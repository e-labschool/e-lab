import { R_IB, STP, SATP, PRESSURE_UNITS, VOLUME_UNITS, KELVIN_OFFSET } from "../../lib/gas/gasUnits.js";

// Gas Laws Explorer -- pure scientific model (no React, no DOM) so it can be
// tested in Node (scripts/test-gas-laws-model.mjs). Rendering lives elsewhere.
//
// ---------------------------------------------------------------------------
// ONE SOURCE OF TRUTH
// ---------------------------------------------------------------------------
// state = { mode, P (kPa), V (dm^3), T (K), n (mol), calc? } with PV = nRT,
// R = 8.31 J K^-1 mol^-1 = 8.31 kPa dm^3 K^-1 mol^-1 (IB data booklet 2025; no conversion factor appears).
// Other pressure / volume units (atm, mmHg, L, cm^3) are DISPLAY conversions only (src/lib/gas/gasUnits.js). Everything displayed, plotted or drawn
// (piston height, particle count, speeds) derives from this object.
//
// MODES (adjustable / locked / calculated):
//   pv  V    / T, n / P        Boyle     P ~ 1/V
//   vt  T    / P, n / V        Charles   V ~ T
//   pt  T    / V, n / P        Gay-Lussac P ~ T
//   vn  n    / P, T / V        Avogadro  V ~ n
//   comb  any three of P, V, T, n are free; state.calc ("P" default) names the calculated one: PV = nRT
//
// RANGES (every reachable state stays inside them):
//   V 5-50 dm^3 (the piston's drawable range), T 100-800 K (1 K steps; typed values may have decimals, e.g. 273.15),
//   n 0.5-2.0 mol, P 10-1000 kPa. A control's EFFECTIVE range is its hard range intersected
//   with the interval that keeps the calculated variable inside ITS range
//   (effectiveRange); setVariable clamps to it, so the piston / particle
//   mapping can never be driven out of bounds.
//
// PARTICLE MAPPING: N = round(n / MOL_PER_PARTICLE), MOL_PER_PARTICLE = 0.05
//   mol per drawn particle (10-40 particles for 0.5-2.0 mol; n = 1.00 mol
//   -> 20). Particles are a visual sample, not literal molecules.
// PISTON MAPPING: piston underside height (chamber units) =
//   CHAMBER.maxHeight * V / V_max, i.e. linear and exact in V (0 L = floor).
// ---------------------------------------------------------------------------

export const R_GAS = R_IB; // kPa dm^3 K^-1 mol^-1 (= J K^-1 mol^-1)
export const AVOGADRO = 6.02214076e23; // mol^-1
export { STP, SATP };

export const RANGES = Object.freeze({
  P: Object.freeze({ min: 10, max: 1000, step: 5 }),
  V: Object.freeze({ min: 5, max: 50, step: 0.5 }),
  T: Object.freeze({ min: 100, max: 800, step: 1 }),
  n: Object.freeze({ min: 0.5, max: 2, step: 0.05 }),
});

export const VARS = Object.freeze({
  P: { key: "P", name: "Pressure", unit: "kPa", decimals: 1 },
  V: { key: "V", name: "Volume", unit: "dm\u00b3", decimals: 1 },
  T: { key: "T", name: "Temperature", unit: "K", decimals: 0 },
  n: { key: "n", name: "Amount of gas", unit: "mol", decimals: 2 },
});

export const MODE_IDS = Object.freeze(["pv", "vt", "pt", "vn", "comb"]);
/** The four single-relationship investigations (the All Graphs View compares these). */
export const SINGLE_MODE_IDS = Object.freeze(["pv", "vt", "pt", "vn"]);

