// Signal list generation, line shapes, integration and the spectrum-axis view model. PURE (no React, no three).
//
// Physics used (first-order / weak-coupling approximation, all stated in docs/NMR_MOLECULAR_MODEL.md):
//   * position:  nu = delta * nu0   (delta in ppm, nu0 = operating frequency in MHz  ->  Hz offset from TMS)
//   * coupling:  every equivalent-neighbour proton splits each line into two lines separated by J (Hz), J independent of B0.
//                n equivalent neighbours -> n + 1 lines with Pascal's-triangle intensities. Several neighbour sets are applied one after
//                another (convolution); with equal J the lines overlap into n_total + 1 lines (an apparent multiplet).
//   * line shape: Lorentzian of full width at half maximum w (Hz). Area of a line = (integral over Hz) = its share of the multiplet.
//   * integration: total area of a multiplet (all its lines) is proportional to the number of equivalent H, independent of coupling.
//
// Higher delta is drawn on the LEFT: view = { left, right } in ppm with left > right.

export const DEFAULT_LINEWIDTH_HZ = 1.2; // FWHM of every line unless an environment declares its own (e.g. broad exchanging OH)
export const DEFAULT_FREQ_MHZ = 400;
export const PPM_LIMITS = [-2, 14];
export const MIN_SPAN_PPM = 0.02;

export const MULT_NAMES = ["singlet", "doublet", "triplet", "quartet", "quintet", "sextet", "septet", "octet", "nonet"];
export const MULT_ABBR = ["s", "d", "t", "q", "quint", "sext", "sept", "oct", "non"];

export const hzFromPpm = (ppm, freqMHz) => ppm * freqMHz;
export const ppmFromHz = (hz, freqMHz) => hz / freqMHz;

/** Row n of Pascal's triangle (n = number of equivalent neighbours) -> n + 1 integers. */
export function pascalRow(n) {
  let row = [1];
  for (let i = 0; i < n; i += 1) { const next = [1]; for (let k = 1; k < row.length; k += 1) next.push(row[k - 1] + row[k]); next.push(1); row = next; }
  return row;
}
export const pascalText = (n) => pascalRow(n).join(":");

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function simplestRatio(counts) {
  const g = counts.reduce((acc, c) => gcd(acc, c), 0) || 1;
  return counts.map((c) => c / g);
}

/** One entry per neighbouring proton: { envId, J }. Exchangeable environments never couple (declared in the data). */
export function neighbourSpins(mol, envId) {
  const env = mol.environments.find((e) => e.id === envId);
  if (!env || env.exchangeable) return [];
  const spins = [];
  for (const c of mol.couplings) {
    const other = c.a === envId ? c.b : c.b === envId ? c.a : null;
    if (!other) continue;
    const oe = mol.environments.find((e) => e.id === other);
    if (oe.exchangeable) continue;
    for (let k = 0; k < oe.count; k += 1) spins.push({ envId: other, J: c.J });
  }
  return spins;
}

/** Neighbour sets of an environment: [{ envId, count, J }] */
export function neighbourSets(mol, envId) {
  const sets = new Map();
  for (const s of neighbourSpins(mol, envId)) { const cur = sets.get(s.envId) ?? { envId: s.envId, count: 0, J: s.J }; cur.count += 1; sets.set(s.envId, cur); }
  return [...sets.values()];
}

/**
 * Lines (offsets in Hz from the multiplet centre, weights summing to 1) after splitting by the first `k` spins.
 * Each spin splits every line into two lines at +-J/2. Offsets are multiplied by `progress` (0 -> single line, 1 -> full splitting),
 * which is how the splitting animation keeps the total area constant. Lines at identical unscaled offsets are merged (exact sum).
 */
export function splitOffsets(spins, k = spins.length, progress = 1) {
  let lines = [{ off: 0, w: 1 }];
  for (let i = 0; i < k; i += 1) {
    const half = spins[i].J / 2; const next = [];
    for (const l of lines) { next.push({ off: l.off - half, w: l.w / 2 }, { off: l.off + half, w: l.w / 2 }); }
    lines = next;
  }
  const merged = new Map();
  for (const l of lines) { const key = Math.round(l.off * 1e6); const cur = merged.get(key); if (cur) cur.w += l.w; else merged.set(key, { off: l.off, w: l.w }); }
  return [...merged.values()].sort((a, b) => a.off - b.off).map((l) => ({ offsetHz: l.off * progress, rel: l.w }));
}

