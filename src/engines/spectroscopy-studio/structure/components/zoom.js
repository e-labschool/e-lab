// Zoom arithmetic for the three spectrum views. A range is [lo, hi] with lo < hi in the axis unit (m/z, cm⁻¹ or ppm); the plots decide which end is drawn on the left.
export const clampRange = ([lo, hi], [L, H], minSpan) => {
  let span = Math.min(H - L, Math.max(minSpan, hi - lo)); let a = (lo + hi) / 2 - span / 2; let b = a + span;
  if (a < L) { b += L - a; a = L; } if (b > H) { a -= b - H; b = H; }
  return [Math.max(L, a), Math.min(H, b)];
};
/** factor < 1 zooms in about `anchor` (default: the centre), > 1 zooms out. The anchor keeps its relative position. */
export function zoomRange(range, factor, anchor, limits, minSpan) {
  const a = anchor ?? (range[0] + range[1]) / 2; const lo = a + (range[0] - a) * factor; const hi = a + (range[1] - a) * factor;
  return clampRange([lo, hi], limits, minSpan);
}
export const panRange = (range, fraction, limits, minSpan) => { const d = (range[1] - range[0]) * fraction; return clampRange([range[0] + d, range[1] + d], limits, minSpan); };
export const isZoomed = (range, limits) => range[1] - range[0] < limits[1] - limits[0] - 1e-9;
