// Species colours (all >= 3:1 against the white vessel and against each other's letters), shared by canvas and SVG.
export const SPECIES = [
  { id: "A", name: "A (reactant)", color: "#2b5fd0", ink: "#ffffff" },
  { id: "B", name: "B (reactant)", color: "#c2410c", ink: "#ffffff" },
  { id: "C", name: "C (product)", color: "#15803d", ink: "#ffffff" },
  { id: "D", name: "D (product)", color: "#7c3aed", ink: "#ffffff" },
];
export const SITE_COLOR = "#fde047"; // reactive-site patch
export const ENERGETIC = "#b45309"; // ring: kinetic energy >= Ea
export const TEXT = "#1e2a44";
export const MUTED = "#4a5a82";
export const CURVE = "#2b5fd0";
export const SHADE = "#c2410c";
export const OUTCOME_COLOR = ["#15803d", "#b45309", "#7c3aed", "#b91c1c"]; // success, low energy, orientation, both
