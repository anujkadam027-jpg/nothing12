import React, { useState } from 'react';
import { Heart, MapPin, Package, Search, ShoppingBag, Sparkles, X } from 'lucide-react';
import { CATEGORIES } from '../data/catalog';
import type { CategoryId, DeliveryLocation } from '../types/poshak';

interface NavbarProps {
  activeView: 'storefront' | 'product' | 'fitting-room' | 'orders';
  selectedCategory: CategoryId | 'all';
  dealsOnly: boolean;
  searchQuery: string;
  deliveryLocation: DeliveryLocation;
  savedCount: number;
  ordersCount: number;
  requestBagCount: number;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onSelectSearchCategory: (cat: CategoryId | 'all') => void;
  onNavigateHome: () => void;
  onNavigateCategory: (catId: CategoryId | 'all') => void;
  onToggleDeals: () => void;
  onOpenFittingRoom: () => void;
  onOpenOrders: () => void;
  onOpenLocationModal: () => void;
  onOpenDrawer: (tab?: 'cart' | 'saved') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  selectedCategory,
  dealsOnly,
  searchQuery,
  deliveryLocation,
  savedCount,
  ordersCount,
  requestBagCount,
  onSearchChange,
  onSearchSubmit,
  onSelectSearchCategory,
  onNavigateHome,
  onNavigateCategory,
  onToggleDeals,
  onOpenFittingRoom,
  onOpenOrders,
  onOpenLocationModal,
  onOpenDrawer,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  return (
    <>
      {/* Top Sticky Navigation Bar: Search + Location | Categories | Account & Studio Actions */}
      <header
        data-testid="top-nav-bar"
        className="sticky top-0 z-40 border-b border-[#E5E1D8] bg-[#FAF9F6]/95 backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_auto] items-center gap-4 px-4 py-2.5 sm:px-8 lg:grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)]">
          {/* Left Zone: Search & Delivery Location */}
          <div className="flex items-center gap-2.5 justify-self-start">
            {searchOpen ? (
              <form
                onSubmit={handleFormSubmit}
                role="search"
                className="flex items-center overflow-hidden rounded-full border border-[#DDD8CE] bg-white px-2.5 py-1"
              >
                <select
                  aria-label="Search in category"
                  value={selectedCategory}
                  onChange={(e) => onSelectSearchCategory(e.target.value as CategoryId | 'all')}
                  className="mr-1.5 border-r border-[#E5E1D8] bg-transparent pr-1.5 text-[11px] font-medium text-[#57544E] focus:outline-none cursor-pointer"
                >
                  <option value="all">All</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  autoFocus
                  aria-label="Search Poshak apparel, fabrics, or colors"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search garments..."
                  className="w-28 bg-transparent text-xs text-[#171717] placeholder:text-[#8A857C] focus:outline-none sm:w-36"
                />
                <button
                  type="submit"
                  aria-label="Search catalogue"
                  className="p-1 text-[#171717] hover:text-[#9A7B4F] cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => {
                    onSearchChange('');
                    setSearchOpen(false);
                  }}
                  className="p-1 text-[#78736A] hover:text-[#171717] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Open catalogue search"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#DDD8CE] bg-white px-3 text-xs font-medium text-[#57544E] transition-colors hover:border-[#171717] hover:text-[#171717] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Search</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLocationModal}
              aria-label={`Change delivery location, currently ${deliveryLocation.city} ${deliveryLocation.pincode}`}
              className="hidden h-8 items-center gap-1 rounded-full border border-[#E5E1D8] bg-[#F3F1EC] px-3 text-[11px] text-[#57544E] transition-colors hover:border-[#171717] hover:text-[#171717] md:inline-flex whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MapPin className="h-3 w-3 text-[#9A7B4F]" aria-hidden="true" />
              <span>
                {deliveryLocation.city} {deliveryLocation.pincode}
              </span>
            </button>
          </div>

          {/* Center Zone: Properly Spaced & Aligned Category Navigation Links */}
          <nav
            aria-label="Primary categories and shopping modes"
            className="hidden items-center justify-center gap-5 lg:flex"
          >
            {CATEGORIES.map((cat) => {
              const active = activeView === 'storefront' && selectedCategory === cat.id && !dealsOnly;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onNavigateCategory(cat.id)}
                  className={`text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'font-semibold text-[#171717] underline decoration-[#9A7B4F] decoration-2 underline-offset-8'
                      : 'text-[#625F59] hover:text-[#171717]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onToggleDeals}
              className={`text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'storefront' && dealsOnly
                  ? 'font-semibold text-[#9A7B4F] underline decoration-[#9A7B4F] decoration-2 underline-offset-8'
                  : 'text-[#9A7B4F] hover:text-[#171717]'
              }`}
            >
              Offers
            </button>
          </nav>

          {/* Right Zone: Orders, Saved, Try-On Studio, Cart */}
          <div className="flex items-center justify-self-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenOrders}
              aria-label={`Orders (${ordersCount})`}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'orders'
                  ? 'border-[#171717] bg-[#F3F1EC] text-[#171717] font-semibold'
                  : 'border-[#DDD8CE] bg-white text-[#171717] hover:border-[#171717]'
              }`}
            >
              <Package className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
              <span className="hidden sm:inline">Orders</span>
              {ordersCount > 0 && (
                <span className="font-mono-num rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {ordersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer('saved')}
              aria-label={`Saved wishlist (${savedCount})`}
              className="hidden h-8 items-center gap-1.5 rounded-full border border-[#DDD8CE] bg-white px-3 text-xs font-medium text-[#171717] transition-colors hover:border-[#171717] sm:inline-flex whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Heart className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
              <span>Saved</span>
              {savedCount > 0 && (
                <span className="font-mono-num rounded-full bg-[#F3F1EC] px-1.5 py-0.5 text-[10px] font-semibold text-[#171717]">
                  {savedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenFittingRoom}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'fitting-room'
                  ? 'bg-[#9A7B4F] text-white'
                  : 'bg-[#171717] text-[#FAF9F6] hover:bg-[#2E2E2E]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Try-On Studio</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer('cart')}
              aria-label={`Cart (${requestBagCount}) — Open cart and saved looks`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#DDD8CE] bg-white px-3 text-xs font-semibold text-[#171717] transition-colors hover:border-[#171717] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cart</span>
              <span className="font-mono-num rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] font-semibold text-[#FAF9F6]">
                {requestBagCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Centered Poshak Brand Logo Strip positioned right after the Navigation Bar */}
      <div
        data-testid="centered-brand-bar"
        className="border-b border-[#E5E1D8] bg-[#FAF9F6] py-3.5"
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-center px-4 sm:px-8">
          <button
            type="button"
            onClick={onNavigateHome}
            aria-label="Poshak Atelier Home"
            className="group inline-flex items-baseline gap-3 text-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.015] cursor-pointer focus:outline-none"
          >
            <span className="font-display text-4xl leading-none font-semibold tracking-[0.06em] text-[#171717] transition-colors duration-300 group-hover:text-[#2D2D2D] sm:text-[44px]">
              Poshak
            </span>
            <span className="text-xs font-semibold tracking-[0.26em] text-[#9A7B4F] uppercase sm:text-[13px]">
              Atelier
            </span>
          </button>
        </div>
      </div>
    </>
  );
};
