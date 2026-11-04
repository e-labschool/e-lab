// Display-side preparation of the molecule FID model (nmr/molecular/model/moleculeFid.js) for the plots of steps 4 and 5.
// Nothing here changes the physics: it only slices, normalises and (for the small instrument display) reduces the sampled arrays.
const cache = new WeakMap();
const memo = (model, key, make) => {
  let m = cache.get(model); if (!m) { m = {}; cache.set(model, m); }
  return m[key] ?? (m[key] = make());
};

/** The FID for the step-5 graph: time axis (s) and the real part, cut at the window that covers the decay. */
export function fidSeries(model) {
  return memo(model, "fid", () => {
    const n = Math.min(model.fid.n, Math.max(8, Math.round(model.fidWindowS / model.acq.dwell)));
    const x = new Float64Array(n); const y = new Float64Array(n);
    for (let i = 0; i < n; i += 1) { x[i] = i * model.acq.dwell; y[i] = model.fid.re[i]; }
    return { x, y, window: [0, n * model.acq.dwell] };
  });
}

/** The spectrum for the step-5 graph: ppm (ascending) and the real part scaled to 0..1 of the tallest peak. */
export function spectrumSeries(model) {
  return memo(model, "spec", () => {
    const n = model.spec.size; const y = new Float64Array(n);
    for (let i = 0; i < n; i += 1) y[i] = model.spec.re[i] / model.specMax;
    return { x: model.ppm, y, window: model.window };
  });
}

/**
 * The same two signals reduced for the small display inside the instrument drawing:
 *   t[], y[]        a min/max zig-zag per column (so the decaying beat pattern is visible instead of aliased)
 *   ppm[], spec[]   the spectrum from high to low ppm (left to right) with the tallest sample per bin
 *   window, ppmWin  axis windows
 */
export function miniData(model, cols = 110, specPts = 260) {
  return memo(model, `mini${cols}/${specPts}`, () => {
    const f = fidSeries(model); const n = f.x.length; const per = n / cols;
    const t = []; const y = [];
    for (let c = 0; c < cols; c += 1) {
      const i0 = Math.floor(c * per); const i1 = Math.max(i0 + 1, Math.floor((c + 1) * per)); let mn = Infinity; let mx = -Infinity;
      for (let i = i0; i < i1 && i < n; i += 1) { const v = f.y[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      const tc = ((c + 0.5) * per) * model.acq.dwell;
      t.push(tc, tc); y.push(c % 2 ? mn : mx, c % 2 ? mx : mn);
    }
    const [lo, hi] = model.window; const ppm = []; const spec = [];
    const idx = []; for (let i = 0; i < model.ppm.length; i += 1) if (model.ppm[i] >= lo && model.ppm[i] <= hi) idx.push(i);
    const m = idx.length; const step = m / specPts;
    for (let k = 0; k < specPts; k += 1) {
      const a = Math.floor(k * step); const b = Math.max(a + 1, Math.floor((k + 1) * step)); let best = 0; let bi = idx[Math.min(m - 1, a)];
      for (let j = a; j < b && j < m; j += 1) { const v = model.spec.re[idx[j]] / model.specMax; if (v > best) { best = v; bi = idx[j]; } }
      ppm.push(model.ppm[bi]); spec.push(best);
    }
    ppm.reverse(); spec.reverse(); // high ppm first
    return { t, y, ppm, spec, window: f.window, ppmWin: [lo, hi] };
  });
}
