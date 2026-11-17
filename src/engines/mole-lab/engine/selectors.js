// Derived, read-only VIEWS of the experiment state.  Each view separates `exact` (numbers the maths uses) from `text`
// (formatted strings for display), so display rounding can never leak back into chemistry (spec E).
import { currentScene } from "./store.js";
import { getSubstance, molarMass } from "./substances.js";
import { fromQuanta, fmtMol, fmtSig, clean, toQuanta } from "./numeric.js";
import { decompose, describeDecomposition, representPackets, sumQ } from "./packets.js";
import { composition, compositionWorking, countingPackets, subscriptExplanation } from "./composition.js";
import { massInfo, massFromMoles, molesFromMass, entityCount, massWorking } from "./moles.js";
import { fmtSci } from "./numeric.js";
import { MASS_POLICIES } from "./elements.js";

export function stage1View(state) {
  const sc = state.scenes[1]; const d = sc.data; const s = getSubstance(d.substanceId);
  const q = d.amountQ; const n = fromQuanta(q);
  const comp = composition(d.substanceId, q);
  const M = molarMass(s, state.policy);
  return {
    exact: { substanceId: d.substanceId, amountQ: q, n, entityCount: entityCount(n), molarMass: M, atoms: comp.atoms, ions: comp.ions, counting: countingPackets(d.substanceId, q), totalAtomsMol: comp.totalAtomsMol },
    text: {
      amount: `${fmtMol(n)} mol`, entities: `${fmtSci(entityCount(n))} ${s.entity.plural}`, entityKind: s.entity.plural, decomposition: describeDecomposition(q),
      composition: compositionWorking(d.substanceId, q).map((l) => l.text), explanation: subscriptExplanation(d.substanceId),
      molarMass: `${fmtSig(M, 4)} g mol⁻¹`, total: `${fmtMol(comp.totalAtomsMol)} mol of atoms in total`,
    },
    flags: { inspect: d.inspect, counted: d.counted, separated: d.separated, selectedEntity: d.selectedEntity, error: d.error },
    substance: s, packets: sc.packets,
  };
}

export function stage2View(state) {
  const sc = state.scenes[2]; const d = sc.data; const s = getSubstance(d.substanceId);
  const q = sumQ(sc.packets); const n = fromQuanta(q);
  const info = massInfo(d.substanceId, state.policy);
  const massG = massFromMoles(n, info.M).mass;
  const working = massWorking({ direction: d.direction, massG, nMol: n, M: info.M, formula: s.formulaDisplay });
  return {
    exact: { substanceId: d.substanceId, totalQ: q, n, massG, molarMass: info.M, entityCount: entityCount(n), lastInput: d.lastInput },
    text: {
      amount: `${fmtMol(n)} mol`, mass: `${fmtSig(massG, 4)} g`, molarMass: info.label, molarMassNote: info.note, entities: `${fmtSci(entityCount(n))} ${s.entity.plural}`,
      decomposition: describeDecomposition(q), working, policy: MASS_POLICIES[state.policy].label,
    },
    flags: { direction: d.direction, error: d.error }, substance: s, packets: sc.packets, grouped: representPackets(q),
  };
}
export { currentScene, decompose, toQuanta, clean };
