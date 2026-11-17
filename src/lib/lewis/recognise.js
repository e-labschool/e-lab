// Recognition layer: the single call the Bonding Visualizer makes. Combines the curated library (hand-verified structures) with the
// resolver (works out ANY composition it can), and turns the result into everything the screen shows: formula, name, bond counts,
// shape hint, polarity and a plain-language explanation whenever nothing can be formed.  Pure.
import { EN, lewisElement } from "./data.js";
import { chargeSup, compositionKey, conventionalFormula, prettyFormula, toSub } from "./format.js";
import { findByComposition } from "./library.js";
import { canonical, chargeLabel, resolveAtoms } from "./resolve.js";
import { embed3D, shapeCentres, shapeText } from "./geometry.js";
import { bondTable, netDipole, polarityStatement } from "./polarity.js";

const isH = (s) => s === "H";
const SYM = { 1: "–", 2: "=", 3: "≡" };
const sumBy = (a, f) => a.reduce((s, x, i) => s + f(x, i), 0);
const countsOf = (symbols) => symbols.reduce((o, s) => ((o[s] = (o[s] ?? 0) + 1), o), {});
const nbrs = (s, i) => s.bonds.filter((b) => b[0] === i || b[1] === i).map((b) => (b[0] === i ? b[1] : b[0]));
const orderOf = (s, i, j) => s.bonds.find((b) => (b[0] === i && b[1] === j) || (b[0] === j && b[1] === i))?.[2] ?? 0;
const compText = (symbols) => Object.entries(countsOf(symbols)).sort((a, b) => (isH(a[0]) ? 1 : 0) - (isH(b[0]) ? 1 : 0) || EN[a[0]] - EN[b[0]]).map(([k, n]) => `${n > 1 ? `${n} ` : ""}${k}`).join(" + ");
const ELEMENT_NAME = (sym) => lewisElement(sym)?.name ?? sym;

/** Condensed structural text, e.g. "O=C=O", "H–O–H", "S(=O)₃", "CH₃–C(=O)–OH", "[N(–H)₄]⁺". */
export function condensedText(s) {
  const n = s.atoms.length;
  const wrap = (t) => (s.charge ? `[${t}]${chargeSup(s.charge)}` : t);
  if (n === 2) return wrap(`${s.atoms[0]}${SYM[s.bonds[0][2]]}${s.atoms[1]}`);
  const heavy = s.atoms.map((_, i) => i).filter((i) => !isH(s.atoms[i]));
  const hub = s.centre;
  if (hub !== null && hub !== undefined) {
    const kids = nbrs(s, hub);
    if (kids.length === 2) {
      const [a, b] = kids.sort((x, y) => (isH(s.atoms[y]) - isH(s.atoms[x])) || x - y);
      return wrap(`${s.atoms[a]}${SYM[orderOf(s, hub, a)]}${s.atoms[hub]}${SYM[orderOf(s, hub, b)]}${s.atoms[b]}`);
    }
    const groups = [];
    for (const k of kids.sort((x, y) => orderOf(s, hub, y) - orderOf(s, hub, x) || x - y)) {
      const key = `${SYM[orderOf(s, hub, k)]}${s.atoms[k]}`;
      const g = groups.find((q) => q.key === key);
      if (g) g.n += 1; else groups.push({ key, n: 1 });
    }
    return wrap(`${s.atoms[hub]}${groups.map((g) => `(${g.key})${g.n > 1 ? toSub(g.n) : ""}`).join("")}`);
  }
  // chains and branched molecules: condensed formula along the longest path, side groups in brackets
  const hCount = (i) => nbrs(s, i).filter((k) => isH(s.atoms[k])).length;
  const hk = (i) => nbrs(s, i).filter((k) => !isH(s.atoms[k]));
  const size = (i, p) => 1 + sumBy(hk(i).filter((k) => k !== p), (k) => size(k, i));
  const label = (i) => `${s.atoms[i]}${hCount(i) ? `H${hCount(i) > 1 ? toSub(hCount(i)) : ""}` : ""}`;
  const text = (i, p) => {
    const kids = hk(i).filter((k) => k !== p).sort((x, y) => size(x, i) - size(y, i) || x - y);
    if (!kids.length) return label(i);
    const side = kids.slice(0, -1).map((k) => `(${SYM[orderOf(s, i, k)]}${text(k, i)})`).join("");
    const main = kids[kids.length - 1];
    return `${label(i)}${side}${SYM[orderOf(s, i, main)]}${text(main, i)}`;
  };
  const ends = heavy.filter((i) => hk(i).length <= 1);
  const start = ends.sort((x, y) => (hk(y).length === 1) - (hk(x).length === 1) || (isH(s.atoms[x]) ? 1 : 0) - (isH(s.atoms[y]) ? 1 : 0) || x - y)[0] ?? heavy[0];
  return wrap(text(start, -1));
}

