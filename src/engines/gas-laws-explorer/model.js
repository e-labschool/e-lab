// Gas Laws Explorer -- pure scientific model (no React, no DOM) so it can be
// tested in Node (scripts/test-gas-laws-model.mjs). Rendering lives elsewhere.
//
// ---------------------------------------------------------------------------
// ONE SOURCE OF TRUTH
// ---------------------------------------------------------------------------
// state = { mode, P (atm), V (L), T (K), n (mol) } with PV = nRT,
// R = 0.082057 L atm mol^-1 K^-1. Everything displayed, plotted or drawn
// (piston height, particle count, speeds) derives from this object.
//
// MODES (adjustable / locked / calculated):
//   pv  V    / T, n / P        Boyle     P ~ 1/V
//   vt  T    / P, n / V        Charles   V ~ T
//   pt  T    / V, n / P        Gay-Lussac P ~ T
//   vn  n    / P, T / V        Avogadro  V ~ n
//
// RANGES (every reachable state stays inside them):
//   V 5-50 L (the piston's drawable range), T 100-800 K, n 0.5-2.0 mol,
//   P 0.1-10 atm. A control's EFFECTIVE range is its hard range intersected
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

export const R_GAS = 0.082057; // L atm mol^-1 K^-1
export const AVOGADRO = 6.02214076e23; // mol^-1

export const RANGES = Object.freeze({
  P: Object.freeze({ min: 0.1, max: 10, step: 0.05 }),
  V: Object.freeze({ min: 5, max: 50, step: 0.5 }),
  T: Object.freeze({ min: 100, max: 800, step: 5 }),
  n: Object.freeze({ min: 0.5, max: 2, step: 0.05 }),
});

export const VARS = Object.freeze({
  P: { key: "P", name: "Pressure", unit: "atm", decimals: 2 },
  V: { key: "V", name: "Volume", unit: "L", decimals: 1 },
  T: { key: "T", name: "Temperature", unit: "K", decimals: 0 },
  n: { key: "n", name: "Amount of gas", unit: "mol", decimals: 2 },
});

export const MODE_IDS = Object.freeze(["pv", "vt", "pt", "vn"]);

export const MODES = Object.freeze({
  pv: { id: "pv", short: "P – V", title: "Pressure – Volume", law: "Boyle’s relationship", independent: "V", locked: ["T", "n"], dependent: "P", relation: "P ∝ 1/V", constantText: "at constant T and n", sentence: "As volume decreases, pressure increases." },
  vt: { id: "vt", short: "V – T", title: "Temperature – Volume", law: "Charles’s relationship", independent: "T", locked: ["P", "n"], dependent: "V", relation: "V ∝ T", constantText: "at constant P and n", sentence: "As temperature increases, volume increases." },
  pt: { id: "pt", short: "P – T", title: "Temperature – Pressure", law: "Gay-Lussac’s relationship", independent: "T", locked: ["V", "n"], dependent: "P", relation: "P ∝ T", constantText: "at constant V and n", sentence: "As temperature increases, pressure increases." },
  vn: { id: "vn", short: "V – n", title: "Amount of Gas", law: "Avogadro’s relationship", independent: "n", locked: ["P", "T"], dependent: "V", relation: "V ∝ n", constantText: "at constant P and T", sentence: "As the amount of gas increases, volume increases." },
});

// Baseline every mode (and Reset) starts from: n = 1.00 mol, T = 300 K, V = 20 L.
export const DEFAULT_BASELINE = Object.freeze({ n: 1, T: 300, V: 20 });

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
export function makeState(mode, given) {
  const dep = MODES[mode].dependent;
  const s = { mode, P: given.P, V: given.V, T: given.T, n: given.n };
  s[dep] = computeDependent(dep, s);
  return s;
}

/** The default (reset) state for a mode. */
export function defaultState(mode) {
  const P = pressureOf(DEFAULT_BASELINE.n, DEFAULT_BASELINE.T, DEFAULT_BASELINE.V);
  return makeState(mode, { ...DEFAULT_BASELINE, P });
}

/** Switching relationship keeps all four values (they are already consistent),
 * so nothing jumps; only which variable is adjustable / locked / calculated changes. */
export function switchMode(state, mode) {
  return makeState(mode, state);
}

export function residual(s) { return Math.abs(s.P * s.V - s.n * R_GAS * s.T); }

/** Hard range of `key`, narrowed so the calculated variable stays inside its own range. */
export function effectiveRange(state, key) {
  const hard = RANGES[key];
  const dep = MODES[state.mode].dependent;
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
  return { min, max, hard, limited: min > hard.min + 1e-9 || max < hard.max - 1e-9, adjustable: true };
}

/** Change one variable (clamped to its effective range) and recalculate the dependent one.
 * Locked variables are never touched. */
