// THE STANDARD ONE-MOLE PACKET: fixed reference geometry and pure surface maths (no three.js, unit-tested).
//
// Every packet in every stage uses exactly these dimensions.  A packet is NEVER resized to represent an amount: fewer
// particles sit lower in the same bag and the empty part of the pouch relaxes flat (it can fold, but its outline stays).
// The bag is a conceptual counting container (spec A2): its size says nothing about molar volume or density.
//
// Coordinates: x across the width, y up from the table (bag base at y = 0), z towards the viewer.

export const BAG = Object.freeze({
  width: 1.6,
  height: 2.3,
  depth: 0.58,        // front-to-back bulge of a FULL pouch at its widest point
  flatDepth: 0.05,    // bulge of the empty / relaxed part
  zipV: 0.84,         // zipper line as a fraction of the height
  zipThickness: 0.055,
  interior: Object.freeze({ x: 0.58, yMin: 0.14, yMax: 1.82, z: 0.105 }), // particle-centre limits
});
export const BAG_SEGMENTS = Object.freeze({ u: 28, v: 36 });

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export { smooth };

/** Fraction of the interior height filled when the packet holds `fraction` of a mole (the ONLY input). */
export const fillLevelV = (fraction) => {
  const lo = BAG.interior.yMin / BAG.height; const hi = BAG.interior.yMax / BAG.height;
  return lo + (hi - lo) * Math.min(1, Math.max(0, fraction));
};

/**
 * Front/back surface z at (u, v), u in [-1,1] across the width, v in [0,1] up the bag.
 * @param side +1 front sheet, -1 back sheet
 * @param p { fill: 0..1 (display fill fraction), open: 0..1 (zipper opening) }
 */
export function bagSurfaceZ(u, v, side, p) {
  const fill = Math.min(1, Math.max(0, p.fill)); const open = Math.min(1, Math.max(0, p.open ?? 0));
  const edge = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.4)), 0.5);           // sealed side edges pinch the sheets together
  const bottom = Math.pow(smooth(0, 0.2, v), 0.65);                                   // sealed bottom edge
  const level = fillLevelV(fill);
  const content = fill <= 0 ? 0 : smooth(level + 0.14, level - 0.1, v);               // 1 where particles are, relaxing to 0 above them
  const belowZip = smooth(BAG.zipV + 0.02, BAG.zipV - 0.14, v);                       // the lip above the zipper is always flat
  const amp = (BAG.flatDepth + (BAG.depth - BAG.flatDepth) * content * (0.55 + 0.45 * fill ** 0.35)) * 0.5;
  let z = amp * edge * bottom * belowZip;
  // folds: gentle diagonal creases + ripples near the seams; stronger where the bag is not stretched by contents
  const slack = 1 - content;
  z += 0.012 * slack * Math.sin(9 * u + 5.5 * v + 0.6) * edge * bottom + 0.010 * Math.sin(17 * u - 3 * v) * (1 - Math.abs(u)) * 0.5 * (0.4 + slack);
  z += 0.014 * Math.exp(-Math.pow((u - 0.62 - 0.3 * v) * 5, 2)) * smooth(0.18, 0.6, v) * smooth(0.95, 0.6, v) * (0.5 + slack); // one diagonal crease
  z += 0.008 * Math.sin(40 * v + 7 * u) * Math.exp(-Math.pow(u * 1.1, 2)) * smooth(BAG.zipV - 0.02, BAG.zipV + 0.12, v) * 0.6;      // ripples just above the zipper
  // the opened mouth: the two sheets part around the zipper line
  if (open > 0) z += open * 0.2 * smooth(BAG.zipV - 0.16, BAG.zipV + 0.02, v) * (0.35 + 0.65 * edge) + open * 0.14 * smooth(BAG.zipV, 1, v) * edge;
  return side * z;
}
/** Vertical placement of a sheet vertex. */
export const vToY = (v) => v * BAG.height;
export const uToX = (u) => u * BAG.width * 0.5;
