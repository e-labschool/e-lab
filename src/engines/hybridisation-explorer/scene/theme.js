// Reads the 3D colours from the CSS variables defined in HybridisationExplorer.css (the single place colours live).
import * as THREE from "three";

const VARS = ["s-pos", "s-neg", "px-pos", "px-neg", "py-pos", "py-neg", "pz-pos", "pz-neg", "d-pos", "d-neg", "h0-pos", "h0-neg", "h1-pos", "h1-neg", "h2-pos", "h2-neg", "h3-pos", "h3-neg", "h4-pos", "h4-neg", "h5-pos", "h5-neg", "sigma", "pi", "sel", "nuc", "ring-pos", "ring-neg", "axis-x", "axis-y", "axis-z", "lp"];
const ELS = ["h", "be", "b", "c", "n", "o", "f", "si", "p", "s", "cl", "xe", "x"];
const FALLBACK = "#8899bb";

/** Parse the variables on `el` (the workspace root) into three Colors. `key` summarises them so callers can detect a theme change. */
export function readTheme(el) {
  const cs = el ? getComputedStyle(el) : null;
  const get = (name) => { const v = cs?.getPropertyValue(`--hy-${name}`).trim(); return v || FALLBACK; };
  const colors = {}; let key = "";
  for (const n of VARS) { const v = get(n); colors[n] = new THREE.Color(v); key += v; }
  const element = {};
  for (const e of ELS) { const v = get(`el-${e}`); element[e] = new THREE.Color(v); key += v; }
  return { colors, element, key };
}
export const paletteFor = (theme, name) => ({ pos: theme.colors[`${name}-pos`] ?? theme.colors["px-pos"], neg: theme.colors[`${name}-neg`] ?? theme.colors["px-neg"] });
export const elementColor = (theme, symbol) => theme.element[symbol.toLowerCase()] ?? theme.element.x;
