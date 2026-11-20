import React, { useMemo, useState } from 'react';
import { Check, Heart, LayoutGrid, ShoppingBag, Sparkles, Star, X } from 'lucide-react';
import { CATEGORIES, formatINR } from '../data/catalog';
import type { CategoryId, DeliveryLocation, GarmentProduct } from '../types/poshak';
import { getProductCommerceMeta } from '../utils/commerce';

interface CatalogSectionProps {
  products: GarmentProduct[];
  selectedCategory: CategoryId | 'all';
  searchQuery: string;
  dealsOnly: boolean;
  deliveryLocation: DeliveryLocation;
  cartProductIds: string[];
  onSelectCategory: (cat: CategoryId | 'all') => void;
  onSearchChange: (q: string) => void;
  onToggleDeals: (next: boolean) => void;
  onSelectProduct: (product: GarmentProduct) => void;
  onAddToCart: (product: GarmentProduct) => void;
  onQuickTryOn: (product: GarmentProduct) => void;
  wishlistIds: string[];
  onToggleWishlist: (productId: string) => void;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({
  products,
  selectedCategory,
  searchQuery,
  dealsOnly,
  deliveryLocation,
  cartProductIds,
  onSelectCategory,
  onSearchChange,
  onToggleDeals,
  onSelectProduct,
  onAddToCart,
  onQuickTryOn,
  wishlistIds,
  onToggleWishlist,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'featured' | 'rating-desc' | 'price-asc' | 'price-desc'>(
    'featured'
  );
  const [maxPrice, setMaxPrice] = useState<number>(6500);

  const categoryThumbs = useMemo(() => {
    const map = new Map<CategoryId, string>();
    for (const cat of CATEGORIES) {
      const match = products.find((p) => p.category === cat.id);
      if (match) map.set(cat.id, match.imageUrl);
    }
    return map;
  }, [products]);

  const uniqueColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (!map.has(p.color.name)) {
        map.set(p.color.name, p.color.hex);
      }
    }
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [products]);

  const enrichedProducts = useMemo(
    () => products.map((p) => ({ product: p, meta: getProductCommerceMeta(p) })),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = enrichedProducts.filter(({ product: p, meta }) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (selectedColor !== 'all' && p.color.name !== selectedColor) return false;
      if (p.price > maxPrice) return false;
      if (dealsOnly && !meta.isDeal) return false;
      if (minRating > 0 && meta.rating < minRating) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.fabric.toLowerCase().includes(q) &&
        !p.categoryLabel.toLowerCase().includes(q) &&
        !p.color.name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') return [...list].sort((a, b) => a.product.price - b.product.price);
    if (sortBy === 'price-desc') return [...list].sort((a, b) => b.product.price - a.product.price);
    if (sortBy === 'rating-desc') return [...list].sort((a, b) => b.meta.rating - a.meta.rating);
    return list;
  }, [enrichedProducts, selectedCategory, selectedColor, maxPrice, dealsOnly, minRating, searchQuery, sortBy]);

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedColor !== 'all' ||
    maxPrice < 6500 ||
    dealsOnly ||
    minRating > 0 ||
    searchQuery.trim() !== '';

  const resetFilters = () => {
    onSelectCategory('all');
    onSearchChange('');
    onToggleDeals(false);
    setSelectedColor('all');
    setMinRating(0);
    setMaxPrice(6500);
    setSortBy('featured');
  };

