// Pure layout helpers for the spectrum strip (tested in scripts/test-atomic-round2.mjs).
export function tickStep(span) {
  if (span <= 3) return 0.5; if (span <= 6) return 1; if (span <= 20) return 5; if (span <= 60) return 10; if (span <= 160) return 25; return 50;
}
/** Which line labels fit: left to right, a label is drawn only if it is at least `minGap` px from the previous label on its row (two rows). */
export function placeLineLabels(xs, minGap = 30) {
  const lastX = [-1e9, -1e9]; const out = [];
  xs.forEach(({ x, i }) => {
    const row = x - lastX[0] >= minGap ? 0 : x - lastX[1] >= minGap ? 1 : -1;
    if (row >= 0) { lastX[row] = x; out.push({ i, x, row }); }
  });
  return out;
}
