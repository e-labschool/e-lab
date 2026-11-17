// Titration of a POLYPROTIC acid (H2CO3: 2 protons, H3PO4: 3) with a strong base. Pure, no React.
// Exposes the same surface the titration UI reads from makeTitration() (stateAt, phAt, curve, veq, eq, initial, steep, axisMax,
// stageText, regionAt, ...) plus `markers` (every half-equivalence and equivalence point) so the chart can draw them all.
// veq is the FIRST equivalence volume; the n-th is n * veq (one mole of NaOH per mole of H+ removed).
import { REAGENTS } from "./constants.js";
import { solveSolution, polyproticFractions } from "./solver.js";
import { niceAxisMax, DEFAULT_FLASK_VOLUME_CM3, STEEP_HALF_WIDTH } from "./titration.js";

/** pKa values at 298 K from the Saylor/General-Chemistry appendix (Ka = 4.5e-7, 4.7e-11; 6.9e-3, 6.2e-8, 4.8e-13). Other sources differ by up to 0.03 (CRC H3PO4: 2.15, 7.20, 12.35). */
export const POLYPROTIC = Object.freeze({
  H2CO3: { id: "H2CO3", label: "H₂CO₃", name: "Carbonic acid", kind: "acid", strong: false, protons: 2, pKas: [6.35, 10.33], species: ["H₂CO₃", "HCO₃⁻", "CO₃²⁻"] },
  H3PO4: { id: "H3PO4", label: "H₃PO₄", name: "Phosphoric acid", kind: "acid", strong: false, protons: 3, pKas: [2.16, 7.21, 12.32], species: ["H₃PO₄", "H₂PO₄⁻", "HPO₄²⁻", "PO₄³⁻"] },
});
export const isPolyprotic = (id) => Object.prototype.hasOwnProperty.call(POLYPROTIC, id);
const ORD = ["first", "second", "third"];

export function makePolyTitration({ acidId, cFlask = 0.1, cBurette = 0.1, vFlask = DEFAULT_FLASK_VOLUME_CM3 }) {
  const acid = POLYPROTIC[acidId]; if (!acid) throw new Error("Unknown polyprotic acid");
  const n = acid.protons; const base = REAGENTS.NaOH;
  const nFlask = (cFlask * vFlask) / 1000;
  const veq = Math.round(((vFlask * cFlask) / cBurette) * 1e9) / 1e9;

  function stateAt(v) {
    const vt = vFlask + v; const V = vt / 1000; const nOH = (cBurette * v) / 1000;
    const r = solveSolution({ strongCations: nOH / V, polyAcids: [{ c: nFlask / V, pKas: acid.pKas }] });
    const ratio = v / veq; // moles OH- per mole acid
    const stage = ratio >= n - 1e-9 ? (Math.abs(ratio - n) < 1e-9 ? "equivalence" : "after") : "before";
    return { v, pH: r.pH, H: r.H, OH: r.OH, pOH: r.pOH, excess: ratio > n + 1e-9 ? "base" : "acid", stage, ratio: null, protonsRemoved: ratio, totalVolumeCm3: vt, fractions: polyproticFractions(r.H, acid.pKas).alpha };
  }
  const phAt = (v) => stateAt(v).pH;
  const axisMax = niceAxisMax(veq * (n + 0.5) / 1.9 * 1.0);

  function curve(vMax, { maxStep = 0.04, uniform = 60, minDv = 1e-4 } = {}) {
    const out = []; let prev = { v: 0, pH: phAt(0) }; out.push(prev);
    const rec = (v0, p0, v1, p1, d) => { if (Math.abs(p1 - p0) > maxStep && v1 - v0 > minDv && d < 18) { const vm = (v0 + v1) / 2; const pm = phAt(vm); rec(v0, p0, vm, pm, d + 1); out.push({ v: vm, pH: pm }); rec(vm, pm, v1, p1, d + 1); } };
    for (let i = 1; i <= uniform; i += 1) { const v = (vMax * i) / uniform; const p = phAt(v); rec(prev.v, prev.pH, v, p, 0); out.push({ v, pH: p }); prev = { v, pH: p }; }
    return out;
  }

  const markers = [];
  for (let i = 1; i <= n; i += 1) {
    const vh = veq * (i - 0.5); const ve = veq * i;
    markers.push({ kind: "half", index: i, v: vh, pH: phAt(vh), pKa: acid.pKas[i - 1], text: i === 3 ? `pKa3 = ${acid.pKas[2].toFixed(2)} (not reached)` : `pH ≈ pKa${i} = ${acid.pKas[i - 1].toFixed(2)}` });
    markers.push({ kind: "eq", index: i, v: ve, pH: phAt(ve), text: `${ORD[i - 1]} equivalence` });
  }
  const eq = stateAt(veq); const initial = stateAt(0);
  const steep = { vLow: veq * (1 - STEEP_HALF_WIDTH), vHigh: veq * (1 + STEEP_HALF_WIDTH) };
  steep.pHLow = phAt(steep.vLow); steep.pHHigh = phAt(steep.vHigh); steep.jump = Math.abs(steep.pHHigh - steep.pHLow);

  function stageText(s) {
    const r = s.v / veq;
    for (let i = 1; i <= n; i += 1) if (Math.abs(r - i) < 1e-6) return { key: "equivalence", text: `${ORD[i - 1][0].toUpperCase()}${ORD[i - 1].slice(1)} equivalence point reached` };
    if (r > n) return { key: "base", text: "Base in excess (all protons removed)" };
    const seg = Math.min(n, Math.floor(r) + 1);
    return { key: "acid", text: `Removing the ${ORD[seg - 1]} proton: ${acid.species[seg - 1]} → ${acid.species[seg]}` };
  }
  // Buffer regions: for each reachable pKa, the part of that proton's step where pH is within pKa +/- 1 (found on the exact curve, clipped to the step).
  // For a weak step this is where [conjugate base]/[acid] is between 1:10 and 10:1. For H3PO4's first step (pKa1 2.16, a fairly strong acid) the
  // simple 1/11..10/11 stoichiometric rule is about 0.6 pH unit off at the low edge, so the exact curve is used. pKa >= 12 is lost in the OH- of the water.
  const findPH = (target, v0, v1) => { let lo = v0, hi = v1; const rising = phAt(hi) > phAt(lo); for (let it = 0; it < 60; it += 1) { const mid = (lo + hi) / 2; if ((phAt(mid) < target) === rising) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const buffers = acid.pKas.map((pKa, k) => {
    const a = k * veq; const b = (k + 1) * veq * (1 - 1e-9);
    const vLow = phAt(a) >= pKa - 1 ? a : findPH(pKa - 1, a, b); const vHigh = phAt(b) <= pKa + 1 ? b : findPH(pKa + 1, a, b);
    return { index: k + 1, pKa, vLow, vHigh };
  }).filter((b) => b.pKa < 12);
  const regionAt = (v) => (v <= 0 ? "initial" : "titration");

  return { kind: "POLY", poly: acid, flask: acid, burette: base, acid, base, flaskIsAcid: true, cFlask, cBurette, vFlask, nFlask, veq, initial, eq, buffer: null, halfEq: null, steep, axisMax, stateAt, phAt, curve, stageText, regionAt, markers, buffers, weakInFlaskStrongTitrant: false };
}
