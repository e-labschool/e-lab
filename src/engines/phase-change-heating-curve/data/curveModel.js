// PURE heating / cooling curve model (no React, no DOM). Everything the
// screen shows -- graph marker, temperature, particle arrangement, energy
// bars, captions -- is derived from ONE number: progress in [0, 1] of the
// active mode. Nothing else is stored, so the graph and the particles
// cannot disagree.
//
// IDEALISATIONS (stated on screen too)
//  * Constant heating power (heating) / constant cooling power (cooling),
//    so TIME is proportional to ENERGY transferred.
//  * Pure substance, constant pressure: temperature is constant during a
//    phase change; sensible-heat segments are straight lines (constant
//    specific heat capacity within a phase).
//  * The cooling curve is the heating curve REVERSED in time: the same
//    energy that was absorbed on melting/boiling is released on
//    freezing/condensing (no supercooling, no superheating).
//
// TIME SCALE. Segment durations are derived from the energy each segment
// needs per gram: sensible = c * dT, latent = L. With water's real numbers
// boiling alone is 72 % of the energy (2257 of 3132 J/g), which would squash
// the other four segments into slivers. So by default ("schematic") each
// duration is proportional to the SQUARE ROOT of its energy: the order and
// the relative ranking (boiling > liquid heating > melting > gas heating ~
// solid heating) are the real ones, but the plateaus are visibly shortened.
// "true" scale uses the exact energies. The graph says which one is shown.
import { SUBSTANCE, ABSOLUTE_ZERO_OFFSET } from "./substance.js";

export const MODES = ["heating", "cooling"];
export const TOTAL_SECONDS_AT_1X = 24;

const HEAT_KEYS = ["solidHeat", "melt", "liquidHeat", "boil", "gasHeat"];
const COOL_OF_HEAT = { solidHeat: "solidCool", melt: "freeze", liquidHeat: "liquidCool", boil: "condense", gasHeat: "gasCool" };