export function setVariable(state, key, value) {
  const dep = MODES[state.mode].dependent;
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

export function formatValue(key, x) { return x.toFixed(VARS[key].decimals); }
export function formatWithUnit(key, x) { return `${formatValue(key, x)} ${VARS[key].unit}`; }

// ---------------------------------------------------------------------------
// Graphs
// ---------------------------------------------------------------------------
const AXES = {
  V: { name: "V", title: "Volume, V (L)", unit: "L", dec: 1, f: (s) => s.V },
  P: { name: "P", title: "Pressure, P (atm)", unit: "atm", dec: 2, f: (s) => s.P },
  invV: { name: "1/V", title: "1/V (L⁻¹)", unit: "L⁻¹", dec: 3, f: (s) => 1 / s.V },
  PV: { name: "PV", title: "PV (L·atm)", unit: "L·atm", dec: 2, f: (s) => s.P * s.V },
  Tk: { name: "T", title: "Temperature, T (K)", unit: "K", dec: 0, f: (s) => s.T },
  Tc: { name: "t", title: "Temperature, t (°C)", unit: "°C", dec: 1, f: (s) => s.T - 273.15 },
  VoverT: { name: "V/T", title: "V/T (L K⁻¹)", unit: "L/K", dec: 4, f: (s) => s.V / s.T },
  PoverT: { name: "P/T", title: "P/T (atm K⁻¹)", unit: "atm/K", dec: 4, f: (s) => s.P / s.T },
  n: { name: "n", title: "Amount, n (mol)", unit: "mol", dec: 2, f: (s) => s.n },
  VoverN: { name: "V/n", title: "V/n (L mol⁻¹)", unit: "L/mol", dec: 1, f: (s) => s.V / s.n },
};

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
  const { independent, dependent } = MODES[state.mode];
  const s = { ...state, [independent]: u };
  s[dependent] = computeDependent(dependent, s);
  return s;
}

function linspace(a, b, k) { return Array.from({ length: k }, (_, i) => a + ((b - a) * i) / (k - 1)); }

function constantsText(state) {
  const locked = MODES[state.mode].locked;
  return locked.map((k) => `${k} = ${formatWithUnit(k, state[k])} (constant)`).join(", ");
}

/** Everything the graph needs, computed from the model using the
 * investigation's locked variables (taken from `state`). */
export function buildGraph(state, graphId, { samples = 48, ticks = 5, marker = true } = {}) {
  const def = getGraphDef(state.mode, graphId);
  const ax = AXES[def.x];
  const ay = AXES[def.y];
  const ind = MODES[state.mode].independent;
  const r = effectiveRange(state, ind);
  const n = def.kind === "curve" ? samples * 2 : samples;
  const pt = (u) => { const s = stateAlong(state, u); return { x: ax.f(s), y: ay.f(s), u }; };
  const accessible = linspace(r.min, r.max, n).map(pt);

  let extension = null;
  let extensionNote = null;
  if (def.ext === "origin" || def.ext === "celsius") {
    extension = linspace(0, r.min, 12).map(pt);
    extensionNote = def.ext === "celsius" ? CELSIUS_EXTRAPOLATION_NOTE : EXTRAP_ORIGIN;
  } else if (def.ext === "invV") {
    extension = [r.max, 1e12].map(pt); // V -> infinity: 1/V -> 0
    extension[1].x = 0; extension[1].y = 0;
    extensionNote = EXTRAP_ORIGIN;
  }

  const all = extension ? accessible.concat(extension) : accessible;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  if (marker) { xs.push(ax.f(state)); ys.push(ay.f(state)); }
  const xLo = def.ext === "celsius" ? Math.min(...xs) : 0;
  const xr = niceScale(xLo, Math.max(...xs), ticks);
  const yHi = def.kind === "flat" ? Math.max(...ys) * 1.5 : Math.max(...ys) * 1.05;
  const yr = niceScale(0, yHi, ticks);

  return {
    id: def.id, mode: state.mode, label: def.label, kind: def.kind, extKind: def.ext,
    title: `${ay.name} vs ${ax.name}`,
    xTitle: ax.title, yTitle: ay.title, xUnit: ax.unit, yUnit: ay.unit, xName: ax.name, yName: ay.name,
    xDec: ax.dec, yDec: ay.dec,
    accessible, extension, extensionNote,
    marker: marker ? { x: ax.f(state), y: ay.f(state) } : null,
    xRange: [xr.min, xr.max], yRange: [yr.min, yr.max], xTicks: xr.ticks, yTicks: yr.ticks,
    constants: constantsText(state), formula: def.formula, interpretation: def.interp,
  };
}

export function formatPoint(g, x, y) {
  return `${g.xName} = ${x.toFixed(g.xDec)} ${g.xUnit}, ${g.yName} = ${y.toFixed(g.yDec)} ${g.yUnit}`;
}

/** Reference conditions of the All Graphs View panels (fixed, documented). The
 * ACTIVE investigation's panel instead uses the live investigation constants
 * and carries the live marker. */
export const REFERENCE_CONDITIONS = Object.freeze({
  pv: { T: 300, n: 1, V: 20 },
  vt: { P: 1, n: 1, T: 300 },
  pt: { V: 20, n: 1, T: 300 },
  vn: { P: 1, T: 300, n: 1 },
});

export function allGraphsView(state) {
  return MODE_IDS.map((mode) => {
    const active = mode === state.mode;
    const base = active ? switchMode(state, mode) : makeState(mode, REFERENCE_CONDITIONS[mode]);
    const graph = buildGraph(base, defaultGraphId(mode), { samples: 24, ticks: 4, marker: active });
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
export function predictContent(state) {
  const mode = state.mode;
  const ind = MODES[mode].independent;
  const r = effectiveRange(state, ind);
  const x0 = state[ind];
  const factor = mode === "pv" ? 0.5 : 2;
  const x1 = x0 * factor;
  const reachable = x1 >= r.min - 1e-9 && x1 <= r.max + 1e-9;
  const dep = MODES[mode].dependent;
  const after = reachable ? setVariable(state, ind, x1).state : null;
  const from = (k, v) => formatWithUnit(k, v);
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
export function graphPoint(state, graphId) {
  const def = getGraphDef(state.mode, graphId);
  return { x: AXES[def.x].f(state), y: AXES[def.y].f(state) };
}