  return (
    <section id="poshak-catalog" className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-8">
      {/* Clean Circular Category & Palette Filter Card */}
      <div className="rounded-2xl border border-[#E5E1D8] bg-white px-5 py-5 sm:px-8">
        {/* Circular Category Medallions */}
        <div
          role="tablist"
          aria-label="Garment categories"
          className="flex flex-wrap items-start justify-center gap-5 border-b border-[#EFECE6] pb-5 sm:gap-8"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => onSelectCategory('all')}
            className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all ${
                selectedCategory === 'all'
                  ? 'border-[#171717] bg-[#171717] text-[#FAF9F6] ring-2 ring-[#9A7B4F] ring-offset-2 ring-offset-white'
                  : 'border-[#DDD8CE] bg-[#FAF9F6] text-[#171717] group-hover:border-[#9A7B4F]'
              }`}
            >
              <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            </span>
            <span
              className={`text-xs whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'font-semibold text-[#171717]'
                  : 'font-medium text-[#625F59] group-hover:text-[#171717]'
              }`}
            >
              All ({products.length})
            </span>
          </button>

          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            const thumb = categoryThumbs.get(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectCategory(cat.id)}
                className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
              >
                <span
                  className={`h-14 w-14 overflow-hidden rounded-full border bg-[#F3F1EC] transition-all ${
                    active
                      ? 'border-[#171717] ring-2 ring-[#9A7B4F] ring-offset-2 ring-offset-white'
                      : 'border-[#DDD8CE] group-hover:border-[#9A7B4F]'
                  }`}
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  )}
                </span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    active
                      ? 'font-semibold text-[#171717]'
                      : 'font-medium text-[#625F59] group-hover:text-[#171717]'
                  }`}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Circular Palette + Clean Editorial Shopping Filters */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3.5">
          {/* Circular Color Palette Swatches */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-semibold tracking-wider text-[#625F59] uppercase">
              Palette
            </span>
            <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-[#E5E1D8] bg-[#FAF9F6] px-2.5 py-1.5">
              {uniqueColors.slice(0, 10).map((c) => {
                const active = selectedColor === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedColor(active ? 'all' : c.name)}
                    title={c.name}
                    aria-label={`Filter by color ${c.name}`}
                    aria-pressed={active}
                    className={`h-5 w-5 rounded-full border transition-transform cursor-pointer ${
                      active
                        ? 'scale-110 border-[#171717] ring-2 ring-[#9A7B4F]'
                        : 'border-[#DDD8CE] hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                );
              })}
            </div>
            {selectedColor !== 'all' && (
              <span className="text-xs font-medium text-[#9A7B4F]">{selectedColor}</span>
            )}
          </div>

          {/* Offers, Rating, Max Price, Sort, Reset */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleDeals(!dealsOnly)}
              aria-pressed={dealsOnly}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                dealsOnly
                  ? 'border-[#9A7B4F] bg-[#9A7B4F] text-white'
                  : 'border-[#DDD8CE] bg-[#FAF9F6] text-[#171717] hover:border-[#171717]'
              }`}
            >
              Seasonal Offers
            </button>

            <button
              type="button"
              onClick={() => setMinRating((r) => (r >= 4.7 ? 0 : 4.7))}
              aria-pressed={minRating >= 4.7}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                minRating >= 4.7
                  ? 'border-[#9A7B4F] bg-[#FBF7EF] text-[#171717]'
                  : 'border-[#DDD8CE] bg-[#FAF9F6] text-[#171717] hover:border-[#171717]'
              }`}
            >
              <Star className="h-3.5 w-3.5 fill-[#9A7B4F] text-[#9A7B4F]" aria-hidden="true" />
              <span>4.7★ & Up</span>
            </button>

            <div className="flex items-center gap-2 rounded-full border border-[#E5E1D8] bg-[#FAF9F6] px-3 py-1.5">
              <label htmlFor="price-range" className="text-[11px] font-medium text-[#625F59]">
                Max
              </label>
              <input
                id="price-range"
                type="range"
                min={1000}
                max={6500}
                step={500}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-24 accent-[#171717] cursor-pointer"
              />
              <span className="font-mono-num min-w-[54px] text-[11px] font-semibold text-[#171717]">
                {formatINR(maxPrice)}
              </span>
            </div>

            <select
              id="sort-select"
              aria-label="Sort garments"
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'featured' | 'rating-desc' | 'price-asc' | 'price-desc'
                )
              }
              className="rounded-full border border-[#DDD8CE] bg-white px-3.5 py-1.5 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none cursor-pointer"
            >
              <option value="featured">Sort: Featured</option>
              <option value="rating-desc">Avg. Customer Review</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs font-medium text-[#625F59] hover:border-[#171717] hover:text-[#171717] cursor-pointer"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="mt-7">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-3xl font-semibold text-[#171717]">
            {dealsOnly
              ? 'Atelier Seasonal Offers'
              : selectedCategory === 'all'
                ? 'The Complete Collection'
                : CATEGORIES.find((c) => c.id === selectedCategory)?.label}
          </h2>
          <span className="text-xs text-[#625F59]">
            <span className="font-mono-num font-semibold text-[#171717]">
              {filteredProducts.length}
            </span>{' '}
            pieces · Delivering to {deliveryLocation.city} {deliveryLocation.pincode}
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-12 text-center">
            <p className="font-display text-2xl font-semibold text-[#171717]">
              No garments match those filters
            </p>
            <p className="mt-2 text-xs text-[#625F59]">
              Clear your search or filters to view all 36 Poshak pieces.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 rounded-full bg-[#171717] px-6 py-2.5 text-xs font-semibold text-[#FAF9F6] hover:bg-[#2E2E2E] cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div
            data-testid="catalog-grid"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {filteredProducts.map(({ product, meta }) => {
              const isWishlisted = wishlistIds.includes(product.id);
              const inCart = cartProductIds.includes(product.id);
              return (
                <article
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-[#C5BEB0] hover:shadow-md"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#F3F1EC]">
                    <button
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      aria-label={`Inspect ${product.name}`}
                      className="block h-full w-full cursor-pointer focus:outline-none"
                    >
                      <img
                        src={product.imageUrl}
                        alt={`${product.name} in ${product.color.name}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                      />
                    </button>

                    {meta.isBestSeller ? (
                      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-[#171717]/90 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#FAF9F6]">
                        Atelier Signature
                      </span>
                    ) : meta.isDeal ? (
                      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-[#9A7B4F] px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        {meta.discountPercent}% off
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onToggleWishlist(product.id)}
                      aria-label={
                        isWishlisted
                          ? `Remove ${product.name} from saved looks`
                          : `Save ${product.name}`
                      }
                      aria-pressed={isWishlisted}
                      className={`absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E1D8] bg-white/95 text-[#171717] transition-opacity hover:border-[#171717] cursor-pointer ${
                        isWishlisted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                      }`}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${
                          isWishlisted ? 'fill-[#9A7B4F] text-[#9A7B4F]' : 'text-[#57544E]'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectProduct(product)}
                        className="line-clamp-2 text-left text-sm font-semibold text-[#171717] hover:text-[#9A7B4F] cursor-pointer"
                      >
                        {product.name}
                      </button>

                      {/* Rating + Shade */}
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        <span className="inline-flex items-center gap-0.5 font-semibold text-[#171717]">
                          <Star
                            className="h-3.5 w-3.5 fill-[#9A7B4F] text-[#9A7B4F]"
                            aria-hidden="true"
                          />
                          <span className="font-mono-num">{meta.rating.toFixed(1)}</span>
                        </span>
                        <span className="font-mono-num text-[#78736A]">({meta.reviewCount})</span>
                        <span className="text-[#DDD8CE]" aria-hidden="true">
                          ·
                        </span>
                        <span className="truncate text-[11px] text-[#625F59]">
                          {product.color.name}
                        </span>
                      </div>

                      {/* Price + MRP */}
                      <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
                        <span className="font-mono-num text-sm font-semibold text-[#171717]">
                          {formatINR(product.price)}
                        </span>
                        <span className="font-mono-num text-[11px] text-[#78736A] line-through">
                          {formatINR(meta.mrp)}
                        </span>
                        <span className="text-[11px] font-medium text-[#9A7B4F]">
                          ({meta.discountPercent}% off)
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] text-[#625F59]">
                        <span className="font-medium text-[#2F6F4E]">
                          {product.price >= 1999 ? 'Complimentary delivery' : 'Delivery'}
                        </span>{' '}
                        {deliveryLocation.etaLabel}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onAddToCart(product)}
                        aria-label={`Add ${product.name} to cart`}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          inCart
                            ? 'border-[#9A7B4F] bg-[#FBF7EF] text-[#171717] hover:bg-[#F3EBD8]'
                            : 'border-[#171717] bg-[#171717] text-[#FAF9F6] hover:bg-[#2E2E2E]'
                        }`}
                      >
                        {inCart ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
                            <span>In Cart</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Add to Cart</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onQuickTryOn(product)}
                        aria-label={`Try on ${product.name}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#DDD8CE] bg-[#FAF9F6] px-2.5 py-2 text-xs font-semibold text-[#171717] transition-colors hover:border-[#9A7B4F] hover:bg-[#F3F1EC] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3 text-[#9A7B4F]" aria-hidden="true" />
                        <span>Try On</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