export const MODES = Object.freeze({
  pv: { id: "pv", short: "P – V", title: "Pressure – Volume", law: "Boyle’s relationship", independent: "V", locked: ["T", "n"], dependent: "P", relation: "P ∝ 1/V", constantText: "at constant T and n", sentence: "As volume decreases, pressure increases." },
  vt: { id: "vt", short: "V – T", title: "Temperature – Volume", law: "Charles’s relationship", independent: "T", locked: ["P", "n"], dependent: "V", relation: "V ∝ T", constantText: "at constant P and n", sentence: "As temperature increases, volume increases." },
  pt: { id: "pt", short: "P – T", title: "Temperature – Pressure", law: "Gay-Lussac’s relationship", independent: "T", locked: ["V", "n"], dependent: "P", relation: "P ∝ T", constantText: "at constant V and n", sentence: "As temperature increases, pressure increases." },
  vn: { id: "vn", short: "V – n", title: "Amount of Gas", law: "Avogadro’s relationship", independent: "n", locked: ["P", "T"], dependent: "V", relation: "V ∝ n", constantText: "at constant P and T", sentence: "As the amount of gas increases, volume increases." },
  comb: { id: "comb", short: "PV = nRT", title: "Ideal gas equation", law: "Ideal gas equation", independent: null, locked: [], dependent: "P", relation: "PV = nRT", constantText: "with R = 8.31 J K\u207b\u00b9 mol\u207b\u00b9", sentence: "Choose which variable to calculate; change the other three." },
});

/** The calculated variable of a state (fixed per mode, chosen by the student in the combined mode). */
export function depOf(state) { return state.mode === "comb" ? (state.calc && VARS[state.calc] ? state.calc : "P") : MODES[state.mode].dependent; }
/** Variables the student may change in this state. */
export function freeKeys(state) {
  if (state.mode === "comb") return ["n", "T", "V", "P"].filter((k) => k !== depOf(state));
  return [MODES[state.mode].independent];
}

// Baseline every mode (and Reset) starts from: n = 1.00 mol, T = 300 K, V = 25 dm^3 (P = 99.7 kPa).
export const DEFAULT_BASELINE = Object.freeze({ n: 1, T: 300, V: 25 }); // P = 99.7 kPa: an everyday gas

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const side = (k) => (k === "P" || k === "V" ? 0 : 1); // PV | nRT

export function pressureOf(n, T, V) { return (n * R_GAS * T) / V; }

export function computeDependent(dep, s) {
  switch (dep) {
    case "P": return (s.n * R_GAS * s.T) / s.V;
    case "V": return (s.n * R_GAS * s.T) / s.P;
    case "T": return (s.P * s.V) / (s.n * R_GAS);
    default: return (s.P * s.V) / (R_GAS * s.T);
  }
}

/** Build a full consistent state; `given` supplies the three non-dependent
 * variables, the dependent one is calculated from PV = nRT. */
export function makeState(mode, given, calc) {
  const s = { mode, P: given.P, V: given.V, T: given.T, n: given.n };
  if (mode === "comb") s.calc = calc ?? given.calc ?? "P";
  const dep = depOf(s);
  s[dep] = computeDependent(dep, s);
  return s;
}

/** Standard-condition presets (IB data booklet 2025): STP 273.15 K and 100 kPa, SATP 298.15 K and 100 kPa, n = 1.00 mol.
 *  Returns a full consistent state for `mode` (V then comes out as 22.70 / 24.78 dm^3). */
export function presetState(mode, preset, calc) {
  const c = preset === "satp" ? SATP : STP;
  const V = (1 * R_GAS * c.T) / c.P_kPa;
  return makeState(mode, { n: 1, T: c.T, P: c.P_kPa, V }, calc);
}

/** The default (reset) state for a mode. */
export function defaultState(mode) {
  const P = pressureOf(DEFAULT_BASELINE.n, DEFAULT_BASELINE.T, DEFAULT_BASELINE.V);
  return makeState(mode, { ...DEFAULT_BASELINE, P });
}

/** Switching relationship keeps all four values (they are already consistent),
 * so nothing jumps; only which variable is adjustable / locked / calculated changes. */
export function switchMode(state, mode) {
  return makeState(mode, state, mode === "comb" ? (state.calc ?? "P") : undefined);
}

export function residual(s) { return Math.abs(s.P * s.V - s.n * R_GAS * s.T); }

