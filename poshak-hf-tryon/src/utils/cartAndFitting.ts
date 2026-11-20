import type { GarmentProduct, GarmentSize } from '../types/poshak';

export interface CartItem {
  id: string;
  product: GarmentProduct;
  size: GarmentSize;
  quantity: number;
}

export const GARMENT_DRAG_MIME = 'application/x-poshak-garment';

export function addItemToCart(
  items: CartItem[],
  product: GarmentProduct,
  size: GarmentSize,
  quantity = 1
): CartItem[] {
  const safeQty = Math.max(1, Math.floor(quantity));
  const existingIdx = items.findIndex(
    (item) => item.product.id === product.id && item.size === size
  );
  if (existingIdx >= 0) {
    return items.map((item, idx) =>
      idx === existingIdx ? { ...item, quantity: item.quantity + safeQty } : item
    );
  }
  return [
    ...items,
    {
      id: `cart-${product.id}-${size}-${Date.now()}`,
      product,
      size,
      quantity: safeQty,
    },
  ];
}

export function updateCartItemQuantity(
  items: CartItem[],
  cartItemId: string,
  delta: number
): CartItem[] {
  return items
    .map((item) =>
      item.id === cartItemId
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item
    )
    .filter((item) => item.quantity > 0);
}

export function removeCartItem(items: CartItem[], cartItemId: string): CartItem[] {
  return items.filter((item) => item.id !== cartItemId);
}

export function getCartTotalCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

export function isProductInCart(items: CartItem[], productId: string): boolean {
  return items.some((item) => item.product.id === productId);
}

export function stepQuickValue(
  current: number,
  delta: number,
  min: number,
  max: number
): number {
  const next = Math.min(max, Math.max(min, current + delta));
  return Math.round(next * 100) / 100;
}

export function resolveDroppedGarment(
  rawId: string | null | undefined,
  catalog: GarmentProduct[]
): GarmentProduct | null {
  if (!rawId) return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  return catalog.find((item) => item.id === trimmed) ?? null;
}

export function wrapCircularIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

export interface CircularWindowEntry<T> {
  item: T;
  index: number;
  offset: number;
}

export function getCircularWindowItems<T>(
  items: T[],
  centerIndex: number,
  radius = 2
): CircularWindowEntry<T>[] {
  if (items.length === 0) return [];
  if (items.length === 2) {
    const c = wrapCircularIndex(centerIndex, 0, 2);
    const next = wrapCircularIndex(centerIndex, 1, 2);
    return [
      { item: items[c], index: c, offset: 0 },
      { item: items[next], index: next, offset: 1 },
    ];
  }
  const maxRadius = Math.min(radius, Math.floor((items.length - 1) / 2));
  const result: CircularWindowEntry<T>[] = [];
  for (let offset = -maxRadius; offset <= maxRadius; offset += 1) {
    const index = wrapCircularIndex(centerIndex, offset, items.length);
    result.push({ item: items[index], index, offset });
  }
  return result;
}

