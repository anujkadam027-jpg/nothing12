import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { Client, handle_file } from '@gradio/client';
import { GARMENTS } from './src/data/catalog';
import {
  DUMMY_TO_SPACE_MODEL,
  SPACE_CATEGORY_UNSUPPORTED_MESSAGE,
  SPACE_PHOTO_TYPE,
  resolveSpaceCategory,
} from './src/utils/hfTryOn';
import { DEFAULT_BODY_PARAMS, recommendSize } from './src/utils/tryonMath';
import type { BodyParameters, FitAnalysisResult, OrderRecord, StoreRequest } from './src/types/poshak';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '12mb' }));

// In-memory store requests & placed orders log
const storeRequests: StoreRequest[] = [];
const placedOrders: OrderRecord[] = [];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'poshak-atelier-api' });
});

app.get('/api/catalog', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const items = category ? GARMENTS.filter((g) => g.category === category) : GARMENTS;
  res.json({ items, total: items.length });
});

/**
 * Server-side multimodal fit & silhouette analysis using gemini-4-hydrogen.
 * Analyzes subject photo + garment image + body measurements to return
 * honest stylist guidance, harmony score, and anchor fine-tuning.
 */
app.post('/api/tryon/analyze', async (req, res) => {
  const { productId, personImageBase64, personMimeType, bodyParams } = req.body as {
    productId?: string;
    personImageBase64?: string;
    personMimeType?: string;
    bodyParams?: BodyParameters;
  };

  const product = GARMENTS.find((g) => g.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found in Poshak catalog.' });
  }

  const safeParams = bodyParams ?? DEFAULT_BODY_PARAMS;
  const recommendedSize = recommendSize(product.category, safeParams);

  const fallbackResult: FitAnalysisResult = {
    source: 'local',
    recommendedSize,
    harmonyScore: 91,
    lightingMatch: 'Soft diffused daylight studio balance',
    stylingNote: `${product.name} in ${product.color.name} pairs cleanly with ${safeParams.fitPreference.toLowerCase()} tailoring proportions (${recommendedSize}).`,
    anchorAdjustment: {
      scaleFactor: 1.0,
      yOffset: 0,
    },
  };

  const ai = getGeminiClient();
  if (!ai) {
    return res.json(fallbackResult);
  }

  try {
    const garmentPublicPath = path.resolve(__dirname, 'public', product.imageUrl.replace(/^\//, ''));
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

    if (personImageBase64 && personMimeType) {
      const cleaned = personImageBase64.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          data: cleaned,
          mimeType: personMimeType,
        },
      });
    }

    if (fs.existsSync(garmentPublicPath)) {
      const garmentBuf = fs.readFileSync(garmentPublicPath);
      parts.push({
        inlineData: {
          data: garmentBuf.toString('base64'),
          mimeType: 'image/jpeg',
        },
      });
    }

    parts.push({
      text: `You are a luxury fashion atelier stylist for Poshak. Analyze the subject image and the selected garment (${product.name}, ${product.categoryLabel}, fabric: ${product.fabric}, color: ${product.color.name}). Customer parameters: chest ${safeParams.chestCm}cm, waist ${safeParams.waistCm}cm, hips ${safeParams.hipsCm}cm, height ${safeParams.heightCm}cm, fit preference ${safeParams.fitPreference}. Provide a concise styling note (max 24 words), lighting match description (max 10 words), harmony score (75-99), and slight anchor scale factor (0.94 to 1.06) and yOffset (-0.03 to 0.03) for draping.`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            harmonyScore: { type: Type.INTEGER },
            lightingMatch: { type: Type.STRING },
            stylingNote: { type: Type.STRING },
            scaleFactor: { type: Type.NUMBER },
            yOffset: { type: Type.NUMBER },
          },
          required: ['harmonyScore', 'lightingMatch', 'stylingNote', 'scaleFactor', 'yOffset'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      harmonyScore?: number;
      lightingMatch?: string;
      stylingNote?: string;
      scaleFactor?: number;
      yOffset?: number;
    };

    const result: FitAnalysisResult = {
      source: 'gemini',
      recommendedSize,
      harmonyScore: Math.min(99, Math.max(70, Math.round(parsed.harmonyScore ?? 92))),
      lightingMatch: parsed.lightingMatch || fallbackResult.lightingMatch,
      stylingNote: parsed.stylingNote || fallbackResult.stylingNote,
      anchorAdjustment: {
        scaleFactor: Math.min(1.08, Math.max(0.92, Number(parsed.scaleFactor ?? 1.0))),
        yOffset: Math.min(0.04, Math.max(-0.04, Number(parsed.yOffset ?? 0))),
      },
    };

    return res.json(result);
  } catch (err) {
    console.warn('Gemini fit analysis fallback engaged:', err instanceof Error ? err.message : err);
    return res.json(fallbackResult);
  }
});

