// Titration model for monoprotic acids/bases (pure, no React). Built on the exact charge-balance solver.
// One object describes a whole titration; everything the UIs draw (curve, equivalence, buffer region,
// half-equivalence, steep region, axis range) comes from here so no drawing code re-derives chemistry.
import { REAGENTS } from "./constants.js";
import { solveSolution } from "./solver.js";

export const DEFAULT_FLASK_VOLUME_CM3 = 25.0;
const AXIS_STEPS = [10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];
/** Buffer region = pKa +/- 1 = [A-]/[HA] (or [B]/[BH+]) between 1:10 and 10:1 = 1/11 .. 10/11 of the equivalence volume. */
export const BUFFER_FRACTION_LOW = 1 / 11;
export const BUFFER_FRACTION_HIGH = 10 / 11;
/** The "steep region" is defined as the volume window V_eq +/- 1 %. */
export const STEEP_HALF_WIDTH = 0.01;

export const pairKind = (flask, burette) => {
  const a = flask.kind === "acid" ? flask : burette;
  const b = flask.kind === "acid" ? burette : flask;
  return `${a.strong ? "S" : "W"}A-${b.strong ? "S" : "W"}B`; // "SA-SB", "WA-SB", "SA-WB", "WA-WB"
};

export function niceAxisMax(veq) {
  const target = 1.9 * veq;
  return AXIS_STEPS.find((s) => s >= target) ?? Math.ceil(target / 50) * 50;
}

