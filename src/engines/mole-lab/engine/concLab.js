// STAGE 3 data and helpers: the supported solutes, the glassware limits, the microscopic-viewer scale.  Pure JS, unit-tested
// (scripts/test-mole-lab-stage3-engine.mjs).  Nothing here is a chemistry formula that duplicates solutions.js / dilution.js:
// concentrations and dilutions are ALWAYS computed by those modules; this file only holds data and display mappings.
import { AVOGADRO } from "./constants.js";
import { clean } from "./numeric.js";

/**
 * Supported solutes (spec D Stage 3: "restrict ... to validated, soluble examples with clearly defined dissolution behaviour").
 *  - NaOH (required): ionic solid, dissolves to hydrated Na+ and OH-, strongly exothermic (about -44 kJ/mol), corrosive.
 *  - NaCl: ionic solid, dissolves to hydrated Na+ and Cl-, almost thermoneutral (about +3.9 kJ/mol), harmless at these amounts.
 * Why only these two: both have one well-defined dissolution equation (no hydrolysis, no hydrate, no reaction with water),
 * the engine already holds their ions and molar masses, and each is far more soluble than the amounts the lab allows.
 * `solubilityG100` = conservative g of solute per 100 mL of water (real: NaOH about 110 g at 20 C; NaCl about 36 g at 25 C).
 * `maxConc` = the largest concentration the lab will prepare (well below saturation), so no solid is ever left undissolved.
 * `solidDensity` (g cm-3) is only used for an UPPER BOUND on whether a solution still fits in a flask, never for concentration.
 */
export const SOLUTES = Object.freeze({
  NaOH: Object.freeze({ id: "NaOH", aqKey: "NaOH_aq", name: "Sodium hydroxide", formula: "NaOH", solidDensity: 2.13, solubilityG100: 100, maxConc: 10, hazard: "corrosive", thermal: "exothermic",
    equation: "NaOH(s) → Na⁺(aq) + OH⁻(aq)", ions: Object.freeze([Object.freeze({ id: "Na", label: "Na⁺", charge: 1 }), Object.freeze({ id: "OH", label: "OH⁻", charge: -1 })]),
    note: "Dissolving NaOH is strongly exothermic (about −44 kJ per mole), so the solution warms up; the concentrations here are for the final solution at the specified (room) conditions." }),
  NaCl: Object.freeze({ id: "NaCl", aqKey: "NaCl_aq", name: "Sodium chloride", formula: "NaCl", solidDensity: 2.165, solubilityG100: 35, maxConc: 5, hazard: "none", thermal: "thermoneutral",
    equation: "NaCl(s) → Na⁺(aq) + Cl⁻(aq)", ions: Object.freeze([Object.freeze({ id: "Na", label: "Na⁺", charge: 1 }), Object.freeze({ id: "Cl", label: "Cl⁻", charge: -1 })]),
    note: "Dissolving NaCl changes the temperature very little (slightly endothermic, about +3.9 kJ per mole)." }),
});
export const SOLUTE_IDS = Object.freeze(Object.keys(SOLUTES));
export const getSolute = (id) => { const s = SOLUTES[id]; if (!s) throw new Error(`Unsupported solute "${id}"`); return s; };
export const aqKeyOf = (soluteId) => getSolute(soluteId).aqKey;

/** Glassware limits (mL).  Beaker graduations are approximate; a volumetric flask is exact AT ITS MARK only. */
export const GLASS = Object.freeze({
  beaker: Object.freeze({ capacityMl: 250, graduationErrorPct: 5, label: "250 mL beaker" }),
  cylinder: Object.freeze({ capacityMl: 100, minMl: 5, resolutionMl: 1, label: "100 mL measuring cylinder" }),
  flask: Object.freeze({ minMl: 10, maxMl: 1000, standard: Object.freeze([25, 50, 100, 200, 250, 500]) }),
  stock: Object.freeze({ capacityMl: 250 }),
});
/** The largest solute amount handled per beaker: ONE standard packet (1 mol). */
export const MAX_STATION_MOL = 1;
export const STATIONS = Object.freeze(["A", "B"]);

