import test from 'node:test';
import assert from 'node:assert/strict';
import { GARMENTS } from '../data/catalog';
import { DUMMY_TO_SPACE_MODEL, resolveSpaceCategory } from './hfTryOn';

test('every catalog category resolves to a Space category or is explicitly unsupported', () => {
  for (const g of GARMENTS) {
    const cat = resolveSpaceCategory(g);
    if (g.category === 'sarees') {
      assert.equal(cat, null, g.id);
    } else {
      assert.ok(['tops', 'bottoms', 'one-pieces'].includes(cat as string), g.id);
    }
  }
});

test('category mapping per product type', () => {
  const by = (c: string) => GARMENTS.find((g) => g.category === c)!;
  assert.equal(resolveSpaceCategory(by('shirts')), 'tops');
  assert.equal(resolveSpaceCategory(by('t-shirts')), 'tops');
  assert.equal(resolveSpaceCategory(by('jackets')), 'tops');
  assert.equal(resolveSpaceCategory(by('bottoms')), 'bottoms');
  assert.equal(resolveSpaceCategory(by('kurtas')), 'one-pieces');
  assert.equal(resolveSpaceCategory(by('sarees')), null);
});

test('preset models map to the Space virtual models; mannequin has no equivalent', () => {
  assert.equal(DUMMY_TO_SPACE_MODEL['dummy-woman'], 'Female (F001)');
  assert.equal(DUMMY_TO_SPACE_MODEL['dummy-man'], 'Male (M001)');
  assert.equal(DUMMY_TO_SPACE_MODEL['dummy-mannequin'], undefined);
});
