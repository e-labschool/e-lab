// Ideal vs Real Gas -- pure model (no React, no DOM) so it can be tested in
// Node (scripts/test-ideal-gas-model.mjs). Rendering lives elsewhere.
//
// ---------------------------------------------------------------------------
// ONE GAS, ONE EXPERIMENT
// ---------------------------------------------------------------------------
// The experiment is a single sample of carbon dioxide (CO2) in a piston. The
// student switches between two MODELS of the same sample at unchanged T, n and
// (depending on the control selector) unchanged P or V:
//
//   Ideal gas   P V = n R T                          Z = 1 exactly
//   Real gas    (P + a n^2 / V^2) (V - n b) = n R T  Z = P V / (n R T)
//
// All quantities use ONE unit system: P in atm, V in L, n in mol, T in K,
// R = 0.082057 L atm mol^-1 K^-1, a in L^2 atm mol^-2, b in L mol^-1.
//
// VAN DER WAALS CONSTANTS (documented gas, NOT tuned)
//   CO2:  a = 3.640 L^2 atm mol^-2,  b = 0.04267 L mol^-1
//   (standard tabulated values). They imply
//   Tc = 8a/(27 R b) = 308 K (experiment 304.1 K), Pc = a/(27 b^2) = 74.0 atm
//   (experiment 72.8 atm), T_Boyle = a/(R b) = 1040 K, so the model is
//   quantitatively reasonable for CO2 below ~100 atm and qualitative above.
//
// WHY THE OLD GRAPH SHOWED "NO MEANINGFUL DEVIATION" (root cause)
//   The previous version used invented constants (a = 15, b = 0.40 in "internal
//   units") and a control window of only 0.2-5 atm with ~1 mol. The equation of
//   state and the Z(P) plot were computed correctly (Z = P_real / P_ideal held
//   exactly and the curve was recomputed with T). The problem was the operating
//   region: for 0.2-5 atm and T >= 250 K a gas is in the low-density limit where
//   Z - 1 ~ B(T) P / (R T) is only a fraction of a percent to a few percent, so
//   the live point always sat on the flat part of the curve on a pressure axis
//   that spanned five decades (the 0.2-5 atm band was a sliver). In Ideal mode
//   the point is pinned at Z = 1 and the real curve was a 45 % ghost. The
//   strongly non-ideal states (100 K) fell in the unstable van der Waals loop and
//   were reported as "unreliable". Nothing was wired to the wrong state; the
//   parameters and ranges simply did not let the physics show.
//   Fix: documented CO2 constants and ranges that include the regime where Z
//   departs visibly from 1: P up to 500 atm, T from 250 K, log P axis 0.1-1000 atm.
//
// SCALING CONVENTION. "Amount of gas" is n = N x 0.01 mol, with N (5-100) the
// number of particles DRAWN. One drawn particle = 0.01 mol (a visual sample, not
// a literal molecule count). Pressure/volume shown to the student are ALWAYS the
// model's formulas, never counted from animated collisions. The particle
// animation is ILLUSTRATIVE (a simple 2D hard-disc picture with a short-range
// attraction in Real mode); it is not molecular dynamics of CO2 and does not
// feed back into the equation of state.
//
// DEVIATION INDICATOR on |Z - 1| (documented thresholds, no P/T-range logic):
//   Near ideal            |Z - 1| <  0.02
//   Noticeable deviation  0.02 <= |Z - 1| < 0.10
//   Strong deviation      |Z - 1| >= 0.10
// Z < 1: attraction dominates; Z > 1: excluded volume dominates.
//
// PRESSURE CONTROL. Given a target P the model solves for V:
//   ideal  V = nRT / P
//   real   the largest-volume root of the vdW cubic (the GAS branch), found by
//          bisection above V_lo = max(V_gas_saturation, V_spinodal, n b / 0.8):
//          dP/dV < 0 there, so the root is unique and stable. Below Tc the gas
//          branch ends at the Maxwell saturation pressure P_sat(T) (the gas
//          would condense); the liquid-like and unstable roots are never used.
//          Targets >= P_sat give status "no-gas-solution"/reason "condensation":
//          the volume is held at the saturation volume and the UI shows a
//          model-limit message. Above Tc the isotherm is monotone and one root
//          exists (dense supercritical gas).
// ---------------------------------------------------------------------------

export const R_GAS = 0.082057; // L atm mol^-1 K^-1
export const GAS = Object.freeze({
  id: "co2",
  name: "Carbon dioxide (CO₂)",
  formula: "CO2",
  a: 3.64, // L^2 atm mol^-2
  b: 0.04267, // L mol^-1
});
export const VDW_A = GAS.a;
export const VDW_B = GAS.b;

// Ranges. P and V are the two controlled/dependent variables; both span
// decades, so their sliders are logarithmic (see sliderScale in the UI).
export const LIMITS = {
  N: { min: 5, max: 100, step: 1 },
  T: { min: 250, max: 700, step: 5 },
  V: { min: 0.01, max: 100, step: 0.01 },
  P: { min: 1, max: 500, step: 0.1 },
};

// control: "pressure" (default) or "volume".
// P     target pressure (atm), kept inside LIMITS.P (slider value).
// Phold exact target (atm) when the pressure we switched in with was outside
//       the slider range (the state is held, never teleported); else null.
// Vpin  volume (L) held when the current state cannot be reproduced by the
//       solver (e.g. beyond the gas branch); else null. Cleared by any change.
export const DEFAULT_CONTROLS = Object.freeze({
  mode: "ideal", N: 50, T: 300, V: 0.41, control: "pressure", P: 30, Phold: null, Vpin: null,
});
export const DEFAULT_DISPLAY = Object.freeze({ trails: true, collisions: false, forces: false });

export const N_REF = 50;
export const MOL_PER_PARTICLE = 0.01;
export const N_REF_MOL = N_REF * MOL_PER_PARTICLE; // 0.5 mol

// |Z - 1| thresholds (fractions) -- single source of truth for UI and tests.
export const Z_BOUNDS = Object.freeze({ nearIdeal: 0.02, noticeable: 0.1 });
export const DEVIATION_CLASSES = Object.freeze([
  { id: "near", label: "Near ideal" },
  { id: "noticeable", label: "Noticeable deviation" },
  { id: "strong", label: "Strong deviation" },
]);
export const VDW_MIN_FREE_FRACTION = 0.2; // (V - nb)/V below this => model unreliable
export const P_IDEAL_MIN = 1e-6; // atm

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function clampControls(c) {
  const fin = (x, d) => (Number.isFinite(Number(x)) && x !== null && x !== "" ? Number(x) : d);
  const V = clamp(fin(c.V, DEFAULT_CONTROLS.V), LIMITS.V.min, LIMITS.V.max);
  const Pn = fin(c.P, NaN);
  const Ph = c.Phold == null ? NaN : Number(c.Phold);
  const Vp = c.Vpin == null ? NaN : Number(c.Vpin);
  return {
    mode: c.mode === "real" ? "real" : "ideal",
    N: Math.round(clamp(fin(c.N, DEFAULT_CONTROLS.N), LIMITS.N.min, LIMITS.N.max)),
    T: clamp(fin(c.T, DEFAULT_CONTROLS.T), LIMITS.T.min, LIMITS.T.max),
    V,
    control: c.control === "volume" ? "volume" : "pressure",
    P: Number.isFinite(Pn) ? clamp(Pn, LIMITS.P.min, LIMITS.P.max) : DEFAULT_CONTROLS.P,
    Phold: Number.isFinite(Ph) && Ph > 0 ? Ph : null,
    Vpin: Number.isFinite(Vp) ? clamp(Vp, LIMITS.V.min, LIMITS.V.max) : null,
  };
}
export function amountOfSubstance(N) {
  return N * MOL_PER_PARTICLE;
}