/** Upper bound (mL) on the volume of the solution made from `waterMl` of water and `massG` of solute: the water plus the solid's own volume.
 *  Real solutions are NOT additive, which is exactly why the lab makes the final volume up in a volumetric flask. */
export const volumeUpperBoundMl = (soluteId, waterMl, massG) => clean(waterMl + massG / getSolute(soluteId).solidDensity);

/** Smallest water volume (mL) that dissolves `massG` of the solute at the conservative solubility. */
export const minWaterMl = (soluteId, massG) => clean((massG / getSolute(soluteId).solubilityG100) * 100);

/** Is c (mol dm-3) a concentration the lab will prepare for this solute?  Returns "" or an explanation. */
export function concentrationLimitError(soluteId, cMolDm3) {
  const s = getSolute(soluteId);
  if (cMolDm3 > s.maxConc + 1e-9) return `${s.formula} is only prepared up to ${s.maxConc} mol dm⁻³ here (it must stay well below saturation). Use less solute or a larger flask.`;
  return "";
}

/** Suggested water (mL) to dissolve the solute in before making up: about 60 % of the flask, but enough to dissolve it and
 *  small enough that the solution still fits.  Returns null when no such volume exists. */
export function suggestedWaterMl(soluteId, massG, flaskMl) {
  const lo = Math.max(5, Math.ceil((minWaterMl(soluteId, massG) * 1.25) / 5) * 5);
  const hi = Math.floor(((flaskMl - massG / getSolute(soluteId).solidDensity) * 0.92) / 5) * 5;
  if (hi < lo || hi < 5) return null;
  const want = Math.round((flaskMl * 0.6) / 5) * 5;
  return Math.min(Math.max(want, lo), hi);
}

// -------------------------------------------------------------------------------------------- the microscopic viewer scale
/** The viewer shows a fixed cube of solution, WINDOW_NM on each side, in EVERY beaker (spec: "the same visualisation scale"). */
export const WINDOW_NM = 2;
export const WINDOW_DM3 = WINDOW_NM ** 3 * 1e-24; // 1 nm3 = 1e-24 dm3
/** Average number of formula units (Na+ and X- pairs) in that window: N = c N_A V_window.  Display mapping only. */
export const formulaUnitsInWindow = (cMolDm3) => (cMolDm3 > 0 && Number.isFinite(cMolDm3) ? cMolDm3 * AVOGADRO * WINDOW_DM3 : 0);
/** How many pairs are drawn: the nearest whole number (a window holds whole ions); never more than MAX_DRAWN_PAIRS. */
export const MAX_DRAWN_PAIRS = 100;
export const drawnPairs = (cMolDm3) => Math.min(MAX_DRAWN_PAIRS, Math.round(formulaUnitsInWindow(cMolDm3)));

/** Deterministic, well-spread points in the cube [-1, 1]^3 (Mitchell best-candidate): the first n points are the same for every n,
 *  so a higher concentration only ADDS ions and never reshuffles the existing ones. */
let pointCache = null;
export function viewerPoints(count) {
  if (!pointCache) {
    let a = 0x9e3779b9 >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pts = []; const total = MAX_DRAWN_PAIRS * 2;
    for (let i = 0; i < total; i += 1) {
      let best = null; let bd = -1;
      for (let k = 0; k < 14; k += 1) {
        const c = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1];
        let d = Infinity; for (const p of pts) { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < d) d = dd; }
        if (d > bd) { bd = d; best = c; }
      }
      pts.push(best);
    }
    pointCache = pts;
  }
  if (!Number.isInteger(count) || count < 0 || count > pointCache.length) throw new Error("viewerPoints: count out of range");
  return pointCache.slice(0, count);
}

/** A volume in mL for display: 100 -> "100", 12.5 -> "12.5", never "100.0 mL" with false precision. */
export function fmtMl(v) {
  if (!Number.isFinite(v)) return "–";
  const r = Math.round(v * 100) / 100; return Number.isInteger(r) ? String(r) : String(r);
}
