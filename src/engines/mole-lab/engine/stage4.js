// STAGE 4 -- GAS VOLUME LABORATORY: scene factory, reducer and invariants.
//   scene.packets  stock packets of the selected gas (role "stock") -- the amount the student has prepared
//   scene.vessels  one vessel "chamber": contents { [gasId]: quanta }  (what is IN the gas chamber)
// Releasing a packet is the generic "packet/pour" into the vessel (atomic, conserving; a closed packet cannot pour).  `s4/collect`
// moves gas back into packets.  The chamber volume is DERIVED (gasLab.js) from the chamber amount, the model and the conditions.
import { adjustTotal, sumQ } from "./packets.js";
import { parseNumberInput, toQuanta, fromQuanta } from "./numeric.js";
import { getSubstance } from "./substances.js";
import { celsiusToKelvin } from "./gas.js";
import { GAS_IDS, GAS_LIMITS, GAS_MAX_Q, RTP_CONVENTION, gasLabState, idealValidity } from "./gasLab.js";

export const STAGE4_DEFAULT_GAS = "O2";
export const STAGE4_PRESETS = Object.freeze([0.5, 1, 2]);
const ok = (code, message, extra = {}) => ({ ok: true, code, message, ...extra });
const no = (code, message) => ({ ok: false, code, message });
export const chamberAmountQ = (scene) => Object.values(scene.vessels.find((v) => v.id === "chamber")?.contents ?? {}).reduce((a, b) => a + b, 0);

export function createStage4Scene(gasId = STAGE4_DEFAULT_GAS, amountMol = 1) {
  const q = toQuanta(amountMol);
  return {
    stage: 4, nextId: 2, packets: [{ id: "p1", substanceId: gasId, q, open: false, role: "stock" }],
    vessels: [{ id: "chamber", kind: "gas-chamber", accepts: [...GAS_IDS], capacityQ: GAS_MAX_Q, contents: {} }],
    data: { gasId, model: "rtp", tempK: RTP_CONVENTION.tK, pressurePa: RTP_CONVENTION.pPa, pinned: [], pinCounter: 0, predictions: {}, error: null },
  };
}

