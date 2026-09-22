// Local, lightweight challenge tasks -- no persistence, no scoring, no
// connection to the project's formal Assess/Challenge system (that
// system is for teacher-authored, graded assessment content; this is
// an in-simulation practice loop, deliberately kept separate and
// simple). Each task has a `check(derived)` predicate and an
// `explain(derived)` function that describes WHY the built atom
// satisfies it, generated from the actual derived state, not a fixed
// string.
export const CHALLENGES = [
  {
    prompt: "Build Carbon-14.",
    check: (d) => d.element?.symbol === "C" && d.massNumber === 14 && d.netCharge === 0,
    explain: (d) => `${d.protons} protons \u2192 Carbon. ${d.neutrons} neutrons \u2192 mass number ${d.massNumber}. Neutral (${d.protons}p = ${d.electrons}e).`,
  },
  {
    prompt: "Build Oxygen-18.",
    check: (d) => d.element?.symbol === "O" && d.massNumber === 18 && d.netCharge === 0,
    explain: (d) => `${d.protons} protons \u2192 Oxygen. ${d.neutrons} neutrons \u2192 mass number ${d.massNumber}. Neutral (${d.protons}p = ${d.electrons}e).`,
  },
  {
    prompt: "Build Na\u207A (a sodium cation with charge +1).",
    check: (d) => d.element?.symbol === "Na" && d.netCharge === 1,
    explain: (d) => `${d.protons} protons \u2192 Sodium. ${d.neutrons} neutrons \u2192 mass number ${d.massNumber}. ${d.electrons} electrons \u2192 charge +1.`,
  },
  {
    prompt: "Build Cl\u207B (a chloride anion with charge \u22121).",
    check: (d) => d.element?.symbol === "Cl" && d.netCharge === -1,
    explain: (d) => `${d.protons} protons \u2192 Chlorine. ${d.neutrons} neutrons \u2192 mass number ${d.massNumber}. ${d.electrons} electrons \u2192 charge \u22121.`,
  },
  {
    prompt: "Build an atom with Z = 8 and A = 18.",
    check: (d) => d.atomicNumber === 8 && d.massNumber === 18,
    explain: (d) => `${d.protons} protons \u2192 Z = 8 (${d.element?.name}). ${d.neutrons} neutrons \u2192 A = ${d.massNumber}.`,
  },
  {
    prompt: "Build an isotope of carbon that is different from Carbon-12.",
    check: (d) => d.element?.symbol === "C" && d.massNumber !== 12,
    explain: (d) => `Still 6 protons \u2192 Carbon. ${d.neutrons} neutrons gives mass number ${d.massNumber}, different from Carbon-12.`,
  },
  {
    prompt: "Build a species with a \u22121 charge.",
    check: (d) => d.netCharge === -1,
    explain: (d) => `${d.protons} protons and ${d.electrons} electrons \u2192 net charge \u22121, an anion.`,
  },
];