/** Hard range of `key`, narrowed so the calculated variable stays inside its own range. */
export function effectiveRange(state, key) {
  const hard = RANGES[key];
  const dep = depOf(state);
  if (key === dep) return { min: hard.min, max: hard.max, hard, limited: false, adjustable: false };
  const y0 = state[dep];
  const x0 = state[key];
  const ry = RANGES[dep];
  let lo;
  let hi;
  if (side(key) === side(dep)) { lo = (x0 * y0) / ry.max; hi = (x0 * y0) / ry.min; } // y ~ 1/x
  else { lo = (x0 * ry.min) / y0; hi = (x0 * ry.max) / y0; } // y ~ x
  const min = Math.max(hard.min, lo);
  const max = Math.min(hard.max, hi);
  return { min, max, hard, limited: min > hard.min + 1e-9 || max < hard.max - 1e-9, adjustable: true, dep,
    // which bound of the calculated variable stops the slider at each end (null = the control's own hard range does)
    minBy: min > hard.min + 1e-9 ? (side(key) === side(dep) ? "max" : "min") : null,
    maxBy: max < hard.max - 1e-9 ? (side(key) === side(dep) ? "min" : "max") : null };
}

/** Why a value sits at an end of its slider, in words that are true: names the calculated variable and the bound it would hit.
 *  null when the value is not at an end or the end is the control's own range. */
export function limitReason(state, key, units = {}, maxTol = 0) {
  const r = effectiveRange(state, key);
  if (!r.adjustable) return null;
  const v = state[key];
  const tag = v <= r.min + 1e-9 ? r.minBy : (v >= r.max - 1e-9 || (maxTol > 0 && v > r.max - maxTol + 1e-6)) ? r.maxBy : null;
  if (!tag) return null;
  const bound = RANGES[r.dep][tag];
  const name = VARS[r.dep].name.toLowerCase();
  const word = tag === "min" ? "below" : "above";
  const shown = r.dep === "P" ? formatValue("P", bound, units) + " " + unitLabel("P", units) : formatValue(r.dep, bound, units) + " " + unitLabel(r.dep, units);
  return `Limit reached: any further and the ${name} would go ${word} ${shown}, the range this simulation can draw.`;
}

/** Change one variable (clamped to its effective range) and recalculate the dependent one.
 * Locked variables are never touched. */
export function setVariable(state, key, value) {
  const dep = depOf(state);
  if (key === dep || !Number.isFinite(value)) return { state, clamped: false, changed: false };
  const r = effectiveRange(state, key);
  const v = clamp(value, r.min, r.max);
  const next = { ...state, [key]: v };
  next[dep] = clamp(computeDependent(dep, next), RANGES[dep].min, RANGES[dep].max);
  return { state: next, clamped: Math.abs(v - value) > 1e-12, changed: v !== state[key] };
}

// ---------------------------------------------------------------------------
// Particle / piston mapping
// ---------------------------------------------------------------------------
export const CHAMBER = Object.freeze({ width: 160, maxHeight: 190 }); // units
export const MOL_PER_PARTICLE = 0.05;
export function particleCount(n) { return Math.max(0, Math.round(n / MOL_PER_PARTICLE)); }
export function pistonHeight(V) { return (CHAMBER.maxHeight * V) / RANGES.V.max; }

// ---------------------------------------------------------------------------
// Number formatting (display only -- never touches the state)
// ---------------------------------------------------------------------------
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻", "+": "" };
export function superscript(int) { return String(int).split("").map((c) => SUP[c] ?? c).join(""); }

/** Scientific notation with correct rounding/renormalisation (9.9996e23 -> 1.00 x 10^24). */
export function formatScientific(x, digits = 2) {
  if (!Number.isFinite(x) || x === 0) return { mantissa: (0).toFixed(digits), exponent: 0, text: (0).toFixed(digits) };
  const [m, e] = x.toExponential(digits).split("e");
  const exponent = Number(e);
  return { mantissa: m, exponent, text: `${m} × 10${superscript(exponent)}` };
}

export function moleculeCount(n) { return n * AVOGADRO; }

/** Amount in the chosen display unit ("mol" | "molecules"). */
export function displayAmount(n, unit) {
  if (unit === "molecules") {
    const f = formatScientific(moleculeCount(n), 2);
    return { ...f, unit: "molecules", text: `${f.text} molecules` };
  }
  return { mantissa: n.toFixed(2), exponent: null, unit: "mol", text: `${n.toFixed(2)} mol` };
}

