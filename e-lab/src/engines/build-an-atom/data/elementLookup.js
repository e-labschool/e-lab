// Thin wrapper around the project's existing, authoritative element
// dataset (src/data/chemistry/elements.js, all 118 elements) -- this
// file is NOT duplicated here, only looked up by atomic number.
import elements from "../../../data/chemistry/elements.js";

const byAtomicNumber = new Map(elements.map((e) => [e.atomicNumber, e]));

export function elementByAtomicNumber(z) {
  return byAtomicNumber.get(z) ?? null;
}

export { elements as allElements };
