// Module 5 -- PARTICLE VISUALISATION MAPPING.
//
// Maps an amount to what the 3D packet DRAWS.  This module is the ONLY bridge between chemistry and rendering and the bridge
// is strictly one-way:  chemistry (quanta) -> fill fraction -> number of representative entities.  Chemistry is NEVER derived
// from rendered counts, and nothing here is random: the same fraction always gives the same entity count (spec B3).
//
// A full packet shows FULL_ENTITIES[detail] representative entities (NOT 6.022e23).  Every substance uses the same number
// at the same detail, so no density or molar-volume information is implied (spec A2).
import { elementStyle } from "../../shared-3d/elementStyle.js";
import { getSubstance } from "./substances.js";

export const DETAIL_LEVELS = Object.freeze(["low", "medium", "high"]);
/** Representative entities drawn in ONE full packet, per detail level. */
export const FULL_ENTITIES = Object.freeze({ low: 300, medium: 450, high: 600 });

/** Visible entity count for a fill fraction: monotone, deterministic, 0 only when empty, < full only when not full. */
export function entityCountFor(fraction, detail = "medium") {
  const N = FULL_ENTITIES[detail];
  if (!N) throw new Error(`Unknown detail level "${detail}"`);
  if (!(fraction > 0)) return 0;
  if (fraction >= 1) return N;
  return Math.min(N - 1, Math.max(1, Math.round(fraction * N)));
}

/** Choose a detail level from device facts.  Pure: the caller supplies the facts. */
export function chooseDetail({ softwareGL = false, deviceMemory = 8, cores = 4, measuredFps = null, reducedMotion = false, small = false } = {}) {
  let level = 2;
  if (softwareGL || deviceMemory <= 2 || cores <= 2) level = 0;
  else if (deviceMemory <= 4 || cores <= 4 || small) level = 1;
  if (measuredFps != null) { if (measuredFps < 22) level = Math.min(level, 0); else if (measuredFps < 40) level = Math.min(level, 1); }
  if (reducedMotion) level = Math.min(level, 1);
  return DETAIL_LEVELS[level];
}
/** Step the level down once (used by the runtime fps monitor); returns the same level when already lowest. */
export const lowerDetail = (d) => DETAIL_LEVELS[Math.max(0, DETAIL_LEVELS.indexOf(d) - 1)];

// ------------------------------------------------------------------------------------------------ colours + sizes
const EXTRA_COLOURS = { Fe: "#8d7b6e", Cu: "#c4733c", Zn: "#8f9bb0", Al: "#b8a9c9" };
/** ONE colour per element for every stage (shared with the VSEPR / bonding tools; Fe, Cu ... added here). */
export const atomColour = (el) => EXTRA_COLOURS[el] ?? elementStyle(el).color;
export const atomTextColour = (el) => elementStyle(el).text;
/** Drawn radii (arbitrary units, ratio matters). Neutral atoms use the shared ball-and-stick radii; ions use ionic-radius ratios. */
const ION_R = { "Na+": 0.62, "Cl-": 1.0, "Mg2+": 0.5, "O2-": 0.8, "Ca2+": 0.7, "Fe3+": 0.45, "Al3+": 0.4 };
export const atomRadius = (el, charge = 0) => {
  if (charge) { const key = `${el}${Math.abs(charge) === 1 ? "" : Math.abs(charge)}${charge > 0 ? "+" : "-"}`; if (ION_R[key]) return ION_R[key] * 0.55; }
  return elementStyle(el).r * 0.9;
};

/**
 * What ONE representative entity looks like.  Returns { mode, entities[] } where each entity template has atoms
 * [{ el, x, y, z, r, charge }] centred on its centroid and scaled so the template's bounding radius is 1, plus bonds.
 *   molecular -> one template (the molecule, correct composition and geometry)
 *   ionic     -> two templates (cation, anion): the packet shows an ion lattice fragment, labelled as a simplification
 *   metallic  -> one template (a single atom)
 */
export function particleModel(substanceId) {
  const s = getSubstance(substanceId);
  const norm = (atoms, bonds, chargeFor = () => 0) => {
    const c = atoms.reduce((a, p) => [a[0] + p.x / atoms.length, a[1] + p.y / atoms.length, a[2] + p.z / atoms.length], [0, 0, 0]);
    const placed = atoms.map((a, i) => ({ el: a.el, x: a.x - c[0], y: a.y - c[1], z: a.z - c[2], charge: chargeFor(a, i), r: atomRadius(a.el, chargeFor(a, i)) }));
    const extent = Math.max(0.0001, ...placed.map((a) => Math.hypot(a.x, a.y, a.z) + a.r * (a.el === "H" ? 1 : 1.2)));
    // Å -> unit sphere; keep atoms from shrinking to dots for single-atom entities
    const k = atoms.length === 1 ? 1 / placed[0].r : 1 / extent;
    return { atoms: placed.map((a) => ({ ...a, x: a.x * k, y: a.y * k, z: a.z * k, r: a.r * k })), bonds: bonds.map((b) => ({ ...b })) };
  };
  if (s.kind === "molecular" || s.kind === "atom-entity" || s.kind === "ion-entity") {
    const g = s.geometry;
    return { mode: "molecular", entities: [{ id: s.id, label: s.formulaDisplay, ...norm(g.atoms, g.bonds, (a) => (s.kind === "ion-entity" && g.atoms.length === 1 ? s.charge : 0)) }] };
  }
  if (s.kind === "metallic" || s.kind === "atomic-solid") return { mode: "metallic", entities: [{ id: s.id, label: `${s.formula} atom`, ...norm([{ el: s.formula, x: 0, y: 0, z: 0 }], []) }] };
  // ionic and aqueous-ionic: one template per ion species (a polyatomic ion like OH- is a two-atom group)
  const ents = s.ions.map((i) => {
    let atoms; let bonds = [];
    if (i.composition && Object.values(i.composition).reduce((a, b) => a + b, 0) > 1) {
      // OH-: O then H along x with the real O-H length
      atoms = [{ el: "O", x: 0, y: 0, z: 0 }, { el: "H", x: 0.97, y: 0, z: 0 }]; bonds = [{ a: 0, b: 1, order: 1 }];
      return { id: `${s.id}:${i.formula}`, label: i.label, charge: i.charge, ...norm(atoms, bonds, (a) => (a.el === "O" ? i.charge : 0)) };
    }
    atoms = [{ el: i.formula, x: 0, y: 0, z: 0 }];
    return { id: `${s.id}:${i.formula}`, label: i.label, charge: i.charge, ...norm(atoms, bonds, () => i.charge) };
  });
  return { mode: "ionic", entities: ents };
}

/** Species index (0 = first ion) for a lattice cell in an ionic fragment: alternating, so every ion sits next to the other kind. */
export const ionicSpecies = (i, j, k) => (i + j + k) % 2;

/** One-line honest description of what the packet's particles are, for the permanent info panel / aria text. */
export function particleCaption(substanceId, detail = "medium") {
  const s = getSubstance(substanceId); const N = FULL_ENTITIES[detail];
  const what = s.kind === "molecular" ? `${s.formulaDisplay} molecules` : s.kind === "metallic" || s.kind === "atomic-solid" ? `${s.formula} atoms in a lattice fragment`
    : s.kind === "atom-entity" ? s.name : s.kind === "ion-entity" ? s.name : `${s.ions.map((i) => i.label).join(" and ")} ions in a lattice fragment`;
  return `A full packet draws about ${N} representative ${what}, not 6.022 × 10²³.`;
}
