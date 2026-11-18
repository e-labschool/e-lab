// Timeline of the "vector addition" animation of the Molecular Polarity tab (pure). Arrow lengths are QUALITATIVE (proportional to delta-EN).
import { add, cross, dot, len, mul, sub, unit, clamp, lerp3 } from "../../shared-3d/electronCloud/vec3.js";

export const ARROW_SCALE = 0.9; // scene units per "EN unit"
export const PHASES = Object.freeze({ reveal: [0, 0.3], add: [0.3, 0.75], result: [0.75, 1] });
export const DURATION = 6;
/** Where the head-to-tail diagram is drawn: just below the molecule (the vector sum does not depend on where the vectors are drawn). */
export const originOf = (mol) => [0, Math.min(...mol.atoms.map((a) => a.p[1])) - 1.25, 0]; // seconds for the whole animation
const ease = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const seg = (u, [a, b]) => ease((u - a) / (b - a));

/** Where bond arrow k rests: parallel to its bond, centred on the bond midpoint, lifted towards the viewer so it never hides the stick. */
export function restingArrow(mol, d) {
  const a = mol.atoms[d.plus].p; const b = mol.atoms[d.minus].p; const mid = mul(add(a, b), 0.5); const L = ARROW_SCALE * d.magnitude;
  let lift = sub([0, 0, 1], mul(d.dir, d.dir[2])); if (len(lift) < 0.2) lift = sub([0, 1, 0], mul(d.dir, d.dir[1]));
  lift = mul(unit(lift), 0.3); const c = add(mid, lift);
  return { from: sub(c, mul(d.dir, L / 2)), to: add(c, mul(d.dir, L / 2)) };
}
/** Head-to-tail chain starting at the molecule centre: arrow k begins where arrow k-1 ended. */
export function chainArrows(mol, dipoles = mol.dipoles) {
  let p = [...originOf(mol)]; const out = [];
  for (const d of dipoles) { if (!d.polar) { out.push(null); continue; } const to = add(p, mul(d.dir, ARROW_SCALE * d.magnitude)); out.push({ from: p, to }); p = to; }
  return { arrows: out, end: p };
}
/** State at progress u (0..1): { arrows:[{from,to,opacity}|null], resultant:{from,to,opacity}|null, zero: 0..1 (opacity of the "= 0" marker), stage } */
export function vectorFrame(mol, u, mode = "overall") {
  const rest = mol.dipoles.map((d) => (d.polar ? restingArrow(mol, d) : null));
  if (mode === "model") return { arrows: rest.map(() => null), resultant: null, zero: 0, stage: "model" };
  if (mode === "bonds") return { arrows: rest.map((r) => (r ? { ...r, opacity: 1 } : null)), resultant: null, zero: 0, stage: "bonds" };
  const rv = seg(u, PHASES.reveal); const av = seg(u, PHASES.add); const res = seg(u, PHASES.result);
  const chain = chainArrows(mol);
  const arrows = rest.map((r, k) => {
    if (!r) return null; const c = chain.arrows[k];
    return { from: lerp3(r.from, c.from, av), to: lerp3(r.to, c.to, av), opacity: rv * (1 - 0.12 * res) };
  });
  const net = mol.net; const target = add(originOf(mol), net.vector);
  const resultant = net.polar && res > 0 ? { from: originOf(mol), to: lerp3(originOf(mol), target, res), opacity: res } : null;
  return { arrows, resultant, zero: net.cancels ? res : 0, stage: u < PHASES.reveal[1] ? "reveal" : u < PHASES.add[1] ? "add" : "result", chainEnd: chain.end };
}
/** The explanation text for the molecule, reduced to what the current stage may say. */
export const stageText = (mol, stage) => ({
  model: `${mol.geometry}${mol.angles[0] ? `, bond angle about ${mol.angles[0].deg.toFixed(mol.angles[0].deg % 1 ? 1 : 0)}°` : ""}.`,
  bonds: mol.dipoles.some((d) => d.polar) ? "Each polar bond has a bond dipole pointing towards the more electronegative atom." : "No bond here is polar enough to draw a dipole.",
  reveal: "Each polar bond has a bond dipole pointing towards the more electronegative atom.", add: "Add the bond dipoles as vectors, head to tail.", result: mol.explain,
}[stage] ?? mol.explain);
export { dot };
