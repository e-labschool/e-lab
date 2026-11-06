// The continuous journey of every molecule through the instrument as a PURE function of (experiment, world, stage, time). No React, no randomness at draw time:
// everything that looks random comes from the seeded experiment (model/experiment.js), so the same experiment always replays the same way.
//   stage 1  sample inlet: molecules leave the reservoir (one by one, once "Start sample introduction" was pressed) and fill the pre-beam zone
//   stage 2  ionisation: molecules drift through the electron beam; some are ionised (M + e- -> M+. + 2e-), the rest stay neutral and are pumped away
//   stage 3  fragmentation: each molecular ion survives or breaks; the neutral product leaves, the charged fragment stays
//   stage 4  acceleration and separation: ions accelerate through V and are separated by the analyser (sector arcs, or TOF flight)
// Stages 5 and 6 are driven by model/experiment.js (detectionPlan / detectionAt); nothing is re-simulated there.
import { gridSlots } from "./experiment.js";
import { mulberry32 } from "./experiment.js";
import { sectorPath } from "./analyser.js";
import { sectorPoint } from "../physics/sector.js";

export const ease = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

export const T_FRAG_STEP = 2.6; // seconds a bond-breaking step lasts
export const BREAK_AT = 0.38; // fraction of the step at which the bond breaks
export const STAGE_BEATS = {
  1: [0, 2.4, 4.8], 2: [0, 2.6, 5.2, 7.8], 3: [0, 3.5, 7.0, 10.5], 4: [0, 3, 6, 9], 5: [0, 0.33, 0.66, 1], 6: [0],
};

/** slots (positions) of the population in a zone, cached per (experiment, world mode) */
const slotCache = new WeakMap();
function slots(exp, world) {
  let by = slotCache.get(exp); if (!by) { by = {}; slotCache.set(exp, by); }
  const key = world.tall ? "tall" : "wide"; if (by[key]) return by[key];
  const mk = (zone, salt) => gridSlots(exp.n, zone, mulberry32(exp.seed * 31 + salt + (world.tall ? 5 : 0)), 0.18);
  const home = mk(world.preZone, 1); const frag = mk(world.fragZone, 2); const res = mk(world.reservoir, 3);
  // crossing order: the molecule closest to the beam goes first; ions leave the fragmentation zone starting from the one closest to the slit
  const crossOrder = exp.molecules.map((m) => m.i).sort((a, b) => home[exp.molecules[b].homeSlot].x - home[exp.molecules[a].homeSlot].x || a - b);
  const exitOrder = exp.ionised.map((m) => m.i).sort((a, b) => frag[exp.molecules[b].fragSlot].x - frag[exp.molecules[a].fragSlot].x || a - b);
  by[key] = { home, frag, res, crossRank: Object.fromEntries(crossOrder.map((id, k) => [id, k])), exitRank: Object.fromEntries(exitOrder.map((id, k) => [id, k])) };
  return by[key];
}
const wob = (m, T, amp = 1) => ({ x: amp * (3.2 * Math.sin(0.9 * T + m.r1 * 6.283) + 1.6 * Math.sin(2.1 * T + m.r2 * 6.283)), y: amp * (3.2 * Math.cos(0.8 * T + m.r3 * 6.283) + 1.6 * Math.sin(1.9 * T + m.r4 * 6.283)) });

// ---- stage durations ---------------------------------------------------------------------------------------------------------------------------------
export const T_CROSS0 = 0.8; export const T_CROSS_SPAN = 6.4; export const T_FRAG0 = 1.0; export const T_FRAG_SPAN = 5.0; export const T_FRAG_GAP = 3.1;
const tLeave = (m) => 0.4 + 0.45 * m.i;
export function stageDuration(exp, stage, { analyser = "sector", V = 2000, B = 0.5, world = null } = {}) {
  if (stage === 1) return tLeave({ i: exp.n - 1 }) + 3.0;
  if (stage === 2) return T_CROSS0 + T_CROSS_SPAN + 3.6;
  if (stage === 3) return 14.5;
  if (stage === 4) {
    let end = 0;
    for (const m of exp.ionised) { const f = ionFlightEnd(exp, m, analyser, V, B, world); end = Math.max(end, f); }
    return end + 1.4;
  }
  return 0;
}

