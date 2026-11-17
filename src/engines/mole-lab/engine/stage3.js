// STAGE 3 -- CONCENTRATION LABORATORY: scene factory, reducer and invariants (spec D Stage 3).
//
// Matter is held ONLY as integer quanta (1e-9 mol) in two kinds of container, exactly like the other stages:
//   scene.packets   the weighed solute (one standard packet per beaker, role "solute:A" / "solute:B")
//   scene.vessels   beakerX {solute solid, solute_aq}, flaskX {solute_aq}, and for the dilution: stock, aliquot (the cylinder), flaskA
// Volumes (mL) are plain numbers in data.  Every transfer moves whole quanta between containers in ONE step, so an interrupted
// animation or a repeated click can never create or lose material; `invariantsStage3` checks that after every action in the tests.
//
// CONCENTRATION IS ONLY DEFINED AT THE MARK.  c = n / V is computed (solutions.js / dilution.js, never from particle counts) with
// V = the volumetric flask's calibrated volume, and only once the flask has been made up to its mark.  Before that the solution's
// volume is not known to better than the beaker graduations, so the lab refuses to give a concentration (spec: "do NOT assume
// that adding solute to 100 mL of water gives exactly 100 mL of solution").
import { clean, fromQuanta, toQuanta, parseNumberInput, fmtSig, ONE_MOLE_Q } from "./numeric.js";
import { molarMass } from "./substances.js";
import { molesFromMass } from "./moles.js";
import { concentration, amountFromConcentration } from "./solutions.js";
import { dilute } from "./dilution.js";
import { findPacket, findVessel } from "./packetOps.js";
import { SOLUTES, SOLUTE_IDS, GLASS, fmtMl, MAX_STATION_MOL, getSolute, aqKeyOf, concentrationLimitError, minWaterMl, suggestedWaterMl, volumeUpperBoundMl } from "./concLab.js";

const fmtN = (n) => fmtSig(n, 3); // amounts in mol: 3 significant figures (0.250 mol)
const ok = (code, message, extra = {}) => ({ ok: true, code, message, ...extra });
const no = (code, message) => ({ ok: false, code, message });
const refuse = (scene, code, message) => ({ scene, notice: no(code, message) });

export const STAGE3_EXPERIMENTS = Object.freeze([
  Object.freeze({ id: 1, kind: "single", short: "1 · Prepare", title: "Prepare a solution", A: Object.freeze({ massG: 10, flaskMl: 100 }) }),
  Object.freeze({ id: 2, kind: "single", short: "2 · More solute", title: "Increase the amount of solute", A: Object.freeze({ massG: 20, flaskMl: 100 }) }),
  Object.freeze({ id: 3, kind: "compare", short: "3 · Change volume", title: "Change the final volume", lockMass: true, A: Object.freeze({ massG: 10, flaskMl: 100 }), B: Object.freeze({ massG: 10, flaskMl: 200 }) }),
  Object.freeze({ id: 4, kind: "dilution", short: "4 · Dilute", title: "Dilution of a stock solution", stock: Object.freeze({ c: 2, volumeMl: 250 }), aliquotMl: 50, finalMl: 200 }),
  Object.freeze({ id: 5, kind: "compare", short: "5 · Compare", title: "Compare two solutions", lockMass: false, A: Object.freeze({ massG: 10, flaskMl: 100 }), B: Object.freeze({ massG: 20, flaskMl: 100 }) }),
]);
export const experimentDef = (id) => STAGE3_EXPERIMENTS.find((e) => e.id === id) ?? null;

const stationIds = (kind) => (kind === "compare" ? ["A", "B"] : ["A"]);
export const beakerId = (x) => `beaker${x}`;
export const flaskId = (x) => `flask${x}`;
export const packetRole = (x) => `solute:${x}`;

// ------------------------------------------------------------------------------------------------ scene construction
function newStation(scene, x, soluteId, policy, { massG, flaskMl }) {
  const M = molarMass(soluteId, policy);
  const r = massG == null ? { nQ: 0 } : molesFromMass(massG, M);
  const pid = `p${scene.nextId}`;
  const packets = [...scene.packets, { id: pid, substanceId: soluteId, q: r.nQ, open: false, role: packetRole(x) }];
  const aq = aqKeyOf(soluteId);
  const vessels = [...scene.vessels,
    { id: beakerId(x), accepts: [soluteId], capacityQ: null, contents: { [soluteId]: 0, [aq]: 0 } },
    { id: flaskId(x), accepts: [], capacityQ: null, contents: { [aq]: 0 } }];
  const station = { id: x, massG: massG ?? null, flaskMl, weighedQ: r.nQ, packetId: pid, waterMl: 0, cylMl: 0, liquidMl: 0, atMark: false, topUpMl: 0, stirs: 0 };
  return { scene: { ...scene, nextId: scene.nextId + 1, packets, vessels, data: { ...scene.data, stations: { ...scene.data.stations, [x]: station } } } };
}

/** Why this (mass, flask) pair cannot be prepared with this solute ("" when it can). */
export function validateStation(soluteId, policy, massG, flaskMl) {
  const M = molarMass(soluteId, policy); const r = molesFromMass(massG, M); if (!r.ok) return r.error;
  if (r.nQ > MAX_STATION_MOL * ONE_MOLE_Q) return `${fmtSig(massG, 4)} g is ${fmtN(r.n)} mol: more than one packet (1 mol).`;
  return concentrationLimitError(soluteId, r.n / (flaskMl / 1000));
}