/** Ideal-gas pressure in atm. n in mol, T in K, V in L. */
export function idealPressure(n, T, V) {
  return (n * R_GAS * T) / V;
}

/** van der Waals pressure in atm, defensively clamped (see header). */
export function vdwPressure(n, T, V) {
  const freeV = Math.max(V - n * VDW_B, 0.25 * V); // never reached on the slider grid
  const p = (n * R_GAS * T) / freeV - VDW_A * (n / V) * (n / V);
  return Number.isFinite(p) ? Math.max(0, p) : 0;
}

export function deviationPercent(pIdeal, pReal) {
  if (!(pIdeal > 0)) return 0;
  return (Math.abs(pReal - pIdeal) / pIdeal) * 100;
}

/** Three-class classification from dev = |Z - 1| (a fraction); see Z_BOUNDS. */
export function classifyZDeviation(dev) {
  const d = Number.isFinite(dev) ? Math.abs(dev) : 0;
  const index = d < Z_BOUNDS.nearIdeal ? 0 : d < Z_BOUNDS.noticeable ? 1 : 2;
  return { index, dev: d, ...DEVIATION_CLASSES[index] };
}
/** Same, from a compressibility factor. */
export function classifyZ(Z) {
  return classifyZDeviation(Number.isFinite(Z) ? Z - 1 : 0);
}

// ---------------------------------------------------------------------------
// vdW helpers, saturation, pressure -> volume solver, comparison with the ideal gas
// ---------------------------------------------------------------------------
/** Unclamped vdW pressure (NaN when V <= n b). */
export function vdwPressureRaw(n, T, V) {
  if (!(V > n * VDW_B)) return NaN;
  return (n * R_GAS * T) / (V - n * VDW_B) - VDW_A * (n / V) * (n / V);
}

/** dP/dV of the vdW isotherm (negative on the stable gas branch). */
export function vdwDPdV(n, T, V) {
  return (-n * R_GAS * T) / ((V - n * VDW_B) ** 2) + (2 * VDW_A * n * n) / (V ** 3);
}

const cacheKey = (T) => T.toFixed(4);
const spinodalCache = new Map();
const liquidSpinodalCache = new Map();
const saturationCache = new Map();
const memo = (cache, T, fn) => {
  const k = cacheKey(T);
  if (!cache.has(k)) {
    if (cache.size > 4000) cache.clear();
    cache.set(k, fn());
  }
  return cache.get(k);
};

/** Largest molar volume x = V/n at which dP/dx = 0 (gas-side spinodal), or
 * null when the isotherm is monotone (T >= Tc). R T x^3 = 2 a (x - b)^2. */
function gasSpinodalMolarVolume(T) {
  return memo(spinodalCache, T, () => {
    const f = (x) => R_GAS * T * x ** 3 - 2 * VDW_A * (x - VDW_B) ** 2;
    let t = 1e3; // t = x - b, scanned downwards (geometric) from large x
    while (t > 1e-4) {
      const t2 = t / 1.01;
      if (f(VDW_B + t2) <= 0) {
        let lo = t2, hi = t;
        for (let i = 0; i < 200; i++) {
          const m = (lo + hi) / 2;
          if (f(VDW_B + m) <= 0) lo = m; else hi = m;
        }
        return VDW_B + (lo + hi) / 2;
      }
      t = t2;
    }
    return null;
  });
}

/** Largest V at which dP/dV = 0 (spinodal) for n mol, or null at/above Tc. */
export function vdwSpinodalVolume(n, T) {
  const x = gasSpinodalMolarVolume(T);
  return x == null ? null : n * x;
}

/** Smallest molar volume x > b where dP/dx = 0 (liquid-side spinodal), or null. */
function liquidSpinodalMolarVolume(T) {
  return memo(liquidSpinodalCache, T, () => {
    const f = (x) => R_GAS * T * x ** 3 - 2 * VDW_A * (x - VDW_B) ** 2;
    let t = 1e-6;
    while (t < 1e3) {
      const t2 = t * 1.01;
      if (f(VDW_B + t2) <= 0) {
        let lo = t, hi = t2;
        for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(VDW_B + m) <= 0) hi = m; else lo = m; }
        return VDW_B + (lo + hi) / 2;
      }
      t = t2;
    }
    return null;
  });
}

/** Critical constants and Boyle temperature of the model's a and b. */
export function vdwCriticalConstants() {
  return {
    Tc: (8 * VDW_A) / (27 * R_GAS * VDW_B), // K
    Pc: VDW_A / (27 * VDW_B * VDW_B), // atm
    Vc: 3 * VDW_B, // L/mol
    TBoyle: VDW_A / (R_GAS * VDW_B), // K
  };
}

/** Maxwell equal-area saturation state of the vdW fluid for T < Tc:
 * { P (atm), xg, xl (saturated gas / liquid molar volumes, L/mol) }, else null. */
export function vdwSaturation(T) {
  const { Tc } = vdwCriticalConstants();
  if (!(T > 0) || !(T < Tc)) return null;
  return memo(saturationCache, T, () => {
    const xg = gasSpinodalMolarVolume(T);
    const xl = liquidSpinodalMolarVolume(T);
    if (xg == null || xl == null || !(xg > xl)) return null;
    const pAt = (x) => (R_GAS * T) / (x - VDW_B) - VDW_A / (x * x);
    const pHi = pAt(xg), pLo = Math.max(pAt(xl), 1e-12);
    if (!(pHi > pLo)) return null;
    const gasRoot = (P) => {
      let lo = xg, hi = 2 * xg;
      while (pAt(hi) > P && hi < 1e15) hi *= 2;
      for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (pAt(m) > P) lo = m; else hi = m; }
      return (lo + hi) / 2;
    };
    const liqRoot = (P) => {
      let lo = VDW_B * (1 + 1e-12), hi = xl;
      for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (pAt(m) > P) lo = m; else hi = m; }
      return (lo + hi) / 2;
    };
    // Equal-area residual: integral of (P_vdW - P) dx from liquid to gas root.
    const area = (P) => {
      const vg = gasRoot(P), vl = liqRoot(P);
      return R_GAS * T * Math.log((vg - VDW_B) / (vl - VDW_B)) + VDW_A * (1 / vg - 1 / vl) - P * (vg - vl);
    };
    let lo = pLo, hi = pHi;
    const sLo = Math.sign(area(lo));
    let P;
    if (sLo === 0) P = lo;
    else if (Math.sign(area(hi)) === sLo) return null;
    else {
      for (let i = 0; i < 200; i++) {
        const m = (lo + hi) / 2;
        if (Math.sign(area(m)) === sLo) lo = m; else hi = m;
      }
      P = (lo + hi) / 2;
    }
    return { P, xg: gasRoot(P), xl: liqRoot(P) };
  });
}