// ---- stages 1 to 3 -----------------------------------------------------------------------------------------------------------------------------------
/** Frame of one molecule at stage-time t. started: stage-1 sample introduction has been started. */
export function moleculeFrame(exp, world, stage, t, m, { started = true, tracked = false } = {}) {
  const S = slots(exp, world); const home = S.home[m.homeSlot]; const frag = S.frag[m.fragSlot]; const res = S.res[m.resSlot];
  const T = t + stage * 41.3; const w = wob(m, T);
  const base = { i: m.i, spin: m.spin0 + m.spinRate * T, tilt: m.tilt, opacity: 1, flash: 0, scale: 1, parts: [{ role: "main", ids: null, kind: "neutral", ionKey: null, dx: 0, dy: 0, opacity: 1 }], bondFx: [], region: "inlet", status: "" };
  const ret = (o) => ({ ...base, ...o });
  if (stage === 1) {
    const tl = tLeave(m);
    if (!started || t < tl) return ret({ x: res.x + w.x * 0.8, y: res.y + w.y * 0.8, region: "reservoir", status: "in the sample reservoir (neutral molecule)" });
    const u = ease((t - tl) / 2.6); const pts = [res, { x: world.valveX, y: world.yc }, { x: world.inletX + 6, y: world.yc }, home];
    const lens = pts.slice(1).map((p, k) => Math.hypot(p.x - pts[k].x, p.y - pts[k].y)); const L = lens.reduce((a, b) => a + b, 0);
    let d = u * L; let k = 0; while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k += 1; }
    const f = lens[k] ? d / lens[k] : 1; const x = lerp(pts[k].x, pts[k + 1].x, f); const y = lerp(pts[k].y, pts[k + 1].y, f);
    const inChamber = x > world.inletX + 8; const settle = u >= 1 ? 1 : 0.6;
    return ret({ x: x + w.x * settle * 0.6, y: y + w.y * settle * 0.6, region: u >= 1 ? "inlet-chamber" : x < world.valveX ? "reservoir" : "inlet", status: u >= 1 ? "in the chamber, before the electron beam (neutral molecule)" : inChamber ? "entering the chamber" : "passing through the sample inlet" });
  }
  const tc = T_CROSS0 + S.crossRank[m.i] * (T_CROSS_SPAN / Math.max(1, exp.n - 1));
  const beamY = home.y;
  if (stage === 2) {
    if (t < tc) { const f = clamp01(t / tc); return ret({ x: lerp(home.x, world.beamX - 3, f) + w.x * 0.5, y: home.y + w.y * 0.5, region: "ionisation", status: "drifting towards the electron beam (neutral molecule)" }); }
    const s = t - tc;
    if (m.ionised) {
      const f = ease(s / 2.4); const flash = Math.max(0, 1 - s / 1.0);
      return ret({ x: lerp(world.beamX, frag.x, f) + w.x * f * 0.6, y: lerp(beamY, frag.y, f) + w.y * f * 0.6, flash, region: "ionisation", status: s < 1 ? "just ionised: M + e⁻ → M⁺• + 2e⁻" : "molecular ion M⁺• (positive, radical)", parts: [{ role: "main", ids: null, kind: "molion", ionKey: exp.spec.mMz, dx: 0, dy: 0, opacity: 1 }] });
    }
    const f1 = clamp01(s / 1.0); const f2 = ease((s - 0.9) / 2.4);
    const x = world.beamX + 70 * f1 + (world.pump.x - world.beamX - 70) * f2; const y = lerp(beamY, beamY + 12, f1) + (world.pump.y - beamY - 12) * f2;
    const keep = tracked ? 0.45 : 0;
    return ret({ x, y, opacity: Math.max(keep, 1 - clamp01((s - 2.0) / 1.4)), region: s < 0.9 ? "ionisation" : "pump", status: s < 0.9 ? "passed through the beam without being ionised: still neutral" : "neutral molecule, pumped away: never accelerated or deflected" });
  }
  // stage 3 (and the resting state in later stages): ions at their fragmentation-zone slot
  if (!m.ionised) return ret({ x: world.pump.x, y: world.pump.y, opacity: 0, region: "pump", status: "neutral molecule, pumped away: never accelerated or deflected" });
  const pos = { x: frag.x + w.x * 0.6, y: frag.y + w.y * 0.6 };
  const mol = exp.sim; const chain = m.outcome.chain.map((id) => mol.pathById[id]);
  if (chain.length === 0) {
    const tSurv = T_FRAG0 + T_FRAG_SPAN + 0.6;
    return ret({ ...pos, region: "fragmentation", parts: [{ role: "main", ids: null, kind: "molion", ionKey: exp.spec.mMz, dx: 0, dy: 0, opacity: 1 }], status: t > tSurv ? "survives intact: contributes to the molecular-ion peak" : "molecular ion M⁺•, not yet fragmented", survives: t > tSurv });
  }
  const nF = Math.max(1, exp.molecules.filter((q) => q.outcome.type === "fragment").length);
  const t0 = T_FRAG0 + T_FRAG_SPAN * (m.fragRank / nF) + m.r1 * 0.35;
  return fragFrame(exp, m, chain, t - t0, pos, ret, tracked);
}