export function makeTitration({ flaskId, buretteId, cFlask = 0.1, cBurette = 0.1, vFlask = DEFAULT_FLASK_VOLUME_CM3 }) {
  const flask = REAGENTS[flaskId];
  const burette = REAGENTS[buretteId];
  if (!flask || !burette || flask.kind === burette.kind) throw new Error("A titration needs one acid and one base");
  const flaskIsAcid = flask.kind === "acid";
  const acid = flaskIsAcid ? flask : burette;
  const base = flaskIsAcid ? burette : flask;
  const nFlask = (cFlask * vFlask) / 1000;
  const veq = Math.round(((vFlask * cFlask) / cBurette) * 1e9) / 1e9; // cm3; rounded to remove binary noise (25.000000000000004)
  const kind = pairKind(flask, burette);
  const weakInFlaskStrongTitrant = !flask.strong && burette.strong;

  function stateAt(v) {
    const vt = vFlask + v;
    const nTit = (cBurette * v) / 1000;
    const nAcid = flaskIsAcid ? nFlask : nTit;
    const nBase = flaskIsAcid ? nTit : nFlask;
    const V = vt / 1000;
    const sol = { strongCations: 0, strongAnions: 0, weakAcids: [], weakBases: [] };
    if (acid.strong) sol.strongAnions += nAcid / V; else sol.weakAcids.push({ c: nAcid / V, pKa: acid.pKa });
    if (base.strong) sol.strongCations += nBase / V; else sol.weakBases.push({ c: nBase / V, pKa: base.pKa });
    const r = solveSolution(sol);
    const diff = nAcid - nBase;
    const tol = 1e-9 * Math.max(nFlask, 1e-12);
    const excess = Math.abs(diff) <= tol ? "none" : diff > 0 ? "acid" : "base";
    const stage = excess === "none" ? "equivalence" : (v < veq ? "before" : "after");
    // conjugate-pair ratio in the buffer picture: [salt form]/[weak form] = n(titrant)/(n(flask) - n(titrant)) before equivalence
    let ratio = null;
    if (weakInFlaskStrongTitrant && v > 0 && v < veq) ratio = nTit / (nFlask - nTit);
    return { v, pH: r.pH, H: r.H, OH: r.OH, pOH: r.pOH, nAcid, nBase, excess, stage, ratio, totalVolumeCm3: vt };
  }

  const phAt = (v) => stateAt(v).pH;

  /** Dense sampling of the exact curve: uniform start, then bisect any interval whose pH step is too big. */
  function curve(vMax, { maxStep = 0.04, uniform = 48, minDv = 1e-4 } = {}) {
    const out = [];
    const rec = (v0, p0, v1, p1, depth) => {
      if (Math.abs(p1 - p0) > maxStep && v1 - v0 > minDv && depth < 18) {
        const vm = (v0 + v1) / 2; const pm = phAt(vm);
        rec(v0, p0, vm, pm, depth + 1); out.push({ v: vm, pH: pm }); rec(vm, pm, v1, p1, depth + 1);
      }
    };
    let prev = { v: 0, pH: phAt(0) };
    out.push(prev);
    for (let i = 1; i <= uniform; i += 1) {
      const v = (vMax * i) / uniform; const p = phAt(v);
      rec(prev.v, prev.pH, v, p, 0);
      out.push({ v, pH: p }); prev = { v, pH: p };
    }
    return out;
  }

  const eq = stateAt(veq);
  const initial = stateAt(0);

  let buffer = null;
  let halfEq = null;
  if (weakInFlaskStrongTitrant) {
    const pKa = flask.pKa;
    const vLow = veq * BUFFER_FRACTION_LOW;
    const vHigh = veq * BUFFER_FRACTION_HIGH;
    buffer = {
      vLow, vHigh, pKa,
      pHLow: stateAt(vLow).pH, pHHigh: stateAt(vHigh).pH, // exact pH at the region edges (about pKa -1 and pKa +1)
      species: flaskIsAcid ? { weak: flask.label, salt: `${flask.label.replace("COOH", "COO")}⁻`, ratioText: `[A⁻]/[HA] between 1:10 and 10:1` } : { weak: flask.label, salt: "NH₄⁺", ratioText: `[BH⁺]/[B] between 1:10 and 10:1` },
    };
    halfEq = { v: veq / 2, pH: stateAt(veq / 2).pH, pKa };
  }

  const steepLow = veq * (1 - STEEP_HALF_WIDTH);
  const steepHigh = veq * (1 + STEEP_HALF_WIDTH);
  const steep = { vLow: steepLow, vHigh: steepHigh, pHLow: phAt(steepLow), pHHigh: phAt(steepHigh) };
  steep.jump = Math.abs(steep.pHHigh - steep.pHLow);

  const axisMax = niceAxisMax(veq);

  function stageText(s) {
    if (s.stage === "equivalence") return { key: "equivalence", text: "Equivalence point reached" };
    const near = Math.abs(s.v - veq) <= Math.max(1, 0.04 * veq);
    if (s.stage === "before") return near ? { key: "approaching", text: "Approaching equivalence" } : { key: s.excess, text: s.excess === "acid" ? "Acid still in excess" : "Base still in excess" };
    return near ? { key: "past", text: `Just past equivalence: ${s.excess === "acid" ? "acid" : "base"} in excess` } : { key: s.excess, text: s.excess === "acid" ? "Acid in excess" : "Base in excess" };
  }

  /** Which named region of the curve a volume lies in (for the live status line). */
  function regionAt(v) {
    if (v <= 0) return "initial";
    if (buffer && v >= buffer.vLow && v <= buffer.vHigh) return "buffer";
    if (Math.abs(v - veq) <= veq * STEEP_HALF_WIDTH) return "steep";
    if (buffer && v < buffer.vLow) return "pre-buffer";
    return v < veq ? "pre-equivalence" : "post-equivalence";
  }

  return { flask, burette, acid, base, kind, flaskIsAcid, cFlask, cBurette, vFlask, nFlask, veq, initial, eq, buffer, halfEq, steep, axisMax, stateAt, phAt, curve, stageText, regionAt, weakInFlaskStrongTitrant };
}

/** The curves the Compare overlay draws, all at the same concentrations and flask volume. */
export function comparisonSet({ side, cFlask = 0.1, cBurette = 0.1, vFlask = DEFAULT_FLASK_VOLUME_CM3, includeWeakWeak = false }) {
  const defs = side === "base"
    ? [{ id: "SB-SA", flask: "NaOH", burette: "HCl", name: "Strong base + strong acid" }, { id: "WB-SA", flask: "NH3", burette: "HCl", name: "Weak base + strong acid" }]
    : [{ id: "SA-SB", flask: "HCl", burette: "NaOH", name: "Strong acid + strong base" }, { id: "WA-SB", flask: "CH3COOH", burette: "NaOH", name: "Weak acid + strong base" }];
  if (includeWeakWeak) defs.push(side === "base" ? { id: "WB-WA", flask: "NH3", burette: "CH3COOH", name: "Weak base + weak acid" } : { id: "WA-WB", flask: "CH3COOH", burette: "NH3", name: "Weak acid + weak base" });
  return defs.map((d) => ({ ...d, titration: makeTitration({ flaskId: d.flask, buretteId: d.burette, cFlask, cBurette, vFlask }) }));
}
