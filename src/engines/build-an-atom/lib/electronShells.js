// Electrons per shell for the drawing. Thin wrapper: the single source of truth is
// lib/electronConfiguration.js (ground-state configuration for that many electrons,
// shell totals derived from it, true 2n^2 maxima). 0 electrons -> [].
import { shellArrangement } from "./electronConfiguration.js";

/** Returns electrons per shell, e.g. 11 -> [2, 8, 1], 25 -> [2, 8, 13, 2], 37 -> [2, 8, 18, 8, 1]. */
export function shellDistribution(electronCount) {
  return shellArrangement(electronCount);
}