/**
 * Real virtual try-on inference via the Hugging Face Space
 * AnujArunKadam/fashn-virtual-tryon (Gradio). Endpoints (from the Space's app.py):
 *   /upload_tryon (person_image, garment_image, category, photo_type, steps, seed)
 *   /model_tryon  (model_choice,  garment_image, category, photo_type, steps, seed)
 * The HF token (HF_TOKEN) stays on this server and is never sent to the browser.
 */
const HF_SPACE_ID = process.env.HF_SPACE_ID || 'AnujArunKadam/fashn-virtual-tryon';
const HF_TRYON_TIMEOUT_MS = 5 * 60 * 1000;
const TRYON_STEPS = 20; // Space default (slider range 10–50)
const PERSON_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const PERSON_MAX_BYTES = 10 * 1024 * 1024;

class TryOnHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.detail === 'string' && o.detail) return o.detail;
    try {
      return JSON.stringify(err);
    } catch {
      /* fall through */
    }
  }
  return 'Unknown error';
}

function mapInferenceError(err: unknown): TryOnHttpError {
  if (err instanceof TryOnHttpError) return err;
  const raw = extractErrorMessage(err);
  const lower = raw.toLowerCase();
  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return new TryOnHttpError(
      429,
      `The try-on GPU quota is exhausted right now. Please try again later. (${raw})`
    );
  }
  if (
    lower.includes('sleep') ||
    lower.includes('paused') ||
    lower.includes('building') ||
    lower.includes('starting') ||
    lower.includes('could not get space status') ||
    lower.includes('space metadata')
  ) {
    return new TryOnHttpError(
      503,
      `The try-on model Space is starting up or unavailable. Please retry in a minute. (${raw})`
    );
  }
  if (lower.includes('zerogpu') || lower.includes('gpu')) {
    return new TryOnHttpError(503, `No GPU is available for the try-on model right now. Please retry. (${raw})`);
  }
  if (lower.includes('timed out')) {
    return new TryOnHttpError(504, 'The try-on model took too long to respond. Please try again.');
  }
  return new TryOnHttpError(502, `Try-on generation failed: ${raw}`);
}

function decodeBase64Image(input: string, mime: string): Buffer {
  if (!PERSON_ALLOWED_MIME.includes(mime)) {
    throw new TryOnHttpError(400, 'Please upload a JPEG, PNG, or WebP photograph.');
  }
  const cleaned = input.replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length < 1024) {
    throw new TryOnHttpError(400, 'Uploaded photo appears empty or corrupted.');
  }
  if (buf.length > PERSON_MAX_BYTES) {
    throw new TryOnHttpError(400, 'Photo exceeds the 10 MB limit.');
  }
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp = buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) {
    throw new TryOnHttpError(400, 'Uploaded file is not a valid JPEG, PNG, or WebP image.');
  }
  return buf;
}

function guessMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

let hfClientPromise: Promise<Client> | null = null;
function getHfClient(): Promise<Client> {
  if (!hfClientPromise) {
    const token = process.env.HF_TOKEN?.trim();
    // The token option name differs between @gradio/client majors (hf_token / token);
    // both are passed so the installed version picks up whichever it supports.
    const options = token ? { hf_token: token, token } : {};
    hfClientPromise = Client.connect(HF_SPACE_ID, options as Parameters<typeof Client.connect>[1]).catch((err) => {
      hfClientPromise = null; // allow a clean retry (e.g. Space was sleeping)
      throw err;
    });
  }
  return hfClientPromise;
}