/** Display units: { pressure: "kPa"|"atm"|"mmHg", volume: "dm3"|"L"|"cm3" } (default IB: kPa, dm3). The state itself is always kPa / dm^3. */
export const IB_UNITS = Object.freeze({ pressure: "kPa", volume: "dm3" });
const pu = (u) => PRESSURE_UNITS[u?.pressure] ?? PRESSURE_UNITS.kPa;
const vu = (u) => VOLUME_UNITS[u?.volume] ?? VOLUME_UNITS.dm3;
export function unitLabel(key, units) { return key === "P" ? pu(units).label : key === "V" ? vu(units).label : VARS[key].unit; }
/** Value of `key` in the display unit. */
export function displayValue(key, x, units) { return key === "P" ? x * pu(units).perKPa : key === "V" ? x * vu(units).perDm3 : x; }
export function fromDisplayValue(key, x, units) { return key === "P" ? x / pu(units).perKPa : key === "V" ? x / vu(units).perDm3 : x; }
export function decimalsFor(key, x, units) {
  if (key === "P") return pu(units).decimals;
  if (key === "V") return vu(units).decimals;
  if (key === "T") return Math.abs(x - Math.round(x)) < 0.005 ? 0 : 2; // 273.15 K must read 273.15, not 273
  return VARS[key].decimals;
}
export function formatValue(key, x, units) { return displayValue(key, x, units).toFixed(decimalsFor(key, x, units)); }
export function formatWithUnit(key, x, units) { return `${formatValue(key, x, units)} ${unitLabel(key, units)}`; }
/** "300 K (26.85 \u00b0C)" */
export function temperatureBoth(T) { const c = T - KELVIN_OFFSET; return `${formatValue("T", T)} K (${(Math.abs(c) < 0.005 ? 0 : c).toFixed(Math.abs(c - Math.round(c)) < 0.005 ? 0 : 2).replace("-", "\u2212")} \u00b0C)`; }

// ---------------------------------------------------------------------------
// Graphs
// ---------------------------------------------------------------------------
// dims = exponents of P and V in the axis quantity, so display-unit factors can be applied (kPa -> atm, dm^3 -> L / cm^3).
const AXES = {
  V: { name: "V", base: "Volume, V", unit: (u) => unitLabel("V", u), dec: 1, dims: { V: 1 }, f: (s) => s.V },
  P: { name: "P", base: "Pressure, P", unit: (u) => unitLabel("P", u), dec: 1, dims: { P: 1 }, f: (s) => s.P },
  invV: { name: "1/V", base: "1/V", unit: (u) => `${unitLabel("V", u)}\u207b\u00b9`, dec: 4, dims: { V: -1 }, f: (s) => 1 / s.V },
  PV: { name: "PV", base: "PV", unit: (u) => `${unitLabel("P", u)}\u00b7${unitLabel("V", u)}`, dec: 0, dims: { P: 1, V: 1 }, f: (s) => s.P * s.V },
  Tk: { name: "T", base: "Temperature, T", unit: () => "K", dec: 0, dims: {}, f: (s) => s.T },
  Tc: { name: "t", base: "Temperature, t", unit: () => "\u00b0C", dec: 1, dims: {}, f: (s) => s.T - 273.15 },
  VoverT: { name: "V/T", base: "V/T", unit: (u) => `${unitLabel("V", u)} K\u207b\u00b9`, dec: 4, dims: { V: 1 }, f: (s) => s.V / s.T },
  PoverT: { name: "P/T", base: "P/T", unit: (u) => `${unitLabel("P", u)} K\u207b\u00b9`, dec: 4, dims: { P: 1 }, f: (s) => s.P / s.T },
  n: { name: "n", base: "Amount, n", unit: () => "mol", dec: 2, dims: {}, f: (s) => s.n },
  VoverN: { name: "V/n", base: "V/n", unit: (u) => `${unitLabel("V", u)} mol\u207b\u00b9`, dec: 2, dims: { V: 1 }, f: (s) => s.V / s.n },
  nT: { name: "nT", base: "nT", unit: () => "mol K", dec: 0, dims: {}, f: (s) => s.n * s.T },
  PVoverNT: { name: "PV/nT", base: "PV/nT", unit: (u) => `${unitLabel("P", u)} ${unitLabel("V", u)} mol\u207b\u00b9 K\u207b\u00b9`, dec: 2, dims: { P: 1, V: 1 }, f: (s) => (s.P * s.V) / (s.n * s.T) },
};
/** Factor that converts an axis quantity from kPa / dm^3 to the display units. */
export function axisFactor(ax, units) {
  const pf = PRESSURE_UNITS[units?.pressure]?.perKPa ?? 1; const vf = VOLUME_UNITS[units?.volume]?.perDm3 ?? 1;
  return pf ** (ax.dims.P ?? 0) * vf ** (ax.dims.V ?? 0);
}
export const axisDef = (id) => AXES[id];

