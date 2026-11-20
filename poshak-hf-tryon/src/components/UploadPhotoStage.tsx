import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  DEFAULT_TRYON_SEED,
  downloadDataUrl,
  generateTryOn,
  preparePersonPhoto,
  randomTryOnSeed,
  tryOnFilename,
} from '../services/tryonService';
import type { BodyParameters, FitAnalysisResult, GarmentProduct } from '../types/poshak';
import { loadImage } from '../utils/photoCompositor';
import { SPACE_CATEGORY_UNSUPPORTED_MESSAGE, resolveSpaceCategory } from '../utils/hfTryOn';
import { validateUploadFile } from '../utils/tryonMath';

interface UploadPhotoStageProps {
  garment: GarmentProduct;
  bodyParams: BodyParameters;
  onAnalysisUpdate: (analysis: FitAnalysisResult | null) => void;
  onCaptureLook: (previewDataUrl: string) => void;
}

export const UploadPhotoStage: React.FC<UploadPhotoStageProps> = ({
  garment,
  bodyParams,
  onAnalysisUpdate,
  onCaptureLook,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const generationCountRef = useRef(0);

  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedMime, setUploadedMime] = useState<string>('image/jpeg');
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string>('');
  const [compareSplit, setCompareSplit] = useState<number>(100);

  const unsupportedCategory = resolveSpaceCategory(garment) === null;

  const cancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    setGenerating(false);
  };

  // A generated image belongs to the garment it was made for: reset when the product changes
  useEffect(() => {
    cancelGeneration();
    setResultDataUrl(null);
    setGenerateError('');
    generationCountRef.current = 0;
    setCompareSplit(100);
  }, [garment.id]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleFileSelected = async (file: File) => {
    const check = validateUploadFile(file);
    if (!check.valid) {
      setErrorMsg(check.error || 'Invalid image file.');
      setStatus('error');
      return;
    }

    setErrorMsg('');
    setStatus('processing');

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);

      try {
        await loadImage(dataUrl); // confirms the browser can decode the photo
        cancelGeneration();
        setUploadedDataUrl(dataUrl);
        setUploadedMime(file.type);
        setResultDataUrl(null);
        setGenerateError('');
        generationCountRef.current = 0;
        setCompareSplit(100);
        setStatus('ready');

        // Fetch server-side Gemini fit analysis non-blockingly
        void fetch('/api/tryon/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: garment.id,
            personImageBase64: dataUrl,
            personMimeType: file.type,
            bodyParams,
          }),
        })
          .then((resp) => (resp.ok ? (resp.json() as Promise<FitAnalysisResult>) : null))
          .then((analysis) => {
            if (analysis) onAnalysisUpdate(analysis);
          })
          .catch(() => {
            // Non-blocking analysis
          });
      } catch {
        setStatus('error');
        setErrorMsg('Unable to decode the uploaded photo. Please try a standard JPEG or PNG.');
      }
    };
    reader.onerror = () => {
      setStatus('error');
      setErrorMsg('Unable to read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!uploadedDataUrl || inFlightRef.current) return; // prevents duplicate submissions
    if (unsupportedCategory) {
      setGenerateError(SPACE_CATEGORY_UNSUPPORTED_MESSAGE);
      return;
    }
    inFlightRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setGenerateError('');

    const seed = generationCountRef.current === 0 ? DEFAULT_TRYON_SEED : randomTryOnSeed();
    try {
      const prepared = await preparePersonPhoto(uploadedDataUrl).catch(() => ({
        dataUrl: uploadedDataUrl,
        mimeType: uploadedMime,
      }));
      const result = await generateTryOn(
        {
          mode: 'upload',
          product: garment,
          personImageBase64: prepared.dataUrl,
          personMimeType: prepared.mimeType,
          seed,
        },
        controller.signal
      );
      if (controller.signal.aborted) return;
      generationCountRef.current += 1;
      setResultDataUrl(result.image);
      setCompareSplit(100);
    } catch (err) {
      if (controller.signal.aborted) return;
      setGenerateError(err instanceof Error ? err.message : 'Try-on generation failed.');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        inFlightRef.current = false;
        setGenerating(false);
      }
    }
  };

  const handleDeletePhoto = () => {
    cancelGeneration();
    setUploadedDataUrl(null);
    setResultDataUrl(null);
    setGenerateError('');
    generationCountRef.current = 0;
    setStatus('idle');
    setErrorMsg('');
    onAnalysisUpdate(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Upload front-facing portrait photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileSelected(f);
        }}
        className="sr-only"
      />

      {!uploadedDataUrl ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFileSelected(f);
          }}
          className="mx-auto flex aspect-[3/4] w-full max-w-[520px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D6D0C4] bg-white p-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F1EC] text-[#171717]">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="font-display mt-4 text-2xl font-semibold text-[#171717]">
            Upload Your Portrait
          </h3>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#625F59]">
            Drag and drop a front-facing photo in even daylight, or browse your device. Maximum
            10 MB (JPEG, PNG, WebP).
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#171717] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#2C2C2C] cursor-pointer"
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            <span>Select Photo from Device</span>
          </button>

          {status === 'error' && errorMsg && (
            <p className="mt-3 text-xs font-medium text-[#8C2F2F]">{errorMsg}</p>
          )}

          <div className="mt-8 w-full max-w-sm rounded-xl border border-[#EFECE6] bg-[#FAF9F6] p-4 text-left text-[11px] text-[#625F59]">
            <div className="flex items-center gap-1.5 font-semibold text-[#171717]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
              <span>Photo Guidelines & Privacy</span>
            </div>
            <ul className="mt-2 space-y-1">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-[#9A7B4F]" aria-hidden="true" />
                <span>Stand upright facing forward with visible shoulders</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-[#9A7B4F]" aria-hidden="true" />
                <span>Processed temporarily — never stored or used for training</span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* Top Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E1D8] bg-white px-4 py-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#171717] cursor-pointer"
              >
                Replace Photo
              </button>
              <button
                type="button"
                onClick={handleDeletePhoto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5D3D3] bg-white px-3 py-1.5 text-xs font-medium text-[#8C2F2F] hover:bg-[#FDF6F6] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Delete Photo</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating || unsupportedCategory}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#2C2C2C] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {resultDataUrl ? (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-[#D6B889]" aria-hidden="true" />
                )}
                <span>{generating ? 'Generating…' : resultDataUrl ? 'Try Again' : 'Generate Try-On'}</span>
              </button>
              {resultDataUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => downloadDataUrl(resultDataUrl, tryOnFilename(garment, resultDataUrl))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#171717] cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCaptureLook(resultDataUrl)}
                    className="rounded-lg bg-[#171717] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#2C2C2C] cursor-pointer"
                  >
                    Save Preview Look
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Before / After Comparison Stage */}
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white">
            {/* Base Original Photo */}
            <img
              src={uploadedDataUrl}
              alt="Original uploaded portrait"
              className="h-full w-full object-contain"
            />

            {/* Generated try-on result clipped by comparison slider */}
            {resultDataUrl && (
              <div
                className="absolute inset-0 overflow-hidden bg-white"
                style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}
              >
                <img
                  src={resultDataUrl}
                  alt={`${garment.name} generated try-on on your portrait`}
                  className="h-full w-full object-contain"
                />
              </div>
            )}

            {/* Split Divider Line */}
            {resultDataUrl && compareSplit > 0 && compareSplit < 100 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow"
                style={{ left: `${compareSplit}%` }}
              />
            )}

            {(status === 'processing' || generating) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 px-6 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#171717]" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-[#171717]">
                  {generating
                    ? 'Generating your try-on with the Poshak AI model…'
                    : 'Reading your photo…'}
                </p>
                {generating && (
                  <p className="mt-1 text-[11px] text-[#625F59]">
                    The first request can take a minute while the GPU wakes up.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Comparison Control + status messages */}
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            {resultDataUrl && (
              <div>
                <div className="flex justify-between text-[11px] font-medium text-[#171717]">
                  <label htmlFor="compare-slider">Before / After Comparison</label>
                  <span className="font-mono-num">{compareSplit}%</span>
                </div>
                <input
                  id="compare-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={compareSplit}
                  onChange={(e) => setCompareSplit(Number(e.target.value))}
                  className="mt-1.5 w-full accent-[#171717] cursor-pointer"
                />
              </div>
            )}
            {unsupportedCategory && (
              <p className="text-[11px] font-medium text-[#8C2F2F]">{SPACE_CATEGORY_UNSUPPORTED_MESSAGE}</p>
            )}
            {generateError && (
              <p role="alert" className="text-[11px] font-medium text-[#8C2F2F]">
                {generateError}
              </p>
            )}
            <p className="mt-2.5 text-[11px] text-[#78736A]">
              {resultDataUrl
                ? 'AI-generated try-on. Garment listing remains the source of truth for color, weave, and tailoring.'
                : 'Press Generate Try-On to dress your portrait in the selected garment using the AI model.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
