// STAGE 2 -- MASS <-> MOLES: scene factory, reducer and invariants.
// Authoritative quantity: the sum of the packets (integer quanta).  The mass is DERIVED (m = n M); the last typed input is
// remembered so a molar-mass policy change re-applies the SAME input explicitly (never silently).
import { adjustTotal, sumQ } from "./packets.js";
import { molesFromMass, massFromMoles } from "./moles.js";
import { molarMass, SELECTABLE_IDS, getSubstance } from "./substances.js";
import { parseNumberInput, toQuanta, MAX_AMOUNT_MOL, clean } from "./numeric.js";

const ok = (code, message, extra = {}) => ({ ok: true, code, message, ...extra });
const no = (code, message) => ({ ok: false, code, message });

export function createStage2Scene(policy = "booklet", substanceId = "Mg", massG = null) {
  // default: 0.50 mol (amount-based start: with the data-booklet Mg = 24.31 a round mass would not be a round amount)
  const M = molarMass(substanceId, policy); const r = massG == null ? { nQ: 500000000 } : molesFromMass(massG, M);
  let counter = 1; const ids = () => `p${counter++}`;
  const packets = adjustTotal([], r.nQ, ids, { keepOne: true }).map((p) => ({ substanceId, open: false, role: "main", ...p }));
  return { stage: 2, packets, vessels: [], nextId: counter, data: { substanceId, direction: "mass-to-moles", lastInput: massG == null ? { kind: "moles", value: 0.5 } : { kind: "mass", value: massG }, error: null, predictions: {} } };
}

/** Apply an input (mass in g or amount in mol) to the scene's packets; returns the new scene or an error notice. */
function applyInput(scene, kind, value, policy) {
  const d = scene.data; const M = molarMass(d.substanceId, policy);
  let nQ;
  if (kind === "mass") { const r = molesFromMass(value, M); if (!r.ok) return { error: r.error }; nQ = r.nQ; }
  else { if (value < 0) return { error: "Amount cannot be negative." }; if (value > MAX_AMOUNT_MOL) return { error: `That is more than ${MAX_AMOUNT_MOL} mol, the largest amount the lab supports.` }; nQ = toQuanta(value); }
  let counter = scene.nextId; const ids = () => `p${counter++}`;
  const adjusted = adjustTotal(scene.packets, nQ, ids, { keepOne: true }).map((p) => ({ substanceId: d.substanceId, open: false, role: "main", ...p }));
  return { scene: { ...scene, nextId: counter, packets: adjusted, data: { ...d, lastInput: { kind, value }, error: null } } };
}

export function reduceStage2(scene, action, ctx) {
  const d = scene.data; const policy = ctx.policy;
  switch (action.type) {
    case "s2/setMass": {
      const p = parseNumberInput(action.value, { label: "Mass" });
      if (!p.ok) return { scene: { ...scene, data: { ...d, error: p.error } }, notice: no("invalid-input", p.error) };
      const r = applyInput(scene, "mass", p.value, policy);
      if (r.error) return { scene: { ...scene, data: { ...d, error: r.error } }, notice: no("out-of-range", r.error) };
      return { scene: r.scene, notice: ok("mass", "Mass set.") };
    }
    case "s2/setMoles": {
      const p = parseNumberInput(action.value, { label: "Amount", max: MAX_AMOUNT_MOL });
      if (!p.ok) return { scene: { ...scene, data: { ...d, error: p.error } }, notice: no("invalid-input", p.error) };
      const r = applyInput(scene, "moles", p.value, policy);
      if (r.error) return { scene: { ...scene, data: { ...d, error: r.error } }, notice: no("out-of-range", r.error) };
      return { scene: r.scene, notice: ok("moles", "Amount set.") };
    }
    case "s2/addMass": {
      // +/- buttons: relative to the CURRENT mass (derived from the packets), clamped at zero, never negative
      const M = molarMass(d.substanceId, policy); const cur = massFromMoles(sumQ(scene.packets) / 1e9, M).mass;
      if (!Number.isFinite(action.delta)) return { scene, notice: no("invalid-input", "Step must be a number.") };
      const next = Math.max(0, clean(cur + action.delta));
      const r = applyInput(scene, "mass", next, policy);
      if (r.error) return { scene: { ...scene, data: { ...d, error: r.error } }, notice: no("out-of-range", r.error) };
      return { scene: r.scene, notice: ok("mass", next === 0 && cur + action.delta < 0 ? "Mass cannot go below zero." : "Mass changed.") };
    }
    case "s2/select": {
      if (!SELECTABLE_IDS.includes(action.substanceId)) return { scene, notice: no("unknown-substance", "That substance is not available.") };
      if (action.substanceId === d.substanceId) return { scene, notice: ok("same", "Already selected.") };
      // keep the SAME typed input (mass or moles) and apply it to the new substance; packets are rebuilt for it
      const fresh = { ...scene, packets: [], data: { ...d, substanceId: action.substanceId, predictions: {} } };
      const r = applyInput(fresh, d.lastInput.kind, d.lastInput.value, policy);
      if (r.error) return { scene, notice: no("out-of-range", r.error) };
      return { scene: r.scene, notice: ok("selected", `${getSubstance(action.substanceId).name} selected; the same ${d.lastInput.kind === "mass" ? "mass" : "amount"} is now applied to it.`) };
    }
    case "s2/setDirection": {
      if (action.direction !== "mass-to-moles" && action.direction !== "moles-to-mass") return { scene, notice: no("bad-direction", "Unknown direction.") };
      return { scene: { ...scene, data: { ...d, direction: action.direction, error: null } }, notice: ok("direction", action.direction === "mass-to-moles" ? "Mass to moles." : "Moles to mass.") };
    }
    case "s2/policyChanged": { // internal: re-apply the last typed input under the new policy
      const r = applyInput(scene, d.lastInput.kind, d.lastInput.value, policy);
      return r.error ? { scene, notice: no("out-of-range", r.error) } : { scene: r.scene, notice: ok("policy", "Molar-mass values changed; your last input was re-applied.") };
    }
    case "guide/answer": return { scene: { ...scene, data: { ...d, predictions: { ...d.predictions, [action.key]: { choice: action.choice, correct: Boolean(action.correct) } } } }, notice: ok("answered", action.correct ? "Correct." : "Not quite.") };
    default: return null;
  }
}

export function invariantsStage2(scene) {
  const out = []; const d = scene.data;
  if (!scene.packets.length) out.push("stage2: at least one (possibly empty) packet must exist");
  if (scene.packets.some((p) => p.substanceId !== d.substanceId)) out.push("stage2: packet of another substance");
  return out;
}
