import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Minus,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { CATEGORIES, GARMENTS, formatINR } from '../data/catalog';
import type {
  BodyParameters,
  CategoryId,
  FitAnalysisResult,
  GarmentProduct,
  GarmentSize,
  TryOnMode,
} from '../types/poshak';
import {
  GARMENT_DRAG_MIME,
  getCircularWindowItems,
  resolveDroppedGarment,
  stepQuickValue,
  wrapCircularIndex,
  type CartItem,
} from '../utils/cartAndFitting';
import { recommendSize } from '../utils/tryonMath';
import { DummyWhiteStage } from './DummyWhiteStage';
import { LiveCameraStage } from './LiveCameraStage';
import { UploadPhotoStage } from './UploadPhotoStage';

interface FittingRoomProps {
  activeProduct: GarmentProduct;
  activeMode: TryOnMode;
  activeSize: GarmentSize;
  bodyParams: BodyParameters;
  cartItems: CartItem[];
  onChangeMode: (mode: TryOnMode) => void;
  onSelectProduct: (product: GarmentProduct) => void;
  onSelectSize: (size: GarmentSize) => void;
  onUpdateBodyParams: (params: BodyParameters) => void;
  onBackToCatalog: () => void;
  onSaveLook: (product: GarmentProduct, size: GarmentSize, mode: TryOnMode, preview?: string) => void;
  onAddToBag: (product: GarmentProduct, size: GarmentSize) => void;
}

