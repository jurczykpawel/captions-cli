import { test, expect, describe } from 'bun:test';
import { allowedTiers, presetsForTier } from './tiers';

const presets = [
  { slug: 'pill', tier: 'basic', description: '', css: '' },
  { slug: 'glow', tier: 'premium', description: '', css: '' },
];

describe('allowedTiers', () => {
  test('premium unlocks basic+premium', () => expect(allowedTiers('premium')).toEqual(['basic', 'premium']));
  test('basic unlocks basic only', () => expect(allowedTiers('basic')).toEqual(['basic']));
  test('unknown/null unlocks nothing', () => {
    expect(allowedTiers(null)).toEqual([]);
    expect(allowedTiers('bogus')).toEqual([]);
  });
});

describe('presetsForTier', () => {
  test('filters by allowed tiers', () => {
    expect(presetsForTier(presets, 'basic').map((p) => p.slug)).toEqual(['pill']);
    expect(presetsForTier(presets, 'premium').map((p) => p.slug)).toEqual(['pill', 'glow']);
    expect(presetsForTier(presets, null)).toEqual([]);
  });
});
