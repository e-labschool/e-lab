// ONE visual convention per element for every stage (colour, finish, drawn-size factor).  Drawn size is a design convention only:
// it never says anything about molar mass (Ca is drawn a little larger than Mg, but a mole of Ca is heavier because M is larger).
export const LOOK = Object.freeze({
  H: { color: "#dfe3ec", metal: 0.15, rough: 0.28 }, O: { color: "#e3182d", metal: 0, rough: 0.16 }, N: { color: "#2f5fe0", metal: 0, rough: 0.18 },
  C: { color: "#2e323b", metal: 0.1, rough: 0.2 }, S: { color: "#f2cf2e", metal: 0, rough: 0.2 }, Cl: { color: "#2fb35e", metal: 0, rough: 0.18 },
  Mg: { color: "#d4d9e1", metal: 1, rough: 0.22 }, Ca: { color: "#f1f2f4", metal: 0.15, rough: 0.2, size: 1.15 }, Fe: { color: "#7f858f", metal: 1, rough: 0.3 },
  Al: { color: "#c3c8d4", metal: 1, rough: 0.28 }, Cu: { color: "#c8733a", metal: 1, rough: 0.24 }, Zn: { color: "#93a1b8", metal: 1, rough: 0.3 },
  Ag: { color: "#eceef2", metal: 1, rough: 0.12 }, Na: { color: "#8e5bd9", metal: 0.35, rough: 0.22 },
  He: { color: "#ffe9a8", metal: 0, rough: 0.2 }, Ne: { color: "#ff8fb8", metal: 0, rough: 0.2 }, Ar: { color: "#6fd0e0", metal: 0, rough: 0.2 },
});
export const lookOf = (el) => LOOK[el] ?? { color: "#9aa3b5", metal: 0.3, rough: 0.3 };
/** Per-element drawn-size factor (design convention). */
export const SIZE_BOOST = Object.freeze(Object.fromEntries(Object.entries(LOOK).filter(([, v]) => v.size).map(([k, v]) => [k, v.size])));
export const BOND_COLOUR = "#b9bfcb";