const EXTRAP_ORIGIN = "extrapolation to the origin (outside the accessible range)";
export const CELSIUS_EXTRAPOLATION_NOTE = "extrapolation: real gases condense/liquefy before this; not physically accessible";

export const GRAPH_DEFS = Object.freeze({
  pv: [
    { id: "p-v", label: "P vs V", x: "V", y: "P", kind: "curve", ext: null, formula: "P = nRT / V", interp: "Pressure falls as volume rises: P ∝ 1/V, a curve (halve V and P doubles)." },
    { id: "p-invv", label: "P vs 1/V", x: "invV", y: "P", kind: "line", ext: "invV", formula: "P = nRT · (1/V)", interp: "P against 1/V is a straight line through the origin, so P is directly proportional to 1/V." },
    { id: "pv-v", label: "PV vs V", x: "V", y: "PV", kind: "flat", ext: null, formula: "PV = nRT", interp: "PV stays constant (= nRT) at every volume: a horizontal line." },
  ],
  vt: [
    { id: "v-tk", label: "V vs T (K)", x: "Tk", y: "V", kind: "line", ext: "origin", formula: "V = (nR/P) · T", interp: "V is directly proportional to absolute temperature: a straight line through the origin." },
    { id: "v-tc", label: "V vs T (°C)", x: "Tc", y: "V", kind: "line", ext: "celsius", formula: "V = (nR/P) · (t + 273.15)", interp: "Extended (dashed), the line reaches V = 0 at −273.15 °C, but real gases liquefy long before that." },
    { id: "v-over-t", label: "V/T vs T (K)", x: "Tk", y: "VoverT", kind: "flat", ext: null, formula: "V/T = nR/P", interp: "V/T stays constant (= nR/P) at every temperature: a horizontal line." },
  ],
  pt: [
    { id: "p-tk", label: "P vs T (K)", x: "Tk", y: "P", kind: "line", ext: "origin", formula: "P = (nR/V) · T", interp: "P is directly proportional to absolute temperature: a straight line through the origin." },
    { id: "p-tc", label: "P vs T (°C)", x: "Tc", y: "P", kind: "line", ext: "celsius", formula: "P = (nR/V) · (t + 273.15)", interp: "Extended (dashed), the line reaches P = 0 at −273.15 °C, but real gases liquefy long before that." },
    { id: "p-over-t", label: "P/T vs T (K)", x: "Tk", y: "PoverT", kind: "flat", ext: null, formula: "P/T = nR/V", interp: "P/T stays constant (= nR/V) at every temperature: a horizontal line." },
  ],
  vn: [
    { id: "v-n", label: "V vs n", x: "n", y: "V", kind: "line", ext: "origin", formula: "V = (RT/P) · n", interp: "V is directly proportional to the amount of gas: a straight line through the origin." },
    { id: "v-over-n", label: "V/n vs n", x: "n", y: "VoverN", kind: "flat", ext: null, formula: "V/n = RT/P", interp: "V/n stays constant (= RT/P) for every amount: a horizontal line." },
  ],
  comb: [
    { id: "pv-nt", label: "PV vs nT", x: "nT", y: "PV", kind: "line", ext: "origin", formula: "PV = R · nT", interp: "PV against nT is a straight line through the origin whose gradient is R = 8.31 J K\u207b\u00b9 mol\u207b\u00b9." },
    { id: "r-nt", label: "PV/nT vs T", x: "Tk", y: "PVoverNT", kind: "flat", ext: null, formula: "PV/nT = R", interp: "PV/nT is the same at every temperature: it equals the gas constant R = 8.31." },
  ],
});