/** Saturation (coexistence) pressure of the vdW fluid in atm for T < Tc; null at or above Tc. */
export function vdwSaturationPressure(T) {
  return vdwSaturation(T)?.P ?? null;
}

/** Smallest volume of the reliable, stable GAS branch: not below the
 * saturated-gas volume (below Tc), the spinodal, or 1/0.8 of the excluded volume. */
export function vdwGasBranchMinVolume(n, T) {
  const sat = vdwSaturation(T);
  const xs = gasSpinodalMolarVolume(T);
  const x = Math.max(sat?.xg ?? 0, xs ?? 0, VDW_B / (1 - VDW_MIN_FREE_FRACTION));
  return n * x;
}

/** Solve for the volume at which the selected gas model has pressure P.
 * Returns { V, vRequired, status, reason, reachable, pTarget, pAtV } where V is
 * clamped to the V slider range and status is one of
 * "ok" | "below-range" | "above-range" | "no-gas-solution" | "invalid".
 * For "no-gas-solution", reason is "condensation" (P >= P_sat, T < Tc) or "excluded-volume". */
export function solveVolumeForPressure(n, T, P, gas = "ideal") {
  const vMin = LIMITS.V.min, vMax = LIMITS.V.max;
  const pAt = (V) => (gas === "real" ? vdwPressureRaw(n, T, V) : idealPressure(n, T, V));
  if (!(n > 0) || !(T > 0) || !(P > 0) || !Number.isFinite(P)) {
    return { V: clamp(vMin, vMin, vMax), vRequired: null, status: "invalid", reason: "invalid-state", reachable: false, pTarget: P, pAtV: NaN };
  }
  let vReq;
  if (gas !== "real") {
    vReq = (n * R_GAS * T) / P;
  } else {
    const vLo = vdwGasBranchMinVolume(n, T);
    if (!(P < pAt(vLo))) {
      const V = clamp(vLo, vMin, vMax);
      const reason = vdwSaturation(T) ? "condensation" : "excluded-volume";
      return { V, vRequired: null, status: "no-gas-solution", reason, reachable: false, pTarget: P, pAtV: vdwPressureRaw(n, T, V) };
    }
    let lo = vLo, hi = Math.max(2 * vLo, 2 * vMax);
    while (pAt(hi) > P && hi < 1e12) hi *= 2; // bracket: P(lo) > P > P(hi)
    for (let i = 0; i < 300 && hi - lo > 1e-13 * hi; i++) {
      const m = (lo + hi) / 2;
      if (pAt(m) > P) lo = m; else hi = m;
    }
    vReq = (lo + hi) / 2;
  }
  const V = clamp(vReq, vMin, vMax);
  const status = vReq < vMin ? "below-range" : vReq > vMax ? "above-range" : "ok";
  return { V, vRequired: vReq, status, reason: null, reachable: status === "ok", pTarget: P, pAtV: pAt(V) };
}

/** Real-vs-ideal comparison at the SAME n, T, V. Never throws; returns
 * status "unreliable" (with a reason) instead of a number outside the model's
 * validity region. On success Z = P_real V / (n R T) = P_real / P_ideal. */
export function compareWithIdeal(n, T, V) {
  const pIdeal = idealPressure(n, T, V);
  const pRealRaw = vdwPressureRaw(n, T, V);
  const bad = (reason) => ({ status: "unreliable", reason, pIdeal, pReal: pRealRaw, Z: null, deviationPct: null, signedPct: null, cls: null });
  if (!(n > 0) || !(T > 0) || !(V > 0) || !Number.isFinite(pIdeal)) return bad("invalid-state");
  if (pIdeal < P_IDEAL_MIN) return bad("ideal-pressure-near-zero");
  if (!(V - n * VDW_B > 0) || (V - n * VDW_B) / V < VDW_MIN_FREE_FRACTION) return bad("excluded-volume");
  if (V < vdwGasBranchMinVolume(n, T)) return bad(vdwSaturation(T) ? "two-phase" : "unstable-region");
  if (!Number.isFinite(pRealRaw) || !(pRealRaw > 0)) return bad("non-positive-pressure");
  const Z = pRealRaw / pIdeal;
  const cls = classifyZ(Z);
  return {
    status: "ok", reason: null, pIdeal, pReal: pRealRaw, Z,
    deviationPct: Math.abs(Z - 1) * 100,
    signedPct: (Z - 1) * 100,
    cls,
  };
}

export const UNRELIABLE_TEXT = Object.freeze({
  "invalid-state": "The simplified model is unreliable for this state.",
  "ideal-pressure-near-zero": "The pressure is too close to zero for a meaningful comparison.",
  "excluded-volume": "Model limit: the molecules' own volume fills too much of the container, so the van der Waals equation is unreliable here.",
  "unstable-region": "Model limit: the van der Waals model predicts an unstable state here, so the comparison is unreliable.",
  "two-phase": "Model limit: at this temperature and volume CO₂ would condense (gas and liquid coexist), so the van der Waals gas model does not apply.",
  condensation: "Model limit: above the saturation pressure at this temperature CO₂ condenses, so the van der Waals gas model does not apply.",
  "non-positive-pressure": "The model gives a non-physical pressure here, so the comparison is unreliable.",
});

const fmtAtm = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const fmtL = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x.toFixed(3));

/** Z at a given pressure for a gas: solves the stable gas-branch volume.
 * Returns { valid, Z, V, P, reason }. Ideal gas: Z = 1, V = nRT/P. */
export function compressibilityAtPressure(n, T, P, gas = "real") {
  if (!(n > 0) || !(T > 0) || !(P > 0)) return { valid: false, Z: NaN, V: NaN, P, reason: "invalid-state" };
  if (gas !== "real") return { valid: true, Z: 1, V: (n * R_GAS * T) / P, P, reason: null };
  const lim = realGasMaxPressure(n, T);
  if (P > lim.P * (1 + 1e-12)) return { valid: false, Z: NaN, V: NaN, P, reason: lim.reason };
  const sol = solveVolumeForPressure(n, T, Math.min(P, lim.P), "real");
  if (sol.vRequired == null) return { valid: false, Z: NaN, V: NaN, P, reason: sol.reason ?? "excluded-volume" };
  const V = sol.vRequired;
  return { valid: true, Z: (P * V) / (n * R_GAS * T), V, P, reason: null };
}

/** Highest pressure (atm) at which the real model still describes a stable
 * gas at this n and T, with the reason that limits it. */
export function realGasMaxPressure(n, T) {
  const sat = vdwSaturation(T);
  const vLo = vdwGasBranchMinVolume(n, T);
  const pLo = vdwPressureRaw(n, T, vLo);
  if (sat) return { P: Math.min(sat.P, pLo), reason: "condensation" };
  return { P: pLo, reason: "excluded-volume" };
}

