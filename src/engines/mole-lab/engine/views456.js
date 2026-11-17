// Read-only VIEWS for Stages 4-6 (exact numbers kept apart from display text).  Selectors only; no state is changed here.
import { gasLabState, gasLines, chamberScale, GAS_INFO, RTP_CONVENTION, GAS_LIMITS } from "./gasLab.js";
import { chamberAmountQ } from "./stage4.js";
import { fromQuanta, fmtMol, fmtSig, fmtFixed } from "./numeric.js";
import { sumQ } from "./packets.js";
import { getSubstance, molarMass } from "./substances.js";
import { getReaction, reactants, products, equationString, ionicNote } from "./reactions.js";
import { limitingReagent, theoreticalYieldMass, percentYield } from "./limiting.js";
import { massFromMoles, molesFromMass } from "./moles.js";
import { toUnicodeFormula } from "./formula.js";
import { parseNumberInput } from "./numeric.js";

const nm = (id) => toUnicodeFormula(getSubstance(id).formula);
export const stateTag = (s) => (s.state === "aq" ? "(aq)" : `(${s.state})`);

export function stage4View(state) {
  const sc = state.scenes[4]; const d = sc.data; const chamberQ = chamberAmountQ(sc); const stockQ = sumQ(sc.packets);
  const s = gasLabState({ model: d.model, nQ: chamberQ, gasId: d.gasId, tK: d.tempK, pPa: d.pressurePa, policy: state.policy });
  const sub = getSubstance(d.gasId); const rtp = d.model === "rtp"; const dpV = rtp ? 0 : 2;
  const stock = gasLabState({ model: d.model, nQ: stockQ, gasId: d.gasId, tK: d.tempK, pPa: d.pressurePa, policy: state.policy });
  return {
    exact: { ...s, chamberQ, stockQ, scale: chamberScale(Math.max(s.volumeDm3, stock.volumeDm3 * 0)), stockN: fromQuanta(stockQ), stockVolumeDm3: stock.volumeDm3 },
    text: {
      amount: `${fmtMol(s.n)} mol`, stockAmount: `${fmtMol(fromQuanta(stockQ))} mol`, volume: s.n > 0 ? `${fmtFixed(s.volumeDm3, dpV)} dm³` : `0.0 dm³`,
      temperature: rtp ? "≈ 298 K (25 °C)" : `${fmtFixed(s.tK, 2)} K (${fmtFixed(s.tC, 1)} °C)`, pressure: rtp ? "≈ 101 kPa (1 atm)" : `${fmtFixed(s.pKPa, 1)} kPa`,
      vm: `${fmtFixed(s.vm, rtp ? 0 : 2)} dm³ mol⁻¹`, density: `${fmtSig(s.densityGPerDm3, 3)} g dm⁻³`, mass: `${fmtSig(s.massG, 4)} g`, speed: `${fmtSig(s.rmsSpeed, 3)} m s⁻¹`,
      lines: gasLines(s), model: rtp ? "At RTP: Vm = 24 dm³ mol⁻¹ (an approximate convention)" : "Advanced: PV = nRT (SI units, T in kelvin)",
      molarMass: `${fmtSig(s.molarMassGPerMol, 4)} g mol⁻¹`, particleDensity: `${(s.moleculesPerDm3 / 1e22).toFixed(2)} × 10²² molecules per dm³`,
      difference: `${s.differenceDm3 >= 0 ? "+" : ""}${fmtFixed(s.differenceDm3, 2)} dm³ (${s.differencePct >= 0 ? "+" : ""}${fmtFixed(s.differencePct, 1)} %) against the other model`,
      geometry: `${sub.geometry.name}${sub.geometry.angleLabel ? ` · ${sub.geometry.angleLabel}` : ""}`,
    },
    flags: { model: d.model, error: d.error, caution: s.validity.caution, cautionText: s.validity.message, pinned: d.pinned },
    substance: sub, info: GAS_INFO[d.gasId], limits: GAS_LIMITS, rtp: RTP_CONVENTION, packets: sc.packets, density: s.densityGPerDm3,
  };
}

const rowFor = (p) => ({ id: p.id, coeff: p.coeff, availableQ: p.availableQ, n: p.available, ratio: p.ratioMol, consumed: p.consumed, remaining: p.remaining, limiting: p.limiting, excess: p.excess });

