import test from 'node:test';
import assert from 'node:assert/strict';
import { GARMENTS } from '../data/catalog';
import {
  addItemToCart,
  getCartSubtotal,
  getCartTotalCount,
  getCircularWindowItems,
  isProductInCart,
  removeCartItem,
  resolveDroppedGarment,
  stepQuickValue,
  updateCartItemQuantity,
  wrapCircularIndex,
  type CartItem,
} from './cartAndFitting';

test('addItemToCart adds new garment and increments quantity for matching product+size', () => {
  const shirt = GARMENTS[0];
  let cart: CartItem[] = [];

  cart = addItemToCart(cart, shirt, 'M');
  assert.equal(cart.length, 1);
  assert.equal(getCartTotalCount(cart), 1);
  assert.equal(isProductInCart(cart, shirt.id), true);

  cart = addItemToCart(cart, shirt, 'M');
  assert.equal(cart.length, 1);
  assert.equal(getCartTotalCount(cart), 2);
  assert.equal(getCartSubtotal(cart), shirt.price * 2);

  cart = addItemToCart(cart, shirt, 'L');
  assert.equal(cart.length, 2);
  assert.equal(getCartTotalCount(cart), 3);
});

test('updateCartItemQuantity and removeCartItem maintain clean state', () => {
  const shirt = GARMENTS[0];
  const kurta = GARMENTS[24];
  let cart = addItemToCart([], shirt, 'M');
  cart = addItemToCart(cart, kurta, 'L');

  const firstId = cart[0].id;
  cart = updateCartItemQuantity(cart, firstId, 1);
  assert.equal(getCartTotalCount(cart), 3);

  cart = updateCartItemQuantity(cart, firstId, -2);
  assert.equal(cart.length, 1);
  assert.equal(isProductInCart(cart, shirt.id), false);

  cart = removeCartItem(cart, cart[0].id);
  assert.equal(cart.length, 0);
});

test('stepQuickValue clamps scale and vertical alignment accurately', () => {
  assert.equal(stepQuickValue(1.0, 0.05, 0.8, 1.3), 1.05);
  assert.equal(stepQuickValue(1.28, 0.05, 0.8, 1.3), 1.3);
  assert.equal(stepQuickValue(0.82, -0.05, 0.8, 1.3), 0.8);
  assert.equal(stepQuickValue(0.0, -0.02, -0.1, 0.1), -0.02);
});

test('resolveDroppedGarment finds valid product from drag payload and ignores invalid IDs', () => {
  const target = GARMENTS[5];
  assert.equal(resolveDroppedGarment(target.id, GARMENTS)?.id, target.id);
  assert.equal(resolveDroppedGarment(`  ${target.id}  `, GARMENTS)?.id, target.id);
  assert.equal(resolveDroppedGarment('non-existent-id', GARMENTS), null);
  assert.equal(resolveDroppedGarment('', GARMENTS), null);
});

test('wrapCircularIndex and getCircularWindowItems scroll one by one circularly', () => {
  assert.equal(wrapCircularIndex(0, -1, 6), 5);
  assert.equal(wrapCircularIndex(5, 1, 6), 0);
  assert.equal(wrapCircularIndex(2, 1, 6), 3);

  const slice = GARMENTS.slice(0, 6);
  const win = getCircularWindowItems(slice, 0, 2);
  assert.equal(win.length, 5);
  assert.deepEqual(
    win.map((w) => w.index),
    [4, 5, 0, 1, 2]
  );
  assert.deepEqual(
    win.map((w) => w.offset),
    [-2, -1, 0, 1, 2]
  );

  assert.equal(getCircularWindowItems([], 0, 2).length, 0);
  assert.equal(getCircularWindowItems(GARMENTS.slice(0, 1), 0, 2).length, 1);
  const twoWin = getCircularWindowItems(GARMENTS.slice(0, 2), 1, 2);
  assert.deepEqual(
    twoWin.map((w) => w.index),
    [1, 0]
  );
});

