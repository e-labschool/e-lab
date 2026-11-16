// Elements offered by the VSEPR Explorer toolbox. Pure data (no React / three).
// `valence` = valence electrons of the neutral atom, `period` decides whether an expanded octet is possible
// (period 3+), `r` is a visual radius (scene units), `color` the CPK-like display colour.
import { ELEMENT_STYLE } from "../../shared-3d/elementStyle.js";
const BASE = {
  H: ["Hydrogen", 1, 1, 1], C: ["Carbon", 6, 4, 2], N: ["Nitrogen", 7, 5, 2], O: ["Oxygen", 8, 6, 2], F: ["Fluorine", 9, 7, 2],
  Cl: ["Chlorine", 17, 7, 3], B: ["Boron", 5, 3, 2], Be: ["Beryllium", 4, 2, 2], S: ["Sulfur", 16, 6, 3], P: ["Phosphorus", 15, 5, 3],
  Si: ["Silicon", 14, 4, 3], Br: ["Bromine", 35, 7, 4], I: ["Iodine", 53, 7, 5], Xe: ["Xenon", 54, 8, 5],
};
// colour / text / radius come from the ONE shared table (src/engines/shared-3d/elementStyle.js)
export const ELEMENTS = Object.fromEntries(Object.entries(BASE).map(([symbol, [name, Z, valence, period]]) => {
  const st = ELEMENT_STYLE[symbol];
  return [symbol, { symbol, name, Z, valence, period, color: st.color, text: st.text, r: st.r }];
}));

/** Toolbox order (matches the spec: H, C, N, O, F, Cl, B, Be, S, P, Si, Br, I, Xe). */
export const TOOLBOX_ATOMS = ["H", "C", "N", "O", "F", "Cl", "B", "Be", "S", "P", "Si", "Br", "I", "Xe"];

export const getElement = (symbol) => ELEMENTS[symbol] ?? null;

/** Maximum bond order an atom can sensibly show as a TERMINAL (surrounding) atom. Used only for Lewis warnings. */
export const MAX_TERMINAL_ORDER = { H: 1, F: 1, Cl: 1, Br: 1, I: 1, O: 2, S: 2, N: 3, C: 3 };
