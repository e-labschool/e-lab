// A heated vessel (distillation flask, evaporating basin) with real boiling points. Pure JS.
// Used by evaporation, crystallisation, simple and fractional distillation so they cannot disagree.
//
//  * Volatile liquids (water, ethanol, the hydrocarbon fractions) are tracked in moles; everything else (solids, solutes, oil,
//    bitumen) is "non-volatile" and stays in the vessel.
//  * Boiling temperature comes from chem.equilibrium() (ethanol-water: tabulated, with its azeotrope; others: ideal) plus the
//    boiling-point elevation of dissolved ionic solutes (i Kb m).
//  * Heat balance: heating power x efficiency - loss to the room. Below the boiling point the contents warm up; at the boiling
//    point the surplus power evaporates liquid (rate = power / molar enthalpy of vaporisation).
//  * The vapour passes through `plates` theoretical plates (1 = no column) before it leaves: column() in chem.js.
//  * Times are LAB seconds (the UI plays them faster than real time).  Powers are model values chosen for pacing, not measured.
import { SUBSTANCES, boilingElevation, column, crystalsAt, equilibrium, isVolatileLiquid, solubilityAt } from "./chem.js";
import { gramsOf } from "./mixtures.js";

export const P_MAX = 400; // W at 100 % flame
export const ETA = 0.55; // fraction of the flame's power that reaches the contents
export const H_LOSS = 0.35; // W per K lost to the room
export const T_ROOM = 20;
export const REACT_T = 180; // degC at which dry iron + sulfur start to react

const MM = (id) => SUBSTANCES[id].molarMass;