/** time-resolved frame of a molecular ion that fragments in 1 or 2 steps; local time tt = seconds since its first step began (negative: not yet) */
function fragFrame(exp, m, chain, tt, pos, ret, tracked) {
  const parts = []; const bondFx = []; let status = "molecular ion M⁺•, about to fragment"; let chargedIds = null; let chargedKey = exp.spec.mMz; let chargedKind = "molion";
  const dirOf = (s) => { const a = (0.35 + 0.3 * ((m.r2 + 0.37 * s) % 1)) * Math.PI; return [Math.cos(a) * (s % 2 ? -1 : 1), Math.sin(a)]; };
  let recoil = [0, 0]; const neutrals = []; let doneAll = true; let pumpFade = 1;
  chain.forEach((p, s) => {
    const ts = tt - s * T_FRAG_GAP; const u = ts / T_FRAG_STEP; const dir = dirOf(s);
    if (u < 0) { doneAll = false; return; }
    const stretch = clamp01(u / BREAK_AT); const broken = u >= BREAK_AT + 0.12;
    if (!broken) {
      doneAll = false; status = u < BREAK_AT ? `bond stretching: ${p.eq}` : `bond breaks: ${p.eq}`;
      for (const [a, b] of p.breaks) bondFx.push({ a, b, state: "stretch", amt: stretch });
      neutrals.push({ ids: p.neutral, dir, dist: 3 + 5 * stretch, opacity: 1, label: null, state: "stretching", stepIndex: s, flash: u >= BREAK_AT ? 1 - (u - BREAK_AT) / 0.12 : 0 });
    } else {
      chargedIds = p.charged; chargedKey = p.mz; chargedKind = "fragion";
      const sep = ease((u - BREAK_AT - 0.12) / (1 - BREAK_AT - 0.12)); const sepD = 8 + 38 * sep; const after = Math.max(0, ts - T_FRAG_STEP);
      const drift = Math.min(after, 3.4); const fade = 1 - clamp01((after - 1.6) / 1.8); const hold = tracked ? 0.5 : 0;
      neutrals.push({ ids: p.neutral, dir: [dir[0], dir[1] * 1], dist: sepD + 18 * drift, opacity: Math.max(hold, 0.92 * fade), label: p.neutralLabel, state: "neutral", stepIndex: s });
      recoil = [recoil[0] - dir[0] * 0.14 * sepD, recoil[1] - dir[1] * 0.14 * sepD];
      pumpFade = Math.min(pumpFade, fade);
      if (p.forms?.length) for (const [a, b] of p.forms) bondFx.push({ a, b, state: "form", amt: clamp01((u - BREAK_AT) / 0.3) });
      status = after > 1.6 ? `charged fragment ${p.chargedFormula}⁺ (m/z ${p.mz}); the neutral ${p.neutralLabel} is pumped away` : `${p.eq}: the neutral product separates`;
    }
  });
  const chargedParent = chargedIds ?? null;
  parts.push({ role: "charged", ids: chargedParent, kind: chargedKind, ionKey: chargedKey, dx: recoil[0], dy: recoil[1], opacity: 1 });
  neutrals.forEach((n, k) => parts.push({ role: "neutral", ids: n.ids, kind: n.state === "stretching" ? chargedKind : "neutralfrag", ionKey: null, dx: n.dir[0] * n.dist + recoil[0] * 0, dy: n.dir[1] * n.dist, opacity: n.opacity, label: n.label, step: n.stepIndex, flash: n.flash ?? 0, stretching: n.state === "stretching", k }));
  // while a bond is stretching the whole ion keeps ONE ring (kind of the parent), after the break the parts have their own rings
  return ret({ ...pos, parts, bondFx, region: "fragmentation", status, fragmented: doneAll, flash: parts.some((q) => q.flash > 0) ? 1 : 0, fadeProgress: pumpFade });
}