/** Stage 5 / 6 view of the CURRENT scene: equation, starting amounts, what is in the zone, the last run (before / change / after). */
export function benchView(state, stage) {
  const sc = state.scenes[stage]; const d = sc.data; const r = getReaction(d.reactionId); const policy = state.policy;
  const zone = sc.vessels.find((v) => v.id === "zone"); const zoneQ = Object.fromEntries(reactants(r).map((s) => [s.id, zone.contents[s.id] ?? 0]));
  const lim = limitingReagent(r, d.initialQ);          // what the STARTING amounts will do (not shown before the student predicts)
  const run = d.lastRun;
  const mass = (id, q) => massFromMoles(fromQuanta(q), molarMass(id, policy)).mass;
  const rows = (lm) => lm.perReactant.map((p) => ({ ...rowFor(p), name: nm(p.id), mass: mass(p.id, p.availableQ), consumedMass: mass(p.id, p.consumedQ), remainingMass: mass(p.id, p.remainingQ) }));
  const firstProduct = products(r)[0];
  const theo = theoreticalYieldMass(lim, firstProduct.id, policy); const act = d.actual === "" ? null : parseNumberInput(d.actual, { label: "Actual yield" });
  const pct = stage === 6 ? percentYield(act?.ok ? act.value : act === null ? null : NaN, theo.ok ? theo.mass : 0) : null;
  return {
    reaction: r, equation: equationString(r), equationPlain: equationString(r, { states: false }), ionic: ionicNote(r), notes: r.notes,
    exact: { initialQ: d.initialQ, zoneQ, lim, extent: lim.extent, run, theoreticalMass: theo.ok ? theo.mass : null, percent: pct?.ok ? pct.percent : null },
    text: {
      rows: rows(lim), zoneTotal: `${fmtMol(fromQuanta(Object.values(zoneQ).reduce((a, b) => a + b, 0)))} mol in the zone`,
      products: lim.products.map((p) => ({ id: p.id, name: nm(p.id), state: stateTag(r.species.find((s) => s.id === p.id)), n: p.produced, mass: mass(p.id, p.producedQ) })),
      theoreticalMass: theo.ok ? `${fmtSig(theo.mass, 4)} g` : "–", productName: `${nm(firstProduct.id)}${stateTag(firstProduct)}`, percent: pct?.ok ? `${fmtSig(pct.percent, 4)} %` : null, percentWarn: pct?.ok ? pct.warning : null, percentError: act && !act.ok ? act.error : pct && !pct.ok && d.actual !== "" ? pct.error : null,
    },
    species: r.species.map((s) => ({ ...s, name: nm(s.id), tag: stateTag(s), formulaDisplay: getSubstance(s.id).formulaDisplay })),
    flags: { error: d.error, hasRun: Boolean(run), inputMode: d.inputMode, tied: lim.tied, noReaction: lim.noReaction, stoichiometric: lim.stoichiometric },
    packets: sc.packets, policy,
  };
}
export const stage5View = (state) => benchView(state, 5);
export const stage6View = (state) => benchView(state, 6);

/** Worked lines for the extent method (spec D Stage 6): n / coefficient for each reactant, the smallest wins. */
export function extentLines(lim, reaction) {
  const out = [];
  for (const p of lim.perReactant) out.push(`${nm(p.id)}: n ÷ ν = ${fmtMol(p.available)} mol ÷ ${p.coeff} = ${fmtMol(p.ratioMol)} mol`);
  if (lim.noReaction) { out.push("Smallest value is 0, so ξ = 0: nothing reacts."); return out; }
  out.push(lim.tied ? `Equal smallest values: ξ = ${fmtMol(lim.extent)} mol and BOTH reactants limit (neither is in excess).` : `Smallest value: ξ = ${fmtMol(lim.extent)} mol, so ${lim.limiting.map(nm).join(" and ")} limits the reaction.`);
  for (const p of lim.perReactant) out.push(`${nm(p.id)}: used ${p.coeff} × ${fmtMol(lim.extent)} = ${fmtMol(p.consumed)} mol, left ${fmtMol(p.available)} − ${fmtMol(p.consumed)} = ${fmtMol(p.remaining)} mol`);
  for (const p of lim.products) out.push(`${nm(p.id)}: formed ${p.coeff} × ${fmtMol(lim.extent)} = ${fmtMol(p.produced)} mol`);
  return out;
}
export { molesFromMass };
