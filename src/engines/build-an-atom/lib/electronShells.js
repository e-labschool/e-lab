// Simplified electron shell distribution (see shellDistribution for 21-36)
// for the FIRST 20 electrons --
// deliberately NOT a 2n^2 filling algorithm, which would incorrectly
// place up to 18 electrons in the third shell before starting a fourth.
// This is a display-only pedagogical model for S1.2 (detailed electron
// configuration is out of scope for this simulation), verified against
// every specified case (1, 2, 3, 4, 10, 11, 18, 19, 20 electrons)
// before use.
export const SHELL_CAPACITIES = [2, 8, 8, 2];

/** Returns an array of electron counts per shell, e.g. 11 -> [2, 8, 1].
 * 21-36 electrons: see SHELLS_21_TO_36. 37-40 (only reachable with a
 * negative charge) pile into the 4th shell -- a display convention, never
 * presented as a real filling rule. */
// Electrons 21-36: shells (K, L, M, N) of the NEUTRAL atom with that many
// electrons, from the ground-state configurations (Cr and Cu use their
// well-known 4s1 exceptions). It is applied by electron COUNT, so it is
// right for neutral atoms but only a display convention for ions of
// transition metals (Fe2+ really keeps 14 in shell 3, this shows the
// pattern of chromium's 24 electrons) -- never presented as a filling rule.
const SHELLS_21_TO_36 = {
  21: [2, 8, 9, 2], 22: [2, 8, 10, 2], 23: [2, 8, 11, 2], 24: [2, 8, 13, 1], 25: [2, 8, 13, 2],
  26: [2, 8, 14, 2], 27: [2, 8, 15, 2], 28: [2, 8, 16, 2], 29: [2, 8, 18, 1], 30: [2, 8, 18, 2],
  31: [2, 8, 18, 3], 32: [2, 8, 18, 4], 33: [2, 8, 18, 5], 34: [2, 8, 18, 6], 35: [2, 8, 18, 7], 36: [2, 8, 18, 8],
};

export function shellDistribution(electronCount) {
  if (SHELLS_21_TO_36[electronCount]) return SHELLS_21_TO_36[electronCount].slice();
  // 37-40 (anions of the heaviest supported elements): extra electrons go
  // into the 4th shell so the drawing never needs a 5th ring.
  if (electronCount > 36) return [2, 8, 18, electronCount - 28];
  const shells = [];
  let remaining = electronCount;
  for (const capacity of SHELL_CAPACITIES) {
    if (remaining <= 0) break;
    const inThisShell = Math.min(remaining, capacity);
    shells.push(inThisShell);
    remaining -= inThisShell;
  }
  while (remaining > 0) {
    const inThisShell = Math.min(remaining, 8);
    shells.push(inThisShell);
    remaining -= inThisShell;
  }
  return shells;
}