function bondSummary(s) {
  const groups = new Map();
  for (const [i, j, o] of s.bonds) {
    const [a, b] = [s.atoms[i], s.atoms[j]].sort((x, y) => (isH(x) ? 1 : 0) - (isH(y) ? 1 : 0) || EN[x] - EN[y] || x.localeCompare(y));
    const key = `${a}${SYM[o]}${b}`;
    const g = groups.get(key) ?? { label: key, order: o, count: 0, a, b };
    g.count += 1; groups.set(key, g);
  }
  return [...groups.values()];
}

function octetText(s) {
  if (s.isRadical) return "One atom has an unpaired electron (an odd-electron species).";
  const parts = [];
  // name the electron count around each unusual atom (S has 12 electrons around it in SF6), not just "more than 8"
  const around = (flag) => { const m = new Map(); s.atoms.forEach((a, i) => { if (flag[i]) m.set(a, Math.max(m.get(a) ?? 0, s.electronsAround[i])); }); return [...m].map(([a, n]) => `${a} has ${n}`).join(", "); };
  if (s.isExpanded) parts.push(`${around(s.expanded)} electrons around it (expanded octet, more than 8)`);
  if (s.incomplete.some(Boolean)) parts.push(`${around(s.incomplete)} electrons around it (incomplete octet, fewer than 8)`);
  return parts.length ? parts.join("; ") + "." : "Every atom has a full outer shell (octet, or duet for H).";
}

const ordinalWord = { 1: "single", 2: "double", 3: "triple" };

/** Everything the screen shows for one resolved structure. */
export function describeStructure(s, { entry = null, formula = null, name = null } = {}) {
  const f = formula ?? entry?.formula ?? conventionalFormula(s.atoms, s.charge, EN);
  const st = { ...s, formula: f };
  const emb = embed3D(s);
  const geo = { atoms: emb.pos.map((p) => ({ pos: p })) };
  const bonds = bondSummary(s);
  const V = sumBy(s.atoms, (a) => lewisElement(a).valence) - s.charge;
  const bondingPairs = sumBy(s.bonds, (b) => b[2]);
  const lonePairs = sumBy(s.lonePairs, (x) => x);
  const centres = shapeCentres(s);
  const shapeLines = centres.map((i) => {
    const same = centres.filter((k) => s.atoms[k] === s.atoms[i]);
    return { atom: i, symbol: s.atoms[i], tag: same.length > 1 ? `${s.atoms[i]}${same.indexOf(i) + 1}` : s.atoms[i] };
  });
  let polarity = "";
  let polarMolecule = null;
  try { polarity = polarityStatement(st, geo); polarMolecule = s.charge ? null : netDipole(st, geo).polar; } catch { /* unknown element: no polarity text */ }
  return {
    formula: f, name: name ?? entry?.name ?? null, structural: condensedText(s), charge: s.charge,
    valenceElectrons: V, bondingPairs, lonePairs, sharedElectrons: 2 * bondingPairs, lonePairElectrons: 2 * lonePairs,
    bonds, bondTable: (() => { try { return bondTable(st); } catch { return []; } })(),
    maxOrder: Math.max(...s.bonds.map((b) => b[2])), octet: octetText(s),
    shape: shapeText(s), shapeCentres: shapeLines, polarity, polarMolecule,
    resonance: s.resonance, dative: s.bonds.filter((b) => b[3]).map((b) => ({ donor: b[3].donor, acceptor: b[3].donor === b[0] ? b[1] : b[0], n: b[3].n })),
    formalCharges: s.atoms.map((a, i) => ({ index: i, symbol: a, value: s.formal[i] })).filter((x) => x.value !== 0),
    expanded: s.isExpanded, radical: s.isRadical,
  };
}

