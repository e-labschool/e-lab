// ONE colour / radius table for every 3D chemistry view (VSEPR Explorer, Bonding Visualizer, Hybridisation Explorer,
// Intermolecular Forces Visualiser).  Students move between these tools, so H is always white, C dark grey, N blue,
// O red, F/Cl green ... (CPK-style conventions).  Pure data: no React, no three.
//   color  display fill            text   label colour that stays readable on that fill
//   r      ball-and-stick radius in scene units (VSEPR scale: H 0.30 ... I 0.60)
//   vdw    van der Waals radius in angstrom (Bondi / Alvarez), used by the space-filling IMF view
// Tab accent colours (e.g. the Bonding Visualizer's ionic / covalent / metallic blues) are NOT element colours and stay local.
export const ELEMENT_STYLE = Object.freeze({
  H:  { color: "#f2f4f8", text: "#1e2a44", r: 0.30, vdw: 1.20 },
  Li: { color: "#cc80ff", text: "#2a0a47", r: 0.50, vdw: 1.82 },
  Be: { color: "#8bd17f", text: "#143016", r: 0.42, vdw: 1.53 },
  B:  { color: "#e58fb2", text: "#3a1730", r: 0.40, vdw: 1.92 },
  C:  { color: "#4b505c", text: "#ffffff", r: 0.42, vdw: 1.70 },
  N:  { color: "#2858d8", text: "#ffffff", r: 0.42, vdw: 1.55 },
  O:  { color: "#d93a30", text: "#ffffff", r: 0.41, vdw: 1.52 },
  F:  { color: "#4cb84a", text: "#0b2a12", r: 0.38, vdw: 1.47 },
  Ne: { color: "#ff9bd2", text: "#3a1730", r: 0.72, vdw: 1.54 },
  Na: { color: "#ab5cf2", text: "#14052b", r: 0.55, vdw: 2.27 },
  Mg: { color: "#5fbf6e", text: "#0b2a12", r: 0.50, vdw: 1.73 },
  Al: { color: "#b8a9c9", text: "#241a33", r: 0.50, vdw: 1.84 },
  Si: { color: "#c9ccd6", text: "#1e2a44", r: 0.50, vdw: 2.10 },
  P:  { color: "#f08a24", text: "#3d1f00", r: 0.50, vdw: 1.80 },
  S:  { color: "#f0c52f", text: "#3d2f00", r: 0.50, vdw: 1.80 },
  Cl: { color: "#2f9d57", text: "#04200f", r: 0.50, vdw: 1.75 },
  Ar: { color: "#80d1e3", text: "#05303a", r: 0.90, vdw: 1.88 },
  K:  { color: "#8f40d4", text: "#ffffff", r: 0.60, vdw: 2.75 },
  Ca: { color: "#3f9f55", text: "#04200f", r: 0.55, vdw: 2.31 },
  Br: { color: "#a5452f", text: "#ffffff", r: 0.55, vdw: 1.85 },
  Xe: { color: "#43aebf", text: "#05303a", r: 0.60, vdw: 2.16 },
  I:  { color: "#7b45b8", text: "#ffffff", r: 0.60, vdw: 1.98 },
});
const FALLBACK = Object.freeze({ color: "#9fb3d9", text: "#0f172a", r: 0.45, vdw: 1.8 });
export const elementStyle = (symbol) => ELEMENT_STYLE[symbol] ?? FALLBACK;
export const elementColor = (symbol) => elementStyle(symbol).color;
/** Dark outline for pale element fills (H, Si, Al ...) so atoms stay visible on a white or navy stage. */
export function elementEdge(symbol) {
  const c = elementStyle(symbol).color;
  const n = parseInt(c.slice(1), 16); const lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.72 ? "#5b6784" : "rgba(255,255,255,0.9)";
}
