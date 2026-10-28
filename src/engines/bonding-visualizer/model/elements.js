// Chemistry data model for the Bonding Visualizer: elements, shell arrangements and ions.
// NO rendering code lives here (pure, Node-testable).
//
// SOURCE OF TRUTH: shell arrangements are NOT authored in this file. They are read from the shared
// e-Lab electron-configuration engine (engines/electron-configuration/logic/buildConfiguration.js),
// which uses the Madelung order plus the curated IUPAC/NIST exceptions table
// (data/chemistry/electron-config-exceptions.js: Cr, Cu, Nb, ... ), and element identity from
// data/chemistry/elements.js. The 2n^2 rule is never used to FILL shells (only the engine's subshell
// filling decides, e.g. K = 2,8,8,1 and Ca = 2,8,8,2). This file only adds bonding-specific facts:
// which elements the visualiser offers, their metal/non-metal role and a display colour.
// Ion charges are DERIVED from the outer-shell electron count (metals lose all outer electrons,
// non-metals gain up to a full octet), and scripts/test-bonding-model.mjs checks them against an
// independent oracle table of textbook values.
import { getElementBySymbol } from "../../../data/chemistry/elements.js";
import { buildConfiguration, buildIonConfiguration } from "../../electron-configuration/logic/buildConfiguration.js";

/** Display + role definitions. `kind` is a teaching classification, not derived data. */
const DEFS = {
  H: { kind: "nonmetal", color: "#ffd966" },
  Li: { kind: "metal", color: "#b79cf5" },
  Be: { kind: "metal", color: "#86d4c8" },
  B: { kind: "metalloid", color: "#f0c28a" },
  C: { kind: "nonmetal", color: "#b0b7c3" },
  N: { kind: "nonmetal", color: "#7fb2f5" },
  O: { kind: "nonmetal", color: "#f58f8f" },
  F: { kind: "nonmetal", color: "#f7d774" },
  Na: { kind: "metal", color: "#9b8cf2" },
  Mg: { kind: "metal", color: "#5ec6b0" },
  Al: { kind: "metal", color: "#f2b27a" },
  P: { kind: "nonmetal", color: "#f3b6d6" },
  S: { kind: "nonmetal", color: "#e8d36a" },
  Cl: { kind: "nonmetal", color: "#5fd1a0" },
  K: { kind: "metal", color: "#8aa4f5" },
  Ca: { kind: "metal", color: "#66c2e0" },
  Br: { kind: "nonmetal", color: "#f5b86b" },
};

/** Which elements each mode offers (display order = library order). */
export const IONIC_METALS = ["Li", "Na", "K", "Mg", "Ca", "Al"];
export const IONIC_NONMETALS = ["N", "O", "F", "S", "Cl", "Br"];
export const COVALENT_ATOMS = ["H", "C", "N", "O", "F", "Cl", "S", "P", "Be", "B"];
export const METALLIC_METALS = ["Na", "Li", "K", "Mg", "Ca", "Al"];

/** Distinct valence-electron colours; atom number i in a mode uses palette[i % n] (a different colour per atom). */
export const ELECTRON_PALETTE = ["#f97316", "#0ea5e9", "#a855f7", "#16a34a", "#e11d48", "#ca8a04", "#14b8a6", "#6366f1"];
export const CORE_ELECTRON_COLOR = "#94a3b8";

const cache = new Map();

/**
 * Element record: { symbol, name, Z, kind, color, shells (neutral, per shell), valence, ionCharge|null,
 * ionShells|null, configuration }. `ionCharge` is only defined for the ionic library.
 */
export function getBondingElement(symbol) {
  if (cache.has(symbol)) return cache.get(symbol);
  const def = DEFS[symbol];
  const base = getElementBySymbol(symbol);
  if (!def || !base) return null;
  const cfg = buildConfiguration(base.atomicNumber);
  const shells = [...cfg.shells];
  const valence = shells[shells.length - 1];
  let ionCharge = null;
  let ionShells = null;
  if (IONIC_METALS.includes(symbol)) ionCharge = valence; // metals lose every outer-shell electron
  if (IONIC_NONMETALS.includes(symbol)) ionCharge = -(8 - valence); // non-metals gain up to a full octet
  if (ionCharge !== null) {
    const ion = buildIonConfiguration(base.atomicNumber, ionCharge);
    ionShells = ion ? [...ion.shells] : null;
  }
  const rec = Object.freeze({
    symbol, name: base.name, Z: base.atomicNumber, kind: def.kind, color: def.color,
    shells, valence, ionCharge, ionShells, configuration: cfg.configurationString, isException: cfg.isException,
  });
  cache.set(symbol, rec);
  return rec;
}

export const ALL_SYMBOLS = Object.keys(DEFS);

/** Shell arrangement as text, e.g. "2,8,7". */
export const shellText = (shells) => shells.join(",");

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
export const toSub = (n) => String(n).split("").map((d) => SUB[d] ?? d).join("");
/** "Li+", "Mg2+", "Cl-", "O2-" with Unicode superscripts (charge 0 -> just the symbol). */
export function chargeText(symbol, charge) {
  if (!charge) return symbol;
  const mag = Math.abs(charge);
  return `${symbol}${mag > 1 ? String(mag).split("").map((d) => SUP[d]).join("") : ""}${charge > 0 ? "⁺" : "⁻"}`;
}

/** Cross-checks every library element against the engine's own numbers. Returns a list of problem strings (empty = OK). */
export function validateLibrary() {
  const problems = [];
  for (const sym of ALL_SYMBOLS) {
    const e = getBondingElement(sym);
    if (!e) { problems.push(`${sym}: missing from element data`); continue; }
    const total = e.shells.reduce((a, b) => a + b, 0);
    if (total !== e.Z) problems.push(`${sym}: ${total} electrons for Z=${e.Z}`);
    e.shells.forEach((n, i) => { if (n > 2 * (i + 1) ** 2) problems.push(`${sym}: shell ${i + 1} exceeds 2n^2`); });
    if (e.isException) problems.push(`${sym}: is a configuration exception; review before using in a Bohr diagram`);
    if (e.ionCharge !== null) {
      const ionTotal = e.ionShells.reduce((a, b) => a + b, 0);
      if (ionTotal !== e.Z - e.ionCharge) problems.push(`${sym}: ion has ${ionTotal} electrons, expected ${e.Z - e.ionCharge}`);
    }
  }
  return problems;
}