export const FittingRoom: React.FC<FittingRoomProps> = ({
  activeProduct,
  activeMode,
  activeSize,
  bodyParams,
  cartItems,
  onChangeMode,
  onSelectProduct,
  onSelectSize,
  onUpdateBodyParams,
  onBackToCatalog,
  onSaveLook,
  onAddToBag,
}) => {
  const [draftParams, setDraftParams] = useState<BodyParameters>(bodyParams);
  const [paramsConfirmed, setParamsConfirmed] = useState(false);
  const [hangerCategory, setHangerCategory] = useState<CategoryId | 'all' | 'cart'>('all');
  const [selectedDummyId, setSelectedDummyId] = useState<string>('dummy-woman');
  const [analysis, setAnalysis] = useState<FitAnalysisResult | null>(null);
  const [showMaterials, setShowMaterials] = useState<boolean>(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Drag & drop + easy fit control states
  const [isDragOverStage, setIsDragOverStage] = useState(false);
  const [dropMessage, setDropMessage] = useState<string>('');
  const [quickScale, setQuickScale] = useState<number>(1.0);
  const [quickVertical, setQuickVertical] = useState<number>(0);

  // Circular left wheel state
  const [wheelIndex, setWheelIndex] = useState<number>(() => {
    const idx = GARMENTS.findIndex((g) => g.id === activeProduct.id);
    return idx >= 0 ? idx : 0;
  });
  const wheelContainerRef = useRef<HTMLElement | null>(null);
  const lastWheelStepRef = useRef<number>(0);

  // Pointer-based drag support alongside HTML5 drag-and-drop
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const pointerDragRef = useRef<{
    product: GarmentProduct;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const [pointerDrag, setPointerDrag] = useState<{
    product: GarmentProduct;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);

  const startPointerDrag = (product: GarmentProduct, clientX: number, clientY: number) => {
    const next = {
      product,
      startX: clientX,
      startY: clientY,
      x: clientX,
      y: clientY,
      active: false,
    };
    pointerDragRef.current = next;
    setPointerDrag(next);
  };

  const recommended = useMemo(
    () => recommendSize(activeProduct.category, bodyParams),
    [activeProduct.category, bodyParams]
  );

  const cartProductIdSet = useMemo(
    () => new Set(cartItems.map((c) => c.product.id)),
    [cartItems]
  );

  const cartWheelProducts = useMemo(() => {
    const unique: GarmentProduct[] = [];
    const seen = new Set<string>();
    for (const item of cartItems) {
      if (!seen.has(item.product.id)) {
        seen.add(item.product.id);
        unique.push(item.product);
      }
    }
    return unique;
  }, [cartItems]);

  const hangerItems = useMemo(() => {
    if (hangerCategory === 'cart') {
      return cartWheelProducts.length > 0 ? cartWheelProducts : GARMENTS;
    }
    if (hangerCategory === 'all') return GARMENTS;
    return GARMENTS.filter((g) => g.category === hangerCategory);
  }, [hangerCategory, cartWheelProducts]);

  // Keep wheelIndex valid and centered on activeProduct if it is in the cart wheel
  useEffect(() => {
    if (cartWheelProducts.length === 0) {
      setWheelIndex(0);
      return;
    }
    const idx = cartWheelProducts.findIndex((g) => g.id === activeProduct.id);
    if (idx >= 0) {
      setWheelIndex(idx);
    } else if (wheelIndex >= cartWheelProducts.length) {
      setWheelIndex(0);
    }
  }, [activeProduct.id, cartWheelProducts]);

  const circularWindow = useMemo(
    () => getCircularWindowItems(cartWheelProducts, wheelIndex, 2),
    [cartWheelProducts, wheelIndex]
  );

  const equipProduct = (item: GarmentProduct, fromDrop = false) => {
    setAnalysis(null);
    onSelectProduct(item);
    if (!item.sizes.includes(activeSize)) {
      onSelectSize(item.sizes.includes('M') ? 'M' : item.sizes[0]);
    }
    const idx = cartWheelProducts.findIndex((g) => g.id === item.id);
    if (idx >= 0) {
      setWheelIndex(idx);
    }
    if (fromDrop) {
      setDropMessage(`Equipped: ${item.name}`);
      window.setTimeout(() => setDropMessage(''), 2200);
    }
  };

  const stepCircularWheel = (delta: number) => {
    if (cartWheelProducts.length === 0) return;
    const nextIndex = wrapCircularIndex(wheelIndex, delta, cartWheelProducts.length);
    setWheelIndex(nextIndex);
    const nextItem = cartWheelProducts[nextIndex];
    if (nextItem) {
      equipProduct(nextItem, false);
    }
  };

  const stepCircularWheelRef = useRef<(delta: number) => void>(() => {});
  stepCircularWheelRef.current = stepCircularWheel;

  useEffect(() => {
    const el = wheelContainerRef.current;
    if (!el) return;
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelStepRef.current < 80) return;
      if (Math.abs(e.deltaY) < 4 && Math.abs(e.deltaX) < 4) return;
      lastWheelStepRef.current = now;
      stepCircularWheelRef.current(e.deltaY >= 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', onNativeWheel);
  }, []);

  useEffect(() => {
    setAnalysis(null);
  }, [activeProduct.id]);

  const isDraggingPointer = Boolean(pointerDrag);

  useEffect(() => {
    if (!isDraggingPointer) return;

    const isInsideDropzone = (clientX: number, clientY: number) => {
      const rect = dropzoneRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    };

    const onPointerMove = (e: PointerEvent) => {
      const curr = pointerDragRef.current;
      if (!curr) return;
      const dist = Math.hypot(e.clientX - curr.startX, e.clientY - curr.startY);
      const active = curr.active || dist > 10;
      const updated = { ...curr, x: e.clientX, y: e.clientY, active };
      pointerDragRef.current = updated;
      setPointerDrag(updated);
      if (active) {
        setIsDragOverStage(isInsideDropzone(e.clientX, e.clientY));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const curr = pointerDragRef.current;
      if (curr?.active && isInsideDropzone(e.clientX, e.clientY)) {
        equipProduct(curr.product, true);
      }
      pointerDragRef.current = null;
      setIsDragOverStage(false);
      setPointerDrag(null);
    };

    const onPointerCancel = () => {
      pointerDragRef.current = null;
      setIsDragOverStage(false);
      setPointerDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [isDraggingPointer]);

  const handleDragStartGarment = (e: React.DragEvent, product: GarmentProduct) => {
    e.dataTransfer.setData(GARMENT_DRAG_MIME, product.id);
    e.dataTransfer.setData('text/plain', product.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleStageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOverStage) setIsDragOverStage(true);
  };

  const handleStageDragLeave = (e: React.DragEvent) => {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragOverStage(false);
  };

  const handleStageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverStage(false);
    const rawId =
      e.dataTransfer.getData(GARMENT_DRAG_MIME) || e.dataTransfer.getData('text/plain');
    const dropped = resolveDroppedGarment(rawId, GARMENTS);
    if (dropped) {
      equipProduct(dropped, true);
    }
  };

  const handleConfirmParams = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBodyParams(draftParams);
    const rec = recommendSize(activeProduct.category, draftParams);
    if (activeProduct.sizes.includes(rec)) {
      onSelectSize(rec);
    }
    setParamsConfirmed(true);
    window.setTimeout(() => setParamsConfirmed(false), 1600);
  };

  const handleCapturePreview = (previewDataUrl: string) => {
    onSaveLook(activeProduct, activeSize, activeMode, previewDataUrl);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1800);
  };

  const handleAddBag = () => {
    onAddToBag(activeProduct, activeSize);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 1600);
  };

  const activeWheelPosition = cartWheelProducts.findIndex((g) => g.id === activeProduct.id);
  const displayWheelNum =
    cartWheelProducts.length === 0
      ? 0
      : activeWheelPosition >= 0
        ? activeWheelPosition + 1
        : Math.min(wheelIndex + 1, cartWheelProducts.length);

  return (
    <main className="poshak-smooth-view mx-auto max-w-[1400px] px-4 py-6 sm:px-8">
      {/* Studio Header + 3-Category Try-On Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E1D8] pb-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#625F59] hover:text-[#171717] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Collection</span>
          </button>
          <span className="text-[#DDD8CE]" aria-hidden="true">
            /
          </span>
          <h1 className="font-display text-2xl font-semibold text-[#171717]">
            Virtual Try-On Studio
          </h1>
        </div>

        {/* Three Try-On Categories Switcher */}
        <div
          role="tablist"
          aria-label="Try-on categories"
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DDD8CE] bg-[#F3F1EC] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'live'}
            onClick={() => onChangeMode('live')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'live'
                ? 'bg-[#171717] text-[#FAF9F6] shadow-xs'
                : 'text-[#57544E] hover:text-[#171717]'
            }`}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            <span>1. Live Camera</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'upload'}
            onClick={() => onChangeMode('upload')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'upload'
                ? 'bg-[#171717] text-[#FAF9F6] shadow-xs'
                : 'text-[#57544E] hover:text-[#171717]'
            }`}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>2. Upload Photo</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'dummy'}
            onClick={() => onChangeMode('dummy')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'dummy'
                ? 'bg-[#171717] text-[#FAF9F6] shadow-xs'
                : 'text-[#57544E] hover:text-[#171717]'
            }`}
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span>3. Dummy White</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Studio Workspace: Compact Left Wheel | Expanded Stage | Right Controls */}
      <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)_340px]">
        {/* Left Column: Compact Circular Cart Product Wheel */}
        <section
          ref={wheelContainerRef}
          aria-label="Circular product scroller"
          data-testid="circular-product-wheel"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              stepCircularWheel(-1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              stepCircularWheel(1);
            }
          }}
          className="relative flex flex-col overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white p-3.5 transition-shadow duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#EFECE6] pb-2.5">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold leading-tight text-[#171717]">
                Cart Wheel
              </h2>
              <p className="truncate text-[10px] text-[#78736A]">
                {cartWheelProducts.length > 0
                  ? 'Scroll cart items'
                  : 'Cart items appear here'}
              </p>
            </div>
            <span
              data-testid="wheel-counter"
              className="font-mono-num shrink-0 rounded-full border border-[#E5E1D8] bg-[#FAF9F6] px-2 py-0.5 text-[10px] font-semibold text-[#171717]"
            >
              {displayWheelNum} / {cartWheelProducts.length}
            </span>
          </div>

          {cartWheelProducts.length === 0 ? (
            <div
              data-testid="empty-wheel-state"
              className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDD8CE] bg-[#FAF9F6] px-3 py-6 text-center transition-all duration-300"
            >
              <ShoppingBag className="h-5 w-5 text-[#9A7B4F]" aria-hidden="true" />
              <p className="mt-2 font-display text-base font-semibold text-[#171717]">
                Cart Wheel Empty
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#625F59]">
                Add garments to Cart to spin them here, or pick from On a Hanger below.
              </p>
              <button
                type="button"
                onClick={onBackToCatalog}
                className="mt-3 rounded-full bg-[#171717] px-3.5 py-1.5 text-[11px] font-semibold text-[#FAF9F6] transition-colors duration-200 hover:bg-[#2E2E2E] cursor-pointer"
              >
                Browse Collection
              </button>
            </div>
          ) : (
            <>
              {/* Step Up Button */}
              <div className="mt-2.5 flex justify-center">
                <button
                  type="button"
                  onClick={() => stepCircularWheel(-1)}
                  aria-label="Previous garment in circular list"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DDD8CE] bg-[#FAF9F6] text-[#171717] transition-all duration-200 hover:scale-105 hover:border-[#171717] hover:bg-[#F3F1EC] cursor-pointer"
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Compact Left Circular Arc Track + Medallions */}
              <div className="relative my-2 flex flex-col justify-center gap-1.5 py-1">
                {/* Subtle Left Semicircular Track */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 90 280"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute top-0 left-0 h-full w-14 opacity-55"
                >
                  <path
                    d="M 8 14 Q 54 140 8 266"
                    fill="none"
                    stroke="#DDD8CE"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                </svg>

                {circularWindow.map(({ item, index, offset }) => {
                  const isCenter = offset === 0;
                  const absOffset = Math.abs(offset);

                  const arcTranslate =
                    absOffset === 0
                      ? 'translate-x-3.5 scale-100'
                      : absOffset === 1
                        ? 'translate-x-1.5 scale-[0.98]'
                        : 'translate-x-0 scale-[0.96]';

                  const circleSize =
                    absOffset === 0
                      ? 'h-14 w-14 ring-2 ring-[#D6B889] ring-offset-2 ring-offset-white border-2 border-[#171717]'
                      : absOffset === 1
                        ? 'h-10 w-10 border border-[#DDD8CE] opacity-90'
                        : 'h-9 w-9 border border-[#E5E1D8] opacity-65';

                  return (
                    <div
                      key={`${item.id}-${index}`}
                      draggable
                      onDragStart={(e) => handleDragStartGarment(e, item)}
                      onPointerDown={(e) => startPointerDrag(item, e.clientX, e.clientY)}
                      data-testid={`draggable-wheel-${item.id}`}
                      data-wheel-offset={offset}
                      className={`relative z-10 flex select-none items-center gap-2.5 rounded-xl px-1.5 py-1 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-grab active:cursor-grabbing ${arcTranslate} ${
                        isCenter ? 'bg-[#F3F1EC]/90 shadow-2xs' : 'hover:bg-[#FAF9F6]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setWheelIndex(index);
                          equipProduct(item, false);
                        }}
                        aria-label={`Select ${item.name} in circular list`}
                        aria-pressed={isCenter}
                        className={`relative shrink-0 overflow-hidden rounded-full bg-[#F3F1EC] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${circleSize}`}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          draggable={false}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setWheelIndex(index);
                          equipProduct(item, false);
                        }}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <p
                          className={`truncate transition-colors duration-200 ${
                            isCenter
                              ? 'text-[11px] font-semibold text-[#171717]'
                              : absOffset === 1
                                ? 'text-[10px] font-medium text-[#57544E]'
                                : 'text-[10px] font-normal text-[#78736A]'
                          }`}
                        >
                          {item.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className={`font-mono-num ${
                              isCenter
                                ? 'text-[10px] font-semibold text-[#171717]'
                                : 'text-[10px] text-[#78736A]'
                            }`}
                          >
                            {formatINR(item.price)}
                          </span>
                          {isCenter && (
                            <span className="text-[9px] font-semibold text-[#9A7B4F]">Active</span>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Step Down Button */}
              <div className="flex justify-center border-t border-[#EFECE6] pt-2.5">
                <button
                  type="button"
                  onClick={() => stepCircularWheel(1)}
                  aria-label="Next garment in circular list"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DDD8CE] bg-[#FAF9F6] text-[#171717] transition-all duration-200 hover:scale-105 hover:border-[#171717] hover:bg-[#F3F1EC] cursor-pointer"
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </section>

        {/* Center Column: Expanded Drag-and-Drop Stage + Easy Fit Controls */}
        <div className="flex flex-col gap-3.5">
          <div
            ref={dropzoneRef}
            data-testid="tryon-dropzone"
            onDragOver={handleStageDragOver}
            onDragLeave={handleStageDragLeave}
            onDrop={handleStageDrop}
            className={`relative rounded-2xl border p-3 transition-colors ${
              isDragOverStage
                ? 'border-[#9A7B4F] bg-[#FAF5EB] ring-2 ring-[#9A7B4F]'
                : 'border-[#E5E1D8] bg-[#F7F5F0]'
            }`}
          >
            {(dropMessage || savedToast) && (
              <div className="mb-2 flex items-center justify-end px-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A7B4F]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{dropMessage || 'Saved Look to Atelier'}</span>
                </span>
              </div>
            )}

            {isDragOverStage && (
              <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-[#9A7B4F] bg-[#FAF9F6]/85">
                <p className="font-display text-2xl font-semibold text-[#171717]">
                  Drop Outfit Here to Try On
                </p>
              </div>
            )}

            {activeMode === 'live' && (
              <LiveCameraStage
                garment={activeProduct}
                bodyParams={bodyParams}
                quickScale={quickScale}
                quickVertical={quickVertical}
                onCaptureLook={handleCapturePreview}
              />
            )}

            {activeMode === 'upload' && (
              <UploadPhotoStage
                garment={activeProduct}
                bodyParams={bodyParams}
                quickScale={quickScale}
                quickVertical={quickVertical}
                onAnalysisUpdate={setAnalysis}
                onCaptureLook={handleCapturePreview}
              />
            )}

            {activeMode === 'dummy' && (
              <DummyWhiteStage
                garment={activeProduct}
                bodyParams={bodyParams}
                selectedDummyId={selectedDummyId}
                quickScale={quickScale}
                quickVertical={quickVertical}
                onSelectDummy={setSelectedDummyId}
                onAnalysisUpdate={setAnalysis}
                onCaptureLook={handleCapturePreview}
              />
            )}
          </div>

          {/* Easy Fit Controls Bar (Scale, Position, Reset) */}
          <section
            aria-label="Easy fit controls"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E1D8] bg-white px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#57544E]">Fit Scale</span>
              <div className="inline-flex items-center rounded-lg border border-[#DDD8CE] bg-[#FAF9F6]">
                <button
                  type="button"
                  aria-label="Decrease garment fit scale"
                  onClick={() => setQuickScale((s) => stepQuickValue(s, -0.05, 0.8, 1.3))}
                  className="flex h-8 w-8 items-center justify-center text-[#171717] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="font-mono-num min-w-[44px] text-center text-xs font-semibold text-[#171717]">
                  {Math.round(quickScale * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="Increase garment fit scale"
                  onClick={() => setQuickScale((s) => stepQuickValue(s, 0.05, 0.8, 1.3))}
                  className="flex h-8 w-8 items-center justify-center text-[#171717] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#57544E]">Position</span>
              <div className="inline-flex items-center rounded-lg border border-[#DDD8CE] bg-[#FAF9F6]">
                <button
                  type="button"
                  aria-label="Move garment up"
                  onClick={() => setQuickVertical((v) => stepQuickValue(v, -0.02, -0.1, 0.1))}
                  className="flex h-8 w-8 items-center justify-center text-[#171717] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Move garment down"
                  onClick={() => setQuickVertical((v) => stepQuickValue(v, 0.02, -0.1, 0.1))}
                  className="flex h-8 w-8 items-center justify-center text-[#171717] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setQuickScale(1.0);
                setQuickVertical(0);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-[11px] font-medium text-[#57544E] hover:border-[#171717] hover:text-[#171717] cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </section>
        </div>

        {/* Right Sidebar: "You Are Wearing" + "Your Parameters" */}
        <aside className="flex flex-col gap-5">
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="font-display text-xl font-semibold text-[#171717]">
              You Are Wearing
            </h2>

            <div className="mt-3 flex gap-3.5 border-b border-[#EFECE6] pb-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-[#E7E3DA] bg-[#F3F1EC]">
                <img
                  src={activeProduct.imageUrl}
                  alt={activeProduct.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[#78736A]">
                  {activeProduct.categoryLabel} · {activeProduct.color.name}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#171717]">
                  {activeProduct.name}
                </p>
                <p className="font-mono-num mt-1 text-sm font-semibold text-[#171717]">
                  {formatINR(activeProduct.price)}
                </p>
              </div>
            </div>

            {/* Size Selection */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#57544E]">Size</span>
                <span className="text-[#78736A]">Active: {activeSize}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeProduct.sizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onSelectSize(sz)}
                    className={`min-w-[40px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      activeSize === sz
                        ? 'border-[#171717] bg-[#171717] text-[#FAF9F6]'
                        : 'border-[#DDD8CE] bg-white text-[#171717] hover:border-[#171717]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Atelier Fit Note */}
            {analysis && (
              <div className="mt-4 rounded-xl border border-[#EAE4D7] bg-[#FAF9F6] p-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-[#171717]">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
                    <span>Stylist Note</span>
                  </span>
                  <span className="font-mono-num text-[#9A7B4F]">
                    {analysis.harmonyScore}% Harmony
                  </span>
                </div>
                <p className="mt-1.5 leading-relaxed text-[#57544E]">{analysis.stylingNote}</p>
              </div>
            )}

            {/* Single Clean Materials & Care Toggle */}
            <div className="mt-4 border-t border-b border-[#EFECE6] text-xs">
              <button
                type="button"
                aria-expanded={showMaterials}
                onClick={() => setShowMaterials((v) => !v)}
                className="flex w-full items-center justify-between py-2.5 font-medium text-[#171717] cursor-pointer"
              >
                <span>Materials & care</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showMaterials ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
              {showMaterials && (
                <p className="pb-3 text-[11px] leading-relaxed text-[#625F59]">
                  {activeProduct.fabric}. {activeProduct.craftNote}. Dry clean recommended.
                </p>
              )}
            </div>

            {/* Single Primary Add to Cart CTA */}
            <button
              type="button"
              onClick={handleAddBag}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#171717] py-3 text-xs font-semibold text-[#FAF9F6] transition-colors hover:bg-[#2E2E2E] cursor-pointer"
            >
              {addedFeedback ? (
                <>
                  <Check className="h-4 w-4 text-[#D6B889]" aria-hidden="true" />
                  <span>Added to Cart</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4 text-[#D6B889]" aria-hidden="true" />
                  <span>Add to Cart · {formatINR(activeProduct.price)}</span>
                </>
              )}
            </button>
          </div>

          {/* Card 2: Your Parameters */}
          <form
            data-testid="your-parameters-section"
            onSubmit={handleConfirmParams}
            className="rounded-2xl border border-[#E5E1D8] bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-[#171717]">
                Your Parameters
              </h2>
              <span className="text-xs font-medium text-[#9A7B4F]">
                Suggested: {recommended}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="param-chest" className="block text-[11px] text-[#625F59]">
                  Chest (cm)
                </label>
                <input
                  id="param-chest"
                  type="number"
                  min={72}
                  max={132}
                  value={draftParams.chestCm}
                  onChange={(e) =>
                    setDraftParams((p) => ({ ...p, chestCm: Number(e.target.value) || 94 }))
                  }
                  className="font-mono-num mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="param-waist" className="block text-[11px] text-[#625F59]">
                  Waist (cm)
                </label>
                <input
                  id="param-waist"
                  type="number"
                  min={56}
                  max={120}
                  value={draftParams.waistCm}
                  onChange={(e) =>
                    setDraftParams((p) => ({ ...p, waistCm: Number(e.target.value) || 76 }))
                  }
                  className="font-mono-num mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="param-hips" className="block text-[11px] text-[#625F59]">
                  Hips (cm)
                </label>
                <input
                  id="param-hips"
                  type="number"
                  min={76}
                  max={136}
                  value={draftParams.hipsCm}
                  onChange={(e) =>
                    setDraftParams((p) => ({ ...p, hipsCm: Number(e.target.value) || 96 }))
                  }
                  className="font-mono-num mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="param-height" className="block text-[11px] text-[#625F59]">
                  Height (cm)
                </label>
                <input
                  id="param-height"
                  type="number"
                  min={145}
                  max={205}
                  value={draftParams.heightCm}
                  onChange={(e) =>
                    setDraftParams((p) => ({ ...p, heightCm: Number(e.target.value) || 173 }))
                  }
                  className="font-mono-num mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3">
              <span className="block text-[11px] text-[#625F59]">Silhouette</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(['Slim', 'Regular', 'Relaxed'] as const).map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setDraftParams((p) => ({ ...p, fitPreference: pref }))}
                    className={`rounded-lg border py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      draftParams.fitPreference === pref
                        ? 'border-[#171717] bg-[#171717] text-[#FAF9F6]'
                        : 'border-[#DDD8CE] bg-[#FAF9F6] text-[#57544E] hover:border-[#171717]'
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-[#D6B889] py-2.5 text-xs font-semibold text-[#171717] transition-colors hover:bg-[#C8A673] cursor-pointer"
            >
              {paramsConfirmed ? 'Parameters Applied ✓' : 'Confirm Parameters'}
            </button>
          </form>
        </aside>
      </div>

      {/* Bottom Section (after Your Parameters): "On a Hanger" Wardrobe */}
      <section
        aria-label="On a Hanger wardrobe"
        data-testid="on-a-hanger-section"
        className="mt-6 rounded-2xl border border-[#E5E1D8] bg-white p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFECE6] pb-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#171717]">On a Hanger</h2>
            <p className="mt-0.5 text-xs text-[#78736A]">
              Filter by garment category or cart, then click or drag onto the stage above
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter wardrobe category"
            className="flex flex-wrap items-center gap-2 rounded-full border border-[#EFECE6] bg-[#FAF9F6] px-3 py-1.5"
          >
            <button
              type="button"
              title="All categories"
              aria-label="Show all wardrobe categories"
              aria-pressed={hangerCategory === 'all'}
              onClick={() => {
                setHangerCategory('all');
                setWheelIndex(0);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-semibold transition-all cursor-pointer ${
                hangerCategory === 'all'
                  ? 'border-[#171717] bg-[#171717] text-[#FAF9F6] ring-2 ring-[#9A7B4F]/40'
                  : 'border-[#DDD8CE] bg-white text-[#57544E] hover:border-[#9A7B4F]'
              }`}
            >
              All
            </button>

            {cartItems.length > 0 && (
              <button
                type="button"
                title="In Your Cart"
                aria-label="Show cart outfits"
                aria-pressed={hangerCategory === 'cart'}
                onClick={() => {
                  setHangerCategory('cart');
                  setWheelIndex(0);
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold transition-all cursor-pointer ${
                  hangerCategory === 'cart'
                    ? 'border-[#9A7B4F] bg-[#9A7B4F] text-white'
                    : 'border-[#DDD8CE] bg-white text-[#57544E] hover:border-[#9A7B4F]'
                }`}
              >
                <ShoppingBag className="h-3 w-3" aria-hidden="true" />
                <span>Cart ({cartProductIdSet.size})</span>
              </button>
            )}

            {CATEGORIES.map((cat) => {
              const active = hangerCategory === cat.id;
              const thumb = GARMENTS.find((g) => g.category === cat.id)?.imageUrl;
              return (
                <button
                  key={cat.id}
                  type="button"
                  title={cat.label}
                  aria-label={`Filter wardrobe by ${cat.label}`}
                  aria-pressed={active}
                  onClick={() => {
                    setHangerCategory(cat.id);
                    setWheelIndex(0);
                  }}
                  className={`h-8 w-8 overflow-hidden rounded-full border bg-white transition-all cursor-pointer ${
                    active
                      ? 'border-[#171717] ring-2 ring-[#9A7B4F] ring-offset-1 ring-offset-[#FAF9F6]'
                      : 'border-[#DDD8CE] hover:border-[#9A7B4F]'
                  }`}
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {hangerItems.map((item) => {
            const isActive = item.id === activeProduct.id;
            const inCart = cartProductIdSet.has(item.id);
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStartGarment(e, item)}
                onPointerDown={(e) => startPointerDrag(item, e.clientX, e.clientY)}
                data-testid={`draggable-hanger-${item.id}`}
                className={`select-none overflow-hidden rounded-xl border p-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 cursor-grab active:cursor-grabbing ${
                  isActive
                    ? 'border-[#171717] bg-[#F3F1EC] ring-1 ring-[#171717]'
                    : 'border-[#E7E3DA] bg-[#FAF9F6] hover:border-[#9A7B4F]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => equipProduct(item, false)}
                  aria-label={`Try on ${item.name} (drag or click)`}
                  aria-pressed={isActive}
                  className="block w-full text-left cursor-pointer"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-[#F3F1EC]">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      draggable={false}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    {inCart && (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-[#171717]/85 px-2 py-0.5 text-[9px] font-semibold text-[#FAF9F6]">
                        In Cart
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-[#171717]">{item.name}</p>
                  <p className="font-mono-num text-[11px] text-[#625F59]">
                    {formatINR(item.price)}
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Floating Drag Ghost during pointer drag */}
      {pointerDrag && pointerDrag.active && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-xl border border-[#171717] bg-white/95 px-2.5 py-1.5 shadow-xl"
          style={{ left: pointerDrag.x + 12, top: pointerDrag.y + 12 }}
        >
          <img
            src={pointerDrag.product.imageUrl}
            alt=""
            className="h-10 w-8 rounded object-cover"
          />
          <span className="text-xs font-semibold text-[#171717]">
            {pointerDrag.product.name}
          </span>
        </div>
      )}
    </main>
  );
};