/** The REAL gas at the same controlled variable as the current state: same V
 * (Volume control) or same P (Pressure control). This is what "switching to
 * Real gas" would show, and what the deviation indicator reports in either mode.
 * { status: "ok"|"limit", Z, P, V, cls, reason } */
export function realGasReference(c, n, V, pTarget) {
  if (c.control === "pressure") {
    const r = compressibilityAtPressure(n, c.T, pTarget, "real");
    if (!r.valid) return { status: "limit", reason: r.reason, Z: null, P: pTarget, V: null, cls: null };
    if (r.V < LIMITS.V.min || r.V > LIMITS.V.max) return { status: "limit", reason: "out-of-range", Z: r.Z, P: pTarget, V: r.V, cls: classifyZ(r.Z) };
    return { status: "ok", reason: null, Z: r.Z, P: pTarget, V: r.V, cls: classifyZ(r.Z) };
  }
  const cmp = compareWithIdeal(n, c.T, V);
  if (cmp.status !== "ok") return { status: "limit", reason: cmp.reason, Z: null, P: null, V, cls: null };
  return { status: "ok", reason: null, Z: cmp.Z, P: cmp.pReal, V, cls: cmp.cls };
}

/** Resolve the full physical state for a set of controls. In Volume control V
 * is the slider value; in Pressure control V is solved from the target P for the
 * selected gas model. Also provides everything the Live Values / indicator /
 * graph need. */
export function resolveState(controls) {
  const c = clampControls(controls);
  const n = amountOfSubstance(c.N);
  const real = c.mode === "real";
  let V = c.V;
  let status = "ok";
  let note = null;
  let target = null;
  let vRequired = null;
  let limitReason = null;
  if (c.control === "pressure") {
    if (c.Vpin != null) {
      V = c.Vpin;
      status = "held";
      target = real ? vdwPressure(n, c.T, V) : idealPressure(n, c.T, V);
      note = "This state cannot be reached by solving for pressure, so the volume is held. Move the pressure slider to continue.";
    } else {
      target = c.Phold ?? c.P;
      const sol = solveVolumeForPressure(n, c.T, target, c.mode);
      V = sol.V; status = sol.status; vRequired = sol.vRequired;
      const pNow = real ? vdwPressure(n, c.T, V) : idealPressure(n, c.T, V);
      if (status === "below-range") note = `Target ${fmtAtm(target)} atm needs ${fmtL(vRequired)} L, below the ${LIMITS.V.min} L minimum. Volume limited to ${LIMITS.V.min} L, so P = ${fmtAtm(pNow)} atm (target unreachable).`;
      else if (status === "above-range") note = `Target ${fmtAtm(target)} atm needs ${vRequired >= 1000 ? ">1000" : fmtL(vRequired)} L, above the ${LIMITS.V.max} L maximum. Volume limited to ${LIMITS.V.max} L, so P = ${fmtAtm(pNow)} atm (target unreachable).`;
      else if (status === "no-gas-solution") { limitReason = sol.reason; note = `${UNRELIABLE_TEXT[sol.reason === "condensation" ? "condensation" : "excluded-volume"]} Volume held at ${fmtL(V)} L.`; }
      else if (status === "invalid") note = "The target pressure is not valid for this state.";
      if (c.Phold != null && status === "ok") note = `Pressure ${fmtAtm(c.Phold)} atm is outside the slider range (${LIMITS.P.min}-${LIMITS.P.max} atm); the state is held at that pressure.`;
    }
  }
  const pIdeal = idealPressure(n, c.T, V);
  let pReal = vdwPressure(n, c.T, V);
  const comparison = compareWithIdeal(n, c.T, V);
  // Volume control, real gas, inside the two-phase region: a real gas holds the
  // saturation pressure (flat Maxwell plateau), not the vdW loop value.
  if (real && c.control === "volume" && comparison.status !== "ok") {
    limitReason = comparison.reason;
    const sat = vdwSaturation(c.T);
    if (comparison.reason === "two-phase" && sat) pReal = sat.P;
    note = UNRELIABLE_TEXT[comparison.reason] || UNRELIABLE_TEXT["invalid-state"];
  }
  const pressure = real ? pReal : pIdeal;
  const Z = real ? (pressure * V) / (n * R_GAS * c.T) : 1;
  const ref = realGasReference(c, n, V, target ?? pressure);
  const limited = real && limitReason != null;
  return {
    ...c,
    n,
    V,
    pressure,
    pIdeal,
    pReal,
    Z,
    cls: real ? (limited ? null : classifyZ(Z)) : classifyZ(1),
    deviationPct: Math.abs(Z - 1) * 100,
    comparison,
    ref,
    limit: limited ? { reason: limitReason, text: UNRELIABLE_TEXT[limitReason] || UNRELIABLE_TEXT["invalid-state"] } : null,
    status,
    reachable: status === "ok" || status === "held",
    vRequired,
    pTarget: target,
    note,
  };
}

/** Everything the Live Values panel needs for a set of controls. */
export function computeReadings(controls) {
  return resolveState(controls);
}

/** Apply one user control change to a full control set (pure). Handles the
 * Volume <-> Pressure switch without jumping the state. Switching the gas
 * model ("mode") never changes N, T, the selected control or its value. */
export function applyControlChange(controls, patch) {
  const cur = clampControls(controls);
  const st = resolveState(cur);
  let next = { ...cur };
  const unpin = () => {
    if (cur.control === "pressure" && cur.Vpin != null) {
      const exact = st.pressure;
      next.Vpin = null;
      next.P = clamp(exact, LIMITS.P.min, LIMITS.P.max);
      next.Phold = exact !== next.P ? exact : null;
    }
  };
  if ("control" in patch && patch.control !== cur.control) {
    if (patch.control === "pressure") {
      const pNow = st.pressure;
      const sol = solveVolumeForPressure(st.n, cur.T, pNow, cur.mode);
      const same = sol.status === "ok" && Math.abs(sol.V - st.V) <= 1e-6 * st.V;
      const outside = pNow < LIMITS.P.min || pNow > LIMITS.P.max;
      next = {
        ...cur, control: "pressure", V: st.V, P: clamp(pNow, LIMITS.P.min, LIMITS.P.max),
        Phold: outside ? pNow : null, Vpin: same ? null : st.V,
      };
    } else {
      next = { ...cur, control: "volume", V: st.V, Phold: null, Vpin: null };
    }
    return clampControls(next);
  }
  if ("P" in patch) { next.P = Number(patch.P); next.Phold = null; next.Vpin = null; }
  if ("N" in patch) { unpin(); next.N = patch.N; }
  if ("T" in patch) { unpin(); next.T = patch.T; }
  if ("mode" in patch) { unpin(); next.mode = patch.mode; }
  if ("V" in patch && cur.control === "volume") next.V = patch.V;
  return clampControls(next);
}

