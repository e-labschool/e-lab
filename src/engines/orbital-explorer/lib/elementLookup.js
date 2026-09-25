// Thin wrapper over the project's existing, authoritative element
// dataset (src/data/chemistry/elements.js) -- not duplicated here,
// matching the same convention already used in build-an-atom.
import elements from "../../../data/chemistry/elements.js";

const FIRST_20 = elements.filter((e) => e.atomicNumber <= 20);
const byZ = new Map(FIRST_20.map((e) => [e.atomicNumber, e]));

export function elementByAtomicNumber(z) {
  return byZ.get(z) ?? null;
}

export { FIRST_20 as first20Elements };
