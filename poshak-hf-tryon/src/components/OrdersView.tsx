import React from 'react';
import { ArrowLeft, CheckCircle2, Package, RotateCcw, Sparkles, Truck, XCircle } from 'lucide-react';
import { GARMENTS, formatINR } from '../data/catalog';
import type { GarmentProduct, GarmentSize, OrderRecord, StoreRequest } from '../types/poshak';

interface OrdersViewProps {
  orders: OrderRecord[];
  storeRequests: StoreRequest[];
  latestOrderId?: string | null;
  onBackToShop: () => void;
  onBuyAgain: (product: GarmentProduct, size: GarmentSize) => void;
  onTryOn: (product: GarmentProduct, size: GarmentSize) => void;
  onCancelOrder: (orderId: string) => void;
}

const ORDER_STEPS = ['Confirmed', 'Tailoring & QC', 'Shipped', 'Delivered'] as const;

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  storeRequests,
  latestOrderId,
  onBackToShop,
  onBuyAgain,
  onTryOn,
  onCancelOrder,
}) => {
  return (
    <main className="poshak-smooth-view mx-auto max-w-[1180px] px-4 py-7 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E1D8] pb-4">
        <div>
          <button
            type="button"
            onClick={onBackToShop}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#625F59] hover:text-[#171717] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Continue Shopping</span>
          </button>
          <h1 className="font-display mt-1 text-3xl font-semibold text-[#171717]">Your Orders</h1>
        </div>
        <span className="font-mono-num text-xs text-[#625F59]">
          {orders.length} order{orders.length === 1 ? '' : 's'}
        </span>
      </div>

      {latestOrderId && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#2F6F4E]/30 bg-[#F2F7F4] px-4 py-3 text-xs text-[#171717]">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F6F4E]" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[#2F6F4E]">
              Order placed successfully. Thank you for shopping with Poshak.
            </p>
            <p className="mt-0.5 text-[#57544E]">
              Order #{latestOrderId} is confirmed and queued for atelier quality inspection.
            </p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#E5E1D8] bg-white p-10 text-center">
          <Package className="mx-auto h-9 w-9 text-[#78736A]" aria-hidden="true" />
          <h2 className="font-display mt-3 text-2xl font-semibold text-[#171717]">
            No orders placed yet
          </h2>
          <p className="mt-1 text-xs text-[#625F59]">
            Add garments to your Cart and checkout to track live delivery status here.
          </p>
          <button
            type="button"
            onClick={onBackToShop}
            className="mt-5 rounded-full bg-[#171717] px-6 py-2.5 text-xs font-semibold text-[#FAF9F6] hover:bg-[#2E2E2E] cursor-pointer"
          >
            Browse Poshak Collection
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {orders.map((order) => {
            const isCancelled = order.status === 'Cancelled';
            const activeStepIdx = Math.max(
              0,
              ORDER_STEPS.indexOf(order.status as (typeof ORDER_STEPS)[number])
            );

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white"
              >
                {/* Order Header Strip */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFECE6] bg-[#F3F1EC] px-5 py-3 text-xs text-[#625F59]">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <p className="text-[10px] uppercase">Order Placed</p>
                      <p className="font-medium text-[#171717]">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase">Total</p>
                      <p className="font-mono-num font-semibold text-[#171717]">
                        {formatINR(order.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase">Ship To</p>
                      <p className="font-medium text-[#9A7B4F]">
                        {order.customerName} · {order.city} {order.pincode}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase">Payment</p>
                      <p className="font-medium text-[#171717]">{order.paymentMethod}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] uppercase">Order #</p>
                    <p className="font-mono-num font-semibold text-[#171717]">{order.id}</p>
                  </div>
                </div>

                {/* Tracking Progress + Items */}
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1.5 text-[#9E3B33]">
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          <span>Order Cancelled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[#2F6F4E]">
                          <Truck className="h-4 w-4" aria-hidden="true" />
                          <span>Arriving {order.estimatedDelivery}</span>
                        </span>
                      )}
                    </div>

                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => onCancelOrder(order.id)}
                        className="rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#FAF9F6] cursor-pointer"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>

                  {!isCancelled && (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {ORDER_STEPS.map((step, idx) => {
                        const done = idx <= activeStepIdx;
                        return (
                          <div key={step} className="space-y-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                done ? 'bg-[#9A7B4F]' : 'bg-[#EFECE6]'
                              }`}
                            />
                            <p
                              className={`text-[11px] ${
                                done ? 'font-semibold text-[#171717]' : 'text-[#78736A]'
                              }`}
                            >
                              {step}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <ul className="mt-5 divide-y divide-[#EFECE6]">
                    {order.items.map((item) => {
                      const product = GARMENTS.find((g) => g.id === item.productId);
                      return (
                        <li
                          key={`${order.id}-${item.productId}-${item.size}`}
                          className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3.5">
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="h-16 w-12 rounded-lg border border-[#E5E1D8] object-cover"
                            />
                            <div>
                              <p className="text-sm font-semibold text-[#171717]">
                                {item.productName}
                              </p>
                              <p className="text-xs text-[#625F59]">
                                Size {item.size} · Qty {item.quantity} ·{' '}
                                <span className="font-mono-num font-medium text-[#171717]">
                                  {formatINR(item.unitPrice)}
                                </span>
                              </p>
                            </div>
                          </div>

                          {product && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onBuyAgain(product, item.size)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-[#FAF9F6] hover:bg-[#2E2E2E] cursor-pointer"
                              >
                                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                <span>Buy again</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onTryOn(product, item.size)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[#DDD8CE] bg-white px-3.5 py-1.5 text-xs font-medium text-[#171717] hover:border-[#9A7B4F] cursor-pointer"
                              >
                                <Sparkles className="h-3 w-3 text-[#9A7B4F]" aria-hidden="true" />
                                <span>Try On</span>
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Boutique In-Store Fitting Reservations */}
      {storeRequests.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold text-[#171717]">
            Boutique Fitting Reservations
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {storeRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-[#E5E1D8] bg-white p-4 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-[#171717]">
                  <span>Reservation #{req.id}</span>
                  <span className="text-[#2F6F4E]">{req.status}</span>
                </div>
                <p className="mt-1 text-[#625F59]">
                  {req.customerName} · {req.preferredTime} · {req.items.length} garment(s)
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
