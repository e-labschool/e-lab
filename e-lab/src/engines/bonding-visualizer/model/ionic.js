// Ionic model: ion charges, charge-balanced ratios, atom-count validation and the electron-transfer plan.
// Pure logic. Only BINARY compounds of one library metal + one library non-metal are supported;
// every other combination returns an explanation (status "unsupported"), never a made-up result.
import { IONIC_METALS, IONIC_NONMETALS, getBondingElement, toSub } from "./elements.js";

export const MAX_IONIC_ATOMS = 8;

/** Combinations that balance on paper but are NOT simple ionic lattices in reality: refused with a reason. */
const NOT_IONIC = {
  "Al|Cl": "AlCl₃ is largely covalent (molecular Al₂Cl₆ in the vapour), so it is not shown as Al³⁺ and Cl⁻ ions.",
  "Al|Br": "AlBr\u2083 is largely covalent (molecular Al\u2082Br\u2086 in the vapour), so it is not shown as Al\u00b3\u207a and Br\u207b ions.",
  "Al|N": "AlN is a largely covalent network solid, so it is not shown as Al³⁺ and N³⁻ ions.",
};

export const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export function isIonicMetal(sym) { return IONIC_METALS.includes(sym); }
export function isIonicNonmetal(sym) { return IONIC_NONMETALS.includes(sym); }

/** Ion record for a library symbol: { symbol, charge, neutralShells, ionShells, ...} */
export function ionOf(symbol) {
  const e = getBondingElement(symbol);
  if (!e || e.ionCharge === null) return null;
  return { symbol, charge: e.ionCharge, neutralShells: e.shells, ionShells: e.ionShells, Z: e.Z, name: e.name, color: e.color };
}

/** Smallest whole-number ratio {cation, anion} that is electrically neutral. Mg + Cl -> {cation:1, anion:2}. */
export function chargeBalance(catSymbol, anSymbol) {
  const c = ionOf(catSymbol);
  const a = ionOf(anSymbol);
  if (!c || !a || c.charge <= 0 || a.charge >= 0) return null;
  const g = gcd(c.charge, -a.charge);
  return { cation: -a.charge / g, anion: c.charge / g };
}

export function formulaOf(catSymbol, anSymbol) {
  const r = chargeBalance(catSymbol, anSymbol);
  if (!r) return null;
  return `${catSymbol}${r.cation > 1 ? toSub(r.cation) : ""}${anSymbol}${r.anion > 1 ? toSub(r.anion) : ""}`;
}

const plus = (list) => list.map((m) => `${m.count > 1 ? `${m.count} ` : "1 "}${m.symbol}`).join(" + ");
const need = (sym, n) => `${n} ${sym}`;

/**
 * Analyse the atoms placed on the ionic canvas.
 * input: array of symbols (one per atom).
 * result: { status, formula, cation, anion, ratio, missing[], extra[], message }
 *   status: "empty" | "incomplete" | "excess" | "valid" | "unsupported"
 */
