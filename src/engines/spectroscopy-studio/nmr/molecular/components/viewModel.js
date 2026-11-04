// How an atom is drawn, decided once for every renderer (3D scene and the SVG fallback): colour, radius, emphasis, label.
// Pure; the rule is: identified environments are coloured by environment; the selected environment is bright with a ring,
// the coupled neighbours get a dashed ring, everything else is dimmed when something is selected.
import { ATOM_COLORS, ATOM_RADIUS, VDW_SCALE } from "./palette.js";
import { ATOMIC } from "../model/molecules.js";
import { densityColor, densityScore } from "../model/shielding.js";

export function atomVisual(mol, idx, ctx) {
  const a = mol.atoms[idx];
  const envId = a.isHydrogen ? mol.envOfAtom[idx] : null;
  const env = envId ? mol.environments.find((e) => e.id === envId) : null;
  const known = env ? ctx.identified.has(env.id) : false;
  const carrierEnv = !a.isHydrogen && a.hydrogens.length ? mol.environments.find((e) => e.atoms.includes(a.hydrogens[0])) : null;
  const selected = Boolean(env && env.id === ctx.selectedEnvId);
  const carrier = Boolean(carrierEnv && carrierEnv.id === ctx.selectedEnvId);
  const coupled = Boolean(env && ctx.coupledEnvIds.includes(env.id));
  const density = ctx.style === "density";
  let color = ATOM_COLORS[a.el];
  if (density) color = densityColor(densityScore(mol, idx));
  else if (env && known) color = env.color;
  const anySel = Boolean(ctx.selectedEnvId);
  const dim = anySel && !selected && !carrier && !coupled && !(ctx.focusAtom === idx);
  const baseR = density ? (ATOMIC[a.el].vdw * VDW_SCALE) * 0.9 : ATOM_RADIUS[a.el];
  const radius = baseR * (selected ? 1.12 : 1);
  const label = a.isHydrogen ? { main: "H", sub: known || density ? env.letter : "" } : { main: a.el, sub: "" };
  return { idx, color, radius, selected, carrier, coupled, dim, focus: ctx.focusAtom === idx, label, envId, known, opacity: density ? (dim ? 0.35 : 0.82) : dim ? 0.5 : 1 };
}

export function visualsFor(mol, ctx) { return mol.atoms.map((a) => atomVisual(mol, a.idx, ctx)); }

/** Draw order helper for the SVG renderer: rotate about Y then X, orthographic. */
export function project(p, yaw, pitch) {
  const cy = Math.cos(yaw); const sy = Math.sin(yaw); const cx = Math.cos(pitch); const sx = Math.sin(pitch);
  const x1 = p[0] * cy + p[2] * sy; const z1 = -p[0] * sy + p[2] * cy;
  const y2 = p[1] * cx - z1 * sx; const z2 = p[1] * sx + z1 * cx;
  return { x: x1, y: y2, z: z2 };
}