/**
 * Splitting tree for the animation: nodes[level] = [{ off (Hz), w (weight), parent (index in level-1) }] for levels 0..ceil(phase).
 * Level j < floor(phase) is fully split; the level being created (floor(phase) + 1) is split by the fraction (phase - floor(phase)).
 * Total weight of every level is 1 (area conserved).
 */
export function splittingTree(spins, phase) {
  const full = Math.min(spins.length, Math.floor(phase + 1e-9));
  const frac = full >= spins.length ? 0 : Math.max(0, Math.min(1, phase - full));
  const levels = [[{ off: 0, w: 1, parent: -1 }]];
  const upto = frac > 0 ? full + 1 : full;
  for (let j = 1; j <= upto; j += 1) {
    const prev = levels[j - 1]; const f = j <= full ? 1 : frac; const half = (spins[j - 1].J / 2) * f; const next = [];
    prev.forEach((n, pi) => { next.push({ off: n.off - half, w: n.w / 2, parent: pi, J: spins[j - 1].J, envId: spins[j - 1].envId }, { off: n.off + half, w: n.w / 2, parent: pi, J: spins[j - 1].J, envId: spins[j - 1].envId }); });
    levels.push(next);
  }
  return levels;
}
/** Lines (Hz offset from the centre, weight) of the spectrum at animation phase `phase` (0..spins.length). Total weight is always 1. */
export function splitStage(spins, phase) { const t = splittingTree(spins, phase); return t[t.length - 1].map((n) => ({ offsetHz: n.off, rel: n.w })); }

function multiplicityOf(lines, spins, sets) {
  const n = spins.length;
  const pas = pascalRow(n); const total = pas.reduce((s, v) => s + v, 0);
  const sameJ = spins.every((s) => Math.abs(s.J - spins[0].J) < 1e-9);
  const matches = lines.length === n + 1 && lines.every((l, i) => Math.abs(l.rel - pas[i] / total) < 1e-9);
  const nameIdx = lines.length - 1;
  if (matches && sameJ) {
    return {
      name: MULT_NAMES[n] ?? "multiplet", abbr: MULT_ABBR[n] ?? "m", nNeighbours: n, nLines: n + 1, nPlusOne: true,
      equivalentNeighbours: sets.length <= 1, apparent: sets.length > 1, pascal: pas,
    };
  }
  return {
    name: n === 0 ? "singlet" : `multiplet (${lines.length} lines)`, abbr: n === 0 ? "s" : "m", nNeighbours: n, nLines: lines.length, nPlusOne: false,
    equivalentNeighbours: false, apparent: false, pascal: pas, nameIdx,
  };
}

/**
 * The signal list for a molecule.
 * opts: { freqMHz, coupling (bool), progress (0..1), jOverrideHz, linewidthHz, envIds (subset) }
 */
export function buildSignals(mol, opts = {}) {
  const { freqMHz = DEFAULT_FREQ_MHZ, coupling = true, progress = 1, jOverrideHz = null, linewidthHz = DEFAULT_LINEWIDTH_HZ, envIds = null } = opts;
  return mol.environments.filter((e) => !envIds || envIds.includes(e.id)).map((env) => {
    let spins = coupling ? neighbourSpins(mol, env.id) : [];
    if (jOverrideHz !== null) spins = spins.map((s) => ({ ...s, J: jOverrideHz }));
    const sets = coupling ? neighbourSets(mol, env.id) : [];
    const full = splitOffsets(spins, spins.length, 1);
    const mult = multiplicityOf(full, spins, sets);
    const centerHz = hzFromPpm(env.delta, freqMHz);
    const widthHz = env.linewidthHz ?? linewidthHz;
    const lines = splitOffsets(spins, spins.length, progress).map((l) => ({
      hz: centerHz + l.offsetHz, ppm: ppmFromHz(centerHz + l.offsetHz, freqMHz), rel: l.rel, area: l.rel * env.count,
    }));
    const lo = lines[0].hz; const hi = lines[lines.length - 1].hz;
    return {
      envId: env.id, env, label: env.label, count: env.count, deltaPpm: env.delta, centerHz, widthHz, lines, multiplicity: mult,
      neighbours: sets, spins, area: env.count, exchangeable: env.exchangeable,
      extentHz: [lo, hi], extentPpm: [ppmFromHz(lo, freqMHz), ppmFromHz(hi, freqMHz)],
      // half-width allowance so selection areas and view fitting include the Lorentzian skirts of the outer lines
      skirtPpm: ppmFromHz(widthHz * 4, freqMHz),
    };
  }).sort((a, b) => b.deltaPpm - a.deltaPpm);
}

