// Ideal Gas Simulation -- pure model (no React, no DOM) so it can be tested
// in Node (scripts/test-ideal-gas-model.mjs). Rendering lives elsewhere.
//
// ---------------------------------------------------------------------------
// SCALING CONVENTION (S1.5.1-S1.5.3)
// ---------------------------------------------------------------------------
// The "Number of particles" slider N (5-100) is a VISUAL SAMPLE of the gas,
// not a literal molecule count. It is mapped linearly onto the amount of
// substance:
//
//     n = N * (N_REF_MOL / N_REF) ,   N_REF = 50
//
// where N_REF_MOL is calibrated so that the default state
// (N = 50, T = 300 K, V = 25 L) gives exactly P_ideal = 1.00 atm with
// R = 0.082057 L atm mol^-1 K^-1:
//
//     n_ref = P V / (R T) = 1.00 * 25 / (0.082057 * 300) ~= 1.0156 mol
//     => one drawn particle represents ~0.0203 mol.
//
// Pressure shown to the student is ALWAYS computed from the macroscopic
// formulas below (ideal: PV = nRT; real: van der Waals), never by counting
// collisions of the animated particles. The animation is a qualitative
// picture; the readout is the model.
//
// The drawn particle radius is a DISPLAY quantity. In ideal mode it does not
// enter the pressure formula (point-particle assumption); in real mode the
// larger collision radius is a visual cue for the excluded volume `b`, but
// the pressure is still the vdW formula, not an emergent MD pressure.
//
// ---------------------------------------------------------------------------
// VAN DER WAALS (illustrative, NOT a specific gas)
// ---------------------------------------------------------------------------
//     P = nRT / (V - n b) - a (n / V)^2
//
//   a = 15.0 L^2 atm mol^-2  (attraction)
//   b = 0.40 L mol^-1        (excluded volume)
//
// These are deliberately larger than values for small real molecules
// (a ~ 1-4, b ~ 0.03-0.05): roughly 4-15x on a and ~8-10x on b. Because the slider
// sample only reaches n ~ 2 mol in V >= 5 L, realistic constants would give
// deviations below ~3% almost everywhere and nothing to explore. With these values
// (Boyle-like crossover where the two effects cancel is near a/(R b) ~ 460 K):
//   - the default state deviates by ~0.8% (Low),
//   - 100 K with a compressed sample is strongly attraction-dominated
//     (pressure far below ideal, High, ~55% at the extreme),
//   - 800 K with a compressed sample is excluded-volume dominated
//     (pressure above ideal, ~10%, Moderate),
//   - V - n b stays >= 4.19 L (>= 83% of V) over the whole slider grid and
//     P stays positive and finite (defensive clamps are still applied).
//
// CRITICAL CONSTANTS (kept unchanged; checked for the Z(P) graph):
//   Tc = 8a / (27 R b) = 135.4 K, Pc = a / (27 b^2) = 3.47 atm,
//   T_Boyle = a / (R b) = 457 K, Vc = 3b = 1.2 L/mol.
// With the 100-800 K slider this gives on the stable gas branch: Z < 1 from
// attractions below T_Boyle (e.g. Z_min = 0.74 near 10 atm at 200 K, 0.945 near
// 11 atm at 300 K), Z -> 1 as P -> 0, and Z > 1 from the excluded volume at high
// P (rises through 1 at ~22 atm at 300 K; Z > 1 at every P above 457 K). Only
// below Tc (100-135 K) does the isotherm have a loop; there the Z curve stops at
// the Maxwell saturation pressure (see vdwSaturationPressure).
//
// DEVIATION INDICATOR  d = |P_real - P_ideal| / P_ideal * 100 (%)
//   P_real and P_ideal are ALWAYS evaluated at the same T, V and n. (In
//   Pressure-control mode V is the volume solved for the selected gas model,
//   and P_ideal is evaluated at that same V -- not at the target pressure.)
//   Single source of truth: DEVIATION_BOUNDS below, used by the UI and tests.
//     Very close to ideal   d <  2
//     Small deviation       2 <= d <  5
//     Moderate deviation    5 <= d <= 15
//     Large deviation       d >  15
//   (the legacy 3-level deviationLevel() keeps the old 5 / 15 cut-offs, which
//   are the "small" and "moderate" bounds.)
//   Marker position (0..1 along the bar): continuous, monotone, piecewise
//   linear. Each class owns an equal quarter of the bar; the last quarter
//   spans 15..DEVIATION_SCALE_MAX (45 %) and saturates at the right end.
//
// PRESSURE CONTROL (Mode B). Given a target P the model solves for V:
//   ideal  V = nRT / P
//   real   P_vdW(V) = P by bisection on the stable gas branch only, i.e.
//          V >= V_lo = max(V_spinodal, n b / (1 - 0.2)), where dP/dV < 0 and the
//          excluded volume leaves at least 20 % of V free. Below the critical
//          temperature (Tc = 8a / 27Rb ~ 135 K) the vdW isotherm has a
//          maximum P_max at V_spinodal; targets above it have no gas-branch
//          solution. Solutions outside the 5-50 L piston range are clamped and
//          reported (status), never presented as reachable.
//          Mechanical stability only: no Maxwell construction, so a
//          super-saturated (metastable) vapour below Tc can still be returned.
// ---------------------------------------------------------------------------

