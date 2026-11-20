export type CategoryId =
  | 'shirts'
  | 't-shirts'
  | 'jackets'
  | 'bottoms'
  | 'kurtas'
  | 'sarees';

export type TryOnMode = 'live' | 'upload' | 'dummy';

export type GarmentSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Free Size';

export interface ColorVariant {
  name: string;
  hex: string;
}

export interface GarmentProduct {
  id: string;
  sku: string;
  name: string;
  category: CategoryId;
  categoryLabel: string;
  price: number;
  fabric: string;
  craftNote: string;
  description: string;
  imageUrl: string;
  matteUrl: string;
  color: ColorVariant;
  sizes: GarmentSize[];
  inStock: boolean;
  fitRegion: 'upper' | 'lower' | 'full';
}

export interface ProductCommerceMeta {
  rating: number;
  reviewCount: number;
  mrp: number;
  discountPercent: number;
  isBestSeller: boolean;
  isDeal: boolean;
}

export interface ProductReview {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  comment: string;
  dateLabel: string;
  verifiedPurchase: boolean;
}

export interface DeliveryLocation {
  city: string;
  pincode: string;
  etaLabel: string;
  isExpress: boolean;
}

export type PaymentMethod = 'UPI' | 'Card' | 'Cash on Delivery';

export type OrderStatus =
  | 'Confirmed'
  | 'Tailoring & QC'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export interface OrderLineItem {
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string;
  size: GarmentSize;
  quantity: number;
  unitPrice: number;
}

export interface OrderRecord {
  id: string;
  customerName: string;
  phone: string;
  addressLine: string;
  city: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  items: OrderLineItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  promoCode?: string;
  status: OrderStatus;
  estimatedDelivery: string;
  createdAt: string;
}

export interface DummyModel {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  silhouette: 'mannequin' | 'female' | 'male';
  // Normalized [0..1] anatomical anchors matching the studio portrait
  anchors: NormalizedPoseAnchors;
}

export interface Point2D {
  x: number;
  y: number;
  visibility?: number;
}

export interface NormalizedPoseAnchors {
  nose: Point2D;
  leftShoulder: Point2D;
  rightShoulder: Point2D;
  leftElbow: Point2D;
  rightElbow: Point2D;
  leftWrist: Point2D;
  rightWrist: Point2D;
  leftHip: Point2D;
  rightHip: Point2D;
  leftKnee: Point2D;
  rightKnee: Point2D;
  leftAnkle: Point2D;
  rightAnkle: Point2D;
}

export interface BodyParameters {
  chestCm: number;
  waistCm: number;
  hipsCm: number;
  heightCm: number;
  fitPreference: 'Slim' | 'Regular' | 'Relaxed';
}

export interface CalibrationSettings {
  mirrored: boolean;
  scaleOffset: number;       // 0.75 to 1.35
  verticalOffset: number;    // -0.15 to +0.15 normalized
  horizontalOffset: number;  // -0.15 to +0.15 normalized
  shoulderSpread: number;    // 0.85 to 1.25
  smoothingAlpha: number;    // 0.12 to 0.75
  showCalibrationGrid: boolean;
  showLandmarks: boolean;
  enableArmOcclusion: boolean;
}

export interface TorsoFitFrame {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationRad: number;
  yawRad: number;
  confidence: number;
  valid: boolean;
}

export interface FitAnalysisResult {
  source: 'gemini' | 'local';
  recommendedSize: GarmentSize;
  harmonyScore: number;
  lightingMatch: string;
  stylingNote: string;
  anchorAdjustment?: {
    scaleFactor: number;
    yOffset: number;
  };
}

export interface SavedLook {
  id: string;
  productId: string;
  size: GarmentSize;
  mode: TryOnMode;
  previewDataUrl?: string;
  createdAt: string;
}

export interface StoreRequest {
  id: string;
  customerName: string;
  phone: string;
  preferredTime: string;
  notes: string;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    size: GarmentSize;
    price: number;
  }>;
  status: 'Confirmed' | 'Preparing';
  createdAt: string;
}
