// Layout thresholds of the shared Simulation Dashboard Layout (pure; unit-testable).
// All values are CONTAINER sizes in px (the dashboard's own measured box), never window sizes.

/** Container width (px) at which the 3-column dashboard replaces the stacked layout. */
export const WIDE_MIN_WIDTH = 800;
/** Container width (px) at which the whole header (title | mode selector | actions) fits on ONE row. */
export const HEADER_ONE_ROW_MIN_WIDTH = 820;

export function classifyDashboard(width, height) {
  const layout = width >= WIDE_MIN_WIDTH ? "wide" : "stacked";
  const header = width >= HEADER_ONE_ROW_MIN_WIDTH ? "one" : "two";
  const w = width >= 1500 ? "xl" : width >= 1100 ? "lg" : "md";
  const density = layout !== "wide" ? "normal" : height < 620 ? "tight" : height < 820 ? "normal" : "roomy";
  // Size scale for big boxes (fullscreen on large monitors): fonts, gaps and the bottom row grow
  // up to 28 %, so the chamber and graph (which fill the rest) get bigger without tiny text.
  const raw = layout === "wide" ? Math.min(width / 1100, height / 700) : 1;
  const scale = Math.round(Math.min(1.28, Math.max(1, raw)) * 50) / 50;
  return { layout, header, w, density, scale };
}
