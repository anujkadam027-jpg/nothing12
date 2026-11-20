import type {
  DeliveryLocation,
  GarmentProduct,
  ProductCommerceMeta,
  ProductReview,
} from '../types/poshak';
import type { CartItem } from './cartAndFitting';

export const PRESET_LOCATIONS: DeliveryLocation[] = [
  { city: 'Mumbai', pincode: '400001', etaLabel: 'Tomorrow by 9 PM', isExpress: true },
  { city: 'New Delhi', pincode: '110001', etaLabel: 'Tomorrow by 9 PM', isExpress: true },
  { city: 'Bengaluru', pincode: '560001', etaLabel: 'Tomorrow by 9 PM', isExpress: true },
  { city: 'Hyderabad', pincode: '500001', etaLabel: 'In 2 days', isExpress: false },
];

export const FREE_DELIVERY_THRESHOLD = 1999;
export const STANDARD_DELIVERY_FEE = 99;

export function getProductCommerceMeta(product: GarmentProduct): ProductCommerceMeta {
  // Deterministic hash from product id so ratings, MRP & tags stay consistent
  let hash = 0;
  for (let i = 0; i < product.id.length; i += 1) {
    hash = (hash * 31 + product.id.charCodeAt(i)) % 997;
  }

  const ratingPool = [4.4, 4.5, 4.6, 4.7, 4.8, 4.9];
  const discountPool = [10, 12, 15, 18, 20];

  const rating = ratingPool[hash % ratingPool.length];
  const reviewCount = 38 + ((hash * 7) % 240);
  const discountPercent = discountPool[(hash >> 2) % discountPool.length];
  const rawMrp = product.price / (1 - discountPercent / 100);
  const mrp = Math.ceil(rawMrp / 50) * 50;

  return {
    rating,
    reviewCount,
    mrp,
    discountPercent,
    isBestSeller: hash % 5 === 0,
    isDeal: discountPercent >= 15,
  };
}

export function getDefaultReviews(product: GarmentProduct): ProductReview[] {
  return [
    {
      id: `rev-${product.id}-1`,
      productId: product.id,
      author: 'Rohan Malhotra',
      rating: 5,
      title: `Superb ${product.fabric} finish`,
      comment: `Tailoring and ${product.color.name.toLowerCase()} tone match the studio preview closely. Comfortable drape right out of the box.`,
      dateLabel: 'Verified Purchase · 4 days ago',
      verifiedPurchase: true,
    },
    {
      id: `rev-${product.id}-2`,
      productId: product.id,
      author: 'Ananya Nair',
      rating: 4,
      title: 'Accurate fit using the Virtual Try-On Studio',
      comment: `Checked sizing in the fitting room first and ordered my suggested size. Clean stitching and prompt doorstep delivery.`,
      dateLabel: 'Verified Purchase · 2 weeks ago',
      verifiedPurchase: true,
    },
  ];
}

export function computeRatingBreakdown(
  reviews: ProductReview[],
  baseRating: number,
  baseCount: number
): { average: number; totalCount: number; distribution: Array<{ stars: number; percent: number }> } {
  if (reviews.length === 0) {
    return {
      average: baseRating,
      totalCount: baseCount,
      distribution: [
        { stars: 5, percent: 72 },
        { stars: 4, percent: 18 },
        { stars: 3, percent: 6 },
        { stars: 2, percent: 2 },
        { stars: 1, percent: 2 },
      ],
    };
  }

  const userSum = reviews.reduce((sum, r) => sum + r.rating, 0);
  const totalCount = baseCount + reviews.length;
  const average = Number(
    ((baseRating * baseCount + userSum) / Math.max(1, totalCount)).toFixed(1)
  );

  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) {
    const clamped = Math.min(5, Math.max(1, Math.round(r.rating)));
    counts[clamped] += 1;
  }

  // Blend deterministic baseline with live review counts
  const baselineWeights: Record<number, number> = { 5: 72, 4: 18, 3: 6, 2: 2, 1: 2 };
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const weighted = baselineWeights[stars] + counts[stars] * 8;
    return { stars, weighted };
  });
  const sumW = distribution.reduce((s, d) => s + d.weighted, 0);

  return {
    average,
    totalCount,
    distribution: distribution.map((d) => ({
      stars: d.stars,
      percent: Math.round((d.weighted / sumW) * 100),
    })),
  };
}

