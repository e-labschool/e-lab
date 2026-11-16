// A plain-object read of the engine for the React side (built ~8 times per second, never inside the physics loop).
import { effectiveEa, stericFactor } from "./collisionEngine.js";
import { RATE_WINDOW } from "./rateMetrics.js";
import { arrheniusFactor } from "./maxwellBoltzmann.js";

export function makeSnapshot(e) {
  const p = e.p; const eaEff = effectiveEa(p);
  const span = e.rateSpan(RATE_WINDOW);
  const rate = e.rateOver(RATE_WINDOW, "succ"); const collRate = e.rateOver(RATE_WINDOW, "coll");
  let nA = 0; let nB = 0; let nC = 0; let nD = 0;
  for (let i = 0; i < e.n; i++) { const s = e.sp[i]; if (s === 0) nA++; else if (s === 1) nB++; else if (s === 2) nC++; else nD++; }
  const tiles = p.system === "solid" ? e.exposedTiles() : null;
  return {
    t: e.t, T: p.T, ea: p.ea, eaEff, params: p, span, rate, collRate,
    successShare: collRate > 0 ? rate / collRate : 0,
    counts: [e.succ, e.failE, e.failO, e.failB], coll: e.coll, succ: e.succ,
    nA, nB, nC, nD, n: e.n, tiles,
    aboveNow: e.n ? e.countAbove(eaEff) / e.n : 0,
    steric: stericFactor(p.site), arrhenius: arrheniusFactor(eaEff, p.T),
    hist: e.history(), marks: e.marks.slice(),
  };
}