// ---------------------------------------------------------------------------
// "What is happening?" explanation selection (pure). Compares two settled
// control sets and returns { id, text } for the most relevant observation, or
// null when nothing relevant changed (so the UI keeps the current message).
// (Reset is handled by the caller: it passes prevControls = null.)
// Priority: control selector > gas model > unreachable/limit state > real-gas
// deviation trend > the variable that changed (P, T, V, N in that order),
// worded for the variable that is held constant.
// ---------------------------------------------------------------------------
export const EXPLANATIONS = Object.freeze({
  initial: "Ideal gas: point particles with no forces, so Z = 1 at every pressure. Switch to Real gas to compare CO₂ at the same conditions.",
  initialReal: "Real CO₂: the molecules have size and attract each other, so Z = PV/nRT departs from 1.",
  realSelected: "Real gas: finite-sized molecules that attract each other. Same T, n and controlled variable – only the model changed.",
  idealSelected: "Ideal gas: point particles with no intermolecular forces, so PV = nRT and Z = 1 exactly.",
  controlPressure: "You now set the pressure. The piston moves until the gas pressure matches it, so the volume is calculated.",
  controlVolume: "You now set the volume with the piston. The pressure is calculated from the gas model.",
  tempUpV: "Hotter: particles move faster and hit the walls harder and more often, so the pressure rises at constant volume.",
  tempDownV: "Colder: particles move more slowly, so the pressure falls at constant volume.",
  tempUpP: "Hotter: particles move faster, so the gas expands to keep the pressure constant.",
  tempDownP: "Colder: particles move more slowly, so the gas contracts to keep the pressure constant.",
  volDown: "Less space: more frequent wall collisions, so the pressure rises.",
  volUp: "More space: fewer wall collisions, so the pressure falls.",
  nUpV: "More gas in the same space: more wall collisions, so the pressure rises.",
  nDownV: "Less gas in the same space: fewer wall collisions, so the pressure falls.",
  nUpP: "More gas at the same pressure needs more space, so the piston rises.",
  nDownP: "Less gas at the same pressure needs less space, so the piston falls.",
  pressureUp: "Higher pressure: the piston moves down and compresses the gas.",
  pressureDown: "Lower pressure: the piston moves up and the gas expands.",
  unreachableLow: "The piston has reached its lower limit: this pressure cannot be reached with this amount of gas.",
  unreachableHigh: "The piston has reached its upper limit: this pressure cannot be reached with this amount of gas.",
  noGasSolutionCondensation: "Model limit: above the saturation pressure at this temperature CO₂ would condense, so the gas model stops here.",
  noGasSolutionExcluded: "Model limit: the molecules' own volume fills the container, so the gas model stops here.",
  unreliable: "Model limit: the van der Waals gas model is unreliable in these conditions, so no real-gas value is shown.",
  approachIdeal: "Molecules are far apart, so attractions and molecular size matter less: the real gas is closer to ideal.",
  deviationUp: "Molecules are closer together: attractions (Z < 1) or molecular size (Z > 1) matter more, so the real gas departs further from ideal.",
});

const DEVIATION_TREND_EPS = 0.2; // percentage points of |Z - 1| x 100

export function selectExplanation(prevControls, nextControls) {
  const next = resolveState(nextControls);
  const out = (id) => ({ id, text: EXPLANATIONS[id] });
  if (prevControls == null) return out(next.mode === "real" ? "initialReal" : "initial");
  const prev = resolveState(prevControls);
  const sameV = Math.abs(prev.V - next.V) < 1e-9;
  const changed = {
    control: prev.control !== next.control,
    mode: prev.mode !== next.mode,
    P: next.control === "pressure" && prev.control === "pressure" && Math.abs((prev.pTarget ?? 0) - (next.pTarget ?? 0)) > 1e-12,
    T: prev.T !== next.T,
    V: next.control === "volume" && prev.control === "volume" && prev.V !== next.V,
    N: prev.N !== next.N,
  };
  if (!Object.values(changed).some(Boolean) && sameV) return null;
  if (changed.control) return out(next.control === "pressure" ? "controlPressure" : "controlVolume");
  if (changed.mode) return out(next.mode === "real" ? "realSelected" : "idealSelected");

  const physical = changed.P || changed.T || changed.V || changed.N;
  if (!physical) return null;
  if (next.control === "pressure") {
    if (next.status === "below-range") return out("unreachableLow");
    if (next.status === "above-range") return out("unreachableHigh");
    if (next.status === "no-gas-solution") return out(next.limit?.reason === "condensation" || (next.mode !== "real" && next.ref.reason === "condensation") ? "noGasSolutionCondensation" : "noGasSolutionExcluded");
  }
  if (next.mode === "real") {
    if (next.limit) return out("unreliable");
    const a = prev.ref, b = next.ref;
    if (a.status === "ok" && b.status === "ok") {
      const dd = (Math.abs(b.Z - 1) - Math.abs(a.Z - 1)) * 100;
      if (dd <= -DEVIATION_TREND_EPS && b.cls.index <= 1) return out("approachIdeal");
      if (dd >= DEVIATION_TREND_EPS && b.cls.index >= 1) return out("deviationUp");
    }
  }
  const pv = next.control === "pressure" ? "P" : "V";
  if (changed.P) return out(next.pTarget > prev.pTarget ? "pressureUp" : "pressureDown");
  if (changed.T) return out(next.T > prev.T ? "tempUp" + pv : "tempDown" + pv);
  if (changed.V) return out(next.V < prev.V ? "volDown" : "volUp");
  return out(next.N > prev.N ? "nUp" + pv : "nDown" + pv);
}

// ---------------------------------------------------------------------------
// REAL vs IDEAL GAS BEHAVIOUR GRAPH: compressibility factor Z(P)
// ---------------------------------------------------------------------------
// Z = P V / (n R T).  Ideal gas: Z = 1 exactly.  Real gas (vdW): the curve is
// Z(P) at the CURRENT T (recomputed whenever T changes), built point by point by
// solving the stable gas-branch volume V(P) (solveVolumeForPressure) and
// Z = P V / (n R T). (With per-mole vdW constants Z depends on P and T only, so
// n does not change the curve; it only changes where the live state sits and
// the physical limits through the volume range.)
//
// Identity used by the UI and tests: at the same T, V, n,
//     Z = P_real / P_ideal   =>   |Z - 1| equals the deviation used by the indicator.
//
// Plotted pressure range: Z_P_MIN..Z_P_MAX = 0.1..1000 atm on a LOG axis: it
// contains the whole 1-500 atm control range, the low-pressure limit Z -> 1 and
// the excluded-volume upturn. The live marker is always inside the plot.
//
// Validity (never plotted otherwise):
//   * gas branch only: V >= max(V_sat_gas, V_spinodal, n b / 0.8) so dP/dV < 0 and
//     at least 20 % of V is free (VDW_MIN_FREE_FRACTION).
//   * below Tc the curve stops at the Maxwell saturation pressure P_sat(T):
//     beyond it the real gas condenses and the simplified gas model no longer applies.
//   The curve is cut at the first pressure where either limit applies and the
//   end point is reported (curve.end) so the UI can say why it stops.
export const Z_P_MIN = 0.1; // atm
export const Z_P_MAX = 1000; // atm
export const Z_SAMPLES = 240;
export const Z_TOLERANCE_PCT = Z_BOUNDS.nearIdeal * 100; // |Z-1| x 100 below this: "approximately ideal"
export const Z_Y_CAP = 2.4; // plotted Z never exceeds this (curve clipped, noted)

