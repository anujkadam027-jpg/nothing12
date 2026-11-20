import React, { useState } from 'react';
import { Check, Lock, MapPin, ShieldCheck, Tag, Truck, X } from 'lucide-react';
import { formatINR } from '../data/catalog';
import type { DeliveryLocation, OrderRecord, PaymentMethod } from '../types/poshak';
import type { CartItem } from '../utils/cartAndFitting';
import { computeOrderTotals } from '../utils/commerce';

interface CheckoutModalProps {
  open: boolean;
  items: CartItem[];
  deliveryLocation: DeliveryLocation;
  initialPromoCode?: string;
  onClose: () => void;
  onOrderPlaced: (order: OrderRecord) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  items,
  deliveryLocation,
  initialPromoCode = '',
  onClose,
  onOrderPlaced,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState(deliveryLocation.city);
  const [pincode, setPincode] = useState(deliveryLocation.pincode);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [promoInput, setPromoInput] = useState(initialPromoCode);
  const [appliedPromo, setAppliedPromo] = useState(initialPromoCode);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setCity(deliveryLocation.city);
      setPincode(deliveryLocation.pincode);
      setPromoInput(initialPromoCode);
      setAppliedPromo(initialPromoCode);
      setError('');
    }
  }, [open, deliveryLocation.city, deliveryLocation.pincode, initialPromoCode]);

  if (!open) return null;

  const totals = computeOrderTotals(items, appliedPromo);

  const handleApplyPromo = () => {
    setAppliedPromo(promoInput.trim());
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !addressLine.trim() || !city.trim() || !pincode.trim()) {
      setError('Please complete all delivery address fields.');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phone,
          addressLine,
          city,
          pincode,
          paymentMethod,
          items: items.map((i) => ({
            productId: i.product.id,
            productName: i.product.name,
            sku: i.product.sku,
            imageUrl: i.product.imageUrl,
            size: i.size,
            quantity: i.quantity,
            unitPrice: i.product.price,
          })),
          subtotal: totals.subtotal,
          discount: totals.discount,
          deliveryFee: totals.deliveryFee,
          total: totals.total,
          promoCode: totals.promo.valid ? totals.promo.code : undefined,
          estimatedDelivery: deliveryLocation.etaLabel,
        }),
      });

      const data = (await resp.json()) as { order?: OrderRecord; error?: string };
      if (!resp.ok || !data.order) {
        throw new Error(data.error || 'Could not place order.');
      }
      onOrderPlaced(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Poshak Checkout"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E5E1D8] bg-[#FAF9F6] shadow-2xl">
        {/* Checkout Header */}
        <div className="flex items-center justify-between border-b border-[#E5E1D8] bg-[#F3F1EC] px-6 py-4 text-[#171717]">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-[#9A7B4F]" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold">
              Atelier Checkout ({items.reduce((s, i) => s + i.quantity, 0)} items)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DDD8CE] bg-white text-[#57544E] hover:border-[#171717] hover:text-[#171717] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handlePlaceOrder} className="poshak-scroll flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left: Address & Payment */}
            <div className="space-y-4 lg:col-span-7">
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-4">
                <div className="flex items-center gap-2 border-b border-[#EFECE6] pb-2.5">
                  <MapPin className="h-4 w-4 text-[#9A7B4F]" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[#171717]">1. Delivery Address</h3>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="chk-name" className="block text-xs font-medium text-[#171717]">
                      Full Name
                    </label>
                    <input
                      id="chk-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Aarav Mehta"
                      className="mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-phone" className="block text-xs font-medium text-[#171717]">
                      Mobile Number
                    </label>
                    <input
                      id="chk-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98200 12345"
                      className="mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="chk-address" className="block text-xs font-medium text-[#171717]">
                      Flat, House no., Building, Street
                    </label>
                    <input
                      id="chk-address"
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="14 Seaface Residences, Worli"
                      className="mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-city" className="block text-xs font-medium text-[#171717]">
                      City
                    </label>
                    <input
                      id="chk-city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-pin" className="block text-xs font-medium text-[#171717]">
                      Pincode
                    </label>
                    <input
                      id="chk-pin"
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="font-mono-num mt-1 w-full rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-4">
                <h3 className="border-b border-[#EFECE6] pb-2.5 text-sm font-semibold text-[#171717]">
                  2. Payment Method
                </h3>
                <div className="mt-3 space-y-2">
                  {(
                    [
                      { id: 'UPI', label: 'UPI (GPay, PhonePe, Paytm)', note: 'Instant verification' },
                      { id: 'Card', label: 'Credit or Debit Card', note: 'Visa, Mastercard, RuPay' },
                      { id: 'Cash on Delivery', label: 'Pay on Delivery (Cash / UPI)', note: 'Available at doorstep' },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs cursor-pointer ${
                        paymentMethod === opt.id
                          ? 'border-[#171717] bg-[#F3F1EC]'
                          : 'border-[#E5E1D8] bg-white hover:bg-[#FAF9F6]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === opt.id}
                          onChange={() => setPaymentMethod(opt.id)}
                          className="accent-[#171717]"
                        />
                        <span className="font-semibold text-[#171717]">{opt.label}</span>
                      </span>
                      <span className="text-[11px] text-[#625F59]">{opt.note}</span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            {/* Right: Promo & Order Summary */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5">
                <h3 className="font-display text-lg font-semibold text-[#171717]">Order Summary</h3>

                <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto border-b border-[#EFECE6] pb-3">
                  {items.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-[#171717]">
                        {entry.product.name} ({entry.size}) × {entry.quantity}
                      </span>
                      <span className="font-mono-num shrink-0 font-medium text-[#171717]">
                        {formatINR(entry.product.price * entry.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Promo Code */}
                <div className="mt-3 border-b border-[#EFECE6] pb-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#171717]">
                    <Tag className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
                    <span>Promo Code</span>
                    <span className="text-[11px] text-[#625F59]">(Try POSHAK10)</span>
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="text"
                      aria-label="Promo code"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="Enter code..."
                      className="flex-1 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-2.5 py-1.5 text-xs uppercase focus:border-[#171717] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="rounded-lg border border-[#DDD8CE] bg-[#F3F1EC] px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#E5E1D8] cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  {totals.promo.message && (
                    <p
                      className={`mt-1 text-[11px] ${
                        totals.promo.valid ? 'text-[#2F6F4E]' : 'text-[#9E3B33]'
                      }`}
                    >
                      {totals.promo.message}
                    </p>
                  )}
                </div>

                {/* Totals Breakdown */}
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#625F59]">
                    <dt>Items Subtotal:</dt>
                    <dd className="font-mono-num">{formatINR(totals.subtotal)}</dd>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-[#2F6F4E]">
                      <dt>Promo Discount:</dt>
                      <dd className="font-mono-num">−{formatINR(totals.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-[#625F59]">
                    <dt>Delivery:</dt>
                    <dd className="font-mono-num">
                      {totals.deliveryFee === 0 ? 'FREE' : formatINR(totals.deliveryFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-[#EFECE6] pt-2 text-base font-semibold text-[#171717]">
                    <dt>Order Total:</dt>
                    <dd className="font-mono-num">{formatINR(totals.total)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F3F1EC] px-3 py-2 text-[11px] text-[#171717]">
                  <Truck className="h-4 w-4 shrink-0 text-[#9A7B4F]" aria-hidden="true" />
                  <span>
                    Arriving <strong>{deliveryLocation.etaLabel}</strong> to {city || deliveryLocation.city}
                  </span>
                </div>

                {error && <p className="mt-2.5 text-xs font-medium text-[#9E3B33]">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#171717] py-2.5 text-xs font-semibold text-[#FAF9F6] transition-colors hover:bg-[#2E2E2E] disabled:opacity-60 cursor-pointer"
                >
                  <Check className="h-4 w-4 text-[#D6B889]" aria-hidden="true" />
                  <span>{submitting ? 'Placing Order...' : 'Place Your Order'}</span>
                </button>

                <p className="mt-2.5 flex items-center justify-center gap-1 text-[11px] text-[#625F59]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#2F6F4E]" aria-hidden="true" />
                  <span>Secure Checkout · 14-Day Easy Returns</span>
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