/** One-paragraph "what you built" text. */
export function buildSummary(s, info, entry) {
  const comp = compText(s.atoms);
  const name = info.name ? `${info.name}, ${info.formula}` : info.formula;
  const bits = info.bonds.map((b) => `${b.count > 1 ? `${b.count} × ` : ""}${b.label}, ${ordinalWord[b.order]}`).join("; ");
  let t = `You built ${name} from ${comp}. It has ${info.valenceElectrons} valence electrons: ${info.bondingPairs} bonding pair${info.bondingPairs === 1 ? "" : "s"} (${bits}) and ${info.lonePairs} lone pair${info.lonePairs === 1 ? "" : "s"}${s.isRadical ? " plus one unpaired electron" : ""}. ${info.octet}`;
  if (info.formalCharges.length && !info.dative.length) t += ` Formal charges: ${info.formalCharges.map((f) => `${f.symbol} ${f.value > 0 ? "+" : "\u2212"}${Math.abs(f.value) > 1 ? Math.abs(f.value) : ""}`).join(", ")} (bookkeeping, not real electron transfer).`;
  if (info.dative.length) t += ` One bond is a coordinate (dative) bond: both electrons come from ${s.atoms[info.dative[0].donor]}.`;
  if (info.resonance) t += ` The ${info.resonance[0].atoms.length} equivalent ${s.atoms[info.resonance[0].atoms[0]]} atoms share the double bond (resonance): average bond order ${(Math.round(info.resonance[0].average * 100) / 100).toFixed(2).replace(/0$/, "").replace(/\.$/, "")}.`;
  if (entry === null) t += " This species is not in the curated list: the app worked the structure out from the electron count.";
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// "Add these to make ..." suggestions
// ---------------------------------------------------------------------------------------------------------------
const ADD_POOL = ["H", "O", "Cl", "F", "N", "C", "S"];
function additionSuggestions(symbols, charge, beyond, max = 3, deadline = null) {
  const out = []; const seen = new Set();
  if (symbols.filter((a) => a !== "H" && a !== "F").length > 3) return out; // bigger sets: no guessing, the explanation is enough
  const room = 14 - symbols.length;
  const tryAdd = (add) => {
    if (add.length > room) return;
    if (deadline && Date.now() > deadline) return;
    const all = [...symbols, ...add];
    const key = compositionKey(all, charge);
    if (seen.has(key)) return; seen.add(key);
    const r = resolveAtoms(all, { charge, beyond, deadline });
    if (!r.ok) return;
    const lib = findByComposition(all, charge)[0] ?? null;
    out.push({ add, formula: lib?.formula ?? conventionalFormula(all, charge, EN), name: lib?.name ?? null, library: !!lib });
  };
  for (const a of ADD_POOL) tryAdd([a]);
  const pairs = [["H", "H"], ["H", "O"], ["O", "O"], ["H", "Cl"], ["Cl", "Cl"], ["F", "F"], ["H", "N"], ["H", "F"]];
  if (out.filter((x) => x.library).length < max) for (const p of pairs) tryAdd(p);
  if (out.filter((x) => x.library).length < max) { tryAdd(["H", "H", "H"]); tryAdd(["H", "H", "H", "H"]); tryAdd(["O", "O", "O"]); }
  return out.sort((a, b) => (b.library - a.library) || a.add.length - b.add.length).slice(0, max);
}
const addText = (add) => { const c = countsOf(add); return Object.entries(c).map(([k, n]) => `${n > 1 ? `${n} ` : ""}${k}`).join(" + "); };

// ---------------------------------------------------------------------------------------------------------------
// recognise()
// ---------------------------------------------------------------------------------------------------------------
/**
 * recognise(symbols, { charge, beyond }) ->
 *  { status: "ok" | "needs-charge" | "needs-beyond" | "none" | "few", message, ... }
 *  ok:       structure, info (describeStructure), summary, source "library" | "algorithm", entry, alternatives, expandedNote, uncertain
 *  failures: message (always), suggestions [{charge, formula, name, structure}], additions [{add, formula, name}]
 */
export function recognise(symbols, { charge = 0, beyond = false } = {}) {
  const n = symbols.length;
  const deadline = Date.now() + 1800; // one recognition never blocks the page for long: every search below shares this limit
  if (n === 0) return { status: "few", message: "Add atoms from the library, or pick a molecule from the list.", additions: [], suggestions: [] };
  const comp = compText(symbols);
  const libs = findByComposition(symbols, charge);
  const primary = libs[0] ?? null;

  // library hit ------------------------------------------------------------------------------------------------
  if (primary) {
    if (primary.beyond && !beyond) {
      const exp = primary.structure;
      const why = exp.isRadical
        ? `${primary.formula} has an odd number of valence electrons (${exp.atoms.reduce((v, a) => v + lewisElement(a).valence, 0) - charge}), so one electron stays unpaired. Odd-electron species are beyond the course.`
        : `${[...new Set(exp.atoms.filter((_, i) => exp.expanded[i]))].map((a) => `${a} would need ${Math.max(...exp.electronsAround.filter((_, i) => exp.atoms[i] === a))} electrons around it`).join(", ")} in ${primary.formula} (an expanded octet, not possible with the octet rule).`;
      return { status: "needs-beyond", message: `${comp}: ${why} Switch on "Beyond the course (HL)" to see ${primary.name.toLowerCase()}.`, entry: primary, formula: primary.formula, name: primary.name, additions: [], suggestions: [] };
    }
    const chosen = !beyond && primary.octetStructure ? primary.octetStructure : primary.structure;
    const info = describeStructure(chosen, { entry: primary });
    const alts = libs.slice(1).map((e) => ({ entry: e, name: e.name, formula: e.formula, structure: !beyond && e.octetStructure ? e.octetStructure : e.structure, structural: condensedText(e.structure) }));
    const expandedNote = primary.octetStructure && !beyond
      ? `HL: ${primary.formula} is often drawn with an expanded octet and no formal charges. Switch on "Beyond the course (HL)" to see that form.`
      : primary.octetStructure && beyond ? `Octet-rule form (with formal charges) is shown when "Beyond the course" is off.` : null;
    return { status: "ok", source: "library", entry: primary, structure: chosen, info, summary: buildSummary(chosen, info, primary), alternatives: alts, uncertain: false, expandedNote, message: `Recognised: ${primary.name}, ${primary.formula}.` };
  }

  // resolver ---------------------------------------------------------------------------------------------------
  const r = resolveAtoms(symbols, { charge, beyond, deadline });
  if (r.ok) {
    const s = r.structure;
    const sep = sumBy(s.adjFormal, (x) => Math.abs(x)) - Math.abs(s.charge);
    // a neutral structure with charges pulled apart and a charged library species made of the same atoms: the charged one is meant
    if (sep > 0 && charge === 0) {
      for (const q of [-2, -1, 1, 2, -3, 3]) {
        const hit = findByComposition(symbols, q)[0];
        if (hit && !(hit.beyond && !beyond)) {
          return { status: "needs-charge", message: `${comp} has no stable neutral molecule: any neutral structure would need charges pulled apart on its atoms. With an overall charge of ${chargeLabel(q)} the same atoms make ${hit.name.toLowerCase()}, ${hit.formula}.`, suggestions: [{ charge: q, formula: hit.formula, name: hit.name, structure: hit.structure, entry: hit }], additions: [] };
        }
      }
    }
    const info = describeStructure(s);
    const alts = [...r.ties].map((t) => ({ entry: null, name: null, formula: info.formula, structure: t, structural: condensedText(t) }));
    const uncertain = sep > 0;
    let msg = `Worked out: ${info.formula}${info.name ? `, ${info.name}` : ""} (${info.structural}).`;
    if (alts.length) msg += ` Other arrangements of the same atoms are possible: ${alts.length + 1} structures have equally good electron bookkeeping.`;
    if (uncertain) msg += " Formal charges are separated on its atoms, so check that this species really exists.";
    return { status: "ok", source: "algorithm", entry: null, structure: s, info, summary: buildSummary(s, info, null), alternatives: alts, uncertain, expandedNote: null, message: msg };
  }

  // failures ---------------------------------------------------------------------------------------------------
  if (r.code === "few" || n === 1) {
    const add = additionSuggestions(symbols, charge, beyond, 3, deadline);
    return { status: "few", message: `Add at least one more atom to bond with ${symbols[0]}.${add.length ? ` For example: ${add.map((a) => `${addText(a.add)} makes ${a.name ? a.name.toLowerCase() + ", " : ""}${a.formula}`).slice(0, 2).join("; ")}.` : ""}`, additions: add, suggestions: [] };
  }
  if (r.code === "too-many" || r.code === "too-complex" || r.code === "unknown") return { status: "none", message: r.message, additions: [], suggestions: [] };
  if (r.code === "needs-beyond") {
    const x = resolveAtoms(symbols, { charge, beyond: true, deadline });
    const s = x.ok ? x.structure : null;
    const why = s?.isRadical ? "That needs an unpaired electron (an odd number of valence electrons)." : s ? `${[...new Set(s.atoms.filter((_, i) => s.expanded[i]))].join(", ")} would need more than 8 electrons around it (an expanded octet).` : "";
    const add = additionSuggestions(symbols, charge, beyond, 2, deadline);
    return { status: "needs-beyond", message: `${comp} can only bond beyond the octet rule. ${why} Switch on "Beyond the course (HL)" to see it.${add.length ? ` Or add ${add.map((a) => `${addText(a.add)} to make ${a.name ? a.name.toLowerCase() + ", " : ""}${a.formula}`).join(" or ")}.` : ""}`, additions: add, suggestions: [] };
  }
  if (r.code === "needs-charge") {
    const sug = r.chargeSuggestions.map((c) => {
      const hit = findByComposition(symbols, c.charge)[0] ?? null;
      return { charge: c.charge, formula: hit?.formula ?? conventionalFormula(symbols, c.charge, EN), name: hit?.name ?? null, structure: hit?.structure ?? c.structure, entry: hit };
    });
    const first = sug[0];
    return { status: "needs-charge", message: `${comp}${charge ? ` with a charge of ${chargeLabel(charge)}` : ""} has no stable Lewis structure${charge === 0 ? " as a neutral molecule" : ""}. With an overall charge of ${chargeLabel(first.charge)} the same atoms form ${first.name ? `${first.name.toLowerCase()}, ` : ""}${first.formula}.`, suggestions: sug, additions: [] };
  }
  // nothing at any charge
  const V = sumBy(symbols, (a) => lewisElement(a).valence) - charge;
  const add = additionSuggestions(symbols, charge, beyond, 3, deadline);
  const parity = V % 2 ? ` ${V} is an odd number of electrons, so one electron would be left unpaired (a radical; beyond the course).` : "";
  const need = sumBy(symbols, (a) => (isH(a) ? 2 : 8));
  const base = V > need ? `${comp} supplies ${V} valence electrons, more than the ${need} that fit around these atoms with full shells.` : `${comp} supplies ${V} valence electrons, not enough to give every atom a full outer shell by sharing in one molecule.`;
  return { status: "none", message: `${base}${parity}${add.length ? ` Try adding ${add.map((a) => `${addText(a.add)} (${a.name ? a.name.toLowerCase() + ", " : ""}${a.formula})`).join(" or ")}.` : ""}`, additions: add, suggestions: [] };
}

export { prettyFormula, canonical };