export function graphOptions(mode) { return GRAPH_DEFS[mode]; }
export function defaultGraphId(mode) { return GRAPH_DEFS[mode][0].id; }
export function getGraphDef(mode, id) { return GRAPH_DEFS[mode].find((g) => g.id === id) ?? GRAPH_DEFS[mode][0]; }

/** Nice axis scale: {min, max, ticks}. */
export function niceScale(lo, hi, target = 5) {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / Math.max(1, target - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1.5 ? 1 : f <= 3.2 ? 2 : f <= 7 ? 5 : 10) * mag;
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let t = min; t <= max + step * 1e-6; t += step) ticks.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toPrecision(12)));
  return { min, max, ticks };
}

/** The state reached when the independent variable takes value u (no clamping:
 * used for the accessible range and for the dashed extrapolation). */
function stateAlong(state, u) {
  const independent = MODES[state.mode].independent; const dependent = depOf(state);
  const s = { ...state, [independent]: u };
  s[dependent] = computeDependent(dependent, s);
  return s;
}

function linspace(a, b, k) { return Array.from({ length: k }, (_, i) => a + ((b - a) * i) / (k - 1)); }

function constantsText(state, units) {
  if (state.mode === "comb") return "P, V, T and n are linked by PV = nRT (R = 8.31)";
  const locked = MODES[state.mode].locked;
  return locked.map((k) => `${k} = ${formatWithUnit(k, state[k], units)} (constant)`).join(", ");
}

/** Everything the graph needs, computed from the model using the investigation's locked variables (taken from `state`).
 *  `units` converts the displayed axes (the model itself stays in kPa / dm^3). */
export function buildGraph(state, graphId, { samples = 48, ticks = 5, marker = true, units = IB_UNITS } = {}) {
  const def = getGraphDef(state.mode, graphId);
  const ax = AXES[def.x];
  const ay = AXES[def.y];
  const fx = axisFactor(ax, units); const fy = axisFactor(ay, units);
  const comb = state.mode === "comb";
  const ind = comb ? null : MODES[state.mode].independent;
  // combined mode: the line is PV = R nT over the reachable nT range, drawn from a sweep of T at the largest n and the smallest n.
  const r = comb ? { min: RANGES.T.min, max: RANGES.T.max } : effectiveRange(state, ind);
  const n = def.kind === "curve" ? samples * 2 : samples;
  const pt = (u) => {
    const s = comb ? { ...state, n: 1, T: u, V: 1, P: R_GAS * u } : stateAlong(state, u);
    if (comb && def.x === "nT") { const nt = state.n * 0 + u; return { x: nt * fx, y: R_GAS * nt * fy, u }; }
    return { x: ax.f(s) * fx, y: ay.f(s) * fy, u };
  };
  const accessible = (comb && def.x === "nT"
    ? linspace(RANGES.n.min * RANGES.T.min, RANGES.n.max * RANGES.T.max, n)
    : linspace(r.min, r.max, n)).map(pt);

  let extension = null;
  let extensionNote = null;
  if (def.ext === "origin" || def.ext === "celsius") {
    const lo = comb ? accessible[0].u : r.min;
    extension = linspace(0, lo, 12).map(pt);
    extensionNote = def.ext === "celsius" ? CELSIUS_EXTRAPOLATION_NOTE : EXTRAP_ORIGIN;
  } else if (def.ext === "invV") {
    extension = [r.max, 1e12].map(pt); // V -> infinity: 1/V -> 0
    extension[1].x = 0; extension[1].y = 0;
    extensionNote = EXTRAP_ORIGIN;
  }

  const mk = { x: ax.f(state) * fx, y: ay.f(state) * fy };
  const all = extension ? accessible.concat(extension) : accessible;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  if (marker) { xs.push(mk.x); ys.push(mk.y); }
  const xLo = def.ext === "celsius" ? Math.min(...xs) : 0;
  const xr = niceScale(xLo, Math.max(...xs), ticks);
  const yHi = def.kind === "flat" ? Math.max(...ys) * 1.5 : Math.max(...ys) * 1.05;
  const yr = niceScale(0, yHi, ticks);
  const title = (a) => `${a.base} (${a.unit(units)})`;

  return {
    id: def.id, mode: state.mode, label: def.label, kind: def.kind, extKind: def.ext, xKey: def.x, yKey: def.y,
    title: `${ay.name} vs ${ax.name}`,
    xTitle: title(ax), yTitle: title(ay), xUnit: ax.unit(units), yUnit: ay.unit(units), xName: ax.name, yName: ay.name,
    xDec: ax.dec, yDec: ay.dec,
    accessible, extension, extensionNote,
    marker: marker ? mk : null,
    xRange: [xr.min, xr.max], yRange: [yr.min, yr.max], xTicks: xr.ticks, yTicks: yr.ticks,
    constants: constantsText(state, units), formula: def.formula, interpretation: def.interp,
  };
}