export function reduceStage4(scene, action, ctx = {}) {
  const d = scene.data; const policy = ctx.policy ?? "booklet";
  const chamberQ = chamberAmountQ(scene); const stockQ = sumQ(scene.packets);
  switch (action.type) {
    case "s4/selectGas": {
      if (!GAS_IDS.includes(action.gasId)) return { scene, notice: no("unknown-gas", "That gas is not supported in this stage.") };
      if (action.gasId === d.gasId) return { scene, notice: ok("same", "Already selected.") };
      if (chamberQ > 0) return { scene, notice: no("chamber-in-use", `Collect the ${getSubstance(d.gasId).formulaDisplay} from the chamber first: the lab never mixes two gases without an explicit mixture step.`) };
      if (d.model === "ideal") { const v = idealValidity(action.gasId, d.tempK, d.pressurePa); if (!v.valid) return { scene, notice: no("would-condense", v.message) }; }
      let counter = scene.nextId; const ids = () => `p${counter++}`;
      const packets = adjustTotal([], stockQ, ids, { keepOne: true }).map((p) => ({ open: false, role: "stock", ...p, substanceId: action.gasId }));
      return { scene: { ...scene, nextId: counter, packets, data: { ...d, gasId: action.gasId, predictions: {}, error: null } }, notice: ok("selected", `${getSubstance(action.gasId).name} selected.`) };
    }
    case "s4/setAmount": {
      const p = parseNumberInput(action.value, { max: GAS_LIMITS.nMaxMol, label: "Amount" });
      if (!p.ok) return { scene: { ...scene, data: { ...d, error: p.error } }, notice: no("invalid-input", p.error) };
      const q = toQuanta(p.value);
      let counter = scene.nextId; const ids = () => `p${counter++}`;
      const packets = adjustTotal(scene.packets.filter((x) => x.role === "stock"), q, ids, { keepOne: true }).map((x) => ({ open: false, role: "stock", ...x, substanceId: d.gasId }));
      return { scene: { ...scene, nextId: counter, packets, data: { ...d, error: null } }, notice: ok("amount", `${fromQuanta(q)} mol of ${getSubstance(d.gasId).formulaDisplay} prepared in packets.`) };
    }
    case "s4/setModel": {
      if (action.model !== "rtp" && action.model !== "ideal") return { scene, notice: no("bad-model", "Unknown gas model.") };
      return { scene: { ...scene, data: { ...d, model: action.model, error: null } }, notice: ok("model", action.model === "rtp" ? "RTP convention: Vm ≈ 24.0 dm³ mol⁻¹." : "Advanced: PV = nRT with the T and P you choose.") };
    }
    case "s4/setTemperature": case "s4/setPressure": {
      if (d.model !== "ideal") return { scene: { ...scene, data: { ...d, error: "Switch to Advanced (PV = nRT) to change temperature or pressure." } }, notice: no("not-advanced", "Switch to Advanced (PV = nRT) to change temperature or pressure.") };
      const isT = action.type === "s4/setTemperature";
      const raw = isT ? (action.celsius != null ? action.celsius : action.kelvin) : action.kPa;
      const p = parseNumberInput(raw, { label: isT ? "Temperature" : "Pressure", allowNegative: isT && action.celsius != null, min: isT && action.celsius != null ? -273.15 : -Infinity });
      if (!p.ok) return { scene: { ...scene, data: { ...d, error: p.error } }, notice: no("invalid-input", p.error) };
      let tK = d.tempK; let pPa = d.pressurePa;
      if (isT) tK = action.celsius != null ? celsiusToKelvin(p.value) : p.value; else pPa = p.value * 1000;
      if (tK <= 0) return { scene: { ...scene, data: { ...d, error: "Temperature must be above 0 K (T/K = θ/°C + 273.15)." } }, notice: no("below-zero", "Temperature must be above 0 K (T/K = θ/°C + 273.15).") };
      if (tK < GAS_LIMITS.tMinK || tK > GAS_LIMITS.tMaxK) { const m = `This lab uses ${GAS_LIMITS.tMinK} to ${GAS_LIMITS.tMaxK} K (${GAS_LIMITS.tMinK - 273.15} to ${GAS_LIMITS.tMaxK - 273.15} °C).`; return { scene: { ...scene, data: { ...d, error: m } }, notice: no("t-range", m) }; }
      if (pPa < GAS_LIMITS.pMinKPa * 1000 || pPa > GAS_LIMITS.pMaxKPa * 1000) { const m = `This lab uses ${GAS_LIMITS.pMinKPa} to ${GAS_LIMITS.pMaxKPa} kPa.`; return { scene: { ...scene, data: { ...d, error: m } }, notice: no("p-range", m) }; }
      const v = idealValidity(d.gasId, tK, pPa);
      if (!v.valid) return { scene: { ...scene, data: { ...d, error: v.message } }, notice: no("would-condense", v.message) };
      return { scene: { ...scene, data: { ...d, tempK: tK, pressurePa: pPa, error: null } }, notice: ok(isT ? "temperature" : "pressure", isT ? "Temperature changed." : "Pressure changed.") };
    }
    case "s4/collect": {
      if (chamberQ <= 0) return { scene, notice: no("empty-chamber", "The chamber is empty: release a packet into it first.") };
      if (chamberQ + stockQ > GAS_MAX_Q * 3) return { scene, notice: no("too-much", "Too much gas to hold in packets.") };
      let counter = scene.nextId; const ids = () => `p${counter++}`;
      const packets = adjustTotal(scene.packets.filter((x) => x.role === "stock"), stockQ + chamberQ, ids, { keepOne: true }).map((x) => ({ open: false, role: "stock", ...x, substanceId: d.gasId }));
      const vessels = scene.vessels.map((v) => (v.id === "chamber" ? { ...v, contents: {} } : v));
      return { scene: { ...scene, nextId: counter, packets, vessels }, notice: ok("collected", `${fromQuanta(chamberQ)} mol collected back into packets: nothing was lost.`, { movedQ: chamberQ }) };
    }
    case "s4/pin": {
      if (chamberQ <= 0) return { scene, notice: no("empty-chamber", "Release gas into the chamber before saving a result to compare.") };
      const s = gasLabState({ model: d.model, nQ: chamberQ, gasId: d.gasId, tK: d.tempK, pPa: d.pressurePa, policy });
      const entry = { id: `c${d.pinCounter + 1}`, gasId: d.gasId, model: d.model, nQ: chamberQ, tK: s.tK, pPa: s.pPa, volumeDm3: s.volumeDm3, vm: s.vm };
      return { scene: { ...scene, data: { ...d, pinned: [...d.pinned, entry].slice(-4), pinCounter: d.pinCounter + 1 } }, notice: ok("pinned", "Saved to the comparison table.") };
    }
    case "s4/unpin": return { scene: { ...scene, data: { ...d, pinned: action.id ? d.pinned.filter((x) => x.id !== action.id) : [] } }, notice: ok("unpinned", "Comparison updated.") };
    case "guide/answer": return { scene: { ...scene, data: { ...d, predictions: { ...d.predictions, [action.key]: { choice: action.choice, correct: Boolean(action.correct) } } } }, notice: ok("answered", action.correct ? "Correct." : "Not quite.") };
    default: return null;
  }
}

export function invariantsStage4(scene) {
  const out = []; const d = scene.data;
  if (!scene.packets.length) out.push("stage4: at least one (possibly empty) stock packet must exist");
  if (scene.packets.some((p) => p.substanceId !== d.gasId)) out.push("stage4: stock packet of a gas other than the selected one");
  const ch = scene.vessels.find((v) => v.id === "chamber"); if (!ch) { out.push("stage4: chamber missing"); return out; }
  const ids = Object.entries(ch.contents).filter(([, q]) => q > 0).map(([k]) => k);
  if (ids.length > 1) out.push("stage4: two gases in one chamber");
  if (ids.length === 1 && ids[0] !== d.gasId) out.push("stage4: chamber gas differs from the selected gas");
  if (chamberAmountQ(scene) > GAS_MAX_Q) out.push("stage4: chamber over capacity");
  if (d.model === "ideal") { const v = idealValidity(d.gasId, d.tempK, d.pressurePa); if (!v.valid) out.push("stage4: ideal-gas conditions where the gas would condense"); }
  if (!(d.tempK >= GAS_LIMITS.tMinK && d.tempK <= GAS_LIMITS.tMaxK)) out.push("stage4: temperature out of range");
  return out;
}
