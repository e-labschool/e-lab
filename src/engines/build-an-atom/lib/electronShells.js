// Simplified electron shell distribution for the FIRST 20 electrons --
// deliberately NOT a 2n^2 filling algorithm, which would incorrectly
// place up to 18 electrons in the third shell before starting a fourth.
// This is a display-only pedagogical model for S1.2 (detailed electron
// configuration is out of scope for this simulation), verified against
// every specified case (1, 2, 3, 4, 10, 11, 18, 19, 20 electrons)
// before use.
export const SHELL_CAPACITIES = [2, 8, 8, 2];

/** Returns an array of electron counts per shell, e.g. 11 -> [2, 8, 1].
 * Beyond 20 electrons (only reachable when a student builds an ion with
 * a large negative charge), additional electrons overflow into further
 * display-only buckets of 8 -- clearly outside the modeled 1-20 range,
 * never presented as a real filling rule. */
export function shellDistribution(electronCount) {
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