export function formatPoint(g, x, y) {
  return `${g.xName} = ${x.toFixed(g.xDec)} ${g.xUnit}, ${g.yName} = ${y.toFixed(g.yDec)} ${g.yUnit}`;
}

/** Reference conditions of the All Graphs View panels (fixed, documented). The
 * ACTIVE investigation's panel instead uses the live investigation constants
 * and carries the live marker. */
export const REFERENCE_CONDITIONS = Object.freeze({
  pv: { T: 300, n: 1, V: 25 },
  vt: { P: 100, n: 1, T: 300 },
  pt: { V: 25, n: 1, T: 300 },
  vn: { P: 100, T: 300, n: 1 },
});

export function allGraphsView(state, units = IB_UNITS) {
  return SINGLE_MODE_IDS.map((mode) => {
    const active = mode === state.mode;
    const base = active ? switchMode(state, mode) : makeState(mode, REFERENCE_CONDITIONS[mode]);
    const graph = buildGraph(base, defaultGraphId(mode), { samples: 24, ticks: 4, marker: active, units });
    return { mode, active, state: base, graph, conditions: graph.constants, conditionsLabel: active ? "current investigation" : "reference conditions" };
  });
}

// ---------------------------------------------------------------------------
// Explanations ("What Is Happening?") -- pure selection
// ---------------------------------------------------------------------------
export const EXPLANATIONS = Object.freeze({
  pv: {
    default: "Change the volume: temperature and amount are constant, so pressure is calculated.",
    up: "Volume increases \u2192 fewer wall collisions \u2192 pressure decreases.",
    down: "Volume decreases \u2192 more wall collisions \u2192 pressure increases.",
  },
  vt: {
    default: "Change the temperature: pressure and amount are constant, so the piston sets the volume.",
    up: "Temperature increases \u2192 faster particles \u2192 the piston rises \u2192 volume increases.",
    down: "Temperature decreases \u2192 slower particles \u2192 the piston falls \u2192 volume decreases.",
  },
  pt: {
    default: "Change the temperature: the piston is fixed, so pressure is calculated.",
    up: "Temperature increases \u2192 faster particles hit the walls harder \u2192 pressure increases.",
    down: "Temperature decreases \u2192 slower particles hit the walls less hard \u2192 pressure decreases.",
  },
  comb: {
    default: "Change any three variables; the fourth is calculated from PV = nRT with R = 8.31 J K\u207b\u00b9 mol\u207b\u00b9.",
    up: "Changed: the calculated variable follows PV = nRT.",
    down: "Changed: the calculated variable follows PV = nRT.",
  },
  vn: {
    default: "Change the amount of gas: pressure and temperature are constant, so the piston sets the volume.",
    up: "More gas \u2192 the piston rises \u2192 volume increases at constant pressure.",
    down: "Less gas \u2192 the piston falls \u2192 volume decreases at constant pressure.",
  },
});

export function defaultExplanation(mode) { return { id: `${mode}-default`, text: EXPLANATIONS[mode].default }; }