app.post('/api/tryon/generate', async (req, res) => {
  const { mode, productId, personImageBase64, personMimeType, dummyId, seed } = req.body as {
    mode?: 'upload' | 'model';
    productId?: string;
    personImageBase64?: string;
    personMimeType?: string;
    dummyId?: string;
    seed?: number;
  };

  try {
    if (mode !== 'upload' && mode !== 'model') {
      throw new TryOnHttpError(400, "mode must be 'upload' or 'model'.");
    }

    const product = GARMENTS.find((g) => g.id === productId);
    if (!product) throw new TryOnHttpError(404, 'Product not found in Poshak catalog.');

    const category = resolveSpaceCategory(product);
    if (!category) throw new TryOnHttpError(422, SPACE_CATEGORY_UNSUPPORTED_MESSAGE);

    // The actual catalogue garment image for this product (never a substitute).
    const publicDir = path.resolve(__dirname, 'public');
    const garmentPath = path.resolve(publicDir, product.imageUrl.replace(/^\//, ''));
    if (!garmentPath.startsWith(publicDir + path.sep) || !fs.existsSync(garmentPath)) {
      throw new TryOnHttpError(500, `Garment image for ${product.name} could not be found on the server.`);
    }
    const garmentBlob = new Blob([fs.readFileSync(garmentPath)], { type: guessMime(garmentPath) });

    const safeSeed = Number.isFinite(seed) ? Math.max(0, Math.min(2147483647, Math.floor(seed as number))) : 42;

    let endpoint: string;
    let params: Record<string, unknown>;
    if (mode === 'upload') {
      if (!personImageBase64 || !personMimeType) {
        throw new TryOnHttpError(400, 'A personal photograph is required for photo try-on.');
      }
      const personBuf = decodeBase64Image(personImageBase64, personMimeType);
      endpoint = '/upload_tryon';
      params = {
        person_image: handle_file(new Blob([personBuf], { type: personMimeType })),
        garment_image: handle_file(garmentBlob),
        category,
        photo_type: SPACE_PHOTO_TYPE,
        steps: TRYON_STEPS,
        seed: safeSeed,
      };
    } else {
      const modelChoice = dummyId ? DUMMY_TO_SPACE_MODEL[dummyId] : undefined;
      if (!modelChoice) {
        throw new TryOnHttpError(
          400,
          'The AI try-on model only offers the Female and Male preset models (the mannequin is not available).'
        );
      }
      endpoint = '/model_tryon';
      params = {
        model_choice: modelChoice,
        garment_image: handle_file(garmentBlob),
        category,
        photo_type: SPACE_PHOTO_TYPE,
        steps: TRYON_STEPS,
        seed: safeSeed,
      };
    }

    const client = await getHfClient();
    let timer: NodeJS.Timeout | undefined;
    const result = await Promise.race([
      client.predict(endpoint, params),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Try-on request timed out')), HF_TRYON_TIMEOUT_MS);
      }),
    ]).finally(() => timer && clearTimeout(timer));

    const out = (result as { data?: unknown[] }).data?.[0] as
      | { url?: string; path?: string }
      | string
      | null
      | undefined;
    const outUrl = typeof out === 'string' ? out : out?.url;
    if (!outUrl) {
      throw new TryOnHttpError(502, 'The try-on model returned no image.');
    }

    const token = process.env.HF_TOKEN?.trim();
    const imgResp = await fetch(outUrl, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (!imgResp.ok) {
      throw new TryOnHttpError(502, `Could not download the generated image (HTTP ${imgResp.status}).`);
    }
    const outMime = imgResp.headers.get('content-type')?.split(';')[0] || 'image/png';
    const outBuf = Buffer.from(await imgResp.arrayBuffer());

    return res.json({
      image: `data:${outMime};base64,${outBuf.toString('base64')}`,
      category,
      photoType: SPACE_PHOTO_TYPE,
      endpoint,
      seed: safeSeed,
      source: 'huggingface-space',
    });
  } catch (err) {
    const mapped = mapInferenceError(err);
    console.warn(`Try-on generation failed [${mapped.status}]:`, extractErrorMessage(err));
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

app.get('/api/requests', (_req, res) => {
  res.json({ requests: storeRequests });
});

app.post('/api/requests', (req, res) => {
  const { customerName, phone, preferredTime, notes, items } = req.body as Partial<StoreRequest>;

  if (!customerName || !customerName.trim() || !phone || !phone.trim()) {
    return res.status(400).json({ error: 'Customer name and phone number are required.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Select at least one garment to request in store.' });
  }

  const created: StoreRequest = {
    id: `PSK-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: customerName.trim(),
    phone: phone.trim(),
    preferredTime: preferredTime?.trim() || 'Today, 4:00 PM – 6:00 PM',
    notes: notes?.trim() || '',
    items,
    status: 'Confirmed',
    createdAt: new Date().toISOString(),
  };

  storeRequests.unshift(created);
  return res.status(201).json({ request: created });
});

app.get('/api/orders', (_req, res) => {
  res.json({ orders: placedOrders });
});

app.post('/api/orders', (req, res) => {
  const {
    customerName,
    phone,
    addressLine,
    city,
    pincode,
    paymentMethod,
    items,
    subtotal,
    discount,
    deliveryFee,
    total,
    promoCode,
    estimatedDelivery,
  } = req.body as Partial<OrderRecord>;

  if (
    !customerName?.trim() ||
    !phone?.trim() ||
    !addressLine?.trim() ||
    !city?.trim() ||
    !pincode?.trim()
  ) {
    return res.status(400).json({ error: 'Complete name, phone, address, city, and pincode are required.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart must contain at least one garment to place an order.' });
  }

  const created: OrderRecord = {
    id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
    customerName: customerName.trim(),
    phone: phone.trim(),
    addressLine: addressLine.trim(),
    city: city.trim(),
    pincode: pincode.trim(),
    paymentMethod: paymentMethod || 'UPI',
    items,
    subtotal: Number(subtotal) || 0,
    discount: Number(discount) || 0,
    deliveryFee: Number(deliveryFee) || 0,
    total: Number(total) || 0,
    promoCode: promoCode?.trim() || undefined,
    status: 'Confirmed',
    estimatedDelivery: estimatedDelivery || 'Tomorrow by 9 PM',
    createdAt: new Date().toISOString(),
  };

  placedOrders.unshift(created);
  return res.status(201).json({ order: created });
});

app.patch('/api/orders/:id/cancel', (req, res) => {
  const order = placedOrders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  order.status = 'Cancelled';
  return res.json({ order });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Poshak server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
