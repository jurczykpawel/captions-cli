// Maps a verified token's `tier` claim to which preset tiers it unlocks.
// premium buyers also get everything basic includes.
export function allowedTiers(claimTier: string | null): string[] {
  if (claimTier === 'premium') return ['basic', 'premium'];
  if (claimTier === 'basic') return ['basic'];
  return [];
}

export function presetsForTier<T extends { tier: string }>(presets: T[], claimTier: string | null): T[] {
  const allowed = new Set(allowedTiers(claimTier));
  return presets.filter((p) => allowed.has(p.tier));
}
