// Glue between the run models (what is happening in the apparatus) and the particle model (why it happens).
// Pure JS: `particleSpecFor` builds the spec of createParticleView for a method + sample, `particleCtl` turns the live run
// state into the control values the particle model's step() expects. Unit-tested in scripts/test-mixture-separation.mjs.
import { SUBSTANCES } from "./chem.js";
import { CHROMA } from "./chromatography.js";
import { createParticleView, kindFor, specFor } from "./particleView.js";
import { gramsOf } from "./mixtures.js";

const clamp = (v, a, b) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a);
const drawn = (g, lo, hi, k) => Math.max(lo, Math.min(hi, Math.round(Math.sqrt(Math.max(0, g)) * k)));

/** The particle spec for `methodId` on `sample` (`solvent` only matters for chromatography). */
export function particleSpecFor(methodId, sample, solvent = "water") {
  const kind = kindFor(methodId);
  const base = specFor(sample);
  if (kind === "chroma") {
    const dyes = sample.parts.filter((p) => SUBSTANCES[p.sub]?.dye).map((p) => ({ id: p.sub, rf: SUBSTANCES[p.sub].rf?.[solvent] ?? 0 }));
    return { ...base, dyes };
  }
  if (kind === "magnet") {
    const iron = gramsOf(sample, "iron");
    const other = sample.parts.filter((p) => p.form === "solid" && !SUBSTANCES[p.sub].magnetic).sort((a, b) => b.g - a.g)[0];
    const otherId = other?.sub === "sulfur" ? "sulfur" : other?.sub === "sand" ? "grain" : other?.sub === "iodine" ? "iodine" : "sulfur";
    return { iron: iron > 0 ? drawn(iron, 5, 16, 3.5) : 0, other: other ? drawn(other.g, 6, 18, 3.2) : 0, otherId };
  }
  if (kind === "layers") {
    const liquids = sample.parts.filter((p) => p.form === "liquid");
    const polar = liquids.filter((p) => SUBSTANCES[p.sub].polar); const non = liquids.filter((p) => !SUBSTANCES[p.sub].polar);
    const biggest = (list, fb) => (list.length ? [...list].sort((a, b) => b.g - a.g)[0].sub : fb);
    const species = (id, fb) => (["water", "ethanol", "oil", "hexane", "decane", "hexadecane"].includes(id) ? id : fb);
    return { polarId: species(biggest(polar, "water"), "water"), nonpolarId: species(biggest(non, "oil"), "oil"), polarN: polar.length ? drawn(polar.reduce((a, p) => a + p.g, 0), 18, 46, 4) : 0, nonpolarN: non.length ? drawn(non.reduce((a, p) => a + p.g, 0), 14, 40, 4) : 0 };
  }
  if (kind === "crystal") {
    return { ions: 36, water: 70 };
  }
  if (kind === "dissolve") return { ions: 30 };
  return base;
}

/** A ready-made particle view for a method + sample. */
export function makeParticleView(methodId, sample, solvent = "water", seed = 7) {
  return createParticleView(kindFor(methodId), particleSpecFor(methodId, sample, solvent), seed);
}

/** Control values for the particle model from the run's `view` (and the run itself). Always finite, always in range. */
export function particleCtl(methodId, run) {
  const v = run?.view ?? {};
  const kind = kindFor(methodId);
  if (kind === "sieve") {
    const prog = methodId === "decanting" ? clamp(v.pouredFrac ?? 0, 0, 1) : v.V ? clamp(v.poured / v.V, 0, 1) : clamp(v.poured ?? 0, 0, 1);
    return { progress: prog, T: 293 };
  }
  if (kind === "vapour") return { T: Number.isFinite(v.Tpot ?? v.T) ? (v.Tpot ?? v.T) : 20 };
  if (kind === "crystal") {
    const cool = v.phase === "cool" || (v.crystals ?? 0) > 0;
    const total = (run?.crystalTotal ?? 0) || 1;
    return { progress: cool ? clamp((v.crystals ?? 0) / total, 0, 1) : 0, T: v.T ?? 60 };
  }
  if (kind === "chroma") return { front: clamp((v.frontDist ?? 0) / (CHROMA.top - CHROMA.baseline), 0, 1) };
  if (kind === "magnet") return { progress: clamp(v.collected ?? 0, 0, 1), sweep: clamp(0.15 + 0.7 * (v.sweep ?? 0), 0, 1), sweeping: !!v.sweeping };
  if (kind === "layers") return { progress: run ? clamp((run.t ?? 0) / 5, 0, 1) : 1 };
  if (kind === "dissolve") return { progress: clamp(v.progress ?? 0, 0, 1) };
  return {};
}

/** One-sentence caption: what the particles show for this method (used under the particle view). */
export function particleCaption(methodId, run, sample) {
  const v = run?.view ?? {};
  switch (kindFor(methodId)) {
    case "sieve": return "Paper fibres leave gaps (pores). Water molecules and ions are tiny and pass through; sand grains are far bigger than the pores and are held back.";
    case "vapour":
      if (methodId === "sublimation") return "Iodine molecules are held only by weak London forces, so warming lets them leave the solid directly as vapour. Sand (a giant lattice) stays put.";
      return `Molecules of the more volatile liquid escape from the surface first. ${(v.Tpot ?? v.T ?? 20) > 70 ? "Particles that are not volatile (ions, sand) stay behind." : "Warm it up and watch which particles leave."}`;
    case "crystal": return "As the hot solution cools the ions can no longer stay separated by water: they join an ordered lattice and crystals grow.";
    case "chroma": return "Each dye sticks to the paper for part of the time and dissolves in the moving solvent for the rest. The more time spent in the solvent, the further it travels (higher Rf).";
    case "magnet": return "Only iron is attracted to the magnet. Sulfur (or sand) feels no force and stays on the tray.";
    case "layers": return "Water molecules attract each other strongly (hydrogen bonds) and push the non-polar oil molecules out, so the two liquids form layers: the denser one underneath.";
    case "dissolve": return "Water molecules pull ions out of the salt lattice one by one and surround them: the solid dissolves.";
    default: return sample ? "" : "";
  }
}