// ---- stage 4 -----------------------------------------------------------------------------------------------------------------------------------------
export const ACCEL_TIME_REF = 0.9; // seconds on screen for m/z 16 to cross the gap at 2000 V (a uniform stretch of real time)
export const WALK_TIME = 1.6;
export const accelTime = (mz, V) => ACCEL_TIME_REF * Math.sqrt((mz / 16) * (2000 / V));
const laneOffset = (exp, mz) => { const keys = [...new Set(exp.detector.map((d) => d.mz))].sort((a, b) => a - b); const k = keys.indexOf(mz); const n = keys.length; return n <= 1 ? 0 : (k / (n - 1) - 0.5) * 2; };

/** timing/geometry of the flight of an ion with effective m/z `mz` released at t0: returns pure functions */
export function ionFlightModel(exp, world, mz, V, B, analyser, t0, from) {
  const tc = accelTime(mz, V); const d = world.accel.d; const vExit = (2 * d) / tc; const slit = world.slit; const tw = WALK_TIME;
  const tAccel0 = t0 + tw; const tAccel1 = tAccel0 + tc; const dr = world.plateX - world.accel.x1; const tDrift1 = tAccel1 + dr / vExit;
  let end = tDrift1; let path = null; let tof = null;
  if (analyser === "sector") { path = sectorPath(mz, V, B); const rU = path.r * world.sector.s; end = tDrift1 + (rU * path.sweep) / vExit; }
  else { const L = world.tof.x1 - world.plateX; end = tDrift1 + L / vExit; tof = { L, vExit }; }
  const lane = analyser === "tof" ? laneOffset(exp, Math.round(mz)) * world.tof.h * 0.42 : 0;
  const at = (t) => {
    if (t < t0) return { x: from.x, y: from.y, phase: "wait" };
    if (t < tAccel0) { const f = ease((t - t0) / tw); return { x: lerp(from.x, slit.x - 6, f), y: lerp(from.y, slit.y, f), phase: "walk" }; }
    if (t < tAccel1) { const f = (t - tAccel0) / tc; return { x: world.accel.x0 + d * f * f, y: slit.y, phase: "accel" }; }
    if (t < tDrift1) { const f = (t - tAccel1) / (tDrift1 - tAccel1); return { x: lerp(world.accel.x1, world.plateX, f), y: slit.y, phase: "drift" }; }
    if (analyser === "sector") {
      const rU = path.r * world.sector.s; const arcT = (rU * path.sweep) / vExit; const f = clamp01((t - tDrift1) / arcT); const th = path.sweep * f; const o = sectorPoint(path.r, th); const p = world.sectorXY(o.x, o.y);
      return { x: p.x, y: p.y, phase: f >= 1 ? "end" : "arc", outcome: path.outcome };
    }
    const f = clamp01((t - tDrift1) / (end - tDrift1)); const ramp = Math.min(1, f * 6);
    return { x: lerp(world.plateX, world.tof.x1, f), y: slit.y + lane * ramp, phase: f >= 1 ? "end" : "flight", outcome: "detector" };
  };
  return { at, t0, tAccel0, tAccel1, tDrift1, end, vExit, path, lane, tc, tof };
}
function ionFlightEnd(exp, m, analyser, V, B, w0) {
  const world = w0 && w0.analyser === analyser ? w0 : makeShallowWorld(analyser); const S = slots(exp, world);
  const t0 = analyser === "tof" ? 0.5 : 0.5 + 0.5 * (S.exitRank[m.i] ?? 0);
  return ionFlightModel(exp, world, m.ionMz, V, B, analyser, t0, S.frag[m.fragSlot]).end;
}
import { makeWorld } from "../scene/world.js";
const makeShallowWorld = (analyser) => makeWorld({ tall: false, analyser });

