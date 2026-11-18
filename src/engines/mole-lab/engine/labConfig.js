// Presentation configuration for the redesigned Mole Lab (pure): which substances / amounts each stage offers and the single
// concise sentence each stage shows.  Every number comes from the existing engine modules; nothing here is a second source of chemistry.
import { toQuanta, fromQuanta, fmtMol, fmtFixed, fmtSig } from "./numeric.js";
import { getSubstance, molarMass } from "./substances.js";
import { composition } from "./composition.js";
import { packetLayout } from "./packetModel.js";
import { describeDecomposition } from "./packets.js";
import { massFromMoles, molesFromMass } from "./moles.js";
import { prepareSolution, concentration } from "./solutions.js";
import { concentrationLimitError, getSolute } from "./concLab.js";
import { gasLabState, GAS_IDS } from "./gasLab.js";
import { STAGE6_EXAMPLES } from "./reactionBench.js";
import { getReaction, reactants, products, REACTION_LIST, equationString } from "./reactions.js";
import { limitingReagent } from "./limiting.js";
import { toUnicodeFormula } from "./formula.js";

export const STAGE1_IDS = Object.freeze(["H2O", "CO2", "NH3", "CH4", "H2", "O2", "Mg", "Fe", "NaCl", "NaOH"]);
export const STAGE1_AMOUNTS = Object.freeze([0.25, 0.5, 1, 1.5, 2.5, 3]);
export const STAGE2_IDS = Object.freeze(["Mg", "Ca", "Fe", "Al", "Cu", "Zn", "C", "S", "Na", "Ag"]);
export const STAGE2_AMOUNTS = Object.freeze([0.25, 0.5, 1, 1.5, 2, 2.5]);
export const STAGE2_MASSES = Object.freeze([5, 10, 25, 50, 75]);
export const STAGE3_SOLUTES = Object.freeze(["NaOH", "NaCl"]);
export const STAGE3_MASSES = Object.freeze([10, 20, 40]);
export const STAGE3_VOLUMES = Object.freeze([100, 250, 500]);
export const STAGE4_IDS = GAS_IDS;
export const STAGE4_AMOUNTS = Object.freeze([0.5, 1, 2]);
export const STAGE6_AMOUNTS = Object.freeze([0, 0.5, 1, 1.5, 2, 2.5, 3, 4]);
export const DEFAULT_REACTION = "water-synthesis";
export const AVOGADRO_LINE = "1 mol = 6.022 × 10²³ specified entities";
export const ANALOGY_NOTE = "Packets are a counting analogy, not molar-volume containers; the particles drawn are representative.";

const hf = (x, dp) => fmtFixed(x + 1e-9, dp); // half-up display rounding (12.155 -> 12.16)
const f = (id) => toUnicodeFormula(getSubstance(id).formula);
export const nameOf = (id) => getSubstance(id).name;
export const labelOf = (id) => { const s = getSubstance(id); return `${toUnicodeFormula(s.formula)}${s.state ? `(${s.state})` : ""}`; };
export const optionLabel = (id) => `${f(id)} – ${getSubstance(id).name}`;
export const amountText = (n) => `${fmtMol(n)} mol`;

/** "2.50 mol = 2 full packets + 1 half-filled packet" */
export function packetSentence(n) { return `${fmtMol(n)} mol = ${describeDecomposition(toQuanta(n))}`; }

/** Stage 1: the one concise line + the optional details (formula composition). */
export function stage1Info(id, n) {
  const q = toQuanta(n); const c = composition(id, q); const s = getSubstance(id);
  const entity = s.entity.plural;
  let comp;
  if (s.kind === "molecular") comp = c.atoms.map((a) => `${fmtMol(a.mol)} mol ${a.element} atoms`).join(" and ");
  else if (s.kind === "ionic") comp = c.ions.map((i) => `${fmtMol(i.mol)} mol ${i.label}`).join(" and ");
  else comp = `${fmtMol(n)} mol ${s.formula} atoms`;
  const nice = s.kind === "metallic" ? `${fmtMol(n)} mol of ${s.formula}: a metal, so one mole is a mole of ${s.formula} atoms.` : `${fmtMol(n)} mol ${f(id)} contains ${comp}.`;
  const how = s.kind === "ionic" ? `Drawn as a small fragment of the ionic lattice (alternating ${s.ions.map((i) => i.label).join(" and ")} ions), not as molecules.` : s.kind === "metallic" ? "Drawn as atoms packed in a metallic lattice." : `Each drawn group is one ${s.entity.singular} of ${f(id)}.`;
  return { line: packetSentence(n), composition: nice, how, entity };
}

/** Stage 2: mass <-> moles for a solid.  mode "m" (mass from moles) | "n" (moles from mass). */
export function stage2Info(id, { mode = "m", n = 1, massG = 24 } = {}) {
  const M = molarMass(id);
  if (mode === "n") { const r = molesFromMass(massG, M); const nn = r.ok ? r.n : 0; return { M, n: nn, massG, line: `n = m ÷ M = ${fmtSig(massG, 4)} g ÷ ${fmtFixed(M, 2)} g mol⁻¹ = ${fmtMol(nn)} mol`, display: hf(massG, 2) }; }
  const m = massFromMoles(n, M).mass;
  return { M, n, massG: m, line: `m = n × M = ${fmtMol(n)} mol × ${fmtFixed(M, 2)} g mol⁻¹ = ${hf(m, 2)} g`, display: hf(m, 2) };
}
/** Mass buttons that keep the amount within three packets. */
export const stage2MassChoices = (id) => STAGE2_MASSES.filter((m) => m / molarMass(id) <= 3.0001);

