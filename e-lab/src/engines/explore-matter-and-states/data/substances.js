// Named-substance options for the particle scenes (section 20 of the brief).
// `unit` describes what one rendered particle actually represents, so the
// canvas layer never has to guess — e.g. NaCl(s) renders as an ionic
// lattice of alternating ions, never as a "NaCl molecule".

export const SOLID_SUBSTANCES = [
  { id: "generic-solid", label: "Generic particles", unit: "particle" },
  { id: "ice", label: "Ice", unit: "molecule", formula: "H2O" },
  { id: "nacl", label: "Sodium chloride", unit: "ionic-lattice", formula: "NaCl" },
  { id: "copper", label: "Copper", unit: "metallic", formula: "Cu" },
  { id: "iodine", label: "Iodine", unit: "molecule", formula: "I2" },
];

export const LIQUID_SUBSTANCES = [
  { id: "generic-liquid", label: "Generic particles", unit: "particle" },
  { id: "water", label: "Water", unit: "molecule", formula: "H2O" },
  { id: "ethanol", label: "Ethanol", unit: "molecule", formula: "C2H5OH" },
  { id: "bromine", label: "Bromine", unit: "molecule", formula: "Br2" },
];

export const GAS_SUBSTANCES = [
  { id: "generic-gas", label: "Generic particles", unit: "particle" },
  { id: "helium", label: "Helium", unit: "atom", formula: "He" },
  { id: "oxygen", label: "Oxygen", unit: "diatomic", formula: "O2" },
  { id: "nitrogen", label: "Nitrogen", unit: "diatomic", formula: "N2" },
  { id: "carbon-dioxide", label: "Carbon dioxide", unit: "linear-triatomic", formula: "CO2" },
];

export function substancesForState(state) {
  if (state === "solid") return SOLID_SUBSTANCES;
  if (state === "liquid") return LIQUID_SUBSTANCES;
  return GAS_SUBSTANCES;
}
