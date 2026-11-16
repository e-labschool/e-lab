// Pure rules for the three particle controls and the optional "Auto-balance particles" mode (no React/DOM).
// Unit-tested by scripts/test-build-atom-controls.mjs.
//
// THE CONTRACT
//  * Auto-balance OFF (default): + / - changes ONLY that count by exactly 1 ... unless the result could not
//    exist. Then the press is REFUSED with an explained reason (tryChange().reason, shown to the student in a
//    live message, never a silent grey button). What cannot exist is decided by the shared data layer:
//      neutrons  - only known isotopes (NUBASE2020): no hydrogen-61, no helium-2.
//      electrons - an electron press may not move the charge FURTHER outside the charges seen in chemistry
//                  (src/lib/atomic/ions.js): no Kr4-, no Na-, no Na2+. Proton changes never touch electrons.
//      neutrons/electrons need at least one proton ("no atom yet").
//  * Changing the proton count (+/- or the periodic table) can leave the neutron count impossible for the NEW
//    element (He-2 does not exist). It is moved to the nearest known isotope and reported in `notes` (visible, never silent).
//    The electron count is never changed by a proton press (so C-12 + proton = N+ is shown, with an ion check).
//  * Auto-balance ON: electrons = protons; neutrons = reference isotope (most abundant natural isotope).
//    Electron and neutron controls are locked.
import { neutronRange, clampNeutrons, stepNeutrons, referenceIsotope as sharedReference, classifyNuclide, formatHalfLife } from "../../../lib/atomic/nuclides.js";
import { chargeLimits, chargeRefusal } from "../../../lib/atomic/ions.js";
import { elementByAtomicNumber } from "../data/elementLookup.js";

export const LIMITS = { protons: 36, neutrons: 64, electrons: 40 };
export const MIN_COUNT = 0;
export const PARTICLE_KEY = { proton: "protons", neutron: "neutrons", electron: "electrons" };

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const toSuperscript = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");

export function clampCount(type, value) {
  const key = PARTICLE_KEY[type];
  return Math.max(MIN_COUNT, Math.min(LIMITS[key], value));
}

const nameOf = (z) => (elementByAtomicNumber(z)?.name ?? "this element").toLowerCase();
const Name = (z) => elementByAtomicNumber(z)?.name ?? "this element";

/** The reference isotope: most abundant natural isotope (longest-lived if none is natural). */
export function referenceIsotope(protons) {
  if (!protons || protons < 1 || protons > 118) return null;
  const ref = sharedReference(protons);
  if (!ref) return null;
  const el = elementByAtomicNumber(protons);
  return {
    protons, neutrons: ref.neutrons, massNumber: ref.massNumber, symbol: el.symbol,
    name: `${el.name.toLowerCase()}-${ref.massNumber}`, notation: `${toSuperscript(ref.massNumber)}${el.symbol}`,
    natural: ref.abundance > 0,
  };
}

/** Allowed electron window for z protons: [min, max]. */
export function electronWindow(z) {
  const { minCharge, maxCharge } = chargeLimits(z);
  return { min: Math.max(0, z - maxCharge), max: z - minCharge };
}

/** Atom after balancing: electrons = protons; neutrons = reference. */
export function balance(atom) {
  const ref = referenceIsotope(atom.protons);
  return { protons: atom.protons, neutrons: ref ? ref.neutrons : atom.neutrons, electrons: atom.protons };
}

/** Why the current charge is not a real monatomic ion (or null when it is fine / the species is neutral). */
export function ionCheck(protons, electrons) {
  if (protons < 1) return null;
  return chargeRefusal(protons, protons - electrons);
}

export function isLocked(type, atom, autoBalance) {
  if (!autoBalance) return false;
  if (type === "electron") return true;
  if (type === "neutron") return referenceIsotope(atom.protons) !== null;
  return false;
}

/** After the proton count changed: bring neutrons / electrons into the allowed range for the new element. */
function normalise(atom) {
  const notes = [];
  const z = atom.protons;
  if (z < 1) return { atom, notes };
  let { neutrons } = atom;
  const range = neutronRange(z);
  if (range) {
    const fixed = clampNeutrons(z, neutrons);
    if (fixed !== neutrons) {
      notes.push(`${Name(z)}-${z + neutrons} has never been observed (known ${nameOf(z)} isotopes: ${range.minA} to ${range.maxA}), so the neutron count moved from ${neutrons} to ${fixed}.`);
      neutrons = fixed;
    }
  }
  return { atom: neutrons === atom.neutrons ? atom : { ...atom, neutrons }, notes };
}