export const SEGMENT_INFO = {
  solidHeat: { label: "Heating the solid", short: "Solid", phase: "solid", kind: "sensible" },
  melt: { label: "Melting", short: "Melting", phase: "solid+liquid", kind: "latent" },
  liquidHeat: { label: "Heating the liquid", short: "Liquid", phase: "liquid", kind: "sensible" },
  boil: { label: "Boiling", short: "Boiling", phase: "liquid+gas", kind: "latent" },
  gasHeat: { label: "Heating the gas", short: "Gas", phase: "gas", kind: "sensible" },
  gasCool: { label: "Cooling the gas", short: "Gas", phase: "gas", kind: "sensible" },
  condense: { label: "Condensation", short: "Condensing", phase: "gas+liquid", kind: "latent" },
  liquidCool: { label: "Cooling the liquid", short: "Liquid", phase: "liquid", kind: "sensible" },
  freeze: { label: "Freezing", short: "Freezing", phase: "liquid+solid", kind: "latent" },
  solidCool: { label: "Cooling the solid", short: "Solid", phase: "solid", kind: "sensible" },
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;

/** Energy needed per gram for each heating segment, J/g. */
export function segmentEnergies(sub = SUBSTANCE) {
  return {
    solidHeat: sub.cSolid * (sub.tMelt - sub.tStart),
    melt: sub.latentFusion,
    liquidHeat: sub.cLiquid * (sub.tBoil - sub.tMelt),
    boil: sub.latentVaporisation,
    gasHeat: sub.cGas * (sub.tEnd - sub.tBoil),
  };
}

/** Builds the curve: heating segments in order with time fractions [t0, t1] of the whole run. */
export function buildCurve(scale = "schematic", sub = SUBSTANCE) {
  const energies = segmentEnergies(sub);
  const weight = (e) => (scale === "true" ? e : Math.sqrt(e));
  const total = HEAT_KEYS.reduce((s, k) => s + weight(energies[k]), 0);
  const temps = {
    solidHeat: [sub.tStart, sub.tMelt],
    melt: [sub.tMelt, sub.tMelt],
    liquidHeat: [sub.tMelt, sub.tBoil],
    boil: [sub.tBoil, sub.tBoil],
    gasHeat: [sub.tBoil, sub.tEnd],
  };
  let t = 0;
  const heating = HEAT_KEYS.map((key) => {
    const t0 = t;
    t += weight(energies[key]) / total;
    return { key, ...SEGMENT_INFO[key], t0, t1: key === "gasHeat" ? 1 : t, from: temps[key][0], to: temps[key][1], energy: energies[key] };
  });
  // Cooling = the heating curve reversed in time and in direction.
  const cooling = [...heating].reverse().map((h) => {
    const key = COOL_OF_HEAT[h.key];
    return { key, ...SEGMENT_INFO[key], t0: 1 - h.t1, t1: 1 - h.t0, from: h.to, to: h.from, energy: h.energy, heatKey: h.key };
  });
  return { scale, substance: sub, heating, cooling, energies, totalEnergy: HEAT_KEYS.reduce((s, k) => s + energies[k], 0) };
}

export const DEFAULT_CURVE = buildCurve("schematic");

/** The heating state at heating-time fraction q (0..1). */
function heatingAt(curve, q) {
  const sub = curve.substance;
  const segs = curve.heating;
  let i = segs.findIndex((s) => q < s.t1);
  if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  const f = clamp01((q - seg.t0) / (seg.t1 - seg.t0));
  const temp = lerp(seg.from, seg.to, f);
  // fraction melted (0..1) and boiled (0..1): 0 before the plateau, f during it, 1 after it
  const meltFrac = i < 1 ? 0 : i === 1 ? f : 1;
  const boilFrac = i < 3 ? 0 : i === 3 ? f : 1;
  // energy absorbed so far, J/g
  let energy = 0;
  for (let k = 0; k < i; k += 1) energy += segs[k].energy;
  energy += seg.energy * f;
  return { index: i, seg, f, temp, meltFrac, boilFrac, energy, sub };
}

/** The complete derived state for a mode at progress p in [0, 1].
 * Cooling at progress p IS heating at 1 - p (same temperature, same phase fractions). */
export function curveState(curve, mode, progress) {
  const p = clamp01(Number.isFinite(progress) ? progress : 0);
  const heating = mode !== "cooling";
  const q = heating ? p : 1 - p;
  const h = heatingAt(curve, q);
  const sub = h.sub;
  const seg = heating ? h.seg : curve.cooling[curve.cooling.length - 1 - h.index];
  const segFrac = heating ? h.f : 1 - h.f;
  const solid = 1 - h.meltFrac;
  const gas = h.boilFrac;
  const liquid = 1 - solid - gas; // melted and not yet boiled
  const tempK = h.temp + ABSOLUTE_ZERO_OFFSET;
  const tMaxK = sub.tEnd + ABSOLUTE_ZERO_OFFSET;
  const latentTotal = sub.latentFusion + sub.latentVaporisation;
  return {
    mode: heating ? "heating" : "cooling",
    progress: p,
    temp: h.temp,
    tempK,
    segmentKey: seg.key,
    segmentIndex: heating ? h.index : curve.cooling.length - 1 - h.index,
    segmentLabel: seg.label,
    segmentFraction: segFrac,
    isPlateau: seg.kind === "latent",
    kind: seg.kind,
    energyFlow: heating ? "absorbed" : "released",
    meltFrac: h.meltFrac, // 0 = all solid, 1 = all melted (same value heating and cooling at the same physical point)
    boilFrac: h.boilFrac, // 0 = no vapour, 1 = all vapour
    phaseFractions: { solid, liquid, gas },
    // Kinetic energy of the particles is proportional to the temperature in kelvin.
    keRelative: tempK / tMaxK,
    // Potential energy stored in the arrangement (latent heat taken in so far), 0..1.
    peRelative: (sub.latentFusion * h.meltFrac + sub.latentVaporisation * h.boilFrac) / latentTotal,
    energyAbsorbed: h.energy, // J/g from the start of the HEATING curve
  };
}

/** Temperature at progress p (convenience for drawing the curve). */
export function temperatureAt(curve, mode, progress) {
  return curveState(curve, mode, progress).temp;
}

/** Polyline of the whole curve for a mode as [progress, temperature] vertices (segment ends). */
export function curveVertices(curve, mode) {
  const segs = mode === "cooling" ? curve.cooling : curve.heating;
  const pts = [[segs[0].t0, segs[0].from]];
  for (const s of segs) pts.push([s.t1, s.to]);
  return pts;
}

/** Segment in effect at progress p for a mode (for shading / captions). */
export function segmentsFor(curve, mode) {
  return mode === "cooling" ? curve.cooling : curve.heating;
}

/** Captions: what the particles are doing in each segment (kinetic particle model). */
export const SEGMENT_CAPTION = {
  solidHeat: "Particles vibrate about fixed positions in a regular lattice. Energy raises their kinetic energy, so the temperature rises.",
  melt: "Energy is used to overcome attractions and break the lattice (potential energy rises). Kinetic energy is constant, so the temperature stays at the melting point.",
  liquidHeat: "Particles are close together but slide past one another. Energy raises their kinetic energy, so the temperature rises.",
  boil: "Energy is used to separate the particles completely (potential energy rises). Kinetic energy is constant, so the temperature stays at the boiling point.",
  gasHeat: "Particles are far apart and move rapidly in straight lines. Energy raises their kinetic energy, so the temperature rises.",
  gasCool: "Gas particles lose kinetic energy to the surroundings, so they slow down and the temperature falls.",
  condense: "Attractions pull the particles together and energy is released (potential energy falls). Kinetic energy is constant, so the temperature stays at the boiling point.",
  liquidCool: "Particles lose kinetic energy, move more slowly and the temperature falls.",
  freeze: "Particles settle into a regular lattice and energy is released (potential energy falls). Kinetic energy is constant, so the temperature stays at the melting point.",
  solidCool: "Particles vibrate less and less about their fixed positions as kinetic energy falls and the temperature falls.",
};
