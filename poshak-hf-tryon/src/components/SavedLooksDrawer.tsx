import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { GARMENTS, formatINR } from '../data/catalog';
import type { GarmentProduct, GarmentSize, SavedLook } from '../types/poshak';
import { getCartTotalCount, type CartItem } from '../utils/cartAndFitting';
import { FREE_DELIVERY_THRESHOLD, computeOrderTotals } from '../utils/commerce';

interface SavedLooksDrawerProps {
  open: boolean;
  initialTab: 'cart' | 'saved';
  bagItems: CartItem[];
  savedLooks: SavedLook[];
  onClose: () => void;
  onUpdateCartQty: (id: string, delta: number) => void;
  onRemoveBagItem: (id: string) => void;
  onSaveForLater: (item: CartItem) => void;
  onMoveSavedToCart: (product: GarmentProduct, size: GarmentSize, lookId: string) => void;
  onRemoveSavedLook: (id: string) => void;
  onTrySavedLook: (product: GarmentProduct, size: GarmentSize) => void;
  onProceedToCheckout: (promoCode: string) => void;
  onSubmitStoreRequest: (req: {
    customerName: string;
    phone: string;
    preferredTime: string;
    notes: string;
  }) => Promise<void>;
}

export const SavedLooksDrawer: React.FC<SavedLooksDrawerProps> = ({
  open,
  initialTab,
  bagItems,
  savedLooks,
  onClose,
  onUpdateCartQty,
  onRemoveBagItem,
  onSaveForLater,
  onMoveSavedToCart,
  onRemoveSavedLook,
  onTrySavedLook,
  onProceedToCheckout,
  onSubmitStoreRequest,
}) => {
  const [activeTab, setActiveTab] = useState<'cart' | 'saved'>(initialTab);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [showStoreBooking, setShowStoreBooking] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredTime, setPreferredTime] = useState('Tomorrow, 3:00 PM – 5:00 PM');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  if (!open) return null;

  const totalCount = getCartTotalCount(bagItems);
  const totals = computeOrderTotals(bagItems, appliedPromo);
  const freeDeliveryRemaining = Math.max(0, FREE_DELIVERY_THRESHOLD - totals.subtotal);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim()) {
      setFormError('Please enter your full name and mobile number.');
      return;
    }
    if (bagItems.length === 0) {
      setFormError('Add at least one garment to reserve an in-store trial.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      await onSubmitStoreRequest({ customerName, phone, preferredTime, notes });
      setCustomerName('');
      setPhone('');
      setNotes('');
      setBookingConfirmed(true);
      setShowStoreBooking(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit store request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart and Wishlist"
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
    >
      <div className="poshak-smooth-drawer flex h-full w-full max-w-md flex-col bg-[#FAF9F6] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E1D8] bg-[#F3F1EC] px-5 py-4 text-[#171717]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-[#9A7B4F]" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold">Cart &amp; Saved Atelier</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Cart drawer"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DDD8CE] bg-white text-[#57544E] hover:border-[#171717] hover:text-[#171717] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Clean 2-Tab Switcher */}
        <div className="grid grid-cols-2 border-b border-[#E5E1D8] bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            className={`py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'cart'
                ? 'border-b-2 border-[#9A7B4F] text-[#171717]'
                : 'text-[#625F59] hover:text-[#171717]'
            }`}
          >
            Shopping Cart ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'saved'
                ? 'border-b-2 border-[#9A7B4F] text-[#171717]'
                : 'text-[#625F59] hover:text-[#171717]'
            }`}
          >
            Saved Wishlist ({savedLooks.length})
          </button>
        </div>

        <div className="poshak-scroll flex-1 space-y-4 overflow-y-auto p-5">
          {bookingConfirmed && (
            <div className="flex items-center gap-2 rounded-xl border border-[#2F6F4E]/30 bg-[#F2F7F4] px-3.5 py-2.5 text-xs text-[#2F6F4E]">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Boutique fitting reserved! View it in Orders.</span>
            </div>
          )}

          {activeTab === 'cart' ? (
            <>
              {/* Free Delivery Progress Note */}
              {bagItems.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-[#E5E1D8] bg-white px-3.5 py-2.5 text-xs">
                  <Truck className="h-4 w-4 shrink-0 text-[#9A7B4F]" aria-hidden="true" />
                  {freeDeliveryRemaining === 0 ? (
                    <span className="text-[#2F6F4E]">
                      Your order qualifies for <strong>Complimentary Delivery</strong>.
                    </span>
                  ) : (
                    <span className="text-[#171717]">
                      Add <strong>{formatINR(freeDeliveryRemaining)}</strong> more for Complimentary Delivery.
                    </span>
                  )}
                </div>
              )}

              {bagItems.length === 0 ? (
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-8 text-center">
                  <ShoppingBag className="mx-auto h-8 w-8 text-[#78736A]" aria-hidden="true" />
                  <p className="mt-2.5 font-display text-lg font-semibold text-[#171717]">
                    Your Poshak Cart is empty
                  </p>
                  <p className="mt-1 text-xs text-[#625F59]">
                    Select garments or move items from your Saved tab to begin checkout.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="space-y-2.5">
                    {bagItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex gap-3 rounded-xl border border-[#E5E1D8] bg-white p-3"
                      >
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="h-20 w-14 shrink-0 rounded-lg object-cover bg-[#F3F1EC]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-[#171717]">
                              {item.product.name}
                            </p>
                            <span className="font-mono-num shrink-0 text-xs font-semibold text-[#171717]">
                              {formatINR(item.product.price * item.quantity)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#2F6F4E]">In Stock</p>
                          <p className="text-[11px] text-[#625F59]">
                            Size: {item.size} · {item.product.color.name}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center rounded-full border border-[#DDD8CE] bg-[#FAF9F6]">
                              <button
                                type="button"
                                onClick={() => onUpdateCartQty(item.id, -1)}
                                aria-label={`Decrease quantity of ${item.product.name}`}
                                className="flex h-6 w-6 items-center justify-center text-[#171717] hover:bg-[#EFECE6] rounded-l-full cursor-pointer"
                              >
                                <Minus className="h-3 w-3" aria-hidden="true" />
                              </button>
                              <span className="font-mono-num min-w-[22px] text-center text-[11px] font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateCartQty(item.id, 1)}
                                aria-label={`Increase quantity of ${item.product.name}`}
                                className="flex h-6 w-6 items-center justify-center text-[#171717] hover:bg-[#EFECE6] rounded-r-full cursor-pointer"
                              >
                                <Plus className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => onTrySavedLook(item.product, item.size)}
                              className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-2.5 py-1 text-[11px] font-semibold text-[#FAF9F6] hover:bg-[#2E2E2E] cursor-pointer"
                            >
                              <Sparkles className="h-2.5 w-2.5 text-[#D6B889]" aria-hidden="true" />
                              <span>Try On</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onSaveForLater(item)}
                              className="text-[11px] font-medium text-[#9A7B4F] hover:underline cursor-pointer"
                            >
                              Save for later
                            </button>

                            <button
                              type="button"
                              onClick={() => onRemoveBagItem(item.id)}
                              aria-label={`Remove ${item.product.name} from cart`}
                              className="ml-auto text-[11px] text-[#78736A] hover:text-[#9E3B33] cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Promo Code + Order Subtotal Box */}
                  <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#171717]">
                      <Tag className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
                      <span>Promo Code (Try POSHAK10)</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        aria-label="Cart promo code"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="POSHAK10 or ATELIER15"
                        className="flex-1 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs uppercase focus:border-[#171717] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setAppliedPromo(promoInput.trim())}
                        className="rounded-lg border border-[#DDD8CE] bg-[#F3F1EC] px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#E5E1D8] cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                    {totals.promo.message && (
                      <p
                        className={`mt-1.5 text-[11px] ${
                          totals.promo.valid ? 'text-[#2F6F4E]' : 'text-[#9E3B33]'
                        }`}
                      >
                        {totals.promo.message}
                      </p>
                    )}

                    <div className="mt-3 space-y-1 border-t border-[#EFECE6] pt-3 text-xs">
                      <div className="flex justify-between text-[#625F59]">
                        <span>Subtotal ({totalCount} items):</span>
                        <span className="font-mono-num">{formatINR(totals.subtotal)}</span>
                      </div>
                      {totals.discount > 0 && (
                        <div className="flex justify-between text-[#2F6F4E]">
                          <span>Discount:</span>
                          <span className="font-mono-num">−{formatINR(totals.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[#625F59]">
                        <span>Delivery:</span>
                        <span className="font-mono-num">
                          {totals.deliveryFee === 0 ? 'FREE' : formatINR(totals.deliveryFee)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 text-sm font-semibold text-[#171717]">
                        <span>Estimated Total:</span>
                        <span className="font-mono-num">{formatINR(totals.total)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onProceedToCheckout(totals.promo.valid ? totals.promo.code : '')}
                      className="mt-4 w-full rounded-full bg-[#171717] py-2.5 text-xs font-semibold text-[#FAF9F6] transition-colors hover:bg-[#2E2E2E] cursor-pointer"
                    >
                      Proceed to Checkout ({totalCount} item{totalCount === 1 ? '' : 's'})
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowStoreBooking((v) => !v)}
                      className="mt-2.5 w-full text-center text-[11px] font-medium text-[#9A7B4F] hover:underline cursor-pointer"
                    >
                      {showStoreBooking ? 'Hide in-store trial form' : 'Or reserve for physical trial at boutique'}
                    </button>
                  </div>

                  {showStoreBooking && (
                    <form
                      onSubmit={handleRequestSubmit}
                      className="rounded-xl border border-[#E5E1D8] bg-white p-4"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#171717]">
                        <Bookmark className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
                        <span>Reserve Boutique Trial</span>
                      </div>
                      <div className="mt-2.5 space-y-2">
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs"
                        />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Mobile Number"
                          className="w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={preferredTime}
                          onChange={(e) => setPreferredTime(e.target.value)}
                          placeholder="Preferred Time"
                          className="w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Tailoring notes (optional)"
                          className="w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs"
                        />
                      </div>
                      {formError && <p className="mt-2 text-xs text-[#9E3B33]">{formError}</p>}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="mt-3 w-full rounded-full bg-[#D6B889] py-2 text-xs font-semibold text-[#171717] hover:bg-[#C8A673] cursor-pointer"
                      >
                        {submitting ? 'Confirming...' : 'Confirm Boutique Trial'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </>
          ) : (
            <section>
              {savedLooks.length === 0 ? (
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-8 text-center">
                  <Heart className="mx-auto h-8 w-8 text-[#78736A]" aria-hidden="true" />
                  <p className="mt-2.5 font-display text-lg font-semibold text-[#171717]">
                    Your Wishlist is empty
                  </p>
                  <p className="mt-1 text-xs text-[#625F59]">
                    Save garments or Fitting Room captures to move them to your Cart later.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {savedLooks.map((look) => {
                    const prod = GARMENTS.find((g) => g.id === look.productId);
                    if (!prod) return null;
                    return (
                      <li
                        key={look.id}
                        className="flex items-center gap-3 rounded-xl border border-[#E5E1D8] bg-white p-3"
                      >
                        <img
                          src={look.previewDataUrl || prod.imageUrl}
                          alt={prod.name}
                          className="h-16 w-12 rounded-lg object-cover bg-[#F3F1EC]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#171717]">
                            {prod.name}
                          </p>
                          <p className="text-[11px] text-[#625F59]">
                            Size {look.size} ·{' '}
                            <span className="font-mono-num font-semibold text-[#171717]">
                              {formatINR(prod.price)}
                            </span>
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onMoveSavedToCart(prod, look.size, look.id)}
                              className="rounded-full bg-[#171717] px-3 py-1 text-[11px] font-semibold text-[#FAF9F6] hover:bg-[#2E2E2E] cursor-pointer"
                            >
                              Move to Cart
                            </button>
                            <button
                              type="button"
                              onClick={() => onTrySavedLook(prod, look.size)}
                              className="text-[11px] font-semibold text-[#9A7B4F] hover:underline cursor-pointer"
                            >
                              Try On
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveSavedLook(look.id)}
                          aria-label={`Remove saved look ${prod.name}`}
                          className="rounded-md p-1.5 text-[#78736A] hover:text-[#9E3B33] cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
