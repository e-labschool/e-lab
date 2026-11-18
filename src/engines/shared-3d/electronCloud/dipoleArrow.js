// The CHEMISTRY dipole-arrow convention (pure geometry; no three). Used by every dipole arrow in the Polarity Playground and the
// Intermolecular Forces Visualiser.
//
//   * The arrow starts on the delta-PLUS (less electronegative) end with a short bar crossing the tail: "+-->"
//   * The arrowhead points to the delta-MINUS (more electronegative) end.
//   * This is the OPPOSITE of the physics electric-dipole vector (which points from - to +). Nothing here uses the physics sense:
//     every caller passes the delta-plus position first and the delta-minus position second.
import { add, len, mul, sub, unit } from "./vec3.js";

/** { tail, head, dir, length, shaftEnd, headLength } for an arrow drawn between a delta-plus and a delta-minus position. */
export function chemistryArrow(plusPos, minusPos, { headLength = 0.34, headFraction = 0.28 } = {}) {
  const dir = unit(sub(minusPos, plusPos)); const length = len(sub(minusPos, plusPos));
  const hl = Math.min(headLength, Math.max(0.0001, length * headFraction + 0.0));
  return { tail: [...plusPos], head: [...minusPos], dir, length, headLength: hl, shaftEnd: sub(minusPos, mul(dir, hl)), crossAt: "tail" };
}
/** The arrow of a dipole VECTOR in chemistry convention: starts at `origin` and points along `v` (v already pointing towards delta-minus). */
export function chemistryArrowFromVector(origin, v, opts) { return chemistryArrow(origin, add(origin, v), opts); }