export const R_GAS = 0.082057; // L atm mol^-1 K^-1
export const VDW_A = 15.0; // L^2 atm mol^-2
export const VDW_B = 0.4; // L mol^-1

export const LIMITS = {
  N: { min: 5, max: 100, step: 1 },
  T: { min: 100, max: 800, step: 5 },
  V: { min: 5, max: 50, step: 1 },
  P: { min: 0.2, max: 5.0, step: 0.05 },
};

// control: "volume" (Mode A, default) or "pressure" (Mode B).
// P     target pressure (atm), kept inside LIMITS.P (slider value).
// Phold exact target (atm) when the pressure we switched in with was outside
//       the slider range (the state is held, never teleported); else null.
// Vpin  volume (L) held when the current state cannot be reproduced by the
//       solver (e.g. unstable vdW branch); else null. Cleared by any change.
export const DEFAULT_CONTROLS = Object.freeze({
  mode: "ideal", N: 50, T: 300, V: 25, control: "volume", P: 1.0, Phold: null, Vpin: null,
});
export const DEFAULT_DISPLAY = Object.freeze({ trails: true, collisions: false, forces: false });

export const N_REF = 50;
export const N_REF_MOL = (1.0 * 25) / (R_GAS * 300); // ~1.0156 mol for N_REF particles
export const MOL_PER_PARTICLE = N_REF_MOL / N_REF;

