// Rule-based "Build this atom / ion" tasks (BA-07). Every target is a real nuclide with a chemically sensible charge, and every
// task carries a worked answer that is shown when the student is wrong. Pure and seeded (repeatable in tests).
import { findNuclide } from "../data/nuclides.js";
import { getElement } from "../../../data/chemistry/elements.js";
import { stableIsotopes } from "../../../lib/atomic/nuclides.js";
import { speciesLabel, toSuperscript } from "../../../lib/atomic/format.js";

const mulberry = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// Common monatomic ion charges (Z <= 36) the IB course uses.
const IONS = { 3: 1, 9: -1, 8: -2, 7: -3, 11: 1, 12: 2, 13: 3, 16: -2, 17: -1, 19: 1, 20: 2, 26: 2, 29: 2, 30: 2, 35: -1 };
const NEUTRAL_Z = [1, 3, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 26, 29];
export const KINDS = ["name", "notation", "deduce", "ion", "isotope"];

const sub = (n) => String(n).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[Number(c)]).join("");
const notation = (z, a, q, sym) => `${toSuperscript(a)}${sub(z)}${sym}${q ? toSuperscript(q > 0 ? `${Math.abs(q) === 1 ? "" : Math.abs(q)}+` : `${Math.abs(q) === 1 ? "" : Math.abs(q)}-`).replace("-", "⁻") : ""}`;

/** Build one task. `kind` fixed or drawn from the seed. Returns { kind, label, protons, neutrons, electrons, prompt, info, worked, symbol, charge }. */
export function generateChallenge(seed, kind) {
  const r = mulberry(seed * 2654435761 + 17);
  const k = kind ?? KINDS[Math.floor(r() * KINDS.length)];
  const pickZ = () => (k === "ion" ? Object.keys(IONS).map(Number) : NEUTRAL_Z)[Math.floor(r() * (k === "ion" ? Object.keys(IONS).length : NEUTRAL_Z.length))];
  let z = pickZ(); const el = getElement(z);
  const iso = stableIsotopes(z); const isotopes = iso.length ? iso : [findNuclide(z, z)];
  const n = isotopes[Math.floor(r() * isotopes.length)].neutrons ?? isotopes[0].neutrons;
  const a = z + n; const sym = el.symbol; const name = el.name;
  const q = k === "ion" || k === "notation" || k === "deduce" ? (IONS[z] ?? 0) : 0;
  const e = z - q;
  const chargeWord = q === 0 ? "no charge" : `${Math.abs(q)} ${q > 0 ? "fewer" : "more"} electron${Math.abs(q) === 1 ? "" : "s"} than protons`;
  const worked = `Z = ${z} gives ${z} protons. Neutrons = A − Z = ${a} − ${z} = ${n}. ${q === 0 ? `Neutral, so electrons = protons = ${z}.` : `A charge of ${q > 0 ? "+" : "−"}${Math.abs(q)} means ${chargeWord}: ${e} electrons.`}`;
  let prompt; let info = "full";
  if (k === "name") prompt = `Build ${name}-${a}.`;
  else if (k === "notation") { prompt = `Build ${notation(z, a, q, sym)}.`; info = "notation"; }
  else if (k === "deduce") { prompt = `Build a species with Z = ${z}, A = ${a}, charge ${q === 0 ? "0" : `${q > 0 ? "+" : "−"}${Math.abs(q)}`}.`; info = "deduce"; }
  else if (k === "ion") prompt = `Build the common ion of ${name} (${speciesLabel(sym, q)}) with mass number ${a}.`;
  else { // isotope: same element, a different (stable) isotope than the reference when there is one
    const others = isotopes.filter((i) => i.neutrons !== undefined); const tgt = others[others.length - 1];
    const nn = tgt.neutrons; return { kind: k, label: `${name}-${z + nn}`, protons: z, neutrons: nn, electrons: z, charge: 0, symbol: sym, info: "full", prompt: `Build an atom of ${name} with ${nn} neutron${nn === 1 ? "" : "s"}. Which isotope is it?`, worked: `Z = ${z} (${name}), neutrons ${nn}, so A = ${z} + ${nn} = ${z + nn}: ${name}-${z + nn}. Neutral: ${z} electrons.` };
  }
  return { kind: k, label: speciesLabel(sym, q), protons: z, neutrons: n, electrons: e, charge: q, symbol: sym, info, prompt, worked };
}