/** Lorentzian line of AREA `area` (integral over Hz) and FWHM `w` Hz centred at hz0. */
export const lorentz = (hz, hz0, w, area) => (area * (w / 2)) / (Math.PI * ((hz - hz0) * (hz - hz0) + (w / 2) * (w / 2)));
export const lorentzPeak = (area, w) => (area * 2) / (Math.PI * w);

/** y(hz) of one signal (sum of its lines). */
export function signalIntensity(signal, hz) {
  let y = 0; for (const l of signal.lines) y += lorentz(hz, l.hz, signal.widthHz, l.area); return y;
}
export function spectrumIntensity(signals, hz) { let y = 0; for (const s of signals) y += signalIntensity(s, hz); return y; }

/**
 * Peak-aware sampling of one signal over a view. Returns { ppm: number[] (descending, i.e. left to right), y: number[] }.
 * A uniform grid (one point per ~pixel) plus, around every line, points spaced at equal fractions of the Lorentzian area
 * (x = x0 + (w/2) tan(pi (u - 1/2))) so a line only a fraction of a pixel wide is still drawn at its true height.
 */
export function sampleSignal(signal, view, freqMHz, widthPx = 800, reach = 30) {
  const loHz = view.right * freqMHz; const hiHz = view.left * freqMHz;
  const xs = [];
  const n = Math.min(1600, Math.max(120, Math.round(widthPx)));
  const winLo = Math.max(loHz, signal.extentHz[0] - reach * signal.widthHz); const winHi = Math.min(hiHz, signal.extentHz[1] + reach * signal.widthHz);
  if (winHi <= winLo) return { ppm: [], y: [] };
  for (let i = 0; i <= n; i += 1) { const hz = loHz + ((hiHz - loHz) * i) / n; if (hz >= winLo && hz <= winHi) xs.push(hz); }
  xs.push(winLo, winHi);
  const K = 40;
  for (const l of signal.lines) {
    for (let k = 0; k < K; k += 1) {
      const u = (k + 0.5) / K; const hz = l.hz + (signal.widthHz / 2) * Math.tan(Math.PI * (u - 0.5));
      if (hz >= winLo && hz <= winHi) xs.push(hz);
    }
    xs.push(l.hz);
  }
  xs.sort((a, b) => b - a); // descending Hz = left to right
  const ppm = []; const y = []; let last = Infinity;
  for (const hz of xs) { if (last - hz < 1e-9) continue; last = hz; ppm.push(hz / freqMHz); y.push(signalIntensity(signal, hz)); }
  return { ppm, y };
}

/** Cumulative integral from the high-delta (left) side to `hz`: step heights equal the areas (proton counts). */
export function cumulativeIntegral(signals, hz) {
  let total = 0;
  for (const s of signals) for (const l of s.lines) total += l.area * (0.5 - Math.atan((hz - l.hz) / (s.widthHz / 2)) / Math.PI);
  return total;
}

/** Numerically integrate a signal's trace over its own extent (+/- 400 half-widths): ~ its area (used by tests and the area comparison). */
export function integrateSignal(signal, reach = 4000) {
  const lo = signal.extentHz[0] - reach * signal.widthHz; const hi = signal.extentHz[1] + reach * signal.widthHz;
  // adaptive: integrate each Lorentzian analytically over [lo, hi]
  let area = 0;
  for (const l of signal.lines) area += l.area * ((Math.atan((hi - l.hz) / (signal.widthHz / 2)) - Math.atan((lo - l.hz) / (signal.widthHz / 2))) / Math.PI);
  return area;
}

/** Intensity-weighted centroid (Hz) of a signal's lines. Equals the centre (shift * nu0) for symmetric multiplets. */
export function centroidHz(signal) {
  let num = 0; let den = 0; for (const l of signal.lines) { num += l.hz * l.area; den += l.area; } return num / den;
}

// ---------- view model (zoom / pan / axis) ----------

export function defaultView(mol) {
  const deltas = mol.environments.map((e) => e.delta);
  const hi = Math.max(...deltas); const lo = Math.min(...deltas);
  const left = Math.min(PPM_LIMITS[1], Math.max(hi + 1.2, 5)); const right = Math.min(-0.5, lo - 0.5);
  return { left: Math.ceil(left * 2) / 2, right };
}

