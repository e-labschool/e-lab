// STAGE 1 -- EXPLORE THE MOLE: scene factory, reducer and invariants.
// Authoritative data: substanceId + amountQ.  The main packets always hold exactly amountQ (any structure); counting packets
// (Formula Composition / Counting View, spec A4) are generated from the formula, never typed in.
import { decompose } from "./packets.js";
import { adjustTotal, sumQ } from "./packets.js";
import { composition, countingPackets } from "./composition.js";
import { getSubstance, SELECTABLE_IDS } from "./substances.js";
import { toQuanta, ONE_MOLE_Q, parseNumberInput } from "./numeric.js";

export const STAGE1_MAX_MOL = 10;
export const STAGE1_PRESETS = Object.freeze([0.5, 1, 1.5]);

const ok = (code, message, extra = {}) => ({ ok: true, code, message, ...extra });
const no = (code, message) => ({ ok: false, code, message });

function packetsFor(scene0, substanceId, amountQ, role) {
  let scene = scene0; const packets = [];
  for (const q of decompose(amountQ).packetsQ) { const id = `p${scene.nextId}`; scene = { ...scene, nextId: scene.nextId + 1 }; packets.push({ id, substanceId, q, open: false, role }); }
  return { scene, packets };
}

export function createStage1Scene(substanceId = "H2O", amountMol = 1) {
  const amountQ = toQuanta(amountMol);
  const base = { stage: 1, packets: [], vessels: [], nextId: 1, data: { substanceId, amountQ, inspect: false, selectedEntity: null, counted: false, separated: false, error: null, predictions: {} } };
  const { scene, packets } = packetsFor(base, substanceId, amountQ, "main");
  return { ...scene, packets };
}

function rebuildMain(scene, patch) {
  const d = { ...scene.data, ...patch };
  const base = { ...scene, packets: [], data: d };
  const { scene: s2, packets } = packetsFor(base, d.substanceId, d.amountQ, "main");
  return { ...s2, packets, data: { ...d, counted: false, separated: false, selectedEntity: null, error: null } };
}

