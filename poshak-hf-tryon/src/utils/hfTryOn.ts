import type { GarmentProduct } from '../types/poshak';

/**
 * Clothing categories accepted by the Hugging Face Space
 * (AnujArunKadam/fashn-virtual-tryon, app.py → CATEGORIES).
 */
export type SpaceCategory = 'tops' | 'bottoms' | 'one-pieces';

/** Garment photo types accepted by the Space (app.py → PHOTO_TYPES). */
export const SPACE_PHOTO_TYPE = 'flat-lay' as const;

/** Virtual model names accepted by /model_tryon (app.py → VIRTUAL_MODELS). */
export type SpaceModelChoice = 'Male (M001)' | 'Female (F001)';

/** Maps the app's preset studio models onto the Space's two virtual models. */
export const DUMMY_TO_SPACE_MODEL: Record<string, SpaceModelChoice | undefined> = {
  'dummy-woman': 'Female (F001)',
  'dummy-man': 'Male (M001)',
};

export const SPACE_CATEGORY_UNSUPPORTED_MESSAGE =
  'Sarees are draped garments and are not supported by the AI try-on model (it handles tops, bottoms and one-piece garments).';

/**
 * Resolves the Space category for a catalog product, or null when the model
 * cannot represent it.
 *  - upper-body garments (shirts, t-shirts, jackets) → tops
 *  - bottoms                                         → bottoms
 *  - kurtas (knee-length tunics)                     → one-pieces
 *  - sarees (draped garment)                         → unsupported
 */
export function resolveSpaceCategory(
  product: Pick<GarmentProduct, 'category' | 'fitRegion'>
): SpaceCategory | null {
  if (product.category === 'sarees') return null;
  if (product.category === 'kurtas') return 'one-pieces';
  if (product.fitRegion === 'upper') return 'tops';
  if (product.fitRegion === 'lower') return 'bottoms';
  return null;
}
