// THE single simulation catalogue for e-Lab.
//
// One entry per simulation with everything any screen needs to list, filter,
// badge, feature or gate it: id, label, short description, subject, topic
// area, IB syllabus codes, status, default access tier, featured flag and
// thumbnail path.  Consumers:
//   * src/data/simulationRegistry.js   -> SIMULATION_REGISTRY (id -> label) is DERIVED from the live entries here,
//                                         so Learn blocks, InteractiveFrame and /simulation/:id keep working unchanged.
//   * src/data/resources-registry.js   -> stays the source for the public /interactives page.  Its live items are
//                                         linked here through `resourceId`; its not-yet-live items are folded in
//                                         below as "coming soon" entries (they are NOT openable).
//   * SimulationLibrary, the landing page, /admin/simulations.
//
// Access: `tier` here is only the DEFAULT.  Per-simulation overrides (draft table `simulation_access`, see
// docs/platform-sql/002_simulation_access.sql) are merged on top by applyAccessOverrides().  Everything is free for now
// -- see src/lib/access/accessPolicy.js; never compare tiers in components.
//
// SYLLABUS CODES are IB DP Chemistry 2025 topic codes (S = Structure, R = Reactivity) and only appear where they can be
// traced to existing project data; otherwise they are left out rather than guessed.  Sources:
//   - the engine's own meta.js / component header or its docs/*.md  (build-an-atom S1.2, vsepr/hybridisation/IMF S2.2,
//     bonding-visualizer S2.1-2.3, gas simulations S1.5, chocolate-wrapping R2.2, wave-explorer S1.3)
//   - src/data/curricula/dp-chemistry/2025.js, which lists each engine's concept ids under a syllabus sub-topic
//     (electron configuration / orbital explorer S1.3, particle model / matter & states / heating curve S1.1,
//      collision theory R2.2, pH / H+-OH- / buffer R3.1)
//   - src/data/curricula/dp-chemistry/syllabus-points-2025.js statement text (atomic spectra S1.3.1-2, ionization energy
//     S1.3.7, mixtures S1.1.1, titration / neutralization R3.1, MS / NMR S3.2.8 / S3.2.10).
// `level` (SL / HL) is intentionally absent: no existing data records it per simulation.
import { TIERS } from "../lib/access/accessPolicy.js";
import { getAllResources } from "./resources-registry.js";

export const SIM_STATUS = Object.freeze({ LIVE: "live", IN_DEVELOPMENT: "in-development", PLANNED: "planned" });

/** Topic areas in the order their filter chips are shown. */
export const TOPIC_AREAS = Object.freeze([
  "Atomic structure",
  "States of matter & gases",
  "Bonding",
  "Kinetics",
  "Acids & bases",
  "Spectroscopy",
  "Stoichiometry",
  "Periodicity",
  "Energetics",
  "Equilibrium",
  "Redox",
  "Organic chemistry",
]);

/** Curricula a simulation serves (ids from src/data/curricula.js PLATFORM_CURRICULA).  VERIFIED for every live simulation:
 *  each one's syllabus codes are IB DP Chemistry 2025 codes (see the SYLLABUS CODES note above).  No IGCSE / AS & A Level
 *  mapping exists or is claimed; a simulation only gains another id here when someone has checked it against that syllabus.
 *  Coming-soon entries have no verified mapping, so theirs is empty.  Optional: consumers treat a missing field as []. */
export const LIVE_SIMULATION_CURRICULA = Object.freeze(["ib-dp"]);

/** FEATURE_WHEN_READY -- one switch for the landing page.  Entries below carry `featureWhenReady: true` (Build an Atom,
 *  Collision Theory, Buffer Action, Bonding Visualizer): the owner wants them on the front page, but they are being rebuilt
 *  and are not yet premium-grade (docs/sim-review/MASTER_PLAN.md).  While this is `false` they are NOT featured (they stay
 *  fully available in the library); set it to `true` -- the only change needed -- once their rebuilds land and they are
 *  featured in `featuredOrder` (Build an Atom 1, VSEPR 2, Heating Curve 3, Hybridisation 4, Collision 5, Buffer 6, Bonding 7).
 *  Entries without `featureWhenReady` (VSEPR, Heating Curve, Hybridisation) are featured now.  The admin Featured star
 *  (simulation_access overrides) still wins over both.  Electron Configuration is deliberately not featured (owner decision:
 *  its animation needs work). */
