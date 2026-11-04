// Elements offered by the VSEPR Explorer toolbox. Pure data (no React / three).
// `valence` = valence electrons of the neutral atom, `period` decides whether an expanded octet is possible
// (period 3+), `r` is a visual radius (scene units), `color` the CPK-like display colour.
export const ELEMENTS = {
  H: { symbol: "H", name: "Hydrogen", Z: 1, valence: 1, period: 1, color: "#f2f4f8", text: "#1e2a44", r: 0.3 },
  C: { symbol: "C", name: "Carbon", Z: 6, valence: 4, period: 2, color: "#4b505c", text: "#ffffff", r: 0.42 },
  N: { symbol: "N", name: "Nitrogen", Z: 7, valence: 5, period: 2, color: "#2858d8", text: "#ffffff", r: 0.42 },
  O: { symbol: "O", name: "Oxygen", Z: 8, valence: 6, period: 2, color: "#e2392f", text: "#ffffff", r: 0.41 },
  F: { symbol: "F", name: "Fluorine", Z: 9, valence: 7, period: 2, color: "#4cb84a", text: "#ffffff", r: 0.38 },
  Cl: { symbol: "Cl", name: "Chlorine", Z: 17, valence: 7, period: 3, color: "#2f9d57", text: "#ffffff", r: 0.5 },
  B: { symbol: "B", name: "Boron", Z: 5, valence: 3, period: 2, color: "#e58fb2", text: "#3a1730", r: 0.4 },
  Be: { symbol: "Be", name: "Beryllium", Z: 4, valence: 2, period: 2, color: "#8bd17f", text: "#143016", r: 0.42 },
  S: { symbol: "S", name: "Sulfur", Z: 16, valence: 6, period: 3, color: "#f0c52f", text: "#3d2f00", r: 0.5 },
  P: { symbol: "P", name: "Phosphorus", Z: 15, valence: 5, period: 3, color: "#f08a24", text: "#3d1f00", r: 0.5 },
  Si: { symbol: "Si", name: "Silicon", Z: 14, valence: 4, period: 3, color: "#c9ccd6", text: "#1e2a44", r: 0.5 },
  Br: { symbol: "Br", name: "Bromine", Z: 35, valence: 7, period: 4, color: "#a5452f", text: "#ffffff", r: 0.55 },
  I: { symbol: "I", name: "Iodine", Z: 53, valence: 7, period: 5, color: "#7b45b8", text: "#ffffff", r: 0.6 },
  Xe: { symbol: "Xe", name: "Xenon", Z: 54, valence: 8, period: 5, color: "#43aebf", text: "#05303a", r: 0.6 },
};

/** Toolbox order (matches the spec: H, C, N, O, F, Cl, B, Be, S, P, Si, Br, I, Xe). */
export const TOOLBOX_ATOMS = ["H", "C", "N", "O", "F", "Cl", "B", "Be", "S", "P", "Si", "Br", "I", "Xe"];

export const getElement = (symbol) => ELEMENTS[symbol] ?? null;

/** Maximum bond order an atom can sensibly show as a TERMINAL (surrounding) atom. Used only for Lewis warnings. */
export const MAX_TERMINAL_ORDER = { H: 1, F: 1, Cl: 1, Br: 1, I: 1, O: 2, S: 2, N: 3, C: 3 };