export const Z_END_TEXT = Object.freeze({
  condensation: "Above this pressure CO₂ condenses at this temperature, so the gas model ends (model limit).",
  "excluded-volume": "At this pressure the molecules' own volume fills too much of the container, so the model ends here (model limit).",
});

/** Compressibility factor Z = P V / (n R T) of a state (n mol, T K, V L).
 * Ideal gas: exactly 1. Real gas: van der Waals pressure at the same T, V, n
 * (NaN when V <= n b). */
export function compressibilityFactor(n, T, V, gas = "real") {
  if (gas !== "real") return 1;
  const p = vdwPressureRaw(n, T, V);
  return (p * V) / (n * R_GAS * T);
}

/** The real-gas Z(P) curve at constant n and T, plus the ideal reference.
 * { n, T, gas, pMin, pMax, ideal: [{P, Z:1} x2], points: [{P, Z, V}],
 *   ghost, end: null | {P, reason, text}, zMin, zMax, tc, ... }
 * `points` is ALWAYS the real-gas model (for gas = "ideal" the UI draws it as a
 * lighter comparison curve). */
export function generateZCurve(n, T, gas = "real", samples = Z_SAMPLES) {
  const pMin = Z_P_MIN, pMax = Z_P_MAX;
  const lim = realGasMaxPressure(n, T);
  const points = [];
  const lr = Math.log(pMax / pMin);
  const add = (P) => {
    const r = compressibilityAtPressure(n, T, P, "real");
    if (r.valid && Number.isFinite(r.Z)) points.push({ P, Z: r.Z, V: r.V });
  };
  for (let i = 0; i < samples; i++) {
    const P = pMin * Math.exp((lr * i) / (samples - 1));
    if (P >= lim.P) break;
    add(P);
  }
  let end = null;
  if (lim.P < pMax) {
    if (lim.P > pMin) add(lim.P); // end exactly on the validity limit
    end = { P: lim.P, reason: lim.reason, text: Z_END_TEXT[lim.reason] };
  }
  let zMin = null, zMax = null;
  for (const p of points) {
    if (!zMin || p.Z < zMin.Z) zMin = p;
    if (!zMax || p.Z > zMax.Z) zMax = p;
  }
  return {
    n, T, gas, pMin, pMax,
    ideal: [{ P: pMin, Z: 1 }, { P: pMax, Z: 1 }],
    points, ghost: gas !== "real", end, zMin, zMax,
    ...vdwCriticalConstants(),
    supercritical: T >= vdwCriticalConstants().Tc,
  };
}

/** Explanation of the current Z (pure). Tolerance: |Z-1| < Z_BOUNDS.nearIdeal. */
export const Z_EXPLANATIONS = Object.freeze({
  ideal: "Z is close to 1: the real gas behaves almost like an ideal gas.",
  below: "Z < 1: attractions between molecules dominate.",
  above: "Z > 1: the molecules' own volume dominates.",
});
export function zExplanation(Z) {
  if (!Number.isFinite(Z)) return { id: "unreliable", text: UNRELIABLE_TEXT["invalid-state"], Z: null, deviationPct: null };
  const deviationPct = Math.abs(Z - 1) * 100;
  const id = deviationPct < Z_TOLERANCE_PCT ? "ideal" : Z < 1 ? "below" : "above";
  return { id, text: Z_EXPLANATIONS[id], Z, deviationPct };
}

/** Live-state markers for the graph, from a resolved state. The CURRENT state
 * matches the Live values exactly (P is the displayed pressure; Z = P V / (n R T)).
 * `real` is the real-gas point at the same controlled variable (the same
 * P in Pressure control, the same V in Volume control): in Ideal mode it is the
 * comparison point that would become the live state if the student switches. */
export function zMarker(state) {
  const { n, T } = state;
  const clampP = (P) => Math.min(Z_P_MAX, Math.max(Z_P_MIN, P));
  const ref = state.ref;
  const real = ref && ref.status === "ok" && ref.P > 0
    ? { P: ref.P, plotP: clampP(ref.P), Z: ref.Z, V: ref.V, cls: ref.cls, ...zExplanation(ref.Z) }
    : null;
  if (state.mode !== "real") {
    const P = state.pIdeal;
    return { status: "ok", reason: null, P, plotP: clampP(P), Z: 1, outside: P < Z_P_MIN || P > Z_P_MAX, onCurve: true, real, ...zExplanation(1) };
  }
  if (state.limit) {
    const P = state.pressure;
    const Z = (P * state.V) / (n * R_GAS * T);
    return { status: "limit", reason: state.limit.reason, P, plotP: clampP(P), Z, outside: P < Z_P_MIN || P > Z_P_MAX, onCurve: false, real: null, text: state.limit.text, deviationPct: Math.abs(Z - 1) * 100 };
  }
  const P = state.pressure;
  const Z = state.Z;
  return {
    status: "ok", reason: null, P, plotP: clampP(P), Z,
    outside: P < Z_P_MIN || P > Z_P_MAX,
    onCurve: true, real: null, ...zExplanation(Z),
  };
}

/** Y-axis range for the Z plot: contains the curve and the markers, rounded
 * outward, and never narrower than 0.7-1.3 so a gentle curve is still visibly a curve. */
export function zAxisRange(curve, marker) {
  let lo = 1, hi = 1;
  for (const p of curve.points) { lo = Math.min(lo, p.Z); hi = Math.max(hi, p.Z); }
  const add = (m) => { if (m && Number.isFinite(m.Z)) { lo = Math.min(lo, m.Z); hi = Math.max(hi, m.Z); } };
  add(marker); add(marker?.real);
  lo = Math.min(lo, 0.7); hi = Math.max(hi, 1.3);
  const yMin = Math.max(0, Math.floor((lo - 0.02) * 10) / 10);
  const rawMax = Math.ceil((hi + 0.02) * 10) / 10;
  return { yMin, yMax: Math.min(Z_Y_CAP, rawMax), clipped: rawMax > Z_Y_CAP };
}


// ---------------------------------------------------------------------------
// Particle dynamics (2D, equal masses m = 1, chamber units)
// ---------------------------------------------------------------------------
// ILLUSTRATIVE particle picture (not molecular dynamics of CO2): a 2D hard-disc
// gas. The cylinder is wide (landscape) and its height follows log(V) over the
// 0.01-100 L range (see pistonHeight), so the piston visibly moves over the
// four decades of volume the pressure range needs.
export const CHAMBER = { width: 300, maxHeight: 190 }; // units
export const MIN_HEIGHT_FRACTION = 0.14; // piston height at V = V_min
export const R_IDEAL = 2.6; // drawn/collision radius, ideal (no effect on the ideal-gas model: point particles)
export const R_REAL = 3.4; // drawn/collision radius in real mode (finite-size cue for the excluded volume b)
export const T_REF = 300;
// Rayleigh scale: each velocity component ~ N(0, sigma^2), sigma = SIGMA_REF * sqrt(T / T_REF)
// so <v^2> = 2 sigma^2 and v_rms (and mean speed) scale with sqrt(T).
export const SIGMA_REF = 30;