/** Build a COMPLETE fresh scene for an experiment (used by create, setExp, setSolute and Reset).  `overrides` = { A:{massG,flaskMl}, B:{...} }.
 *  The two beakers of a comparison start already prepared (so the comparison is visible at once); `prepared` is not touched by that. */
export function buildStage3Scene({ exp = 1, soluteId = "NaOH", policy = "booklet", keep = {}, overrides = {} } = {}) {
  const def = experimentDef(exp); getSolute(soluteId);
  let scene = { stage: 3, packets: [], vessels: [], nextId: 1, data: { exp, kind: def.kind, soluteId, policy, lockMass: Boolean(def.lockMass), stations: {}, dil: null, predictions: keep.predictions ?? {}, applied: keep.applied ?? {}, prepared: keep.prepared ?? null, error: null } };
  if (def.kind === "dilution") {
    const aq = aqKeyOf(soluteId); const n = amountFromConcentration(def.stock.c, def.stock.volumeMl);
    scene = { ...scene, vessels: [{ id: "stock", accepts: [], capacityQ: null, contents: { [aq]: n.nQ } }, { id: "aliquot", accepts: [], capacityQ: null, contents: { [aq]: 0 } }] };
    scene = newStation(scene, "A", soluteId, policy, { massG: null, flaskMl: def.finalMl }).scene;
    return { ...scene, packets: [], data: { ...scene.data, dil: { stockQ0: n.nQ, stockVolMl0: def.stock.volumeMl, stockVolMl: def.stock.volumeMl, aliquotMl: def.aliquotMl, finalMl: def.finalMl, taken: false, aliquotQ: 0, cylMl: 0, source: "preset" } } };
  }
  for (const x of stationIds(def.kind)) scene = newStation(scene, x, soluteId, policy, { ...def[x], ...(overrides[x] ?? {}) }).scene;
  if (def.kind === "compare") for (const x of stationIds(def.kind)) { const r = opPrepare(scene, x); if (r.notice.ok) scene = r.scene; }
  return withData(scene, { prepared: keep.prepared ?? null });
}
export const createStage3Scene = (policy = "booklet") => buildStage3Scene({ exp: 1, soluteId: "NaOH", policy });

