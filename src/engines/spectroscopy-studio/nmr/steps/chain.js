// The five-link teaching chain of step 3 and which link is "current" for a resonance region. Pure (no React); tested by scripts/test-nmr-steps.mjs.
//   Applied field -> Energy splitting -> Matching RF energy -> Resonance -> Absorption
export const CHAIN = [
  { id: "field", label: "Applied field B₀" },
  { id: "split", label: "Energy splitting ΔE" },
  { id: "match", label: "Matching RF energy" },
  { id: "resonance", label: "Resonance" },
  { id: "absorb", label: "Absorption" },
];
/**
 * Index of the current link for a region of cwRegion(): the field is on and the levels are split in step 3, so off and near resonance
 * are both "waiting at the matching link" (near = a partial match); on resonance the whole chain is complete and the last link is current.
 */
export const chainCurrent = (region) => (region === "on" ? CHAIN.length - 1 : 2);
/** State of link i: "done" | "current" | "pending". Near resonance the matching link reads "current" and the later ones stay pending. */
export function chainState(region, i) {
  const c = chainCurrent(region);
  return i < c ? "done" : i === c ? "current" : "pending";
}