const DT = 1 / 240; // fixed physics substep (s)
const MAX_SUBSTEPS_PER_ADVANCE = 16;
const THERMOSTAT_TAU = 0.6; // s; imposes the chosen temperature smoothly (isothermal experiment)
const PISTON_RATE = 5; // 1/s exponential approach
const PISTON_MAX_SPEED = 80; // units/s
const RADIUS_RATE = 5; // 1/s
const FADE_TIME = 0.45; // s
const COUNT_RATE = 60; // particles/s added or removed
const MAX_EVENTS = 80;

// Real-mode attraction: hard core (collision radius) + short-range attractive
// tail, force-shifted so it goes to zero at the cutoff:
//   F(r) = (6 EPS / S) * [ (S/r)^7 - (S/RC)^7 ]  for S <= r <= RC   (attractive)
// with S the contact distance (2 * current radius). EPS is set relative to the
// reference thermal energy kT_ref = SIGMA_REF^2 (m = 1) so attraction matters
// at 100 K (well depth ~1.2 kT) and is minor at 300 K (~0.4 kT) and above. Tuned
// empirically (neighbour-count sweep over seeds). Not quantitative MD.
const EPS_OVER_KT_REF = 0.65; // ~ (eps/k = 195 K for CO2-like molecules) / 300 K
const EPS = EPS_OVER_KT_REF * SIGMA_REF * SIGMA_REF;
const CUTOFF_FACTOR = 2.5;

/** Piston height (chamber units) for a volume in litres: logarithmic in V. */
export function pistonHeight(V) {
  const v = clamp(Number(V) || LIMITS.V.min, LIMITS.V.min, LIMITS.V.max);
  const f = Math.log(v / LIMITS.V.min) / Math.log(LIMITS.V.max / LIMITS.V.min);
  return CHAMBER.maxHeight * (MIN_HEIGHT_FRACTION + (1 - MIN_HEIGHT_FRACTION) * f);
}

export function sigmaForT(T) {
  return SIGMA_REF * Math.sqrt(T / T_REF);
}

/** Seedable PRNG (mulberry32) so tests are reproducible. */
export function makeRng(seed = 12345) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Elastic reflection of velocity component v off a wall moving at vWall. */
export function reflectWall1D(v, vWall = 0) {
  return 2 * vWall - v;
}

/** Elastic collision of two EQUAL-mass particles (velocity update only).
 * Exchanges the normal components -> conserves momentum and kinetic energy
 * exactly (up to floating point). Returns true if a collision was applied
 * (i.e. the particles were approaching along the line of centres). */
export function collidePair(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-12) return false;
  dx /= d;
  dy /= d;
  const vrel = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
  if (vrel <= 0) return false;
  a.vx -= vrel * dx;
  a.vy -= vrel * dy;
  b.vx += vrel * dx;
  b.vy += vrel * dy;
  return true;
}

/** Keep a particle inside the chamber and under the (possibly moving)
 * piston. Returns true if a velocity reflection happened. */
function confine(p, r, h, vPiston) {
  let hit = false;
  const W = CHAMBER.width;
  if (p.x < r) {
    p.x = r;
    if (p.vx < 0) { p.vx = -p.vx; hit = true; }
  } else if (p.x > W - r) {
    p.x = W - r;
    if (p.vx > 0) { p.vx = -p.vx; hit = true; }
  }
  if (p.y < r) {
    p.y = r;
    if (p.vy < 0) { p.vy = -p.vy; hit = true; }
  }
  const top = h - r;
  if (p.y > top) {
    p.y = top;
    const rel = p.vy - vPiston;
    if (rel > 0) { p.vy = reflectWall1D(p.vy, vPiston); hit = true; }
  }
  return hit;
}

