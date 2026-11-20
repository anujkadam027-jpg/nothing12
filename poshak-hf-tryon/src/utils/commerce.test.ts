import test from 'node:test';
import assert from 'node:assert/strict';
import { GARMENTS } from '../data/catalog';
import {
  computeOrderTotals,
  computeRatingBreakdown,
  evaluatePromoCode,
  getDefaultReviews,
  getProductCommerceMeta,
  resolveDeliveryLocation,
} from './commerce';
import type { CartItem } from './cartAndFitting';

test('getProductCommerceMeta generates consistent MRP, discount, and ratings', () => {
  const shirt = GARMENTS[0];
  const metaA = getProductCommerceMeta(shirt);
  const metaB = getProductCommerceMeta(shirt);

  assert.deepEqual(metaA, metaB);
  assert.ok(metaA.mrp > shirt.price);
  assert.ok(metaA.rating >= 4.0 && metaA.rating <= 5.0);
  assert.ok(metaA.discountPercent >= 10);
});

test('evaluatePromoCode validates POSHAK10, ATELIER15 threshold, and invalid codes', () => {
  const ten = evaluatePromoCode('poshak10', 2500);
  assert.equal(ten.valid, true);
  assert.equal(ten.discount, 250);

  const blocked = evaluatePromoCode('ATELIER15', 2500);
  assert.equal(blocked.valid, false);
  assert.equal(blocked.discount, 0);

  const fifteen = evaluatePromoCode('ATELIER15', 4000);
  assert.equal(fifteen.valid, true);
  assert.equal(fifteen.discount, 600);

  const bad = evaluatePromoCode('NOPE', 5000);
  assert.equal(bad.valid, false);
});

test('computeOrderTotals applies free delivery over threshold and delivery fee below', () => {
  const tee = GARMENTS.find((g) => g.price < 1999)!;
  const lowCart: CartItem[] = [{ id: `${tee.id}::M`, product: tee, size: 'M', quantity: 1 }];
  const lowTotals = computeOrderTotals(lowCart, '');
  assert.equal(lowTotals.deliveryFee, 99);
  assert.equal(lowTotals.total, tee.price + 99);

  const jacket = GARMENTS.find((g) => g.price >= 1999)!;
  const highCart: CartItem[] = [{ id: `${jacket.id}::M`, product: jacket, size: 'M', quantity: 1 }];
  const highTotals = computeOrderTotals(highCart, 'POSHAK10');
  assert.equal(highTotals.deliveryFee, 0);
  assert.equal(highTotals.total, jacket.price - Math.round(jacket.price * 0.1));
});

test('resolveDeliveryLocation resolves valid 6-digit pincode and rejects invalid input', () => {
  assert.equal(resolveDeliveryLocation('123'), null);
  const mumbai = resolveDeliveryLocation('400050');
  assert.ok(mumbai);
  assert.equal(mumbai.isExpress, true);
  assert.equal(mumbai.etaLabel, 'Tomorrow by 9 PM');
});

test('computeRatingBreakdown incorporates newly added reviews accurately', () => {
  const shirt = GARMENTS[0];
  const reviews = getDefaultReviews(shirt);
  const breakdown = computeRatingBreakdown(reviews, 4.7, 50);
  assert.equal(breakdown.totalCount, 52);
  assert.ok(breakdown.average >= 4.0 && breakdown.average <= 5.0);
  assert.equal(breakdown.distribution.length, 5);
});