export const FEATURE_WHEN_READY = false;

export const thumbnailPath = (id) => `/sim-thumbs/${id}.webp`;

// Live simulations: every id here has an engine in simulationEngineComponents.js.  `label` MUST equal the engine's own
// InteractiveFrame title (InteractiveFrame resolves "Open in New Tab" from it).
const LIVE = [
  { id: "electron-configuration", label: "Electron Configuration Explorer", topic: "Atomic structure", syllabus: ["S1.3"], resourceId: "electron-configuration-explorer",
    description: "Fill shells, sublevels and orbitals for any of the 118 elements, one electron at a time." },
  { id: "vsepr-explorer-3d", label: "VSEPR Explorer (3D)", topic: "Bonding", syllabus: ["S2.2"], resourceId: "vsepr-explorer-3d", featured: true, featuredOrder: 2,
    description: "Rotate 3D molecules and see how electron domains set shapes and bond angles." },
  { id: "explore-matter-and-states", label: "Explore Matter & States", topic: "States of matter & gases", syllabus: ["S1.1"], resourceId: "explore-matter-and-states",
    description: "A teacher-led walkthrough from mass and volume to solids, liquids, gases and their particles." },
  { id: "particle-model-visualizer", label: "Particle Model Visualizer", topic: "States of matter & gases", syllabus: ["S1.1"], resourceId: "particle-model-visualizer",
    description: "Compare particle arrangement, movement and attraction in solids, liquids and gases." },
  { id: "phase-change-heating-curve", label: "Phase Change & Heating Curve", topic: "States of matter & gases", syllabus: ["S1.1"], resourceId: "phase-change-heating-curve", featured: true, featuredOrder: 3,
    description: "Watch particles heat from solid to gas alongside the matching heating curve." },
  { id: "mixture-separation-explorer", label: "Mixture Separation Explorer", topic: "States of matter & gases", syllabus: ["S1.1", "S2.2"], resourceId: "mixture-separation-explorer",
    description: "Pick a mixture and a method, assemble the apparatus and watch filtration, distillation, chromatography and more separate it; then work out a multi-step separation yourself." },
  { id: "ph-calculator-visualizer", label: "pH Calculator & Visualizer", topic: "Acids & bases", syllabus: ["R3.1"], resourceId: "ph-calculator-visualizer",
    description: "Slide the concentration and read pH = -log[H3O+] on a labelled pH scale." },
  { id: "h-oh-balance", label: "H+ - OH- Balance in Water", topic: "Acids & bases", syllabus: ["R3.1"], resourceId: "h-oh-balance",
    description: "Add HCl and see [H+], [OH-] and pH move together in water at 25 °C." },
  { id: "neutralization-particle-visualizer", label: "Neutralization Particle Visualizer", topic: "Acids & bases", syllabus: ["R3.1"],
    description: "Watch H+ and OH- form water while the spectator ions look on." },
  { id: "equivalence-point", label: "Equivalence Point", topic: "Acids & bases", syllabus: ["R3.1"],
    description: "A beam-balance analogy for stoichiometric neutralization." },
  { id: "titration-ph-curve", label: "pH Curve & Titration Visualizer", topic: "Acids & bases", syllabus: ["R3.1"],
    description: "Build titration curves for strong and weak acid and base systems." },
  { id: "buffer-action-visualizer", label: "Buffer Action Visualizer", topic: "Acids & bases", syllabus: ["R3.1"], featured: true, featuredOrder: 6, featureWhenReady: true,
    description: "See why a buffer resists pH change and what happens when its capacity runs out." },
  { id: "chocolate-wrapping-rate", label: "Chocolate Wrapping — Understanding Rate", topic: "Kinetics", syllabus: ["R2.2"],
    description: "A real-life analogy for rate of reaction, before any particle chemistry." },
  { id: "collision-theory-visualizer", label: "Collision Theory Visualizer", topic: "Kinetics", syllabus: ["R2.2"], featured: true, featuredOrder: 5, featureWhenReady: true,
    description: "Collisions, activation energy, orientation and the Maxwell–Boltzmann distribution in one view." },
  { id: "build-an-atom", label: "Build an Atom", topic: "Atomic structure", syllabus: ["S1.2"], featured: true, featuredOrder: 1, featureWhenReady: true,
    description: "Add protons, neutrons and electrons to explore isotopes, ions and nuclear notation." },
  { id: "wave-explorer", label: "Wave Explorer", topic: "Atomic structure", syllabus: ["S1.3"],
    description: "Transverse and longitudinal waves, and how wavelength, frequency and photon energy relate." },
  { id: "orbital-explorer", label: "Orbital Explorer", topic: "Atomic structure", syllabus: ["S1.3"],
    description: "See atomic orbitals as probability distributions and build configurations from H to Ca." },
  { id: "atomic-spectra-lab", label: "Atomic Spectra Lab", topic: "Atomic structure", syllabus: ["S1.3"],
    description: "Link electron transitions, photon energy and wavelength to emission and absorption lines." },
  { id: "ionization-energy-explorer", label: "Ionization Energy Explorer", topic: "Atomic structure", syllabus: ["S1.3"],
    description: "Remove electrons one at a time and read the successive ionization energy graph." },
  { id: "ideal-gas-simulation", label: "Ideal Gas Simulation", topic: "States of matter & gases", syllabus: ["S1.5"],
    description: "Pressure, temperature, volume and amount of gas — ideal and real behaviour." },
  { id: "gas-laws-explorer", label: "Gas Laws Explorer", topic: "States of matter & gases", syllabus: ["S1.5"],
    description: "Investigate how pressure, volume, temperature and amount of gas are related." },
  { id: "bonding-visualizer", label: "Bonding Visualizer", topic: "Bonding", syllabus: ["S2.1", "S2.2", "S2.3"], featured: true, featuredOrder: 7, featureWhenReady: true,
    description: "Compare ionic, covalent and metallic bonding." },
  { id: "hybridisation-explorer", label: "Hybridisation Explorer (3D)", topic: "Bonding", syllabus: ["S2.2"], resourceId: "hybridisation-explorer", featured: true, featuredOrder: 4,
    description: "See sp, sp2 and sp3 hybrid orbitals form in 3D." },
  { id: "intermolecular-forces-visualiser", label: "Intermolecular Forces Visualiser", topic: "Bonding", syllabus: ["S2.2"], resourceId: "intermolecular-forces-visualiser",
    description: "Explore London, dipole–dipole and hydrogen-bond forces between molecules." },
  { id: "polarity-playground", label: "Polarity Playground", topic: "Bonding", syllabus: ["S2.2"], resourceId: "polarity-playground",
    description: "Pull electrons in a tug-of-war, look inside a covalent bond, rotate 3D molecules to see dipoles add or cancel, then test yourself." },
  { id: "mole-lab", label: "Mole Lab", topic: "Stoichiometry", syllabus: [],
    description: "Handle one-mole packets: count atoms from formulae, convert mass to moles, then concentration, gas volume and limiting reagents." },
  { id: "equilibrium-lab", label: "Equilibrium Lab — Dynamic Balance", topic: "Equilibrium", syllabus: ["R2.3"], resourceId: "equilibrium-lab",
    description: "Start with two cities and two buses, then watch five reversible reactions reach dynamic equilibrium and respond to changes in concentration, temperature, volume and catalyst, with rates, K and Q." },
  { id: "spectroscopy-studio", label: "Spectroscopy Simulation Lab", topic: "Spectroscopy", syllabus: ["S3.2"], featured: false,
    description: "Proton NMR, infrared and mass spectrometry step by step, plus a structure-investigation workspace." },
];

