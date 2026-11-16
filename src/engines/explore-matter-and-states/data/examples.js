// The example tray for the opening "What is Matter?" scene. Each matter
// example declares which mass/volume test apparatus fits it (regular solid,
// irregular solid, liquid, gas) so MassTest/VolumeTest can pick the right
// demonstration without hardcoding per-material logic elsewhere. Values are
// explicitly illustrative, not measured data.

// Mass and volume are CALCULATED from typical room-temperature densities (m = rho x V) so every sample is self-consistent:
// rock (granite) 2.7 g/cm3, iron 7.87, ice 0.917, rock salt 2.16, copper 8.96, water 0.997, ethanol 0.789 g/cm3,
// air 1.20, oxygen 1.43, carbon dioxide 1.98 g/dm3 (g/L). Rounded for display; they are typical values, not measurements.
// Rock salt is used as a solid BLOCK (measured with a ruler) because ordinary salt would dissolve in a displacement test.
const g = (x, d = 1) => `${x.toFixed(d)} g`;
const DENSITY = { rock: 2.7, "iron-nail": 7.87, ice: 0.917, salt: 2.16, copper: 8.96, water: 0.997, ethanol: 0.789 }; // g/cm3
const GAS_DENSITY = { air: 1.2, oxygen: 1.43, "carbon-dioxide": 1.98 }; // g/dm3 = mg/cm3
const BALLOON = 2.4; // g, empty balloon
const box = (id, label, l, w, h, hint = "solid") => ({
  id, label, stateHint: hint, volumeMethod: "regular-solid",
  mass: { before: "0.0 g", after: g(DENSITY[id] * l * w * h) },
  volume: { l, w, h, unit: "cm" }, density: DENSITY[id],
});
const liquid = (id, label, mL, beaker) => ({
  id, label, stateHint: "liquid", volumeMethod: "liquid",
  mass: { before: `Empty beaker: ${g(beaker)}`, after: `Beaker + ${label.toLowerCase()}: ${g(beaker + DENSITY[id] * mL)}` },
  volume: { amount: mL, unit: "mL" }, density: DENSITY[id],
});
const gas = (id, label, mL) => ({
  id, label, stateHint: "gas", volumeMethod: "gas",
  mass: { before: `Deflated balloon: ${g(BALLOON, 2)}`, after: `Inflated balloon: ${g(BALLOON + (GAS_DENSITY[id] * mL) / 1000, 2)}` },
  volume: { amount: mL, unit: "mL" }, density: GAS_DENSITY[id] / 1000,
});

export const MATTER_EXAMPLES = [
  { id: "rock", label: "Rock", stateHint: "solid", volumeMethod: "irregular-solid",
    mass: { before: "0.0 g", after: g(DENSITY.rock * 18) },
    volume: { before: 50, after: 68, unit: "mL" }, density: DENSITY.rock },
  box("iron-nail", "Iron nail", 5, 0.5, 0.5),
  box("ice", "Ice cube", 3, 3, 3),
  box("salt", "Rock salt", 2, 2, 2),
  box("copper", "Copper", 2, 2, 2),
  liquid("water", "Water", 50, 42.0),
  liquid("ethanol", "Ethanol", 50, 38.5),
  gas("air", "Air", 60),
  gas("oxygen", "Oxygen", 60),
  gas("carbon-dioxide", "Carbon dioxide", 60),
];

export const NON_MATTER_EXAMPLES = [
  {
    id: "light",
    label: "Light",
    objectLabel: "Lamp",
    phenomenonLabel: "Light emitted",
    phenomenonNote: "energy transfer / electromagnetic radiation",
  },
  {
    id: "sound",
    label: "Sound",
    objectLabel: "Speaker",
    phenomenonLabel: "Sound wave",
    phenomenonNote: "energy transfer through oscillating air particles",
  },
  {
    id: "heat",
    label: "Heat",
    objectLabel: "Warm object",
    phenomenonLabel: "Thermal energy transfer",
    phenomenonNote: "energy transfer, not a material substance",
  },
  {
    id: "shadow",
    label: "Shadow",
    objectLabel: "Object blocking light",
    phenomenonLabel: "Shadow region",
    phenomenonNote: "an absence of light, not a substance",
  },
];

export function getRandomMatterExample(excludeId) {
  const pool = MATTER_EXAMPLES.filter((e) => e.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}