export const DEVIATION_BOUNDS = Object.freeze({ veryClose: 2, small: 5, moderate: 15 });
export const DEVIATION_SCALE_MAX = 45; // % at which the marker reaches the right end
export const DEVIATION_LOW_MAX = DEVIATION_BOUNDS.small; // legacy 3-level cut-offs
export const DEVIATION_MODERATE_MAX = DEVIATION_BOUNDS.moderate;
export const DEVIATION_CLASSES = Object.freeze([
  { id: "veryClose", label: "Very close to ideal" },
  { id: "small", label: "Small deviation" },
  { id: "moderate", label: "Moderate deviation" },
  { id: "large", label: "Large deviation" },
]);
export const VDW_MIN_FREE_FRACTION = 0.2; // (V - nb)/V below this => model unreliable
export const P_IDEAL_MIN = 1e-6; // atm; below this the % comparison is meaningless

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function clampControls(c) {
  const V = clamp(Number(c.V), LIMITS.V.min, LIMITS.V.max);
  const Pn = Number(c.P);
  const Ph = c.Phold == null ? NaN : Number(c.Phold);
  const Vp = c.Vpin == null ? NaN : Number(c.Vpin);
  return {
    mode: c.mode === "real" ? "real" : "ideal",
    N: Math.round(clamp(Number(c.N), LIMITS.N.min, LIMITS.N.max)),
    T: clamp(Number(c.T), LIMITS.T.min, LIMITS.T.max),
    V,
    control: c.control === "pressure" ? "pressure" : "volume",
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

export function deviationLevel(pct) {
  if (pct < DEVIATION_LOW_MAX) return "Low";
  if (pct <= DEVIATION_MODERATE_MAX) return "Moderate";
  return "High";
}

/** Four-class deviation classification (see header). */
export function classifyDeviation(pct) {
  const d = Number.isFinite(pct) ? pct : 0;
  let index = 3;
  if (d < DEVIATION_BOUNDS.veryClose) index = 0;
  else if (d < DEVIATION_BOUNDS.small) index = 1;
  else if (d <= DEVIATION_BOUNDS.moderate) index = 2;
  return { index, ...DEVIATION_CLASSES[index] };
}

/** Marker position 0..1: continuous, monotone, piecewise linear; each class
 * owns a quarter of the bar and the last one saturates at DEVIATION_SCALE_MAX. */
export function deviationMarkerPosition(pct) {
  const d = Math.max(0, Number.isFinite(pct) ? pct : 0);
  const { veryClose, small, moderate } = DEVIATION_BOUNDS;
  const knots = [0, veryClose, small, moderate, DEVIATION_SCALE_MAX];
  if (d >= DEVIATION_SCALE_MAX) return 1;
  for (let i = 0; i < 4; i++) {
    if (d <= knots[i + 1]) return (i + (d - knots[i]) / (knots[i + 1] - knots[i])) / 4;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// vdW helpers, pressure -> volume solver, comparison with the ideal gas
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

/** Largest V at which dP/dV = 0 (spinodal), or null when the isotherm is
 * monotone (T >= Tc). With x = V/n: R T x^3 = 2 a (x - b)^2. */
export function vdwSpinodalVolume(n, T) {
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
      return n * (VDW_B + (lo + hi) / 2);
    }
    t = t2;
  }
  return null;
}

/** Smallest volume of the reliable, stable gas branch. */
export function vdwGasBranchMinVolume(n, T) {
  const vs = vdwSpinodalVolume(n, T);
  return Math.max(vs ?? 0, (n * VDW_B) / (1 - VDW_MIN_FREE_FRACTION));
}

/** Solve for the volume at which the selected gas model has pressure P.
 * Returns { V, vRequired, status, reachable, pTarget, pAtV } where V is
 * clamped to the V slider range and status is one of
 * "ok" | "below-range" | "above-range" | "no-gas-solution" | "invalid". */
export function solveVolumeForPressure(n, T, P, gas = "ideal") {
  const vMin = LIMITS.V.min, vMax = LIMITS.V.max;
  const pAt = (V) => (gas === "real" ? vdwPressureRaw(n, T, V) : idealPressure(n, T, V));
  if (!(n > 0) || !(T > 0) || !(P > 0) || !Number.isFinite(P)) {
    return { V: clamp(vMin, vMin, vMax), vRequired: null, status: "invalid", reachable: false, pTarget: P, pAtV: NaN };
  }
  let vReq;
  if (gas !== "real") {
    vReq = (n * R_GAS * T) / P;
  } else {
    const vLo = vdwGasBranchMinVolume(n, T);
    if (!(P < pAt(vLo))) {
      const V = clamp(vLo, vMin, vMax);
      return { V, vRequired: null, status: "no-gas-solution", reachable: false, pTarget: P, pAtV: vdwPressureRaw(n, T, V) };
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
  return { V, vRequired: vReq, status, reachable: status === "ok", pTarget: P, pAtV: pAt(V) };
}

/** Real-vs-ideal comparison at the SAME n, T, V. Never throws; returns
 * status "unreliable" (with a reason) instead of a number outside the model's
 * validity region. */
export function compareWithIdeal(n, T, V) {
  const pIdeal = idealPressure(n, T, V);
  const pRealRaw = vdwPressureRaw(n, T, V);
  const bad = (reason) => ({ status: "unreliable", reason, caution: null, pIdeal, pReal: pRealRaw, deviationPct: null, signedPct: null, cls: null, marker: null });
  if (!(n > 0) || !(T > 0) || !(V > 0) || !Number.isFinite(pIdeal)) return bad("invalid-state");
  if (pIdeal < P_IDEAL_MIN) return bad("ideal-pressure-near-zero");
  if (!(V - n * VDW_B > 0) || (V - n * VDW_B) / V < VDW_MIN_FREE_FRACTION) return bad("excluded-volume");
  if (V < vdwGasBranchMinVolume(n, T)) return bad("unstable-region");
  if (!Number.isFinite(pRealRaw) || !(pRealRaw > 0)) return bad("non-positive-pressure");
  const deviationPct = deviationPercent(pIdeal, pRealRaw);
  // Below Tc, pressures above P_sat(T) are a supersaturated (metastable) vapour:
  // the number is still the model's, but flagged so the UI can warn.
  const psat = vdwSaturationPressure(T);
  const caution = psat != null && pRealRaw > psat * (1 + 1e-9) ? "supersaturated" : null;
  return {
    status: "ok", reason: null, caution, pIdeal, pReal: pRealRaw, deviationPct,
    signedPct: ((pRealRaw - pIdeal) / pIdeal) * 100,
    cls: classifyDeviation(deviationPct), marker: deviationMarkerPosition(deviationPct),
  };
}

export const CAUTION_TEXT = Object.freeze({
  supersaturated: "Near condensation: only a rough guide here.",
});

export const UNRELIABLE_TEXT = Object.freeze({
  "invalid-state": "The simplified model is unreliable for this state.",
  "ideal-pressure-near-zero": "The pressure is too close to zero for a meaningful comparison.",
  "excluded-volume": "The particles' own volume fills too much of the container, so the van der Waals model is unreliable here.",
  "unstable-region": "At this low temperature and density the van der Waals model predicts an unstable, condensing state, so the comparison is unreliable.",
  "non-positive-pressure": "The model gives a non-physical pressure here, so the comparison is unreliable.",
});

const fmtAtm = (x) => (x >= 10 ? x.toFixed(1) : x.toFixed(2));

/** Resolve the full physical state for a set of controls. In Volume mode V
 * is the slider value; in Pressure mode V is solved from the target P for the
 * selected gas model. Also provides everything the Live Values / comparison
 * panels need (legacy fields: pressure, pIdeal, pReal, deviationPct,
 * deviationLevel, n, mode, N, T, V). */
export function resolveState(controls) {
  const c = clampControls(controls);
  const n = amountOfSubstance(c.N);
  let V = c.V;
  let status = "ok";
  let note = null;
  let target = null;
  let vRequired = null;
  if (c.control === "pressure") {
    if (c.Vpin != null) {
      V = c.Vpin;
      status = "held";
      target = c.mode === "real" ? vdwPressure(n, c.T, V) : idealPressure(n, c.T, V);
      note = "This state cannot be reached by solving for pressure, so the volume is held. Move the pressure slider to continue.";
    } else {
      target = c.Phold ?? c.P;
      const sol = solveVolumeForPressure(n, c.T, target, c.mode);
      V = sol.V; status = sol.status; vRequired = sol.vRequired;
      const pNow = c.mode === "real" ? vdwPressure(n, c.T, V) : idealPressure(n, c.T, V);
      if (status === "below-range") note = `Target ${fmtAtm(target)} atm needs ${vRequired.toFixed(1)} L, below the ${LIMITS.V.min} L minimum. Volume limited to ${LIMITS.V.min} L, so P = ${fmtAtm(pNow)} atm (target unreachable).`;
      else if (status === "above-range") note = `Target ${fmtAtm(target)} atm needs ${vRequired >= 1000 ? ">1000" : vRequired.toFixed(1)} L, above the ${LIMITS.V.max} L maximum. Volume limited to ${LIMITS.V.max} L, so P = ${fmtAtm(pNow)} atm (target unreachable).`;
      else if (status === "no-gas-solution") note = `No stable gas state exists at ${fmtAtm(target)} atm for this model, n and T. Volume held at ${V.toFixed(1)} L; the model is unreliable here.`;
      else if (status === "invalid") note = "The target pressure is not valid for this state.";
      if (c.Phold != null && status === "ok") note = `Pressure ${fmtAtm(c.Phold)} atm is outside the slider range (${LIMITS.P.min}-${LIMITS.P.max} atm); the state is held at that pressure.`;
    }
  }
  const pIdeal = idealPressure(n, c.T, V);
  const pReal = vdwPressure(n, c.T, V);
  const pct = deviationPercent(pIdeal, pReal);
  return {
    ...c,
    n,
    V,
    pressure: c.mode === "real" ? pReal : pIdeal,
    pIdeal,
    pReal,
    deviationPct: pct,
    deviationLevel: deviationLevel(pct),
    comparison: compareWithIdeal(n, c.T, V),
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
 * Volume <-> Pressure switch without jumping the state. */
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
// Priority: control mode > gas type > unreachable/unreliable
// state > real-gas deviation trend > the physical variable that changed
// (P, T, V, N in that order), worded for the variable that is held constant.
// ---------------------------------------------------------------------------
export const EXPLANATIONS = Object.freeze({
  initial: "Particles move randomly and collide with the walls and with each other. These wall collisions are what produce the gas pressure.",
  initialReal: "Real gas particles have finite volume and experience intermolecular forces, so the pressure can differ from the ideal-gas value.",
  realSelected: "Unlike ideal gas particles, real gas particles have finite volume and experience intermolecular forces.",
  idealSelected: "Ideal gas particles are treated as points with no intermolecular forces, so the pressure follows PV = nRT exactly.",
  controlPressure: "You now set the target pressure. The piston moves until the gas pressure matches it, so the volume is calculated.",
  controlVolume: "You now set the volume with the piston. The pressure is calculated from the gas model.",
  tempUpV: "The particles are moving faster because their average kinetic energy has increased. At constant volume, this increases the pressure.",
  tempDownV: "The particles are moving more slowly because their average kinetic energy has decreased. At constant volume, this decreases the pressure.",
  tempUpP: "The particles are moving faster because their average kinetic energy has increased. To keep the pressure constant, the gas expands and the volume increases.",
  tempDownP: "The particles are moving more slowly because their average kinetic energy has decreased. To keep the pressure constant, the gas contracts and the volume decreases.",
  volDown: "The particles now have less space to move. They collide with the container walls more frequently, increasing the pressure.",
  volUp: "The particles now have more space to move. They collide with the container walls less frequently, decreasing the pressure.",
  nUpV: "More particles are present in the same space. This increases the number of collisions with the container walls, so the pressure increases.",
  nDownV: "Fewer particles are present in the same space. This decreases the number of collisions with the container walls, so the pressure decreases.",
  nUpP: "More particles are present. To keep the pressure constant, the gas needs more space, so the piston rises and the volume increases.",
  nDownP: "Fewer particles are present. To keep the pressure constant, the gas needs less space, so the piston falls and the volume decreases.",
  pressureUp: "The target pressure is higher, so the piston moves down. The gas is compressed until its pressure matches the target.",
  pressureDown: "The target pressure is lower, so the piston moves up. The gas expands until its pressure matches the target.",
  unreachableLow: "The piston has reached its lower limit. At this amount of gas and temperature the target pressure cannot be reached in the available volume.",
  unreachableHigh: "The piston has reached its upper limit. At this amount of gas and temperature the target pressure cannot be reached in the available volume.",
  noGasSolution: "At this temperature the model has no stable gas state at the target pressure, so the volume is held at the nearest valid value.",
  unreliable: "In these conditions the simple van der Waals model is unreliable, so no comparison with the ideal gas is shown.",
  approachIdeal: "At these conditions, the particles are relatively far apart and intermolecular attractions have less influence. The real gas behaves approximately like an ideal gas.",
  deviationUp: "The effects of particle volume or intermolecular attractions are becoming more significant, so the real gas differs more from the ideal prediction.",
});

const DEVIATION_TREND_EPS = 0.2; // percentage points

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
    if (next.status === "no-gas-solution") return out("noGasSolution");
  }
  if (next.mode === "real") {
    const a = prev.comparison, b = next.comparison;
    if (b.status !== "ok") return out("unreliable");
    if (a.status === "ok") {
      const dd = b.deviationPct - a.deviationPct;
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
// Z(P) at the CURRENT T and CURRENT n, built point by point by solving the
// stable gas-branch volume V(P) (solveVolumeForPressure) and Z = P V / (n R T).
// n is held constant along every curve. (In van der Waals theory with
// per-mole constants Z depends on P and T only, so changing n does not change
// the curve itself, only where the live state sits on it.)
//
// Identity used by the UI and tests: at the same T, V, n,
//     Z = P_real / P_ideal   =>   |Z - 1| x 100  ==  Deviation (%) of the
// comparison panel. The "approximately ideal" tolerance IS the "very close to
// ideal" bound, Z_TOLERANCE_PCT = DEVIATION_BOUNDS.veryClose (2 %).
//
// Plotted pressure range (independent of the 0.2-5.0 atm control range):
// Z_P_MIN..Z_P_MAX = 0.01..100 atm on a LOG axis. 0.01 atm contains the lowest
// pressure reachable with the sliders (n = 0.10 mol, 100 K, 50 L -> 0.016 atm),
// 100 atm shows the excluded-volume upturn; the live marker is therefore always
// inside the plot. The 0.2-5.0 atm control window is shaded.
//
// Validity (never plotted otherwise):
//   * gas branch only: V >= max(V_spinodal, n b / (1 - 0.2)) so dP/dV < 0 and
//     at least 20 % of V is free (VDW_MIN_FREE_FRACTION).
//   * below the critical temperature Tc the vdW isotherm has a loop; the
//     curve stops at the SATURATION (Maxwell equal-area) pressure P_sat(T):
//     beyond it the gas would be supersaturated (metastable) and the
//     simplified model no longer describes a stable gas.
//   The curve is cut at the first pressure where either limit applies and the
//   end point is reported (curve.end) so the UI can say why it stops.
export const Z_P_MIN = 0.01; // atm
export const Z_P_MAX = 100; // atm
export const Z_SAMPLES = 240;
export const Z_TOLERANCE_PCT = DEVIATION_BOUNDS.veryClose; // |Z-1| x 100 below this: "approximately ideal"
export const Z_Y_CAP = 2; // plotted Z never exceeds this (curve clipped, noted)

/** Critical constants and Boyle temperature of the model's a and b. */
export function vdwCriticalConstants() {
  return {
    Tc: (8 * VDW_A) / (27 * R_GAS * VDW_B), // K
    Pc: VDW_A / (27 * VDW_B * VDW_B), // atm
    Vc: 3 * VDW_B, // L/mol
    TBoyle: VDW_A / (R_GAS * VDW_B), // K
  };
}

/** Smallest molar volume x > b where dP/dx = 0 (liquid-side spinodal), or null. */
function vdwLiquidSpinodalMolarVolume(T) {
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
}

/** Saturation (coexistence) pressure of the vdW fluid from the Maxwell
 * equal-area construction, in atm, for T < Tc; null at or above Tc. */
export function vdwSaturationPressure(T) {
  const { Tc } = vdwCriticalConstants();
  if (!(T > 0) || !(T < Tc)) return null;
  const xg = vdwSpinodalVolume(1, T);
  const xl = vdwLiquidSpinodalMolarVolume(T);
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
  if (sLo === 0) return lo;
  if (Math.sign(area(hi)) === sLo) return null;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (Math.sign(area(m)) === sLo) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Highest pressure (atm) at which the real model still describes a stable
 * gas at this n and T, with the reason that limits it. */
export function realGasMaxPressure(n, T) {
  const psat = vdwSaturationPressure(T);
  const vLo = vdwGasBranchMinVolume(n, T);
  const pExcl = vdwPressureRaw(n, T, vLo);
  if (psat != null && psat <= pExcl) return { P: psat, reason: "condensation" };
  return { P: pExcl, reason: psat != null ? "condensation" : "excluded-volume" };
}

export const Z_END_TEXT = Object.freeze({
  condensation: "Near and below condensation the simplified model stops describing a stable gas, so the curve ends here.",
  "excluded-volume": "At this pressure the particles' own volume fills too much of the container, so the simplified model stops here.",
});

/** Compressibility factor Z = P V / (n R T) of a state (n mol, T K, V L).
 * Ideal gas: exactly 1. Real gas: van der Waals pressure at the same T, V, n
 * (NaN when V <= n b). */
export function compressibilityFactor(n, T, V, gas = "real") {
  if (gas !== "real") return 1;
  const p = vdwPressureRaw(n, T, V);
  return (p * V) / (n * R_GAS * T);
}

/** Z at a given pressure for a gas: solves the stable gas-branch volume.
 * Returns { valid, Z, V, P, reason }. Ideal gas: Z = 1, V = nRT/P. */
export function compressibilityAtPressure(n, T, P, gas = "real") {
  if (!(n > 0) || !(T > 0) || !(P > 0)) return { valid: false, Z: NaN, V: NaN, P, reason: "invalid-state" };
  if (gas !== "real") return { valid: true, Z: 1, V: (n * R_GAS * T) / P, P, reason: null };
  const lim = realGasMaxPressure(n, T);
  if (P > lim.P * (1 + 1e-12)) return { valid: false, Z: NaN, V: NaN, P, reason: lim.reason };
  const sol = solveVolumeForPressure(n, T, Math.min(P, lim.P), "real");
  if (sol.vRequired == null) return { valid: false, Z: NaN, V: NaN, P, reason: "excluded-volume" };
  const V = sol.vRequired;
  return { valid: true, Z: (P * V) / (n * R_GAS * T), V, P, reason: null };
}

/** The real-gas Z(P) curve at constant n and T, plus the ideal reference.
 * { n, T, gas, pMin, pMax, ideal: [{P, Z:1} x2], points: [{P, Z, V}],
 *   ghost, end: null | {P, reason, text}, zMin, zMax, tc, ... }
 * `points` is ALWAYS the real-gas model (for gas = "ideal" the UI draws it as a
 * faint dashed ghost for comparison). */
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
  };
}

/** Explanation of the current Z (pure). Tolerance: |Z-1| x 100 < Z_TOLERANCE_PCT. */
export const Z_EXPLANATIONS = Object.freeze({
  ideal: "The real gas behaves approximately like an ideal gas.",
  below: "Attractive interactions dominate the deviation.",
  above: "Repulsive or excluded-volume effects dominate the deviation.",
});
export function zExplanation(Z) {
  if (!Number.isFinite(Z)) return { id: "unreliable", text: UNRELIABLE_TEXT["invalid-state"], Z: null, deviationPct: null };
  const deviationPct = Math.abs(Z - 1) * 100;
  const id = deviationPct < Z_TOLERANCE_PCT ? "ideal" : Z < 1 ? "below" : "above";
  return { id, text: Z_EXPLANATIONS[id], Z, deviationPct };
}

/** Live-state marker for the graph, from a resolved state. Matches the Live
 * values exactly: P is the displayed pressure; Z = P V / (n R T). */
export function zMarker(state) {
  const { n, T, V } = state;
  const clampP = (P) => Math.min(Z_P_MAX, Math.max(Z_P_MIN, P));
  if (state.mode !== "real") {
    const P = state.pIdeal;
    return { status: "ok", reason: null, P, plotP: clampP(P), Z: 1, outside: P < Z_P_MIN || P > Z_P_MAX, onCurve: true, caution: null, ...zExplanation(1) };
  }
  const c = state.comparison;
  if (c.status !== "ok") {
    return { status: "unreliable", reason: c.reason, P: state.pIdeal, plotP: clampP(state.pIdeal), Z: null, outside: false, onCurve: false, caution: null, ...zExplanation(NaN), text: UNRELIABLE_TEXT[c.reason] || UNRELIABLE_TEXT["invalid-state"] };
  }
  const P = c.pReal;
  const Z = (P * V) / (n * R_GAS * T);
  return {
    status: "ok", reason: null, P, plotP: clampP(P), Z,
    outside: P < Z_P_MIN || P > Z_P_MAX,
    onCurve: c.caution == null, caution: c.caution, ...zExplanation(Z),
  };
}

/** Y-axis range for the Z plot (rescales with the curve so a shallow dip at
 * 300 K stays visible); capped at Z_Y_CAP. */
export function zAxisRange(curve, marker) {
  let lo = 1, hi = 1;
  for (const p of curve.points) { lo = Math.min(lo, p.Z); hi = Math.max(hi, p.Z); }
  if (marker && Number.isFinite(marker.Z)) { lo = Math.min(lo, marker.Z); hi = Math.max(hi, marker.Z); }
  const yMin = Math.max(0, Math.min(0.9, Math.floor((lo - 0.03) * 10) / 10));
  const rawMax = Math.max(1.1, Math.ceil((hi + 0.03) * 10) / 10);
  return { yMin, yMax: Math.min(Z_Y_CAP, rawMax), clipped: rawMax > Z_Y_CAP };
}


// ---------------------------------------------------------------------------
// Particle dynamics (2D, equal masses m = 1, chamber units)
// ---------------------------------------------------------------------------
export const CHAMBER = { width: 170, maxHeight: 190 }; // units; height = maxHeight * V / V_max
export const R_IDEAL = 1.9; // display/collision radius, ideal (no effect on ideal pressure)
export const R_REAL = 2.4; // collision radius in real mode (excluded-volume cue)
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
const EPS_OVER_KT_REF = 0.4;
const EPS = EPS_OVER_KT_REF * SIGMA_REF * SIGMA_REF;
const CUTOFF_FACTOR = 2.5;

export function pistonHeight(V) {
  return (CHAMBER.maxHeight * V) / LIMITS.V.max;
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
    pistonH: pistonHeight(DEFAULT_CONTROLS.V),
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
    sim.pistonH = pistonHeight(DEFAULT_CONTROLS.V);
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