// Resource-registry ids that describe something a live simulation above already covers; they are not repeated as
// separate "coming soon" cards.
const COVERED_BY_LIVE = new Set([
  "ideal-gas-simulator", "molecular-geometry-explorer", "collision-theory-lab",
  "titration-lab", "spectroscopy-studio", "mass-spectrometer-simulator", "molecular-polarity-explorer", "equilibrium-simulator",
]);

const UPCOMING_TOPIC = {
  "atomic-structure-model": "Atomic structure",
  "mole-calculator": "Stoichiometry",
  "stoichiometry-equation-builder": "Stoichiometry",
  "ionic-lattice-builder": "Bonding",
  "lewis-structure-builder": "Bonding",
  "molecular-polarity-explorer": "Bonding",
  "metallic-bonding-model": "Bonding",
  "bonding-continuum-comparison-tool": "Bonding",
  "periodic-trends-explorer": "Periodicity",
  "organic-nomenclature-builder": "Organic chemistry",
  "energy-cycle-builder": "Energetics",
  "fuels-comparison-tool": "Energetics",
  "entropy-spontaneity-explorer": "Energetics",
  "equilibrium-simulator": "Equilibrium",
  "acid-base-explorer": "Acids & bases",
  "redox-electrochemistry-explorer": "Redox",
  "mechanism-builder": "Organic chemistry",
};