/** Stage 3: n, c, packets for a mass of solute made up to a final volume. */
export function stage3Info(soluteId, massG, volumeMl) {
  const M = molarMass(soluteId); const p = prepareSolution({ massG, molarMassGPerMol: M, finalVolumeMl: volumeMl });
  const n = p.ok ? p.n : 0; const c = p.ok ? p.c : 0; const err = concentrationLimitError(soluteId, c);
  return { M, n, c, volumeMl, massG, error: err || "", ok: p.ok && !err, packets: packetLayout(n),
    line: `${fmtSig(massG, 3)} g ${f(soluteId)} = ${fmtMol(n)} mol;  final volume ${volumeMl} mL;  c = n ÷ V = ${fmtMol(n)} mol ÷ ${fmtFixed(volumeMl / 1000, 3)} dm³ = ${fmtFixed(c, 2)} mol dm⁻³` };
}
/** Worked calculation for the Stage 3 side panel (pure strings; every number comes from stage3Info / the engine). */
export function stage3Work(soluteId, massG, volumeMl) {
  const i = stage3Info(soluteId, massG, volumeMl); const V = volumeMl / 1000;
  return { ok: i.ok, n: i.n, c: i.c, M: i.M, V,
    steps: [
      { title: "Amount of solute", eq: "n = m ÷ M", sub: `= ${fmtFixed(massG, 1)} g ÷ ${fmtFixed(i.M, 2)} g mol⁻¹ = ${fmtFixed(i.n, 3)} mol` },
      { title: "Final solution volume", eq: "V (dm³) = V (cm³) ÷ 1000", sub: `${volumeMl} cm³ = ${fmtFixed(V, 3)} dm³` },
      { title: "Concentration", eq: "c = n ÷ V", sub: `= ${fmtFixed(i.n, 3)} mol ÷ ${fmtFixed(V, 3)} dm³` } ],
    final: `${fmtFixed(i.c, 2)} mol dm⁻³` };
}
/** Dilution of the SAME amount n from V1 to V2 (cm3): n is unchanged, c falls in proportion. */
export function stage3Dilution(soluteId, massG, v1, v2) {
  const a = stage3Info(soluteId, massG, v1); const b = stage3Info(soluteId, massG, v2);
  return { n: a.n, c1: a.c, c2: b.c, line1: `n is unchanged = ${fmtFixed(a.n, 3)} mol`, line2: `c₂ = n ÷ V₂ = ${fmtFixed(a.n, 3)} mol ÷ ${fmtFixed(v2 / 1000, 3)} dm³`, check: `c₁V₁ = ${fmtFixed(a.c, 2)} × ${fmtFixed(v1 / 1000, 3)} = ${fmtFixed(b.c, 2)} × ${fmtFixed(v2 / 1000, 3)} = ${fmtFixed(a.c * v1 / 1000, 3)} mol`, final: `${fmtFixed(b.c, 2)} mol dm⁻³` };
}
export const soluteLabel = (id) => `${f(id)} – ${getSolute(id).name}`;
export { concentration };

/** Stage 4: volume of n mol of any gas at RTP (24 dm3 per mol) and the advanced ideal-gas value. */
export function stage4Info(gasId, n, adv) {
  const nQ = toQuanta(n); const rtp = gasLabState({ model: "rtp", nQ, gasId });
  const ideal = adv ? gasLabState({ model: "ideal", nQ, gasId, tK: adv.tK, pPa: adv.pPa }) : null;
  return { volumeDm3: rtp.volumeDm3, rtp, ideal, line: `V = n × Vm = ${fmtMol(n)} mol × 24 dm³ mol⁻¹ = ${fmtFixed(rtp.volumeDm3, 1)} dm³ (at RTP)` };
}
export const compareTrio = (selected) => { const base = ["H2", "O2", "CO2"]; if (base.includes(selected)) return base; return [base[0], selected, base[2]]; };
export const MOLECULES_PER_MOL = 12;

/** Stage 5: the balanced equation as packets (coefficients = moles). */
export function stage5Board(reactionId) {
  const r = getReaction(reactionId);
  return { reaction: r, equation: equationString(r), reactants: reactants(r).map((s) => ({ id: s.id, n: s.coeff, state: s.state })), products: products(r).map((s) => ({ id: s.id, n: s.coeff, state: s.state })),
    ratio: r.species.map((s) => s.coeff).join(" : "),
    sentence: `${reactants(r).map((s) => `${s.coeff} mol ${f(s.id)}`).join(" + ")} → ${products(r).map((s) => `${s.coeff} mol ${f(s.id)}`).join(" + ")}` };
}
/** Stage 6 default amounts: stoichiometric, plus one extra mole of the first reactant (3 mol H2 + 1 mol O2 for water). */
export function stage6Defaults(reactionId) { if (STAGE6_EXAMPLES[reactionId]) return { ...STAGE6_EXAMPLES[reactionId] }; const r = getReaction(reactionId); return Object.fromEntries(reactants(r).map((s, i) => [s.id, i === 0 ? s.coeff + 1 : s.coeff])); }
export function stage6Result(reactionId, amounts) {
  const r = getReaction(reactionId); const q = Object.fromEntries(reactants(r).map((s) => [s.id, toQuanta(amounts[s.id] ?? 0)]));
  const res = limitingReagent(r, q);
  return { reaction: r, res, limiting: res.perReactant.filter((p) => p.limiting).map((p) => p.id), excess: res.perReactant.filter((p) => p.excess).map((p) => p.id),
    products: res.products.map((p) => ({ id: p.id, n: p.produced })), remaining: res.perReactant.filter((p) => p.remainingQ > 0).map((p) => ({ id: p.id, n: p.remaining })), noReaction: res.noReaction };
}
export { REACTION_LIST, fromQuanta, equationString, f as formulaOf };
