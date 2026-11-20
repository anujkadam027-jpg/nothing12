
import type { GarmentProduct } from '../types/poshak';

export interface TryOnGenerationResult {
  image: string;
  seed: number;
}

export const DEFAULT_TRYON_SEED = 42;

/**
 * Generate a random seed for a new try-on attempt.
 */
export function randomTryOnSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

/**
 * Downscale and normalize a person image before upload.
 *
 * Accepts a data URL or image URL.
 * Returns base64 image data and its MIME type.
 */
export async function preparePersonPhoto(
  imageSource: string,
  maxSide = 1536
): Promise<{ dataUrl: string; mimeType: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();

    element.onload = () => resolve(element);
    element.onerror = () => {
      reject(new Error('Unable to load the selected model image.'));
    };

    element.src = imageSource;
  });

  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error('The selected model image is invalid.');
  }

  const scale = Math.min(
    1,
    maxSide / Math.max(img.naturalWidth, img.naturalHeight)
  );

  const canvas = document.createElement('canvas');

  canvas.width = Math.max(
    1,
    Math.round(img.naturalWidth * scale)
  );

  canvas.height = Math.max(
    1,
    Math.round(img.naturalHeight * scale)
  );

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to prepare the model image for upload.');
  }

  // Use a white background to flatten transparency.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.drawImage(
    img,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  return {
    dataUrl,
    mimeType: 'image/jpeg',
  };
}

/**
 * Convert a data URL into base64 without its MIME prefix.
 */
function extractBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');

  if (commaIndex === -1) {
    throw new Error('Invalid image data.');
  }

  return dataUrl.slice(commaIndex + 1);
}

type GenerateRequest =
  | {
      mode: 'upload';
      product: GarmentProduct;
      personImageBase64: string;
      personMimeType: string;
      seed?: number;
    }
  | {
      mode: 'model';
      product: GarmentProduct;
      dummyId: string;
      seed?: number;
    };

/**
 * Sends a try-on request to the Poshak backend.
 *
 * Upload mode uses the supplied person image.
 * Model mode uses a Hugging Face preset model.
 */
export async function generateTryOn(
  req: GenerateRequest,
  signal?: AbortSignal
): Promise<TryOnGenerationResult> {
  const { product, ...requestData } = req;

  if (req.mode === 'upload') {
    if (!req.personImageBase64) {
      throw new Error('Please provide a person image for try-on.');
    }

    if (!req.personMimeType) {
      throw new Error('Person image MIME type is missing.');
    }
  }

  let response: Response;

  try {
    response = await fetch('/api/tryon/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...requestData,
        productId: product.id,
      }),
      signal,
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw error;
    }

    throw new Error(
      'Could not reach the Poshak server. Check your connection and try again.'
    );
  }

  const body = (await response.json().catch(() => null)) as
    | {
        image?: string;
        seed?: number;
        error?: string;
      }
    | null;

  if (!response.ok || !body?.image) {
    throw new Error(
      body?.error ||
        `Try-on request failed (HTTP ${response.status}).`
    );
  }

  return {
    image: body.image,
    seed: body.seed ?? req.seed ?? DEFAULT_TRYON_SEED,
  };
}

/**
 * Download a generated try-on image.
 */
export function downloadDataUrl(
  dataUrl: string,
  filename: string
): void {
  const anchor = document.createElement('a');

  anchor.href = dataUrl;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Generate a filename for the try-on result.
 */
export function tryOnFilename(
  product: GarmentProduct,
  dataUrl: string
): string {
  const mimeType = /^data:image\/([\w.+-]+);base64,/i.exec(dataUrl)?.[1];

  const extension =
    mimeType?.toLowerCase() === 'jpeg'
      ? 'jpg'
      : mimeType?.toLowerCase() || 'png';

  return `poshak-tryon-${product.id}.${extension}`;
}