function liveEntry(e) {
  return Object.freeze({
    id: e.id, label: e.label, description: e.description, subject: "chemistry", topic: e.topic,
    syllabus: Object.freeze([...(e.syllabus || [])]),
    curriculum: Object.freeze([...(e.curriculum ?? LIVE_SIMULATION_CURRICULA)]),
    status: SIM_STATUS.LIVE, tier: TIERS.FREE, featured: Boolean(e.featured) && (!e.featureWhenReady || FEATURE_WHEN_READY), featuredOrder: e.featuredOrder ?? 99,
    thumbnail: thumbnailPath(e.id), resourceId: e.resourceId ?? null,
  });
}

function upcomingEntries() {
  return getAllResources()
    .filter((r) => r.status !== "live" && !COVERED_BY_LIVE.has(r.id))
    .map((r) => Object.freeze({
      id: r.id, label: r.title, description: r.description, subject: "chemistry",
      topic: UPCOMING_TOPIC[r.id] ?? "Other", syllabus: Object.freeze([]), curriculum: Object.freeze([]),
      status: r.status === "in-development" ? SIM_STATUS.IN_DEVELOPMENT : SIM_STATUS.PLANNED,
      tier: TIERS.FREE, featured: false, featuredOrder: 99, thumbnail: null, resourceId: r.id,
    }));
}

/** Every simulation, live first (in the registry's historical order), then coming-soon items. */
export const SIMULATION_CATALOGUE = Object.freeze([...LIVE.map(liveEntry), ...upcomingEntries()]);

export const CATALOGUE_BY_ID = Object.freeze(Object.fromEntries(SIMULATION_CATALOGUE.map((e) => [e.id, e])));
export const getCatalogueEntry = (id) => CATALOGUE_BY_ID[id] ?? null;
export const isLive = (entry) => entry?.status === SIM_STATUS.LIVE;
export const getLiveSimulations = () => SIMULATION_CATALOGUE.filter(isLive);
export const getFeaturedSimulations = (entries = SIMULATION_CATALOGUE) =>
  entries.filter((e) => e.featured && isLive(e)).sort((a, b) => a.featuredOrder - b.featuredOrder);

/** Merge per-simulation overrides ({ [simId]: { tier?, featured? } }, from the optional `simulation_access` table) over the
 *  catalogue defaults.  Unknown ids and invalid tiers are ignored; with no overrides the catalogue is returned as is. */
export function applyAccessOverrides(entries = SIMULATION_CATALOGUE, overrides = null) {
  if (!overrides || typeof overrides !== "object") return entries;
  return entries.map((e) => {
    const o = overrides[e.id];
    if (!o) return e;
    const next = { ...e };
    if (Object.values(TIERS).includes(o.tier)) next.tier = o.tier;
    if (typeof o.featured === "boolean") next.featured = o.featured;
    return Object.freeze(next);
  });
}

/** Text the library search matches against: name, description, topic and syllabus codes. */
export function searchText(entry) {
  return [entry.label, entry.description, entry.topic, ...(entry.syllabus || [])].join(" \u0001 ").toLowerCase();
}