export function createSimulation({ seed = 12345 } = {}) {
  const rng = makeRng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

  const sim = {
    controls: { ...DEFAULT_CONTROLS },
    state: resolveState(DEFAULT_CONTROLS),
    display: { ...DEFAULT_DISPLAY },
    particles: [],
    paused: false,
    instant: false, // reduced motion: piston/radius/fades snap
    time: 0,
    pistonH: pistonHeight(resolveState(DEFAULT_CONTROLS).V),
    pistonV: 0,
    radius: R_IDEAL,
    events: [],
    _acc: 0,
    _countAcc: 0,
    _nextId: 1,
  };

  const targetRadius = () => (sim.controls.mode === "real" ? R_REAL : R_IDEAL);
  const activeParticles = () => sim.particles.filter((p) => p.fade >= 0);

  function randomSpeedVelocity() {
    const s = sigmaForT(sim.controls.T);
    return [s * gauss(), s * gauss()];
  }

  function spawnParticle(alpha) {
    const r = sim.radius;
    const h = sim.pistonH;
    const minD = 2 * r * 1.15;
    let best = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = r + rng() * (CHAMBER.width - 2 * r);
      const y = r + rng() * Math.max(0, h - 2 * r);
      let md = Infinity;
      for (const q of sim.particles) {
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < md) md = d;
      }
      if (md >= minD) { best = { x, y }; break; }
      if (md > bestScore) { bestScore = md; best = { x, y }; }
    }
    const [vx, vy] = randomSpeedVelocity();
    sim.particles.push({
      id: sim._nextId++, x: best.x, y: best.y, vx, vy,
      alpha, fade: alpha >= 1 ? 0 : 1,
    });
  }

  function syncCount(instantly) {
    const target = sim.controls.N;
    let active = activeParticles();
    if (instantly) {
      sim.particles = sim.particles.filter((p) => p.fade >= 0);
      for (const p of sim.particles) { p.alpha = 1; p.fade = 0; }
      while (sim.particles.length > target) sim.particles.pop();
      while (sim.particles.length < target) spawnParticle(1);
      return;
    }
    // fade-in particles count as active; spawn/remove at COUNT_RATE
    let budget = Math.floor(sim._countAcc);
    if (budget > 0) sim._countAcc -= budget;
    while (budget > 0 && active.length < target) { spawnParticle(sim.instant ? 1 : 0); active = activeParticles(); budget--; }
    while (budget > 0 && active.length > target) {
      const p = active.pop();
      if (sim.instant) sim.particles.splice(sim.particles.indexOf(p), 1);
      else p.fade = -1;
      budget--;
    }
    if (active.length === target) sim._countAcc = 0;
  }

  function currentKineticTemperature() {
    const act = activeParticles();
    if (!act.length) return null;
    let s = 0;
    for (const p of act) s += p.vx * p.vx + p.vy * p.vy;
    return (T_REF * (s / act.length)) / (2 * SIGMA_REF * SIGMA_REF);
  }

  function scaleVelocities(lambda) {
    for (const p of sim.particles) { p.vx *= lambda; p.vy *= lambda; }
  }

  function thermostat(dt) {
    const Tk = currentKineticTemperature();
    if (!Tk) return;
    const l2 = 1 + (dt / THERMOSTAT_TAU) * (sim.controls.T / Tk - 1);
    scaleVelocities(clamp(Math.sqrt(Math.max(l2, 0)), 0.9, 1.1));
  }

  function applyAttraction(dt) {
    const S = 2 * sim.radius;
    const RC = CUTOFF_FACTOR * S;
    const pre = (6 * EPS) / S;
    const shift = Math.pow(S / RC, 7);
    const ps = sim.particles;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.fade < 0) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.fade < 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > RC * RC || d2 < 1e-9) continue;
        const d = Math.sqrt(d2);
        const rr = Math.max(d, S); // clamp: force never exceeds its contact value
        const f = pre * (Math.pow(S / rr, 7) - shift);
        const fx = (f * dx) / d * dt;
        const fy = (f * dy) / d * dt;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }
  }

  function pushEvent(x, y, kind) {
    if (!sim.display.collisions || sim.instant) return;
    sim.events.push({ x, y, kind, t: sim.time });
    if (sim.events.length > MAX_EVENTS) sim.events.shift();
  }

  function substep() {
    const dt = DT;
    // piston
    const targetH = pistonHeight(sim.state.V);
    const prevH = sim.pistonH;
    if (sim.instant) {
      sim.pistonH = targetH;
    } else {
      const diff = targetH - prevH;
      const v = clamp(diff * PISTON_RATE, -PISTON_MAX_SPEED, PISTON_MAX_SPEED);
      sim.pistonH = Math.abs(diff) < 1e-4 ? targetH : prevH + v * dt;
    }
    sim.pistonV = (sim.pistonH - prevH) / dt;
    // collision radius eases between ideal and real
    const rt = targetRadius();
    sim.radius = sim.instant || Math.abs(rt - sim.radius) < 1e-4 ? rt : sim.radius + (rt - sim.radius) * Math.min(1, RADIUS_RATE * dt);
    const r = sim.radius;
    const ps = sim.particles;

    thermostat(dt);
    if (sim.controls.mode === "real") applyAttraction(dt);

    for (const p of ps) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.fade > 0) { p.alpha = Math.min(1, p.alpha + dt / FADE_TIME); if (p.alpha >= 1) p.fade = 0; }
      else if (p.fade < 0) p.alpha -= dt / FADE_TIME;
    }
    for (const p of ps) {
      if (confine(p, r, sim.pistonH, sim.pistonV)) pushEvent(p.x, p.y, "wall");
    }
    // particle-particle (equal mass, elastic); fading-out ghosts do not collide
    const D = 2 * r;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.fade < 0) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.fade < 0) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= D * D) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-9) { const ang = rng() * 2 * Math.PI; dx = Math.cos(ang); dy = Math.sin(ang); d = 1e-9; }
        const nx = dx / d, ny = dy / d;
        const push = (D - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        if (collidePair(a, b)) pushEvent((a.x + b.x) / 2, (a.y + b.y) / 2, "pair");
      }
    }
    for (const p of ps) confine(p, r, sim.pistonH, sim.pistonV); // hard guarantee after pair pushes
    sim.particles = ps.filter((p) => p.fade >= 0 || p.alpha > 0);
    sim.time += dt;
  }

  /** Advance by wall-clock dt seconds (no-op while paused). */
  sim.advance = function advance(dt) {
    if (sim.paused) return;
    sim._acc += Math.min(Math.max(dt, 0), 0.1);
    sim._countAcc += Math.min(Math.max(dt, 0), 0.1) * COUNT_RATE;
    let n = 0;
    syncCount(false);
    while (sim._acc >= DT && n < MAX_SUBSTEPS_PER_ADVANCE) {
      substep();
      sim._acc -= DT;
      n++;
    }
    if (n === MAX_SUBSTEPS_PER_ADVANCE) sim._acc = 0;
  };

  /** Snap everything to the current controls without advancing motion
   * (used while paused so the display never lags the sliders). */
  function syncInstant() {
    sim.pistonH = pistonHeight(sim.state.V);
    sim.pistonV = 0;
    sim.radius = targetRadius();
    syncCount(true);
    const Tk = currentKineticTemperature();
    if (Tk) scaleVelocities(Math.sqrt(sim.controls.T / Tk));
    for (const p of sim.particles) confine(p, sim.radius, sim.pistonH, 0);
  }

  sim.setControls = function setControls(next) {
    sim.controls = clampControls({ ...sim.controls, ...next });
    sim.state = resolveState(sim.controls);
    if (sim.paused) syncInstant();
  };

  sim.setDisplay = function setDisplay(next) {
    sim.display = { ...sim.display, ...next };
    if (!sim.display.collisions) sim.events.length = 0;
  };

  sim.setPaused = function setPaused(p) {
    sim.paused = !!p;
  };

  sim.setInstant = function setInstant(v) {
    sim.instant = !!v;
  };

  /** Restore defaults: Ideal mode, N=50, T=300 K, V=25 L, default display
   * options, playing. Rebuilds the particle sample. */
  sim.reset = function reset() {
    sim.controls = { ...DEFAULT_CONTROLS };
    sim.state = resolveState(sim.controls);
    sim.display = { ...DEFAULT_DISPLAY };
    sim.paused = false;
    sim.particles = [];
    sim.events.length = 0;
    sim.time = 0;
    sim._acc = 0;
    sim._countAcc = 0;
    sim.pistonH = pistonHeight(sim.state.V);
    sim.pistonV = 0;
    sim.radius = R_IDEAL;
    syncCount(true);
    for (const p of sim.particles) confine(p, sim.radius, sim.pistonH, 0);
  };

  sim.getReadings = () => sim.state;

  sim.getStats = function getStats() {
    const act = activeParticles();
    let sp = 0, ke = 0, px = 0, py = 0;
    for (const p of act) {
      const v2 = p.vx * p.vx + p.vy * p.vy;
      sp += Math.sqrt(v2); ke += 0.5 * v2; px += p.vx; py += p.vy;
    }
    const n = act.length || 1;
    return { count: act.length, meanSpeed: sp / n, meanKE: ke / n, totalKE: ke, px, py, kineticTemperature: currentKineticTemperature() };
  };

  /** Pairs of active particles within the attraction range (real mode),
   * with strength s in (0,1] relative to contact. For the force-line overlay. */
  sim.getForcePairs = function getForcePairs() {
    if (sim.controls.mode !== "real") return [];
    const S = 2 * sim.radius;
    const RC = 1.8 * S;
    const out = [];
    const ps = sim.particles;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].fade < 0) continue;
      for (let j = i + 1; j < ps.length; j++) {
        if (ps[j].fade < 0) continue;
        const d = Math.hypot(ps[j].x - ps[i].x, ps[j].y - ps[i].y);
        if (d <= RC) out.push({ a: ps[i], b: ps[j], s: clamp(1 - (d - S) / (RC - S), 0.08, 1) });
      }
    }
    return out;
  };

  sim.settle = function settle(seconds) {
    const steps = Math.ceil(seconds / DT);
    for (let i = 0; i < steps; i++) {
      if (sim.paused) return;
      sim._countAcc += DT * COUNT_RATE;
      syncCount(false);
      substep();
    }
  };

  sim.reset();
  return sim;
}

export const PHYSICS_DT = DT;