export interface PromoEvaluation {
  valid: boolean;
  code: string;
  discount: number;
  message: string;
}

export function evaluatePromoCode(rawCode: string, subtotal: number): PromoEvaluation {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, code: '', discount: 0, message: '' };
  }
  if (subtotal <= 0) {
    return { valid: false, code, discount: 0, message: 'Add items to cart before applying a code.' };
  }

  if (code === 'POSHAK10') {
    const discount = Math.round(subtotal * 0.1);
    return {
      valid: true,
      code,
      discount,
      message: `POSHAK10 applied — 10% off saved`,
    };
  }

  if (code === 'ATELIER15') {
    if (subtotal < 3500) {
      return {
        valid: false,
        code,
        discount: 0,
        message: 'ATELIER15 requires a subtotal of ₹3,500 or more.',
      };
    }
    const discount = Math.round(subtotal * 0.15);
    return {
      valid: true,
      code,
      discount,
      message: `ATELIER15 applied — 15% off saved`,
    };
  }

  if (code === 'WELCOME500') {
    if (subtotal < 2000) {
      return {
        valid: false,
        code,
        discount: 0,
        message: 'WELCOME500 requires a subtotal of ₹2,000 or more.',
      };
    }
    return {
      valid: true,
      code,
      discount: 500,
      message: `WELCOME500 applied — ₹500 off saved`,
    };
  }

  return {
    valid: false,
    code,
    discount: 0,
    message: 'Invalid code. Try POSHAK10, ATELIER15, or WELCOME500.',
  };
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  promo: PromoEvaluation;
}

export function computeOrderTotals(items: CartItem[], promoCode: string): OrderTotals {
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const promo = evaluatePromoCode(promoCode, subtotal);
  const afterDiscount = Math.max(0, subtotal - promo.discount);
  const deliveryFee =
    subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const total = afterDiscount + deliveryFee;

  return {
    subtotal,
    discount: promo.discount,
    deliveryFee,
    total,
    promo,
  };
}

export function resolveDeliveryLocation(pincode: string, customCity?: string): DeliveryLocation | null {
  const cleaned = pincode.replace(/\D/g, '').slice(0, 6);
  if (cleaned.length !== 6) {
    return null;
  }

  const preset = PRESET_LOCATIONS.find((loc) => loc.pincode === cleaned);
  if (preset) return preset;

  const prefixMap: Array<{ prefixes: string[]; city: string; express: boolean }> = [
    { prefixes: ['400', '401', '411'], city: 'Mumbai / Pune', express: true },
    { prefixes: ['110', '122', '201'], city: 'Delhi NCR', express: true },
    { prefixes: ['560'], city: 'Bengaluru', express: true },
    { prefixes: ['500'], city: 'Hyderabad', express: false },
    { prefixes: ['600'], city: 'Chennai', express: false },
    { prefixes: ['700'], city: 'Kolkata', express: false },
    { prefixes: ['380'], city: 'Ahmedabad', express: false },
  ];

  const match = prefixMap.find((entry) => entry.prefixes.some((p) => cleaned.startsWith(p)));
  const city = customCity?.trim() || match?.city || `PIN ${cleaned}`;
  const isExpress = match?.express ?? false;

  return {
    city,
    pincode: cleaned,
    etaLabel: isExpress ? 'Tomorrow by 9 PM' : 'Within 2–3 days',
    isExpress,
  };
}