export function clampView(view, limits = PPM_LIMITS, minSpan = MIN_SPAN_PPM) {
  let span = view.left - view.right;
  const maxSpan = limits[1] - limits[0];
  span = Math.min(maxSpan, Math.max(minSpan, span));
  const centre = (view.left + view.right) / 2;
  let left = centre + span / 2; let right = centre - span / 2;
  if (right < limits[0]) { left += limits[0] - right; right = limits[0]; }
  if (left > limits[1]) { right -= left - limits[1]; left = limits[1]; }
  return { left, right };
}

/** Zoom about `anchorPpm` by `factor` (< 1 zooms in). The anchor keeps its relative position in the view. */
export function zoomView(view, factor, anchorPpm) {
  const a = anchorPpm ?? (view.left + view.right) / 2;
  return clampView({ left: a + (view.left - a) * factor, right: a + (view.right - a) * factor });
}
/** Pan so the content moves by `dPpm` (positive dPpm = the view window shifts towards higher delta). */
export function panView(view, dPpm) { return clampView({ left: view.left + dPpm, right: view.right + dPpm }); }

export function viewForPpmRange(lo, hi, pad = 0.35) {
  const span = Math.max(MIN_SPAN_PPM, hi - lo); const p = span * pad;
  return clampView({ left: hi + p, right: lo - p });
}
export function viewForSignal(signal) {
  const lo = signal.extentPpm[0]; const hi = signal.extentPpm[1];
  const span = Math.max(hi - lo, signal.skirtPpm * 2, 0.06);
  return viewForPpmRange((lo + hi) / 2 - span / 2 - signal.skirtPpm, (lo + hi) / 2 + span / 2 + signal.skirtPpm, 0.4);
}

/** Pixel mapping: higher delta on the LEFT. */
export const xOfPpm = (view, ppm, x0, x1) => x0 + ((view.left - ppm) / (view.left - view.right)) * (x1 - x0);
export const ppmOfX = (view, x, x0, x1) => view.left - ((x - x0) / (x1 - x0)) * (view.left - view.right);

/** Nice tick positions for the ppm axis. */
export function niceTicks(view, maxTicks = 12) {
  const span = view.left - view.right;
  const raw = span / Math.max(2, maxTicks);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const first = Math.ceil(view.right / step - 1e-9) * step;
  const ticks = [];
  for (let v = first; v <= view.left + 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return { ticks: ticks.reverse(), step, decimals };
}

/** Tallest line height among signals that have a line inside the view (for auto-scaling the vertical axis). */
export function visiblePeakHeight(signals, view) {
  let m = 0;
  for (const s of signals) for (const l of s.lines) if (l.ppm <= view.left && l.ppm >= view.right) m = Math.max(m, signalIntensity(s, l.hz));
  return m;
}

/** Signals fully inside the view (used by the integration trace so a partially visible multiplet is never mis-scaled). */
export function fullyVisible(signals, view) {
  return signals.filter((s) => s.extentPpm[1] + s.skirtPpm <= view.left && s.extentPpm[0] - s.skirtPpm >= view.right);
}

// ---------- reading a spectrum the way a student does ----------

/** Rows (sorted high to low delta): { envId, count, mult } -> used by integration questions and the identify-the-molecule logic. */
export function spectrumRows(mol, opts = {}) {
  return buildSignals(mol, { freqMHz: DEFAULT_FREQ_MHZ, coupling: true, ...opts }).map((s) => ({
    envId: s.envId, count: s.count, mult: s.multiplicity.name, abbr: s.multiplicity.abbr, delta: s.deltaPpm,
  }));
}
export function spectrumSignature(mol, { withShifts = false } = {}) {
  const rows = spectrumRows(mol);
  const ratio = simplestRatio(rows.map((r) => r.count));
  return rows.map((r, i) => `${ratio[i]}${r.abbr}${withShifts ? `@${r.delta.toFixed(1)}` : ""}`).join("|");
}

/** J expressed in ppm at an operating frequency (the same J in Hz is a smaller ppm gap at higher field). */
export const jInPpm = (jHz, freqMHz) => jHz / freqMHz;
/** B0 (tesla) -> proton Larmor frequency (MHz), nu = gamma B0 / 2pi with gamma/2pi = 42.577478 MHz/T (CODATA-level value). */
export const larmorMHz = (b0Tesla) => 42.577478 * b0Tesla;