export function analyzeIonic(symbols) {
  const counts = {};
  for (const s of symbols) counts[s] = (counts[s] ?? 0) + 1;
  const metals = Object.keys(counts).filter(isIonicMetal);
  const nonmetals = Object.keys(counts).filter(isIonicNonmetal);
  const base = { formula: null, cation: null, anion: null, ratio: null, missing: [], extra: [] };

  if (symbols.length === 0) return { ...base, status: "empty", message: "Add a metal and a non-metal from the library." };
  if (Object.keys(counts).some((s) => !isIonicMetal(s) && !isIonicNonmetal(s))) {
    return { ...base, status: "unsupported", message: "Only the library metals and non-metals are supported." };
  }
  if (metals.length > 1 || nonmetals.length > 1) {
    return { ...base, status: "unsupported", message: "Use one metal and one non-metal at a time (binary compounds only)." };
  }
  if (metals.length === 0) return { ...base, status: "incomplete", message: `Add a metal to pair with ${nonmetals[0]}.` };
  if (nonmetals.length === 0) return { ...base, status: "incomplete", message: `Add a non-metal to pair with ${metals[0]}.` };

  const [cat] = metals;
  const [an] = nonmetals;
  const key = `${cat}|${an}`;
  const ratio = chargeBalance(cat, an);
  const formula = formulaOf(cat, an);
  const info = { ...base, cation: cat, anion: an, ratio, formula };
  if (NOT_IONIC[key]) return { ...info, status: "unsupported", message: NOT_IONIC[key] };

  const cc = counts[cat];
  const ca = counts[an];
  const needText = `${formula} needs ${plus([{ symbol: cat, count: ratio.cation }, { symbol: an, count: ratio.anion }])}.`;
  if (cc === ratio.cation && ca === ratio.anion) {
    return { ...info, status: "valid", message: `${formula}: ${plus([{ symbol: cat, count: cc }, { symbol: an, count: ca }])}. Ready to ionize.` };
  }
  const missing = [];
  const extra = [];
  if (cc < ratio.cation) missing.push({ symbol: cat, count: ratio.cation - cc });
  if (ca < ratio.anion) missing.push({ symbol: an, count: ratio.anion - ca });
  if (cc > ratio.cation) extra.push({ symbol: cat, count: cc - ratio.cation });
  if (ca > ratio.anion) extra.push({ symbol: an, count: ca - ratio.anion });
  if (extra.length) {
    return { ...info, status: "excess", missing, extra, message: `${needText} Remove ${extra.map((x) => need(x.symbol, x.count)).join(" and ")}.` };
  }
  return { ...info, status: "incomplete", missing, extra, message: `${needText} Add ${missing.map((x) => need(x.symbol, x.count)).join(" and ")}.` };
}

/**
 * Cluster arrangement for a VALID set of atoms: alternating row (Cl-Mg-Cl, Na-O-Na, O-Al-O-Al-O) or, when one
 * side is a single ion with 3+ partners (AlF3, Li3N), a star. `atoms` = [{id, symbol}]. Returns ids in order.
 */
export function arrangeIons(atoms) {
  const cations = atoms.filter((a) => isIonicMetal(a.symbol)).map((a) => a.id);
  const anions = atoms.filter((a) => isIonicNonmetal(a.symbol)).map((a) => a.id);
  if ((cations.length === 1 && anions.length >= 3) || (anions.length === 1 && cations.length >= 3)) {
    const centre = cations.length === 1 ? cations[0] : anions[0];
    const ring = cations.length === 1 ? anions : cations;
    return { kind: "star", centre, ring, cations, anions, order: [centre, ...ring] };
  }
  const majorIsCation = cations.length > anions.length;
  const major = majorIsCation ? cations : anions;
  const minor = majorIsCation ? anions : cations;
  const order = [];
  if (cations.length === anions.length) {
    cations.forEach((c, i) => { order.push(c, anions[i]); });
  } else {
    major.forEach((m, i) => { order.push(m); if (i < minor.length) order.push(minor[i]); });
  }
  return { kind: "row", order, cations, anions };
}

/**
 * Full ionic system for a valid atom set: ions with before/after shells, the arrangement and the electron
 * transfers [{from, to}] (one entry PER ELECTRON). Throws if the set is not a valid single formula unit.
 */
export function buildIonicSystem(atoms) {
  const analysis = analyzeIonic(atoms.map((a) => a.symbol));
  if (analysis.status !== "valid") throw new Error(`Not a valid ionic set: ${analysis.message}`);
  const arrangement = arrangeIons(atoms);
  const ions = atoms.map((a) => ({ id: a.id, ...ionOf(a.symbol) }));
  const byId = Object.fromEntries(ions.map((i) => [i.id, i]));
  const donors = [];
  const acceptors = [];
  const cationsInOrder = arrangement.kind === "row" ? arrangement.order.filter((id) => byId[id].charge > 0) : arrangement.cations;
  const anionsInOrder = arrangement.kind === "row" ? arrangement.order.filter((id) => byId[id].charge < 0) : arrangement.anions;
  for (const id of cationsInOrder) for (let i = 0; i < byId[id].charge; i += 1) donors.push(id);
  for (const id of anionsInOrder) for (let i = 0; i < -byId[id].charge; i += 1) acceptors.push(id);
  if (donors.length !== acceptors.length) throw new Error("Charge not conserved in transfer plan");
  const transfers = donors.map((from, i) => ({ from, to: acceptors[i] }));
  return { formula: analysis.formula, analysis, ions, byId, arrangement, transfers, electronsTransferred: transfers.length };
}
