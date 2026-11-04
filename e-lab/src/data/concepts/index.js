// Aggregates every chemistry concept across all domains into one flat registry.
// This is the single source of truth for Layer 1 (curriculum-independent concepts).

import particulateNatureOfMatterConcepts from "./chemistry/particulate-nature-of-matter.js";
import atomicStructureConcepts from "./chemistry/atomic-structure.js";
import electronConfigurationConcepts from "./chemistry/electron-configuration.js";
import stoichiometryConcepts from "./chemistry/stoichiometry.js";
import gasesConcepts from "./chemistry/gases.js";
import ionicBondingConcepts from "./chemistry/ionic-bonding.js";
import covalentBondingConcepts from "./chemistry/covalent-bonding.js";
import metallicBondingConcepts from "./chemistry/metallic-bonding.js";
import materialsConcepts from "./chemistry/materials.js";
import periodicityConcepts from "./chemistry/periodicity.js";
import organicChemistryConcepts from "./chemistry/organic-chemistry.js";
import energeticsConcepts from "./chemistry/energetics.js";
import kineticsConcepts from "./chemistry/kinetics.js";
import equilibriumConcepts from "./chemistry/equilibrium.js";
import acidsAndBasesConcepts from "./chemistry/acids-and-bases.js";
import redoxConcepts from "./chemistry/redox.js";
import reactionMechanismsConcepts from "./chemistry/reaction-mechanisms.js";

const allChemistryConcepts = [
  ...particulateNatureOfMatterConcepts,
  ...atomicStructureConcepts,
  ...electronConfigurationConcepts,
  ...stoichiometryConcepts,
  ...gasesConcepts,
  ...ionicBondingConcepts,
  ...covalentBondingConcepts,
  ...metallicBondingConcepts,
  ...materialsConcepts,
  ...periodicityConcepts,
  ...organicChemistryConcepts,
  ...energeticsConcepts,
  ...kineticsConcepts,
  ...equilibriumConcepts,
  ...acidsAndBasesConcepts,
  ...redoxConcepts,
  ...reactionMechanismsConcepts,
];

export const conceptsById = Object.fromEntries(allChemistryConcepts.map((c) => [c.id, c]));

export function getConcept(id) {
  return conceptsById[id] ?? null;
}

export function getAllConcepts() {
  return allChemistryConcepts;
}

export function getConceptsByDomain(domain) {
  return allChemistryConcepts.filter((c) => c.domain === domain);
}

export function getAllDomains() {
  return [...new Set(allChemistryConcepts.map((c) => c.domain))];
}

export default allChemistryConcepts;