// ------------------------------------------------------------------------------------------------ small immutable helpers
const stn = (scene, x) => scene.data.stations[x];
const patchStation = (scene, x, patch) => ({ ...scene, data: { ...scene.data, stations: { ...scene.data.stations, [x]: { ...scene.data.stations[x], ...patch } } } });
const vq = (scene, vid, key) => findVessel(scene, vid)?.contents[key] ?? 0;
const patchVessel = (scene, vid, patch) => ({ ...scene, vessels: scene.vessels.map((v) => (v.id === vid ? { ...v, contents: { ...v.contents, ...patch } } : v)) });
const patchPacket = (scene, id, patch) => ({ ...scene, packets: scene.packets.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
const withData = (scene, patch) => ({ ...scene, data: { ...scene.data, ...patch } });
const molarM = (scene) => molarMass(scene.data.soluteId, scene.data.policy);
const massOf = (scene, q) => clean(fromQuanta(q) * molarM(scene));

/** Has any material left this station's packet (so the sample can no longer be re-weighed)? */
export const isUntouched = (scene, x) => { const s = stn(scene, x); const p = findPacket(scene, s.packetId); const aq = aqKeyOf(scene.data.soluteId); return p.q === s.weighedQ && vq(scene, beakerId(x), scene.data.soluteId) === 0 && vq(scene, beakerId(x), aq) === 0 && vq(scene, flaskId(x), aq) === 0; };

// ------------------------------------------------------------------------------------------------ the individual lab operations
// Each returns { scene, notice }; a refusal returns the SAME scene object.  prepare() chains them on a scratch copy.

function opSetMass(scene, x, rawValue) {
  const d = scene.data; const s = stn(scene, x);
  if (d.kind === "dilution") return refuse(scene, "no-mass", "This experiment starts from a stock solution; there is no solid to weigh.");
  const p = parseNumberInput(rawValue, { label: "Mass", allowZero: false }); if (!p.ok) return refuse(scene, "invalid-input", p.error);
  if (!isUntouched(scene, x)) return refuse(scene, "in-use", "Some of this sample has already left the packet. Press Start over to weigh a new sample.");
  const M = molarM(scene); const r = molesFromMass(p.value, M); if (!r.ok) return refuse(scene, "invalid-input", r.error);
  if (r.nQ > MAX_STATION_MOL * ONE_MOLE_Q) return refuse(scene, "too-much", `${fmtSig(p.value, 4)} g is ${fmtN(r.n)} mol: more than one packet. This lab weighs at most 1 mol (${fmtSig(M, 4)} g of ${getSolute(d.soluteId).formula}) per beaker.`);
  const lim = concentrationLimitError(d.soluteId, r.n / (s.flaskMl / 1000)); if (lim) return refuse(scene, "too-concentrated", lim);
  let out = patchPacket(scene, s.packetId, { q: r.nQ });
  out = patchStation(out, x, { massG: p.value, weighedQ: r.nQ });
  return { scene: out, notice: ok("mass", `${fmtSig(p.value, 3)} g of ${getSolute(d.soluteId).formula} weighed: ${fmtN(r.n)} mol.`) };
}

function opSetFlask(scene, x, rawValue) {
  const d = scene.data; const s = stn(scene, x);
  const p = parseNumberInput(rawValue, { label: "Final volume", allowZero: false }); if (!p.ok) return refuse(scene, "invalid-input", p.error);
  if (p.value < GLASS.flask.minMl) return refuse(scene, "too-small", `A volumetric flask smaller than ${GLASS.flask.minMl} mL is not available.`);
  if (p.value > GLASS.flask.maxMl) return refuse(scene, "too-large", `The largest volumetric flask here is ${GLASS.flask.maxMl} mL.`);
  if (vq(scene, flaskId(x), aqKeyOf(d.soluteId)) > 0 || s.liquidMl > 0) return refuse(scene, "in-use", "The flask already holds solution. Press Start over to choose another flask.");
  if (d.kind !== "dilution") { const lim = concentrationLimitError(d.soluteId, fromQuanta(s.weighedQ) / (p.value / 1000)); if (lim) return refuse(scene, "too-concentrated", lim); }
  return { scene: patchStation(scene, x, { flaskMl: p.value }), notice: ok("flask", `${fmtMl(p.value)} mL volumetric flask selected.`) };
}

function opMeasureWater(scene, x, rawValue) {
  const s = stn(scene, x); const p = parseNumberInput(rawValue, { label: "Water volume", allowZero: false }); if (!p.ok) return refuse(scene, "invalid-input", p.error);
  if (s.cylMl > 0) return refuse(scene, "cylinder-full", "The cylinder already holds water: pour it into the beaker first.");
  if (p.value < GLASS.cylinder.minMl) return refuse(scene, "too-small", `The cylinder cannot measure less than ${GLASS.cylinder.minMl} mL accurately.`);
  if (p.value > GLASS.cylinder.capacityMl) return refuse(scene, "too-large", `The cylinder holds at most ${GLASS.cylinder.capacityMl} mL. Measure in two parts.`);
  return { scene: patchStation(scene, x, { cylMl: p.value }), notice: ok("measured", `${fmtMl(p.value)} mL of water measured in the cylinder.`) };
}
function opPourWater(scene, x) {
  const s = stn(scene, x); if (s.cylMl <= 0) return refuse(scene, "cylinder-empty", "Measure some water in the cylinder first.");
  if (s.waterMl + s.cylMl > GLASS.beaker.capacityMl + 1e-9) return refuse(scene, "overflow", `The beaker holds only ${GLASS.beaker.capacityMl} mL: that much water would overflow it.`);
  return { scene: patchStation(scene, x, { waterMl: clean(s.waterMl + s.cylMl), cylMl: 0 }), notice: ok("water", `${fmtMl(s.cylMl)} mL of water poured into the beaker.`) };
}

/** Pour solid from the (open) packet into the beaker's water: source and destination change in ONE step. */
function opPour(scene, x, q = null) {
  const d = scene.data; const s = stn(scene, x); const src = findPacket(scene, s.packetId);
  if (!src) return refuse(scene, "missing", "The solute packet is not on the bench.");
  if (!src.open) return refuse(scene, "closed", "The packet is closed: open the zipper before pouring.");
  if (src.q <= 0) return refuse(scene, "empty", "That packet is empty.");
  if (q != null && (!Number.isInteger(q) || q <= 0)) return refuse(scene, "bad-amount", "Choose an amount greater than zero.");
  if (s.waterMl <= 0) return refuse(scene, "no-water", "Add water to the beaker first: the solid falls into water.");
  if (s.atMark) return refuse(scene, "done", "This solution is already made up.");
  const move = Math.min(src.q, q ?? src.q); const bid = beakerId(x);
  let out = patchPacket(scene, s.packetId, { q: src.q - move });
  out = patchVessel(out, bid, { [d.soluteId]: vq(scene, bid, d.soluteId) + move });
  return { scene: out, notice: ok("poured", `Poured ${fmtN(fromQuanta(move))} mol of ${getSolute(d.soluteId).formula} into the beaker.`, { movedQ: move }) };
}

/** Stirring dissolves the solid: it leaves the lattice as hydrated ions.  Refused if the water could not hold that much. */
function opStir(scene, x) {
  const d = scene.data; const s = stn(scene, x); const bid = beakerId(x); const aq = aqKeyOf(d.soluteId);
  if (s.waterMl <= 0) return refuse(scene, "no-water", "There is no water in the beaker to dissolve anything in.");
  const solid = vq(scene, bid, d.soluteId); const dissolved = vq(scene, bid, aq);
  if (solid === 0 && dissolved === 0) return refuse(scene, "nothing-to-stir", "There is nothing in the beaker to stir yet: pour the solid in first.");
  if (solid === 0) return { scene: patchStation(scene, x, { stirs: s.stirs + 1 }), notice: ok("mixed", dissolved ? "Stirring mixes the solution so its concentration is the same throughout." : "There is nothing in the beaker to stir yet.") };
  const total = massOf(scene, solid + dissolved); const need = minWaterMl(d.soluteId, total);
  if (s.waterMl + 1e-9 < need) return refuse(scene, "not-enough-water", `${fmtSig(total, 3)} g of ${getSolute(d.soluteId).formula} needs at least ${fmtMl(need)} mL of water to dissolve completely. Add more water.`);
  let out = patchVessel(scene, bid, { [d.soluteId]: 0, [aq]: dissolved + solid });
  out = patchStation(out, x, { stirs: s.stirs + 1 });
  return { scene: out, notice: ok("dissolved", `Stirred: the solid dissolved into hydrated ${getSolute(d.soluteId).ions.map((i) => i.label).join(" and ")} ions (${getSolute(d.soluteId).equation}).`) };
}

/** Transfer the dissolved solution into the volumetric flask (quantitative transfer: every ion goes with it). */
function opTransfer(scene, x) {
  const d = scene.data; const s = stn(scene, x); const bid = beakerId(x); const fid = flaskId(x); const aq = aqKeyOf(d.soluteId);
  const solid = vq(scene, bid, d.soluteId); const dissolved = vq(scene, bid, aq);
  if (solid > 0) return refuse(scene, "undissolved", "Stir until all the solid has dissolved before transferring it: undissolved solid would be left behind.");
  if (dissolved <= 0) return refuse(scene, "nothing", "There is no dissolved solute in the beaker to transfer.");
  if (vq(scene, fid, aq) > 0 || s.liquidMl > 0) return refuse(scene, "flask-used", "The flask already holds solution.");
  const ub = volumeUpperBoundMl(d.soluteId, s.waterMl, massOf(scene, dissolved));
  if (ub > s.flaskMl + 1e-9) return refuse(scene, "overfill", `The solution is about ${fmtMl(ub)} mL, which would go past the mark of the ${fmtMl(s.flaskMl)} mL flask. Start over with less water (the final volume is made up in the flask, not in the beaker).`);
  let out = patchVessel(scene, bid, { [aq]: 0 }); out = patchVessel(out, fid, { [aq]: dissolved });
  out = patchStation(out, x, { liquidMl: s.waterMl, waterMl: 0 });
  return { scene: out, notice: ok("transferred", `Solution transferred to the ${fmtMl(s.flaskMl)} mL flask. It is not yet made up to the mark.`) };
}

function markReached(scene, x, liquid, add) {
  const s = stn(scene, x); const atMark = Math.abs(liquid - s.flaskMl) < 1e-9;
  let out = patchStation(scene, x, { liquidMl: atMark ? s.flaskMl : liquid, atMark, topUpMl: clean(s.topUpMl + add) });
  if (atMark) { const d = scene.data; out = withData(out, { prepared: { soluteId: d.soluteId, nQ: vq(out, flaskId(x), aqKeyOf(d.soluteId)), volumeMl: s.flaskMl } }); }
  return out;
}
/** Add water drop by drop.  Refuses to go past the calibration mark. */
function opTopUp(scene, x, rawValue) {
  const d = scene.data; const s = stn(scene, x); const aq = aqKeyOf(d.soluteId);
  if (vq(scene, flaskId(x), aq) <= 0) return refuse(scene, "empty-flask", "Transfer the solution into the flask first.");
  if (s.atMark) return refuse(scene, "at-mark", "The solution is already at the calibration mark.");
  const p = parseNumberInput(rawValue, { label: "Volume to add", allowZero: false }); if (!p.ok) return refuse(scene, "invalid-input", p.error);
  if (s.liquidMl + p.value > s.flaskMl + 1e-9) return refuse(scene, "past-mark", `That would go ${fmtMl(s.liquidMl + p.value - s.flaskMl)} mL past the calibration mark. A flask filled past its mark no longer holds the calibrated volume and cannot be corrected: add less (${fmtMl(s.flaskMl - s.liquidMl)} mL reaches the mark).`);
  return { scene: markReached(scene, x, clean(s.liquidMl + p.value), p.value), notice: ok("topped-up", `${fmtMl(p.value)} mL of water added.`) };
}
function opFillToMark(scene, x) {
  const d = scene.data; const s = stn(scene, x); const aq = aqKeyOf(d.soluteId);
  if (vq(scene, flaskId(x), aq) <= 0) return refuse(scene, "empty-flask", "Transfer the solution into the flask first, then make it up to the mark.");
  if (s.atMark) return { scene, notice: ok("at-mark", "The solution is already at the calibration mark.") };
  const add = clean(s.flaskMl - s.liquidMl);
  return { scene: markReached(scene, x, s.flaskMl, add), notice: ok("at-mark", `Made up to the ${fmtMl(s.flaskMl)} mL mark with ${fmtMl(add)} mL of water.`) };
}

function opRestart(scene, x) {
  const d = scene.data; const s = stn(scene, x); const keep = { predictions: d.predictions, applied: d.applied, prepared: d.prepared };
  if (d.kind === "dilution") return { scene: buildStage3Scene({ exp: 4, soluteId: d.soluteId, policy: d.policy, keep }), notice: ok("restart", "Dilution restarted.") };
  // restarting ONE beaker keeps the other as it is: empty this station's glassware and put the SAME sample back in a closed packet
  const aq = aqKeyOf(d.soluteId); const wq = s.massG == null ? 0 : molesFromMass(s.massG, molarM(scene)).nQ;
  let out = patchPacket(scene, s.packetId, { q: wq, open: false }); out = patchVessel(out, beakerId(x), { [d.soluteId]: 0, [aq]: 0 }); out = patchVessel(out, flaskId(x), { [aq]: 0 });
  out = patchStation(out, x, { waterMl: 0, cylMl: 0, liquidMl: 0, atMark: false, topUpMl: 0, stirs: 0, weighedQ: wq });
  return { scene: out, notice: ok("restart", `Beaker ${x} restarted with the same ${s.massG == null ? "sample" : fmtSig(s.massG, 3) + " g sample"}.`) };
}

/** One-click preparation of a whole solution (used by comparison mode and as a shortcut).  Chains the SAME operations on a scratch copy:
 *  if any step is refused nothing at all changes. */
function opPrepare(scene, x) {
  const d = scene.data; const s = stn(scene, x);
  if (d.kind === "dilution") return refuse(scene, "no-solid", "Use the dilution steps in this experiment.");
  if (!isUntouched(scene, x)) return refuse(scene, "in-use", "This beaker is already in use. Press Start over first.");
  if (s.weighedQ <= 0) return refuse(scene, "no-sample", "Weigh some solute first: the mass must be greater than zero.");
  const M = molarM(scene); const massG = clean(fromQuanta(s.weighedQ) * M);
  const water = suggestedWaterMl(d.soluteId, massG, s.flaskMl);
  if (water == null) return refuse(scene, "no-fit", `${fmtSig(massG, 3)} g of ${getSolute(d.soluteId).formula} cannot be dissolved in less than the ${fmtMl(s.flaskMl)} mL flask holds. Use a larger flask or less solute.`);
  let cur = { ...patchPacket(scene, s.packetId, { open: true }) };
  const steps = [(sc) => ({ scene: patchStation(sc, x, { waterMl: water }), notice: ok("water", "") }), (sc) => opPour(sc, x), (sc) => opStir(sc, x), (sc) => opTransfer(sc, x), (sc) => opFillToMark(sc, x)];
  for (const step of steps) { const r = step(cur); if (!r.notice.ok) return refuse(scene, r.notice.code, r.notice.message); cur = r.scene; }
  cur = patchPacket(cur, s.packetId, { open: false });
  const c = concentration(fromQuanta(vq(cur, flaskId(x), aqKeyOf(d.soluteId))), s.flaskMl);
  return { scene: cur, notice: ok("prepared", `Beaker ${x} prepared: ${fmtN(fromQuanta(s.weighedQ))} mol in ${fmtMl(s.flaskMl)} mL = ${fmtSig(c.c, 3)} mol dm⁻³.`) };
}

// ------------------------------------------------------------------------------------------------ dilution operations
function opSetStock(scene, rawC, rawV) {
  const d = scene.data; if (d.kind !== "dilution") return refuse(scene, "wrong-experiment", "The stock solution belongs to the dilution experiment.");
  if (d.dil.taken) return refuse(scene, "in-use", "An aliquot was already taken. Press Start over to change the stock.");
  const pc = parseNumberInput(rawC, { label: "Stock concentration", allowZero: false }); if (!pc.ok) return refuse(scene, "invalid-input", pc.error);
  const pv = parseNumberInput(rawV, { label: "Stock volume", allowZero: false }); if (!pv.ok) return refuse(scene, "invalid-input", pv.error);
  if (pv.value > GLASS.stock.capacityMl) return refuse(scene, "too-large", `The stock bottle holds at most ${GLASS.stock.capacityMl} mL.`);
  if (pv.value < GLASS.cylinder.minMl) return refuse(scene, "too-small", `The stock volume must be at least ${GLASS.cylinder.minMl} mL.`);
  const lim = concentrationLimitError(d.soluteId, pc.value); if (lim) return refuse(scene, "too-concentrated", lim);
  const n = amountFromConcentration(pc.value, pv.value);
  if (n.nQ > MAX_STATION_MOL * ONE_MOLE_Q) return refuse(scene, "too-much", `That stock holds ${fmtN(n.n)} mol: more than one packet (1 mol) of ${getSolute(d.soluteId).formula}.`);
  if (d.dil.aliquotMl > pv.value) return refuse(scene, "aliquot-too-big", `The planned aliquot (${fmtMl(d.dil.aliquotMl)} mL) is more than that stock volume. Change the aliquot first.`);
  return { scene: loadStock(scene, n.nQ, pv.value, "typed"), notice: ok("stock", `Stock set: ${fmtSig(pc.value, 3)} mol dm⁻³ in ${fmtMl(pv.value)} mL (${fmtN(n.n)} mol).`) };
}
function loadStock(scene, nQ, volumeMl, source) {
  const aq = aqKeyOf(scene.data.soluteId);
  let out = patchVessel(scene, "stock", { [aq]: nQ });
  return withData(out, { dil: { ...scene.data.dil, stockQ0: nQ, stockVolMl0: volumeMl, stockVolMl: volumeMl, source } });
}
function opStockFromPrepared(scene) {
  const d = scene.data; if (d.kind !== "dilution") return refuse(scene, "wrong-experiment", "The stock solution belongs to the dilution experiment.");
  if (d.dil.taken) return refuse(scene, "in-use", "An aliquot was already taken. Press Start over to change the stock.");
  if (!d.prepared || d.prepared.soluteId !== d.soluteId) return refuse(scene, "none", "No solution has been made up to the mark yet. Prepare one in Experiment 1, 2, 3 or 5 first.");
  if (d.prepared.volumeMl > GLASS.stock.capacityMl) return refuse(scene, "too-large", `That solution (${fmtMl(d.prepared.volumeMl)} mL) is more than the ${GLASS.stock.capacityMl} mL stock bottle holds. Prepare one of ${GLASS.stock.capacityMl} mL or less.`);
  if (d.dil.aliquotMl > d.prepared.volumeMl) return refuse(scene, "aliquot-too-big", "The planned aliquot is more than the prepared solution. Change the aliquot first.");
  return { scene: loadStock(scene, d.prepared.nQ, d.prepared.volumeMl, "prepared"), notice: ok("stock", `Your prepared solution (${fmtN(fromQuanta(d.prepared.nQ))} mol in ${fmtMl(d.prepared.volumeMl)} mL) is now the stock.`) };
}
function opSetAliquot(scene, rawV) {
  const d = scene.data; if (d.kind !== "dilution") return refuse(scene, "wrong-experiment", "Aliquots belong to the dilution experiment.");
  if (d.dil.taken) return refuse(scene, "in-use", "The aliquot has already been taken. Press Start over to choose another.");
  const p = parseNumberInput(rawV, { label: "Aliquot volume", allowZero: false }); if (!p.ok) return refuse(scene, "invalid-input", p.error);
  if (p.value < GLASS.cylinder.minMl) return refuse(scene, "too-small", `The cylinder cannot measure less than ${GLASS.cylinder.minMl} mL accurately.`);
  if (p.value > GLASS.cylinder.capacityMl) return refuse(scene, "too-large", `The measuring cylinder holds at most ${GLASS.cylinder.capacityMl} mL.`);
  if (p.value > d.dil.stockVolMl + 1e-9) return refuse(scene, "too-much-stock", `The stock only holds ${fmtMl(d.dil.stockVolMl)} mL: you cannot take ${fmtMl(p.value)} mL from it.`);
  if (p.value > d.dil.finalMl + 1e-9) return refuse(scene, "bigger-than-final", "The aliquot cannot be larger than the final volume you are diluting to.");
  return { scene: withData(scene, { dil: { ...d.dil, aliquotMl: p.value } }), notice: ok("aliquot-set", `Aliquot volume ${fmtMl(p.value)} mL.`) };
}
function opSetFinal(scene, rawV) {
  const d = scene.data; if (d.kind !== "dilution") return refuse(scene, "wrong-experiment", "The final volume belongs to the dilution experiment.");
  const s = stn(scene, "A"); if (s.liquidMl > 0) return refuse(scene, "in-use", "The aliquot is already in the flask. Press Start over to choose another flask.");
  const p = parseNumberInput(rawV, { label: "Final volume", allowZero: false }); if (!p.ok) return refuse(scene, "invalid-input", p.error);
  if (p.value < GLASS.flask.minMl) return refuse(scene, "too-small", `A volumetric flask smaller than ${GLASS.flask.minMl} mL is not available.`);
  if (p.value > GLASS.flask.maxMl) return refuse(scene, "too-large", `The largest volumetric flask here is ${GLASS.flask.maxMl} mL.`);
  if (p.value + 1e-9 < d.dil.aliquotMl) return refuse(scene, "smaller-than-aliquot", `The flask (${fmtMl(p.value)} mL) is smaller than the aliquot (${fmtMl(d.dil.aliquotMl)} mL): the aliquot would not fit, and a dilution cannot make a solution more concentrated.`);
  return { scene: patchStation(withData(scene, { dil: { ...d.dil, finalMl: p.value } }), "A", { flaskMl: p.value }), notice: ok("final-set", `${fmtMl(p.value)} mL volumetric flask selected.`) };
}
/** Take the aliquot: n(aliquot) = c1 V1 travels WITH it (dilution.js); the stock keeps the rest. */
function opTakeAliquot(scene) {
  const d = scene.data; if (d.kind !== "dilution") return refuse(scene, "wrong-experiment", "Aliquots belong to the dilution experiment.");
  if (d.dil.taken) return refuse(scene, "already", "The aliquot has already been taken.");
  const aq = aqKeyOf(d.soluteId); const stockQ = vq(scene, "stock", aq);
  const r = dilute({ nQ: stockQ, volumeMl: d.dil.stockVolMl }, d.dil.aliquotMl, d.dil.finalMl);
  if (!r.ok) return refuse(scene, "bad-aliquot", r.error);
  let out = patchVessel(scene, "stock", { [aq]: r.stockAfter.nQ }); out = patchVessel(out, "aliquot", { [aq]: r.nAliquotQ });
  out = withData(out, { dil: { ...d.dil, taken: true, aliquotQ: r.nAliquotQ, cylMl: d.dil.aliquotMl, stockVolMl: r.stockAfter.volumeMl } });
  return { scene: out, notice: ok("aliquot", `Took ${fmtMl(d.dil.aliquotMl)} mL of stock carrying ${fmtN(fromQuanta(r.nAliquotQ))} mol. The stock still holds ${fmtN(fromQuanta(r.stockAfter.nQ))} mol.`, { movedQ: r.nAliquotQ }) };
}
function opTransferAliquot(scene) {
  const d = scene.data; if (d.kind !== "dilution") return refuse(scene, "wrong-experiment", "Aliquots belong to the dilution experiment.");
  const aq = aqKeyOf(d.soluteId); const q = vq(scene, "aliquot", aq); const s = stn(scene, "A");
  if (!d.dil.taken || q <= 0) return refuse(scene, "no-aliquot", "Take an aliquot of the stock first.");
  if (s.liquidMl > 0 || vq(scene, "flaskA", aq) > 0) return refuse(scene, "flask-used", "The flask already holds the aliquot.");
  let out = patchVessel(scene, "aliquot", { [aq]: 0 }); out = patchVessel(out, "flaskA", { [aq]: q });
  out = patchStation(out, "A", { liquidMl: d.dil.aliquotMl }); out = withData(out, { dil: { ...out.data.dil, cylMl: 0 } });
  return { scene: out, notice: ok("transferred", "Aliquot poured into the volumetric flask. Now make it up to the mark.") };
}

// ------------------------------------------------------------------------------------------------ policy sync
/** Molar masses follow the global policy; a scene nothing has been taken from re-weighs its samples visibly, a scene in use keeps its recorded policy. */
function syncPolicy(scene, policy) {
  const d = scene.data; if (d.policy === policy || d.kind === "dilution") return scene;
  if (!stationIds(d.kind).every((x) => isUntouched(scene, x))) return scene;
  let out = withData(scene, { policy });
  for (const x of stationIds(d.kind)) { const s = stn(out, x); if (s.massG == null) continue; const r = molesFromMass(s.massG, molarMass(d.soluteId, policy)); out = patchPacket(out, s.packetId, { q: r.nQ }); out = patchStation(out, x, { weighedQ: r.nQ }); }
  return out;
}

// Change a beaker's setting.  In comparison mode a beaker that is already made up is restarted and re-prepared so the two stay
// comparable; the whole change is all-or-nothing (a refusal anywhere returns the ORIGINAL scene).
function reconfigure(scene, scene0, ids, fn) {
  let cur = scene; let last = null;
  for (const id of ids) {
    const redo = cur.data.kind === "compare" && stn(cur, id).atMark;
    const base = redo ? opRestart(cur, id).scene : cur;
    const r = fn(base, id); if (!r.notice.ok) return { scene: scene0, notice: r.notice };
    cur = r.scene; last = r.notice;
    if (redo) { const p = opPrepare(cur, id); if (!p.notice.ok) return { scene: scene0, notice: p.notice }; cur = p.scene; last = p.notice; }
  }
  return { scene: cur, notice: last };
}

// ------------------------------------------------------------------------------------------------ the reducer
const station = (a) => (a.station === "B" ? "B" : "A");
export function reduceStage3(scene0, action, ctx) {
  const scene = syncPolicy(scene0, ctx.policy); const d = scene.data; const done = (r) => ({ scene: r.scene === scene ? scene0 : r.scene, notice: r.notice });
  const x = station(action);
  if (x === "B" && d.kind !== "compare" && action.type !== "guide/answer") return { scene: scene0, notice: no("no-such-beaker", "This experiment has only one beaker.") };
  switch (action.type) {
    case "s3/setExp": {
      const def = experimentDef(action.exp); if (!def) return { scene: scene0, notice: no("bad-experiment", "Unknown experiment.") };
      if (def.id === d.exp) return { scene: scene0, notice: ok("same", "Already on that experiment.") };
      return { scene: buildStage3Scene({ exp: def.id, soluteId: d.soluteId, policy: ctx.policy, keep: { predictions: d.predictions, applied: d.applied, prepared: d.prepared } }), notice: ok("experiment", `Experiment ${def.id}: ${def.title}.`) };
    }
    case "s3/setSolute": {
      if (!SOLUTE_IDS.includes(action.soluteId)) return { scene: scene0, notice: no("unsupported-solute", "Only sodium hydroxide and sodium chloride are supported: both dissolve completely to hydrated ions in the amounts used here.") };
      if (action.soluteId === d.soluteId) return { scene: scene0, notice: ok("same", "Already selected.") };
      const overrides = {};
      if (d.kind !== "dilution") for (const id of stationIds(d.kind)) { const old = stn(scene, id); const bad = validateStation(action.soluteId, ctx.policy, old.massG ?? 0, old.flaskMl); if (bad) return { scene: scene0, notice: no("cannot-switch", `${SOLUTES[action.soluteId].name} cannot take beaker ${id}'s settings: ${bad}`) }; overrides[id] = { massG: old.massG, flaskMl: old.flaskMl }; }
      return { scene: buildStage3Scene({ exp: d.exp, soluteId: action.soluteId, policy: ctx.policy, keep: { predictions: d.predictions, applied: d.applied, prepared: null }, overrides }), notice: ok("solute", `${SOLUTES[action.soluteId].name} selected. The beakers were emptied.`) };
    }
    case "s3/setMass": return reconfigure(scene, scene0, d.lockMass ? ["A", "B"] : [x], (sc, id) => opSetMass(sc, id, action.value));
    case "s3/setFlask": return reconfigure(scene, scene0, [x], (sc, id) => opSetFlask(sc, id, action.value));
    case "s3/measureWater": return done(opMeasureWater(scene, x, action.value));
    case "s3/pourWater": return done(opPourWater(scene, x));
    case "s3/pour": return done(opPour(scene, x, action.q ?? null));
    case "s3/stir": return done(opStir(scene, x));
    case "s3/transfer": return done(opTransfer(scene, x));
    case "s3/topUp": return done(opTopUp(scene, x, action.value));
    case "s3/fillToMark": return done(opFillToMark(scene, x));
    case "s3/prepare": return done(opPrepare(scene, x));
    case "s3/restart": return done(opRestart(scene, x));
    case "s3/setStock": return done(opSetStock(scene, action.c, action.volumeMl));
    case "s3/stockFromPrepared": return done(opStockFromPrepared(scene));
    case "s3/setAliquot": return done(opSetAliquot(scene, action.value));
    case "s3/setFinal": return done(opSetFinal(scene, action.value));
    case "s3/takeAliquot": return done(opTakeAliquot(scene));
    case "s3/transferAliquot": return done(opTransferAliquot(scene));
    case "guide/answer": return { scene: { ...scene0, data: { ...scene0.data, predictions: { ...scene0.data.predictions, [action.key]: { choice: action.choice, correct: Boolean(action.correct) } } } }, notice: ok("answered", action.correct ? "Correct." : "Not quite.") };
    case "s3/applyAnswer": return { scene: { ...scene0, data: { ...scene0.data, applied: { ...scene0.data.applied, [action.key]: { value: action.value, correct: Boolean(action.correct) } } } }, notice: ok("applied", action.correct ? "Correct." : "Not quite.") };
    default: return null;
  }
}

// ------------------------------------------------------------------------------------------------ invariants
export function invariantsStage3(scene) {
  const out = []; const d = scene.data; if (!d?.stations) return ["stage3: no data"];
  const aq = aqKeyOf(d.soluteId);
  if (d.kind === "dilution") {
    const t = vq(scene, "stock", aq) + vq(scene, "aliquot", aq) + vq(scene, "flaskA", aq);
    if (t !== d.dil.stockQ0) out.push(`stage3: dilution moles ${t} != initial stock ${d.dil.stockQ0}`);
    const expVol = clean(d.dil.stockVolMl0 - (d.dil.taken ? d.dil.aliquotMl : 0));
    if (Math.abs(d.dil.stockVolMl - expVol) > 1e-6) out.push(`stage3: stock volume ${d.dil.stockVolMl} != ${expVol}`);
    if (d.dil.taken && vq(scene, "stock", aq) + d.dil.aliquotQ + 0 !== d.dil.stockQ0) out.push("stage3: stock + aliquot != initial stock");
  }
  for (const x of stationIds(d.kind)) {
    const s = stn(scene, x); if (!s) { out.push(`stage3: station ${x} missing`); continue; }
    const p = findPacket(scene, s.packetId);
    if (d.kind !== "dilution") {
      if (!p) { out.push(`stage3: packet of ${x} missing`); continue; }
      const total = p.q + vq(scene, beakerId(x), d.soluteId) + vq(scene, beakerId(x), aq) + vq(scene, flaskId(x), aq);
      if (total !== s.weighedQ) out.push(`stage3: beaker ${x} holds ${total} quanta in total but ${s.weighedQ} were weighed`);
      if (p.role !== packetRole(x)) out.push(`stage3: packet role of ${x}`);
    }
    if (s.waterMl < 0 || s.waterMl > GLASS.beaker.capacityMl + 1e-9) out.push(`stage3: beaker ${x} water ${s.waterMl}`);
    if (s.cylMl < 0 || s.cylMl > GLASS.cylinder.capacityMl + 1e-9) out.push(`stage3: cylinder ${x} ${s.cylMl}`);
    if (s.liquidMl < 0 || s.liquidMl > s.flaskMl + 1e-9) out.push(`stage3: flask ${x} liquid ${s.liquidMl} of ${s.flaskMl}`);
    if (s.atMark && Math.abs(s.liquidMl - s.flaskMl) > 1e-9) out.push(`stage3: flask ${x} marked at mark but liquid ${s.liquidMl}`);
    if (s.liquidMl > 0 && vq(scene, flaskId(x), aq) <= 0 && d.kind !== "dilution") out.push(`stage3: flask ${x} liquid without solute`);
    if (d.kind !== "dilution" && vq(scene, beakerId(x), d.soluteId) > 0 && s.waterMl <= 0) out.push(`stage3: solid in a dry beaker ${x}`);
    if (p && (p.q < 0 || p.q > ONE_MOLE_Q)) out.push(`stage3: packet ${p.id} amount ${p.q}`);
  }
  for (const v of scene.vessels) for (const [k, q] of Object.entries(v.contents)) if (!Number.isInteger(q) || q < 0) out.push(`stage3: vessel ${v.id} ${k} invalid ${q}`);
  return out;
}
export { toQuanta };
