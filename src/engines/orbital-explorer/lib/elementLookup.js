// Thin wrapper over the project's existing, authoritative element
// dataset (src/data/chemistry/elements.js) -- not duplicated here,
// matching the same convention already used in build-an-atom.
import elements from "../../../data/chemistry/elements.js";

const FIRST_36 = elements.filter((e) => e.atomicNumber <= 36); // OE-06: Atom View now covers the whole IB range, Z = 1-36
const byZ = new Map(FIRST_36.map((e) => [e.atomicNumber, e]));

export function elementByAtomicNumber(z) {
  return byZ.get(z) ?? null;
}

export { FIRST_36 as first36Elements };
