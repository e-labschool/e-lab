// Pick a readable label colour for a control whose fill is data-driven (an orbital family colour, a CPK element colour...).
// Presentation helper only: returns white or a deep navy, whichever gives the higher WCAG contrast against `fill`.
function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const h = String(hex).replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrastRatio(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function readableInk(fill, light = "#ffffff", dark = "#0b1630") {
  return contrastRatio(light, fill) >= contrastRatio(dark, fill) ? light : dark;
}
