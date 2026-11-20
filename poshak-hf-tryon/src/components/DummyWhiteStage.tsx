
import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Eye,
  Loader2,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { DUMMY_MODELS } from '../data/catalog';

import {
  DEFAULT_TRYON_SEED,
  downloadDataUrl,
  generateTryOn,
  preparePersonPhoto,
  randomTryOnSeed,
  tryOnFilename,
} from '../services/tryonService';

import type {
  BodyParameters,
  DummyModel,
  FitAnalysisResult,
  GarmentProduct,
} from '../types/poshak';

import {
  SPACE_CATEGORY_UNSUPPORTED_MESSAGE,
  resolveSpaceCategory,
} from '../utils/hfTryOn';

interface DummyWhiteStageProps {
  garment: GarmentProduct;
  bodyParams: BodyParameters;
  selectedDummyId: string;
  onSelectDummy: (id: string) => void;
  onAnalysisUpdate: (analysis: FitAnalysisResult | null) => void;
  onCaptureLook: (previewDataUrl: string) => void;
}

const FEMALE_MODEL_ID = 'dummy-woman';
const MALE_MODEL_ID = 'dummy-man';

export const DummyWhiteStage: React.FC<DummyWhiteStageProps> = ({
  garment,
  bodyParams,
  selectedDummyId,
  onSelectDummy,
  onAnalysisUpdate,
  onCaptureLook,
}) => {
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const generationCountRef = useRef(0);

  const [renderedDataUrl, setRenderedDataUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [showBaseDummy, setShowBaseDummy] = useState(false);
  const [showFabricLoupe, setShowFabricLoupe] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Only allow the two supported studio models.
  const availableModels = DUMMY_MODELS.filter(
    (model) =>
      model.id === FEMALE_MODEL_ID ||
      model.id === MALE_MODEL_ID
  );

  const activeDummy: DummyModel =
    availableModels.find((model) => model.id === selectedDummyId) ??
    availableModels.find((model) => model.id === FEMALE_MODEL_ID) ??
    availableModels[0];

  const unsupportedCategory =
    resolveSpaceCategory(garment) === null;

  const cancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    setRendering(false);
  };

  // Reset generated output when the garment or selected model changes.
  useEffect(() => {
    cancelGeneration();
    setRenderedDataUrl('');
    setGenerateError('');
    setShowBaseDummy(false);
    generationCountRef.current = 0;

    return () => {
      abortRef.current?.abort();
    };
  }, [activeDummy.id, garment.id]);

  // Fetch stylist fit analysis.
  useEffect(() => {
    let cancelled = false;

    void fetch('/api/tryon/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: garment.id,
        bodyParams,
      }),
    })
      .then((response) =>
        response.ok ? response.json() : null
      )
      .then((data: FitAnalysisResult | null) => {
        if (!cancelled) {
          onAnalysisUpdate(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          onAnalysisUpdate(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [garment.id, bodyParams, onAnalysisUpdate]);

  const handleGenerate = async () => {
    if (inFlightRef.current) return;

    if (unsupportedCategory) {
      setGenerateError(SPACE_CATEGORY_UNSUPPORTED_MESSAGE);
      return;
    }

    if (!activeDummy) {
      setGenerateError('No studio model is available.');
      return;
    }

    inFlightRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    setRendering(true);
    setGenerateError('');

    const seed =
      generationCountRef.current === 0
        ? DEFAULT_TRYON_SEED
        : randomTryOnSeed();

    try {
      // Prepare the currently selected male or female model image.
      const preparedPerson = await preparePersonPhoto(
        activeDummy.imageUrl
      );

      if (controller.signal.aborted) return;

      const commaIndex = preparedPerson.dataUrl.indexOf(',');

      if (commaIndex === -1) {
        throw new Error('Unable to prepare the selected model image.');
      }

      const personImageBase64 =
        preparedPerson.dataUrl.slice(commaIndex + 1);

      // Send the selected model image to the upload endpoint.
      const result = await generateTryOn(
        {
          mode: 'upload',
          product: garment,
          personImageBase64,
          personMimeType: preparedPerson.mimeType,
          seed,
        },
        controller.signal
      );

      if (controller.signal.aborted) return;

      generationCountRef.current += 1;
      setRenderedDataUrl(result.image);
      setShowBaseDummy(false);
    } catch (error) {
      if (controller.signal.aborted) return;

      setGenerateError(
        error instanceof Error
          ? error.message
          : 'Try-on generation failed.'
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        inFlightRef.current = false;
        setRendering(false);
      }
    }
  };

  if (!activeDummy) {
    return (
      <p className="text-center text-sm text-red-700">
        No female or male studio model is configured in the catalog.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Model selector and action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E1D8] bg-white px-3 py-2">

        <div className="flex items-center gap-1.5">
          {availableModels.map((model) => {
            const selected = model.id === activeDummy.id;
            const label =
              model.id === FEMALE_MODEL_ID
                ? 'Female'
                : 'Male';

            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onSelectDummy(model.id)}
                aria-pressed={selected}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  selected
                    ? 'bg-[#171717] text-white'
                    : 'bg-[#F3F1EC] text-[#57544E] hover:bg-[#E7E3DA]'
                }`}
              >
                {label}
              </button>
            );
          })}

          <span className="ml-1 text-[11px] text-[#78736A]">
            {activeDummy.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">

          {renderedDataUrl && (
            <button
              type="button"
              onClick={() =>
                setShowBaseDummy((value) => !value)
              }
              aria-pressed={showBaseDummy}
              className="inline-flex items-center gap-1 rounded-lg border border-[#DDD8CE] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#171717] hover:border-[#171717]"
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              <span>
                {showBaseDummy ? 'Dressed' : 'Compare'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={rendering || unsupportedCategory}
            className="inline-flex items-center gap-1 rounded-lg bg-[#171717] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#2C2C2C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {renderedDataUrl ? (
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Sparkles
                className="h-3 w-3 text-[#D6B889]"
                aria-hidden="true"
              />
            )}

            <span>
              {rendering
                ? 'Generating…'
                : renderedDataUrl
                  ? 'Try Again'
                  : 'Generate Try-On'}
            </span>
          </button>

          {renderedDataUrl && (
            <>
              <button
                type="button"
                onClick={() =>
                  downloadDataUrl(
                    renderedDataUrl,
                    tryOnFilename(garment, renderedDataUrl)
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[#DDD8CE] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#171717] hover:border-[#171717]"
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                <span>Download</span>
              </button>

              <button
                type="button"
                onClick={() => onCaptureLook(renderedDataUrl)}
                className="rounded-lg bg-[#171717] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#2C2C2C]"
              >
                Save Look
              </button>
            </>
          )}
        </div>
      </div>

      {/* Single studio viewport */}
      <div
        data-testid="dummy-white-stage"
        className="relative mx-auto aspect-[3/4] w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white"
      >
        <div
          className="h-full w-full transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel})`,
          }}
        >
          <img
            src={
              showBaseDummy || !renderedDataUrl
                ? activeDummy.imageUrl
                : renderedDataUrl
            }
            alt={
              renderedDataUrl && !showBaseDummy
                ? `${garment.name} on ${activeDummy.name}`
                : `${activeDummy.name} studio model`
            }
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
          />
        </div>

        {/* Zoom controls */}
        <div className="absolute left-3.5 top-1/2 flex -translate-y-1/2 flex-col gap-2">

          <button
            type="button"
            onClick={() =>
              setZoomLevel((value) =>
                Math.min(1.4, Number((value + 0.15).toFixed(2)))
              )
            }
            aria-label="Zoom in studio preview"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E1D8] bg-white text-[#171717] shadow-sm hover:border-[#171717]"
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() =>
              setZoomLevel((value) =>
                Math.max(1, Number((value - 0.15).toFixed(2)))
              )
            }
            aria-label="Zoom out studio preview"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E1D8] bg-white text-[#171717] shadow-sm hover:border-[#171717]"
          >
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

        </div>

        {/* Fabric detail */}
        {showFabricLoupe ? (
          <button
            type="button"
            onClick={() => setShowFabricLoupe(false)}
            title="Hide fabric detail"
            aria-label="Hide fabric detail preview"
            className="group absolute right-3.5 top-3.5 h-20 w-20 overflow-hidden rounded-full border-2 border-white shadow-md ring-1 ring-[#D4CFC4]"
          >
            <img
              src={garment.imageUrl}
              alt={`${garment.fabric} close-up`}
              className="h-full w-full scale-[2.2] object-cover transition-transform duration-200 group-hover:scale-[2.5]"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowFabricLoupe(true)}
            className="absolute right-3.5 top-3.5 rounded-lg border border-[#DDD8CE] bg-white px-2.5 py-1 text-[11px] font-medium text-[#171717] shadow-sm hover:border-[#171717]"
          >
            Weave Loupe
          </button>
        )}

        {/* Generation overlay */}
        {rendering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 px-6 text-center">
            <Loader2
              className="h-6 w-6 animate-spin text-[#171717]"
              aria-hidden="true"
            />

            <p className="mt-2 text-xs font-medium text-[#171717]">
              Dressing {activeDummy.name} with your selected garment…
            </p>

            <p className="mt-1 text-[11px] text-[#625F59]">
              The first request may take a minute while the AI model loads.
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      {unsupportedCategory && (
        <p className="text-center text-[11px] font-medium text-[#8C2F2F]">
          {SPACE_CATEGORY_UNSUPPORTED_MESSAGE}
        </p>
      )}

      {generateError && (
        <p
          role="alert"
          className="text-center text-[11px] font-medium text-[#8C2F2F]"
        >
          {generateError}
        </p>
      )}

      <p className="text-center text-[11px] text-[#78736A]">
        {renderedDataUrl
          ? `AI-generated try-on using the ${activeDummy.name} studio image as the person input.`
          : `Select Female or Male, then generate your try-on with ${activeDummy.name}.`}
      </p>
    </div>
  );
};