/** One +/- press. Returns { atom, refused, reason, notes }. `atom` is the SAME object when nothing changes. */
export function tryChange(atom, type, delta, { autoBalance = false } = {}) {
  const key = PARTICLE_KEY[type];
  if (!key) return { atom, refused: false, reason: null, notes: [] };
  if (isLocked(type, atom, autoBalance)) {
    return { atom, refused: true, reason: `${type === "electron" ? "Electrons" : "Neutrons"} are set automatically while Auto-balance is on. Untick Auto-balance to change them yourself.`, notes: [] };
  }
  const z = atom.protons;
  const refuse = (reason) => ({ atom, refused: true, reason, notes: [] });
  if (type === "proton") {
    if (delta > 0 && z >= LIMITS.protons) return refuse(`This simulation builds elements up to krypton (Z = ${LIMITS.protons}), the range of the IB course.`);
    if (delta < 0 && z <= 0) return refuse("There are no protons to remove.");
    if (delta < 0 && z === 1 && (atom.neutrons > 0 || atom.electrons > 0)) return refuse("Remove the neutrons and electrons first: a nucleus needs at least one proton to be an atom of any element.");
    let next = { ...atom, protons: z + delta };
    if (autoBalance) next = balance(next);
    const n = normalise(next);
    return { atom: n.atom, refused: false, reason: null, notes: n.notes };
  }
  if (z < 1) return refuse(`Add a proton first: ${type === "neutron" ? "neutrons without protons do not form an atom" : "electrons need a nucleus with at least one proton to be bound to"}.`);
  if (type === "neutron") {
    const r = stepNeutrons(z, atom.neutrons, delta, nameOf(z));
    if (r.refused) return refuse(r.reason);
    if (r.neutrons === atom.neutrons) return { atom, refused: false, reason: null, notes: [] };
    return { atom: { ...atom, neutrons: r.neutrons }, refused: false, reason: null, notes: [] };
  }
  // electron
  const e = atom.electrons + delta;
  if (e < 0) return refuse("There are no electrons to remove.");
  // Refuse only a step that moves the charge FURTHER outside the physically sensible window; a step back toward it is always allowed
  // (building protons first, e.g. nitrogen with 6 electrons = N+, is a legitimate intermediate state).
  const win = chargeLimits(z);
  const dist = (c) => Math.max(0, win.minCharge - c, c - win.maxCharge);
  const reason = chargeRefusal(z, z - e);
  if (reason && dist(z - e) >= dist(z - atom.electrons)) return refuse(reason);
  return { atom: { ...atom, electrons: e }, refused: false, reason: null, notes: [] };
}

export function applyChange(atom, type, delta, opts) {
  return tryChange(atom, type, delta, opts).atom;
}

/** Periodic table selection: sets protons. Returns { atom, notes }. */
export function trySetProtons(atom, protons, { autoBalance = false } = {}) {
  const z = clampCount("proton", protons);
  if (z === atom.protons) return { atom, notes: [] };
  let next = { ...atom, protons: z };
  if (autoBalance) next = balance(next);
  return normalise(next);
}
export function setProtons(atom, protons, opts) {
  return trySetProtons(atom, protons, opts).atom;
}

export function toggleAutoBalance(atom, on) {
  return on && atom.protons >= 1 ? balance(atom) : atom;
}

export function isotopeIdentity(protons, neutrons) {
  const el = protons > 0 ? elementByAtomicNumber(protons) : null;
  if (!el) return null;
  const massNumber = protons + neutrons;
  const ref = referenceIsotope(protons);
  return {
    element: el, massNumber, name: `${el.name.toLowerCase()}-${massNumber}`, notation: `${toSuperscript(massNumber)}${el.symbol}`,
    isReference: ref ? ref.neutrons === neutrons : false, reference: ref,
  };
}

/** What to tell the student about a (Z, N) combination.
 * status: "reference" | "stable" | "radioactive" | "unbound" | "unknown" | "no-data" */
export function nuclideStatus(protons, neutrons) {
  if (protons === 0) return { status: "no-data", label: "No nucleus yet", detail: "" };
  const c = classifyNuclide(protons, neutrons);
  const ref = referenceIsotope(protons);
  switch (c.status) {
    case "stable":
      return ref && ref.neutrons === neutrons
        ? { status: "reference", label: "Stable nuclide", detail: "Most abundant isotope of this element (reference isotope)." }
        : { status: "stable", label: "Stable nuclide", detail: "A stable isotope, but not the most abundant one." };
    case "radioactive":
      return { status: "radioactive", label: "Radioactive nuclide", detail: `Not stable: it decays. Half-life ${formatHalfLife(c.halfLifeSeconds)}.` };
    case "unbound":
      return { status: "unbound", label: "Not stable: fleeting", detail: "Only ever seen as an extremely short-lived resonance." };
    case "unobserved":
    case "out-of-range":
      return { status: "unknown", label: "No known isotope", detail: "This combination of protons and neutrons has never been observed." };
    default:
      return { status: "no-data", label: "No isotope data", detail: "" };
  }
}
