// The example tray for the opening "What is Matter?" scene. Each matter
// example declares which mass/volume test apparatus fits it (regular solid,
// irregular solid, liquid, gas) so MassTest/VolumeTest can pick the right
// demonstration without hardcoding per-material logic elsewhere. Values are
// explicitly illustrative, not measured data.

export const MATTER_EXAMPLES = [
  { id: "rock", label: "Rock", stateHint: "solid", volumeMethod: "irregular-solid",
    mass: { before: "0.0 g", after: "58.4 g" },
    volume: { before: 50, after: 68, unit: "mL" } },
  { id: "iron-nail", label: "Iron nail", stateHint: "solid", volumeMethod: "regular-solid",
    mass: { before: "0.0 g", after: "14.2 g" },
    volume: { l: 6, w: 1, h: 1, unit: "cm" } },
  { id: "ice", label: "Ice cube", stateHint: "solid", volumeMethod: "regular-solid",
    mass: { before: "0.0 g", after: "27.0 g" },
    volume: { l: 3, w: 3, h: 3, unit: "cm" } },
  { id: "salt", label: "Salt", stateHint: "solid", volumeMethod: "irregular-solid",
    mass: { before: "0.0 g", after: "12.6 g" },
    volume: { before: 50, after: 55, unit: "mL" } },
  { id: "copper", label: "Copper", stateHint: "solid", volumeMethod: "regular-solid",
    mass: { before: "0.0 g", after: "44.8 g" },
    volume: { l: 2, w: 2, h: 2, unit: "cm" } },
  { id: "water", label: "Water", stateHint: "liquid", volumeMethod: "liquid",
    mass: { before: "Empty beaker: 42.0 g", after: "Beaker + water: 92.0 g" },
    volume: { amount: 50, unit: "mL" } },
  { id: "ethanol", label: "Ethanol", stateHint: "liquid", volumeMethod: "liquid",
    mass: { before: "Empty beaker: 38.5 g", after: "Beaker + ethanol: 78.1 g" },
    volume: { amount: 50, unit: "mL" } },
  { id: "air", label: "Air", stateHint: "gas", volumeMethod: "gas",
    mass: { before: "Deflated balloon: 2.4 g", after: "Inflated balloon: 2.7 g" },
    volume: { amount: 60, unit: "mL" } },
  { id: "oxygen", label: "Oxygen", stateHint: "gas", volumeMethod: "gas",
    mass: { before: "Deflated balloon: 2.4 g", after: "Inflated balloon: 2.8 g" },
    volume: { amount: 60, unit: "mL" } },
  { id: "carbon-dioxide", label: "Carbon dioxide", stateHint: "gas", volumeMethod: "gas",
    mass: { before: "Deflated balloon: 2.4 g", after: "Inflated balloon: 3.0 g" },
    volume: { amount: 60, unit: "mL" } },
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