/** all ion tokens of stage 4 at time t. cmp: optional extra comparison ions [{mz (effective), label, key}] released after the population */
export function ionTokens(exp, world, V, B, analyser, t, { cmp = [] } = {}) {
  const S = slots(exp, world); const out = [];
  for (const m of exp.ionised) {
    const t0 = analyser === "tof" ? 0.5 : 0.5 + 0.5 * (S.exitRank[m.i] ?? 0);
    const f = ionFlightModel(exp, world, m.ionMz, V, B, analyser, t0, S.frag[m.fragSlot]); const p = f.at(t);
    out.push({ id: `m${m.i}`, i: m.i, mz: m.ionMz, z: 1, ...p, model: f });
  }
  cmp.forEach((c, k) => {
    const from = { x: world.fragZone.x1 - 20, y: world.yc + (k ? 22 : -22) };
    const f = ionFlightModel(exp, world, c.mz, V, B, analyser, 0.8, from); out.push({ id: `c${k}`, cmp: true, mz: c.mz, z: c.z, label: c.label, ...f.at(t), model: f });
  });
  return out;
}
export const fragmentSlots = (exp, world) => slots(exp, world);

// ---- helpers for the scene and the panels -------------------------------------------------------------------------------------------------------------
export const crossTime = (exp, world, m) => T_CROSS0 + slots(exp, world).crossRank[m.i] * (T_CROSS_SPAN / Math.max(1, exp.n - 1));
export const homePoint = (exp, world, m) => slots(exp, world).home[m.homeSlot];

/** A single molecular ion breaking down along a chain of verified pathways, centred at (0, 0): for the pathway view (no population, no seed). tt = seconds since the first bond started to stretch. */
export function demoFrame(sim, chain, tt, { seed = 0.37 } = {}) {
  const ret = (o) => ({ i: 0, spin: 0.5, tilt: 0.3, opacity: 1, flash: 0, scale: 1, parts: [], bondFx: [], x: 0, y: 0, ...o });
  if (!chain.length || tt < 0) return ret({ parts: [{ role: "main", ids: null, kind: "molion", ionKey: sim.spec.mMz, dx: 0, dy: 0, opacity: 1 }], status: "molecular ion M⁺•" });
  return fragFrame({ spec: sim.spec }, { r2: seed }, chain, tt, { x: 0, y: 0 }, ret, true);
}
export const chainDuration = (chain) => (chain.length ? T_FRAG_STEP * (1 + (chain.length - 1) * (T_FRAG_GAP / T_FRAG_STEP)) + 1.8 : 0);