export function createPot(sample, o = {}) {
  const vesselCp = o.vesselCp ?? 80; // J/K (glass flask / ceramic basin)
  const heatScale = o.heatScale ?? 1;
  const basePlates = o.plates ?? 1;
  const ids = [...new Set(sample.parts.filter((p) => p.form === "liquid" && isVolatileLiquid(p.sub)).map((p) => p.sub))];
  const n = ids.map((id) => gramsOf({ parts: sample.parts.filter((p) => p.form === "liquid") }, id) / MM(id));
  const nStart = n.reduce((a, b) => a + b, 0);
  const nv = {}; // sub -> g that never boils off (solids, solutes, oil...)
  for (const p of sample.parts) if (!(p.form === "liquid" && isVolatileLiquid(p.sub))) nv[p.sub] = (nv[p.sub] ?? 0) + p.g;
  const solid0 = {}; for (const p of sample.parts) if (p.form === "solid") solid0[p.sub] = (solid0[p.sub] ?? 0) + p.g;
  const pot = {
    ids, n, nv, T: T_ROOM, t: 0, boiling: false, nStart, plates: basePlates, heat: 0,
    head: { T: T_ROOM, y: ids.map(() => 0), stageT: [] }, sublimed: {}, reacted: 0, dry: nStart <= 1e-9,
    boilStartT: null, flameOutAt: null,
  };
  const waterG = () => { const i = ids.indexOf("water"); return i < 0 ? 0 : n[i] * MM("water"); };

  /** Solute bookkeeping at temperature T: crystals and dissolved grams per soluble substance. */
  function solutes(T) {
    const w = waterG(); const out = [];
    for (const sub of Object.keys(nv)) {
      if (!SUBSTANCES[sub]?.solubility) continue;
      const cr = w > 1e-6 ? crystalsAt(sub, nv[sub], w, T) : nv[sub];
      out.push({ sub, g: nv[sub], crystals: cr, dissolved: nv[sub] - cr });
    }
    return out;
  }
  function heatCapacity() {
    let c = vesselCp;
    for (let i = 0; i < ids.length; i++) c += n[i] * MM(ids[i]) * SUBSTANCES[ids[i]].cp;
    for (const [sub, g] of Object.entries(nv)) c += g * (SUBSTANCES[sub].cp ?? 1);
    return c;
  }
  function boilingPoint() {
    if (!ids.length || nStart <= 0) return Infinity;
    const live = ids.map((id, i) => ({ id, n: n[i] })).filter((o2) => o2.n > 1e-9);
    if (!live.length) return Infinity;
    const eq = equilibrium(live.map((o2) => o2.id), live.map((o2) => o2.n));
    const sol = solutes(eq.T).map((s) => ({ sub: s.sub, g: s.dissolved }));
    return eq.T + (ids.includes("water") ? boilingElevation(sol, waterG()) : 0);
  }
  pot.boilingPoint = boilingPoint;
  pot.solutes = solutes;
  pot.liquidMoles = () => n.reduce((a, b) => a + b, 0);
  pot.liquidFraction = () => (nStart > 0 ? pot.liquidMoles() / nStart : 0);
  pot.waterG = waterG;
  pot.liquidG = (id) => { const i = ids.indexOf(id); return i < 0 ? 0 : n[i] * MM(id); };
  pot.composition = () => { const s = pot.liquidMoles(); return ids.map((id, i) => (s > 0 ? n[i] / s : 0)); };

  /** Advance dt lab seconds with the flame at `heat` (0..1). Returns what left the vessel: { vapour: {id: mol}, sublimed: {id: g} }. */
  pot.step = (dt, heat) => {
    heat = Number.isFinite(heat) ? Math.min(1, Math.max(0, heat)) : 0;
    if (!(dt > 0) || !Number.isFinite(dt)) dt = 0;
    pot.heat = heat;
    pot.t += dt;
    const P = Math.max(0, Math.min(1, heat)) * P_MAX * heatScale;
    const q = ETA * P - H_LOSS * (pot.T - T_ROOM);
    const vapour = {}; const subl = {};
    const tot = pot.liquidMoles();
    if (tot > 1e-9) {
      const Tb = boilingPoint();
      if ((pot.boiling || pot.T >= Tb - 0.03) && q > 0.05) {
        pot.T = Tb; pot.boiling = true; if (pot.boilStartT == null) pot.boilStartT = pot.t;
        const x = n.map((v) => v / tot);
        const flood = heat > 0.8 ? 1 - 2 * (heat - 0.8) : 1; // too fierce a flame floods the column and loses plates
        const platesEff = basePlates <= 1 ? 1 : Math.max(1.5, basePlates * flood);
        pot.platesEff = platesEff;
        const live = ids.map((id, i) => ({ id, i })).filter((o2) => n[o2.i] > 1e-9);
        const lx = live.map((o2) => x[o2.i]);
        const top = column(live.map((o2) => o2.id), lx, platesEff);
        const dH = live.reduce((a, o2, k) => a + top.y[k] * SUBSTANCES[o2.id].dHvap, 0);
        const rate = q / dH; // mol per second leaving as vapour
        const dn = Math.min(rate * dt, tot);
        live.forEach((o2, k) => { const take = Math.min(n[o2.i], top.y[k] * dn); n[o2.i] -= take; vapour[o2.id] = (vapour[o2.id] ?? 0) + take; });
        pot.head = { T: top.T, y: top.y, ids: live.map((o2) => o2.id), stageT: top.stageT, stages: top.stages };
        pot.rate = rate; pot.vapourRate = dn / dt;
      } else {
        pot.boiling = false; pot.rate = 0;
        pot.T = Math.min(Tb, pot.T + (q / heatCapacity()) * dt);
        pot.head = { T: pot.T, y: [], ids: [], stageT: [] };
      }
    } else {
      pot.boiling = false; pot.dry = true;
      pot.T += (q / heatCapacity()) * dt;
    }
    // sublimation of iodine-like solids (anything with `sublimes`): gentle warming is enough, rate rises with T
    for (const sub of Object.keys(nv)) {
      if (!SUBSTANCES[sub]?.sublimes) continue;
      if (pot.T > 45 && nv[sub] > 1e-9) {
        const rateG = Math.min(nv[sub], 0.02 * Math.min(1.5, (pot.T - 45) / 55) * (solid0[sub] ?? 1) * dt);
        nv[sub] -= rateG; subl[sub] = (subl[sub] ?? 0) + rateG; pot.sublimed[sub] = (pot.sublimed[sub] ?? 0) + rateG;
      }
    }
    // dry iron + sulfur react once hot enough: Fe + S -> FeS (a compound: the mixture is gone)
    if (nv.iron > 1e-9 && nv.sulfur > 1e-9 && pot.T >= REACT_T && !pot.liquidMoles()) {
      const dFe = Math.min(nv.iron, nv.sulfur * (55.85 / 32.06), 0.2 * (solid0.iron ?? 1) * dt);
      const dS = dFe * (32.06 / 55.85);
      nv.iron -= dFe; nv.sulfur -= dS; nv.ironSulfide = (nv.ironSulfide ?? 0) + dFe + dS; pot.reacted += dFe + dS;
    }
    return { vapour, sublimed: subl };
  };

  /** The contents as a sample: remaining liquids, dissolved solutes / crystals, solids. */
  pot.contents = (label = "Left in the vessel") => {
    const parts = [];
    ids.forEach((id, i) => { if (n[i] > 1e-9) parts.push({ sub: id, form: "liquid", g: n[i] * MM(id) }); });
    const sol = Object.fromEntries(solutes(pot.T).map((s) => [s.sub, s]));
    const anyLiquid = pot.liquidMoles() > 1e-9;
    for (const [sub, g] of Object.entries(nv)) {
      if (g <= 1e-9) continue;
      const s = SUBSTANCES[sub];
      if (sol[sub]) { if (sol[sub].crystals > 1e-9) parts.push({ sub, form: "solid", g: sol[sub].crystals }); if (sol[sub].dissolved > 1e-9) parts.push({ sub, form: "dissolved", g: sol[sub].dissolved }); }
      else if (s.kind === "liquid") parts.push({ sub, form: "liquid", g });
      else if (s.dye) parts.push({ sub, form: anyLiquid ? "dissolved" : "solid", g });
      else parts.push({ sub, form: "solid", g });
    }
    return { label, parts };
  };
  return pot;
}

/** Saturation helper for UI: grams of water at which `sub` (g) just saturates at T. */
export const saturationWater = (sub, g, T) => (g * 100) / solubilityAt(sub, T);
