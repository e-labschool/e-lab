// Adaptive point-density tiers for Build an Atom's probability clouds.
// Desktop gets the full, rich density the brief asks for by default;
// narrower/touch viewports (where several overlapping 10,000-point
// clouds would strain the GPU/CPU and the viewer is smaller anyway)
// automatically step down. Purely a viewport-width heuristic, computed
// once, matching the existing mobile-detection pattern in ThreeCanvas.
export const QUALITY_TIERS = {
  high: 10000,
  medium: 5000,
  low: 3000,
};

export function detectQualityTier() {
  if (typeof window === "undefined") return "high";
  const w = window.innerWidth;
  if (w < 640) return "low";
  if (w < 1024) return "medium";
  return "high";
}

export function pointsPerOrbitalFor(tier) {
  return QUALITY_TIERS[tier] ?? QUALITY_TIERS.high;
}
