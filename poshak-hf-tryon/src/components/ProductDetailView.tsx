import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Heart,
  ImagePlus,
  MapPin,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
} from 'lucide-react';
import { formatINR } from '../data/catalog';
import type {
  DeliveryLocation,
  GarmentProduct,
  GarmentSize,
  ProductReview,
  TryOnMode,
} from '../types/poshak';
import {
  computeRatingBreakdown,
  getDefaultReviews,
  getProductCommerceMeta,
} from '../utils/commerce';

interface ProductDetailViewProps {
  product: GarmentProduct;
  relatedProducts: GarmentProduct[];
  deliveryLocation: DeliveryLocation;
  userReviews: ProductReview[];
  isWishlisted: boolean;
  onBack: () => void;
  onSelectProduct: (p: GarmentProduct) => void;
  onStartTryOn: (product: GarmentProduct, mode: TryOnMode, size: GarmentSize) => void;
  onAddToBag: (product: GarmentProduct, size: GarmentSize, quantity?: number) => void;
  onBuyNow: (product: GarmentProduct, size: GarmentSize, quantity: number) => void;
  onToggleWishlist: (productId: string) => void;
  onSubmitReview: (review: Omit<ProductReview, 'id' | 'dateLabel' | 'verifiedPurchase'>) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  relatedProducts,
  deliveryLocation,
  userReviews,
  isWishlisted,
  onBack,
  onSelectProduct,
  onStartTryOn,
  onAddToBag,
  onBuyNow,
  onToggleWishlist,
  onSubmitReview,
}) => {
  const [selectedSize, setSelectedSize] = useState<GarmentSize>(
    product.sizes.includes('M') ? 'M' : product.sizes[0]
  );
  const [selectedTryOnMode, setSelectedTryOnMode] = useState<TryOnMode>('dummy');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeImage, setActiveImage] = useState<'studio' | 'matte'>('studio');
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Review form state
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaved, setReviewSaved] = useState(false);

  const meta = useMemo(() => getProductCommerceMeta(product), [product]);
  const allReviews = useMemo(
    () => [...userReviews, ...getDefaultReviews(product)],
    [userReviews, product]
  );
  const ratingStats = useMemo(
    () => computeRatingBreakdown(userReviews, meta.rating, meta.reviewCount),
    [userReviews, meta.rating, meta.reviewCount]
  );

  const handleAdd = (qty = quantity) => {
    onAddToBag(product, selectedSize, qty);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTitle.trim() || !reviewComment.trim()) return;
    onSubmitReview({
      productId: product.id,
      author: reviewAuthor.trim() || 'Poshak Patron',
      rating: reviewRating,
      title: reviewTitle.trim(),
      comment: reviewComment.trim(),
    });
    setReviewAuthor('');
    setReviewTitle('');
    setReviewComment('');
    setReviewRating(5);
    setReviewSaved(true);
    window.setTimeout(() => setReviewSaved(false), 2000);
  };

  const gallerySrc = activeImage === 'matte' && product.matteUrl ? product.matteUrl : product.imageUrl;

  return (
    <main className="poshak-smooth-view mx-auto max-w-[1400px] px-4 py-7 sm:px-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#625F59] hover:text-[#171717] cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Back to Collection</span>
      </button>

      {/* 3-Column Editorial Product Detail Grid */}
      <div className="mt-5 grid grid-cols-1 items-start gap-7 lg:grid-cols-12">
        {/* Left: Thumbnail Strip + Studio Gallery */}
        <div className="flex gap-3 lg:col-span-5">
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setActiveImage('studio')}
              aria-label="Studio view"
              className={`h-16 w-14 overflow-hidden rounded-xl border bg-white cursor-pointer ${
                activeImage === 'studio'
                  ? 'border-[#171717] ring-2 ring-[#9A7B4F]/40'
                  : 'border-[#E5E1D8] hover:border-[#171717]'
              }`}
            >
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            </button>
            {product.matteUrl && (
              <button
                type="button"
                onClick={() => setActiveImage('matte')}
                aria-label="Garment cutout view"
                className={`h-16 w-14 overflow-hidden rounded-xl border bg-white cursor-pointer ${
                  activeImage === 'matte'
                    ? 'border-[#171717] ring-2 ring-[#9A7B4F]/40'
                    : 'border-[#E5E1D8] hover:border-[#171717]'
                }`}
              >
                <img src={product.matteUrl} alt="" className="h-full w-full object-contain p-1" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white aspect-[3/4]">
            <img
              src={gallerySrc}
              alt={`${product.name} portrait`}
              referrerPolicy="no-referrer"
              className={`h-full w-full ${
                activeImage === 'matte' ? 'object-contain p-4 bg-[#F3F1EC]' : 'object-cover'
              }`}
            />
          </div>
        </div>

        {/* Center: Details, Features & Size/Try-On Mode */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#E5E1D8] bg-white p-6 lg:col-span-4">
          <div className="border-b border-[#EFECE6] pb-4">
            <p className="text-[11px] font-semibold tracking-wider text-[#9A7B4F] uppercase">
              Poshak Atelier · {product.categoryLabel}
            </p>
            <h1 className="font-display mt-1.5 text-3xl font-semibold text-[#171717] [text-wrap:balance]">
              {product.name}
            </h1>

            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-[#171717]">
                <span className="font-mono-num">{ratingStats.average}</span>
                <span className="flex items-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3.5 w-3.5 ${
                        n <= Math.round(ratingStats.average)
                          ? 'fill-[#9A7B4F] text-[#9A7B4F]'
                          : 'text-[#DDD8CE]'
                      }`}
                      aria-hidden="true"
                    />
                  ))}
                </span>
              </span>
              <a href="#customer-reviews" className="text-[#9A7B4F] hover:underline">
                {ratingStats.totalCount} ratings
              </a>
            </div>
          </div>

          {/* Price Block */}
          <div className="border-b border-[#EFECE6] pb-3.5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-[#9A7B4F]">−{meta.discountPercent}%</span>
              <span className="font-mono-num text-2xl font-semibold text-[#171717]">
                {formatINR(product.price)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#625F59]">
              M.R.P.: <span className="font-mono-num line-through">{formatINR(meta.mrp)}</span> ·
              Inclusive of all taxes
            </p>
          </div>

          <p className="text-xs leading-relaxed text-[#57544E]">{product.description}</p>

          {/* Size Selector */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#171717]">
                Size: <span className="font-bold">{selectedSize}</span>
              </span>
              <span className="text-[#625F59]">Shade: {product.color.name}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {product.sizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`min-w-[44px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    selectedSize === sz
                      ? 'border-[#171717] bg-[#171717] text-[#FAF9F6]'
                      : 'border-[#DDD8CE] bg-white text-[#171717] hover:border-[#171717]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Product Features with Inline Add to Cart */}
          <div className="rounded-xl border border-[#EFECE6] bg-[#FAF9F6] p-4">
            <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-2.5">
              <p className="text-xs font-semibold tracking-wider text-[#171717] uppercase">
                Product Features
              </p>
              <button
                type="button"
                onClick={() => handleAdd(1)}
                className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-3 py-1 text-[11px] font-semibold text-[#FAF9F6] hover:bg-[#2E2E2E] cursor-pointer"
              >
                <ShoppingBag className="h-3 w-3 text-[#D6B889]" aria-hidden="true" />
                <span>{addedFeedback ? 'Added ✓' : 'Add to Cart'}</span>
              </button>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs text-[#57544E]">
              <li>
                <strong className="text-[#171717]">Fabric:</strong> {product.fabric}
              </li>
              <li>
                <strong className="text-[#171717]">Craft:</strong> {product.craftNote}
              </li>
              <li>
                <strong className="text-[#171717]">Fit:</strong>{' '}
                <span className="capitalize">{product.fitRegion}</span> atelier tailoring · SKU{' '}
                <span className="font-mono-num">{product.sku}</span>
              </li>
              <li>
                <strong className="text-[#171717]">Care:</strong> Dry clean recommended ·
                Complimentary store alterations
              </li>
            </ul>
          </div>

          {/* Try-On Mode Switcher */}
          <div>
            <span className="block text-xs font-semibold text-[#171717]">
              Virtual Try-On Experience
            </span>
            <div
              role="radiogroup"
              aria-label="Virtual try-on mode"
              className="mt-1.5 grid grid-cols-[1fr_1fr_1.28fr] gap-1.5"
            >
              {(
                [
                  { id: 'live', label: '1. Camera', Icon: Camera },
                  { id: 'upload', label: '2. Upload', Icon: ImagePlus },
                  { id: 'dummy', label: '3. Dummy White', Icon: UserRound },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selectedTryOnMode === id}
                  onClick={() => setSelectedTryOnMode(id)}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedTryOnMode === id
                      ? 'border-[#171717] bg-[#171717] text-[#FAF9F6]'
                      : 'border-[#DDD8CE] bg-white text-[#171717] hover:border-[#171717]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Atelier Purchase Box */}
        <aside className="rounded-2xl border border-[#E5E1D8] bg-white p-5 lg:col-span-3">
          <p className="font-mono-num text-2xl font-semibold text-[#171717]">
            {formatINR(product.price)}
          </p>

          <div className="mt-2.5 space-y-1.5 text-xs text-[#57544E]">
            <p className="flex items-start gap-1.5">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[#9A7B4F]" aria-hidden="true" />
              <span>
                <strong className="text-[#2F6F4E]">
                  {product.price >= 1999 ? 'Complimentary delivery' : 'Delivery'}
                </strong>{' '}
                {deliveryLocation.etaLabel}
              </span>
            </p>
            <p className="flex items-center gap-1.5 text-[#625F59]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9A7B4F]" aria-hidden="true" />
              <span>
                Delivering to {deliveryLocation.city} {deliveryLocation.pincode}
              </span>
            </p>
          </div>

          <p className="mt-3 text-xs font-semibold text-[#2F6F4E]">In Stock · Ready to Dispatch</p>

          {/* Quantity Selector */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            <label htmlFor="pdp-qty" className="font-medium text-[#171717]">
              Quantity:
            </label>
            <select
              id="pdp-qty"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-2.5 py-1.5 text-xs font-semibold text-[#171717] cursor-pointer"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Stacked Primary CTAs */}
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleAdd(quantity)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#171717] py-2.5 text-xs font-semibold text-[#FAF9F6] transition-colors hover:bg-[#2E2E2E] cursor-pointer"
            >
              {addedFeedback ? (
                <>
                  <Check className="h-4 w-4 text-[#D6B889]" aria-hidden="true" />
                  <span>Added to Cart</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4 text-[#D6B889]" aria-hidden="true" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onBuyNow(product, selectedSize, quantity)}
              className="flex w-full items-center justify-center rounded-full bg-[#D6B889] py-2.5 text-xs font-semibold text-[#171717] transition-colors hover:bg-[#C8A673] cursor-pointer"
            >
              Buy Now
            </button>

            <button
              type="button"
              onClick={() => onStartTryOn(product, selectedTryOnMode, selectedSize)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#DDD8CE] bg-[#FAF9F6] py-2.5 text-xs font-semibold text-[#171717] transition-colors hover:border-[#9A7B4F] hover:bg-[#F3F1EC] cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
              <span>Try On in Studio</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onToggleWishlist(product.id)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#DDD8CE] bg-white py-2 text-xs font-medium text-[#171717] hover:bg-[#FAF9F6] cursor-pointer"
          >
            <Heart
              className={`h-3.5 w-3.5 ${
                isWishlisted ? 'fill-[#9A7B4F] text-[#9A7B4F]' : 'text-[#625F59]'
              }`}
              aria-hidden="true"
            />
            <span>{isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
          </button>

          <dl className="mt-4 space-y-1.5 border-t border-[#EFECE6] pt-3 text-[11px] text-[#625F59]">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
              <span>14-day easy returns & size exchange</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-[#2F6F4E]" aria-hidden="true" />
              <span>Verified Poshak Atelier craftsmanship</span>
            </div>
          </dl>
        </aside>
      </div>

      {/* Customer Ratings & Interactive Reviews Section */}
      <section
        id="customer-reviews"
        className="mt-10 rounded-2xl border border-[#E5E1D8] bg-white p-6"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Rating Breakdown + Write Review Form */}
          <div className="space-y-6 lg:col-span-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#171717]">
                Patron Reviews
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${
                        n <= Math.round(ratingStats.average)
                          ? 'fill-[#9A7B4F] text-[#9A7B4F]'
                          : 'text-[#DDD8CE]'
                      }`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span className="font-mono-num text-sm font-semibold text-[#171717]">
                  {ratingStats.average} out of 5
                </span>
              </div>
              <p className="mt-1 text-xs text-[#625F59]">
                {ratingStats.totalCount} verified patron ratings
              </p>

              <div className="mt-4 space-y-1.5">
                {ratingStats.distribution.map((row) => (
                  <div key={row.stars} className="flex items-center gap-2 text-xs">
                    <span className="w-10 text-[#625F59]">{row.stars} star</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-[#E5E1D8] bg-[#FAF9F6]">
                      <div
                        className="h-full bg-[#9A7B4F]"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                    <span className="font-mono-num w-9 text-right text-[#625F59]">
                      {row.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleReviewSubmit}
              className="rounded-xl border border-[#EFECE6] bg-[#FAF9F6] p-4"
            >
              <h3 className="text-sm font-semibold text-[#171717]">Review this garment</h3>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Rate ${n} stars`}
                    onClick={() => setReviewRating(n)}
                    className="p-0.5 cursor-pointer"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        n <= reviewRating ? 'fill-[#9A7B4F] text-[#9A7B4F]' : 'text-[#C5BEB0]'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <input
                type="text"
                aria-label="Your name"
                value={reviewAuthor}
                onChange={(e) => setReviewAuthor(e.target.value)}
                placeholder="Your name (optional)"
                className="mt-2.5 w-full rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs focus:border-[#171717] focus:outline-none"
              />
              <input
                type="text"
                aria-label="Review headline"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Headline (e.g., Crisp tailoring and drape)"
                required
                className="mt-2 w-full rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs focus:border-[#171717] focus:outline-none"
              />
              <textarea
                rows={2}
                aria-label="Written review"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your fit or fabric experience..."
                required
                className="mt-2 w-full rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs focus:border-[#171717] focus:outline-none"
              />
              <button
                type="submit"
                className="mt-2.5 w-full rounded-full border border-[#171717] bg-white py-2 text-xs font-semibold text-[#171717] hover:bg-[#F3F1EC] cursor-pointer"
              >
                {reviewSaved ? 'Review Submitted ✓' : 'Submit Review'}
              </button>
            </form>
          </div>

          {/* Reviews List */}
          <div className="space-y-4 lg:col-span-8">
            <h3 className="text-sm font-semibold text-[#171717]">Top reviews from Poshak patrons</h3>
            <div className="divide-y divide-[#EFECE6]">
              {allReviews.map((rev) => (
                <article key={rev.id} className="py-4 first:pt-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171717] text-[10px] font-bold text-[#FAF9F6]">
                      {rev.author.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-semibold text-[#171717]">{rev.author}</span>
                    {rev.verifiedPurchase && (
                      <span className="text-[11px] font-medium text-[#9A7B4F]">
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-3.5 w-3.5 ${
                            n <= rev.rating ? 'fill-[#9A7B4F] text-[#9A7B4F]' : 'text-[#DDD8CE]'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <h4 className="text-xs font-semibold text-[#171717]">{rev.title}</h4>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#78736A]">{rev.dateLabel}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#57544E]">{rev.comment}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* More in Category */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold text-[#171717]">
          More in {product.categoryLabel}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {relatedProducts.slice(0, 4).map((item) => {
            const relMeta = getProductCommerceMeta(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectProduct(item)}
                className="group overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white text-left transition-all hover:border-[#C5BEB0] hover:shadow-md cursor-pointer"
              >
                <div className="aspect-[3/4] overflow-hidden bg-[#F3F1EC]">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-3.5">
                  <p className="truncate text-xs font-semibold text-[#171717] group-hover:text-[#9A7B4F]">
                    {item.name}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[11px]">
                    <Star
                      className="h-3 w-3 fill-[#9A7B4F] text-[#9A7B4F]"
                      aria-hidden="true"
                    />
                    <span className="font-mono-num text-[#171717]">{relMeta.rating}</span>
                    <span className="text-[#78736A]">({relMeta.reviewCount})</span>
                  </div>
                  <p className="font-mono-num mt-1 text-xs font-semibold text-[#171717]">
                    {formatINR(item.price)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
};