/** Message for the latest change; null when the independent variable did not change. */
export function selectExplanation(prev, next) {
  if (!next) return null;
  if (!prev || prev.mode !== next.mode) return defaultExplanation(next.mode);
  if (next.mode === "comb") {
    const changed = ["P", "V", "T", "n"].filter((k) => k !== depOf(next) && Math.abs(next[k] - prev[k]) > 1e-9 * Math.max(1, Math.abs(prev[k])));
    if (!changed.length) return null;
    const k = changed[0]; const dir = next[k] > prev[k] ? "up" : "down";
    return { id: `comb-${k}-${dir}-${depOf(next)}`, text: `${VARS[k].name} ${dir === "up" ? "increases" : "decreases"} \u2192 ${VARS[depOf(next)].name.toLowerCase()} is recalculated from PV = nRT.` };
  }
  const ind = MODES[next.mode].independent;
  const a = prev[ind];
  const b = next[ind];
  if (Math.abs(b - a) <= 1e-9 * Math.max(1, Math.abs(a))) return null;
  const dir = b > a ? "up" : "down";
  return { id: `${next.mode}-${dir}`, text: EXPLANATIONS[next.mode][dir] };
}

// ---------------------------------------------------------------------------
// Predict / reveal
// ---------------------------------------------------------------------------
export function predictContent(state, units = IB_UNITS) {
  const mode = state.mode;
  if (mode === "comb") {
    const dep = depOf(state);
    const others = ["P", "V", "T", "n"].filter((k) => k !== dep);
    const given = others.map((k) => `${VARS[k].name.toLowerCase()} = ${formatWithUnit(k, state[k], units)}`).join(", ");
    return {
      question: `Use PV = nRT to predict the ${VARS[dep].name.toLowerCase()} when ${given}.`,
      answer: `${VARS[dep].name} = ${formatWithUnit(dep, state[dep], units)}. With R = 8.31 J K\u207b\u00b9 mol\u207b\u00b9, use kPa with dm\u00b3 (or Pa with m\u00b3).`,
      reachable: true,
    };
  }
  const ind = MODES[mode].independent;
  const r = effectiveRange(state, ind);
  const x0 = state[ind];
  const factor = mode === "pv" ? 0.5 : 2;
  const x1 = x0 * factor;
  const reachable = x1 >= r.min - 1e-9 && x1 <= r.max + 1e-9;
  const dep = depOf(state);
  const after = reachable ? setVariable(state, ind, x1).state : null;
  const from = (k, v) => formatWithUnit(k, v, units);
  const ex = reachable ? ` (from ${from(ind, x0)} to ${from(ind, x1)})` : "";
  const outcome = reachable ? ` In this example, ${VARS[dep].name.toLowerCase()} goes from ${from(dep, state[dep])} to ${from(dep, after[dep])}.` : "";
  const q = {
    pv: { q: `What will happen to the pressure if the volume is halved${ex}?`, a: "The pressure doubles. With half the space, particles (at the same speed) hit the walls twice as often, so P ∝ 1/V and PV stays constant." },
    vt: { q: `What will happen to the volume if the absolute temperature doubles${ex}?`, a: "The volume doubles. Faster particles hit the walls harder and more often, so the piston rises until the pressure is back to its constant value: V ∝ T." },
    pt: { q: `What will happen to the pressure if the absolute temperature doubles${ex}?`, a: "The pressure doubles. In a fixed volume, particles move faster and hit the walls harder and more often: P ∝ T." },
    vn: { q: `What will happen to the volume if the amount of gas doubles${ex}?`, a: "The volume doubles. Twice as many particles would collide twice as often, so the piston rises until the pressure is back to its constant value: V ∝ n." },
  }[mode];
  return { question: q.q, answer: q.a + outcome, reachable };
}

export const TEXT_ONE_LINER = "Change one variable. Observe the response while the other variables remain constant.";

/** Graph coordinates of any state for a given graph (used for the marker and the visited-points trail). */
export function graphPoint(state, graphId, units = IB_UNITS) {
  const def = getGraphDef(state.mode, graphId);
  return { x: AXES[def.x].f(state) * axisFactor(AXES[def.x], units), y: AXES[def.y].f(state) * axisFactor(AXES[def.y], units) };
}
