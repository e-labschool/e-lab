// Computes electron (x,y) positions on each shell ring -- NEVER hand
// placed. For N electrons on one shell of radius r centred at (cx,cy):
//   theta_i = thetaOffset + 2*PI*i / N
//   x = cx + r*cos(theta_i)
//   y = cy + r*sin(theta_i)
// `thetaOffset` gives sensible starting angles for small, common electron
// counts (matching the brief's explicit examples: 2 electrons -> 90/270deg,
// 8 -> 45deg apart starting at the top, 1 -> straight up) while falling
// back to "start at the top" for any other count.
const OFFSET_DEGREES = { 1: -90, 2: -90 }; // 2 -> -90,90 i.e. 90deg/270deg from x-axis
function thetaOffsetFor(n) {
  if (OFFSET_DEGREES[n] != null) return (OFFSET_DEGREES[n] * Math.PI) / 180;
  return -Math.PI / 2; // start at the top (12 o'clock) for every other count
}

/** Returns [{x,y,angle}] for `count` electrons evenly spaced on a ring of
 * radius `r` centred at (cx, cy). */
export function electronPositionsOnShell(count, r, cx, cy) {
  if (count <= 0) return [];
  const thetaOffset = thetaOffsetFor(count);
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const theta = thetaOffset + (2 * Math.PI * i) / count;
    positions.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta), angle: theta });
  }
  return positions;
}

/** All electron positions for an atom's full shell map, one ring per
 * occupied shell. `shellRadius(n)` maps a principal shell number to a
 * pixel radius (caller supplies this so it stays a pure layout concern
 * shared with the shell-ring drawing code, never duplicated). */
export function allElectronPositions(shells, shellRadius, cx, cy) {
  const out = [];
  for (const n of Object.keys(shells).map(Number).sort((a, b) => a - b)) {
    const r = shellRadius(n);
    const positions = electronPositionsOnShell(shells[n], r, cx, cy);
    positions.forEach((p) => out.push({ ...p, shell: n }));
  }
  return out;
}