export function reduceStage1(scene, action) {
  const d = scene.data;
  switch (action.type) {
    case "s1/select": {
      if (!SELECTABLE_IDS.includes(action.substanceId)) return { scene, notice: no("unknown-substance", "That substance is not available in this stage.") };
      if (action.substanceId === d.substanceId) return { scene, notice: ok("same", "Already selected.") };
      return { scene: rebuildMain(scene, { substanceId: action.substanceId, predictions: {} }), notice: ok("selected", `${getSubstance(action.substanceId).name} selected.`) };
    }
    case "s1/setAmount": {
      const raw = action.q != null ? action.q / 1e9 : action.value;
      const r = parseNumberInput(raw, { max: STAGE1_MAX_MOL, label: "Amount" });
      if (!r.ok) return { scene: { ...scene, data: { ...d, error: r.error } }, notice: no("invalid-input", r.error) };
      const amountQ = toQuanta(r.value);
      if (amountQ === d.amountQ) return { scene: { ...scene, data: { ...d, error: null } }, notice: ok("same", "Amount unchanged.") };
      // keep packet ids where possible, and drop the counting view: "change the quantity and repeat the calculation"
      const main = scene.packets.filter((p) => p.role === "main");
      let counter = scene.nextId; const ids = () => `p${counter++}`;
      const adjusted = adjustTotal(main, amountQ, ids, { keepOne: true });
      return { scene: { ...scene, nextId: counter, packets: adjusted.map((p) => ({ substanceId: d.substanceId, open: false, role: "main", ...p })), data: { ...d, amountQ, counted: false, separated: false, selectedEntity: null, error: null } }, notice: ok("amount", "Amount changed; the counting view was reset so you can repeat the calculation.") };
    }
    case "s1/inspect": return { scene: { ...scene, data: { ...d, inspect: Boolean(action.on), selectedEntity: action.on ? d.selectedEntity : null } }, notice: ok("inspect", action.on ? "Inspecting representative particles." : "Left inspect view.") };
    case "s1/selectEntity": {
      if (!d.inspect) return { scene, notice: no("not-inspecting", "Open Inspect first.") };
      return { scene: { ...scene, data: { ...d, selectedEntity: action.index ?? null } }, notice: ok("entity", action.index == null ? "Selection cleared." : "Particle selected.") };
    }
    case "s1/count": {
      if (d.amountQ === 0) return { scene, notice: no("empty", "There is no material to count: choose an amount above 0 mol.") };
      return { scene: { ...scene, data: { ...d, counted: true } }, notice: ok("counted", "Composition counted from the formula (Formula Composition / Counting View).") };
    }
    case "s1/separate": {
      if (d.amountQ === 0) return { scene, notice: no("empty", "There is no material to count: choose an amount above 0 mol.") };
      if (d.separated) return { scene, notice: ok("already", "The counting packets are already shown.") };
      const kept = scene.packets.filter((p) => p.role === "main");
      let s = { ...scene, packets: kept };
      const cp = countingPackets(d.substanceId, d.amountQ);
      if (!cp.length) return { scene: { ...scene, data: { ...d, counted: true } }, notice: no("nothing-to-separate", "A metal is already a count of atoms: there is nothing smaller to separate.") };
      for (const c of cp) { const r = packetsFor(s, c.substanceId, c.q, "counting"); s = { ...r.scene, packets: [...s.packets, ...r.packets] }; }
      return { scene: { ...s, data: { ...d, counted: true, separated: true } }, notice: ok("separated", "Counting packets shown. This is a counting view of the formula, not a chemical reaction.") };
    }
    case "s1/recombine": {
      if (!d.separated) return { scene, notice: ok("nothing", "The counting packets are not shown.") };
      return { scene: { ...scene, packets: scene.packets.filter((p) => p.role === "main"), data: { ...d, separated: false } }, notice: ok("recombined", "Back to the original counting model.") };
    }
    case "guide/answer": return { scene: { ...scene, data: { ...d, predictions: { ...d.predictions, [action.key]: { choice: action.choice, correct: Boolean(action.correct) } } } }, notice: ok("answered", action.correct ? "Correct." : "Not quite.") };
    default: return null;
  }
}

export function invariantsStage1(scene) {
  const out = []; const d = scene.data;
  const main = scene.packets.filter((p) => p.role === "main");
  if (sumQ(main) !== d.amountQ) out.push(`stage1: main packets hold ${sumQ(main)} quanta but amountQ is ${d.amountQ}`);
  if (main.some((p) => p.substanceId !== d.substanceId)) out.push("stage1: main packet of another substance");
  const counting = scene.packets.filter((p) => p.role === "counting");
  if (d.separated) {
    const expect = countingPackets(d.substanceId, d.amountQ);
    for (const e of expect) { const have = counting.filter((p) => p.substanceId === e.substanceId).reduce((a, p) => a + p.q, 0); if (have !== e.q) out.push(`stage1: counting ${e.substanceId} ${have} != ${e.q}`); }
    const atoms = {}; for (const p of counting) atoms[p.substanceId] = true;
    for (const id of Object.keys(atoms)) if (/^atoms:H$|^atoms:O$/.test(id) === false && getSubstance(d.substanceId).kind === "molecular" && !Object.keys(getSubstance(d.substanceId).composition).includes(id.split(":")[1])) out.push(`stage1: unexpected counting entity ${id}`);
    if (counting.some((p) => p.substanceId === "H2" || p.substanceId === "O2")) out.push("stage1: H2/O2 must never appear as counting packets (A4)");
  } else if (counting.length) out.push("stage1: counting packets present while not separated");
  return out;
}
export { composition, ONE_MOLE_Q };
