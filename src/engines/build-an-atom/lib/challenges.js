// Curated "Build This Atom / Ion" tasks -- each has an explicit target
// {protons, neutrons, electrons} (not just a pass/fail predicate) so
// the Check button can report PER-PARTICLE-TYPE feedback (protons
// correct, neutrons wrong, etc), not just an overall yes/no. Targets
// are all scientifically sensible real nuclides/ions, never
// arbitrarily-generated proton/neutron/electron combinations.
//
// No persistence, no scoring, no connection to the project's formal
// Assess/Challenge system -- this is a local, lightweight practice
// loop, deliberately kept separate.
export const CHALLENGES = [
  { label: "Carbon-12", protons: 6, neutrons: 6, electrons: 6, prompt: "Build Carbon-12.", info: "full" },
  { label: "Carbon-14", protons: 6, neutrons: 8, electrons: 6, prompt: "Build Carbon-14.", info: "full" },
  { label: "Oxygen-18", protons: 8, neutrons: 10, electrons: 8, prompt: "Build Oxygen-18.", info: "full" },
  { label: "Na\u207A", protons: 11, neutrons: 12, electrons: 10, prompt: "Build \u00B2\u00B3\u2081\u2081Na\u207A.", info: "notation" },
  { label: "Mg\u00B2\u207A", protons: 12, neutrons: 12, electrons: 10, prompt: "Build Magnesium-24, Mg\u00B2\u207A.", info: "full" },
  { label: "Cl\u207B", protons: 17, neutrons: 18, electrons: 18, prompt: "Build a species with Z = 17, A = 35, charge = \u22121.", info: "deduce" },
  { label: "K\u207A", protons: 19, neutrons: 20, electrons: 18, prompt: "Build Potassium-39, K\u207A.", info: "full" },
  { label: "Ca\u00B2\u207A", protons: 20, neutrons: 20, electrons: 18, prompt: "Build Calcium-40, Ca\u00B2\u207A.", info: "full" },
];

/** Per-particle-type comparison against a challenge's target -- used
 * for the Check button's detailed feedback, always computed fresh from
 * the current atom state, never a stored/cached result. */
export function checkChallenge(challenge, atom) {
  const protonsCorrect = atom.protons === challenge.protons;
  const neutronsCorrect = atom.neutrons === challenge.neutrons;
  const electronsCorrect = atom.electrons === challenge.electrons;
  return {
    correct: protonsCorrect && neutronsCorrect && electronsCorrect,
    protonsCorrect,
    neutronsCorrect,
    electronsCorrect,
  };
}

/** Picks a random challenge different from the current one where
 * possible (avoids immediately repeating the same task). */
export function pickNextChallenge(currentIndex) {
  if (CHALLENGES.length <= 1) return 0;
  let next = Math.floor(Math.random() * CHALLENGES.length);
  while (next === currentIndex) next = Math.floor(Math.random() * CHALLENGES.length);
  return next;
}
