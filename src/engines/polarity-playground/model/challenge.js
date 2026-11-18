// Polarity Challenge (pure): five short questions per round, immediate feedback with reasoning, stars. No timers.
import { PAULING, elementBond, NAMES } from "../../shared-3d/electronCloud/electronegativity.js";
import { getMolecule } from "./molecules.js";

export const ROUND_LENGTH = 5;
export const TYPES = ["en", "partial", "arrow", "polar", "cancel", "match"];
function rng(seed) { let a = (seed >>> 0) + 0x9e3779b9; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (arr, R) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const PAIRS = [["H", "Cl"], ["H", "F"], ["C", "O"], ["N", "H"], ["O", "H"], ["C", "Cl"], ["H", "Br"], ["C", "N"], ["S", "O"], ["F", "Cl"], ["H", "C"], ["H", "H"], ["Cl", "Cl"], ["O", "O"]];
const nm = (x) => `${NAMES[x] ?? x} (${x})`;

function qEN(R) {
  const [a, b] = PAIRS[Math.floor(R() * PAIRS.length)]; const [x, y] = R() < 0.5 ? [a, b] : [b, a]; const bond = elementBond(x, y);
  const options = [{ id: x, label: x }, { id: y, label: y }, ...(x === y ? [] : [{ id: "equal", label: "Neither: equal" }])];
  const right = bond.equal ? "equal" : bond.more;
  if (bond.equal) options.splice(0, options.length, { id: x, label: x }, { id: "equal", label: "Neither: equal" });
  return { type: "en", prompt: `In the bond ${x}–${y}, which atom is more electronegative?`, visual: { kind: "pair", a: x, b: y, arrow: false }, options, right,
    explain: bond.equal ? `${x}–${y} joins two identical atoms (EN ${PAULING[x].toFixed(2)}), so neither attracts the electrons more.` : `${nm(bond.more)} (${PAULING[bond.more].toFixed(2)}) is more electronegative than ${nm(bond.less)} (${PAULING[bond.less].toFixed(2)}).` };
}
function qPartial(R) {
  const pool = PAIRS.filter(([a, b]) => elementBond(a, b).dEN >= 0.4); const [a, b] = pool[Math.floor(R() * pool.length)]; const [x, y] = R() < 0.5 ? [a, b] : [b, a]; const bond = elementBond(x, y);
  return { type: "partial", prompt: `In ${x}–${y}, which atom carries the partial positive charge, δ+?`, visual: { kind: "pair", a: x, b: y, arrow: false }, options: [{ id: x, label: `${x} is δ+` }, { id: y, label: `${y} is δ+` }], right: bond.less,
    explain: `The less electronegative atom, ${bond.less}, is pulled on less strongly, so it is δ+; the more electronegative ${bond.more} is δ−.` };
}
function qArrow(R) {
  const pool = PAIRS.filter(([a, b]) => elementBond(a, b).dEN >= 0.4); const [a, b] = pool[Math.floor(R() * pool.length)]; const [x, y] = R() < 0.5 ? [a, b] : [b, a]; const bond = elementBond(x, y);
  const correct = bond.less === x ? "fwd" : "back"; // the arrow drawn left to right: crossed tail on x if x is less electronegative
  const options = shuffle([{ id: "fwd", label: "Crossed tail on the left atom, head towards the right atom", arrow: { tail: "left" } }, { id: "back", label: "Crossed tail on the right atom, head towards the left atom", arrow: { tail: "right" } }], R);
  return { type: "arrow", prompt: `Which dipole arrow is correct for the bond ${x}–${y}?`, visual: { kind: "pair", a: x, b: y, arrow: false }, options, right: correct,
    explain: `The chemistry convention: the crossed tail sits on the δ+ atom (${bond.less}) and the arrowhead points towards the δ− atom (${bond.more}), the more electronegative one.` };
}
const POLARITY_SET = ["h2", "hcl", "co2", "h2o", "bf3", "nh3", "ch4", "ch3cl", "ccl4", "so2"];
function qPolar(R) {
  const m = getMolecule(POLARITY_SET[Math.floor(R() * POLARITY_SET.length)]);
  return { type: "polar", prompt: `Is the molecule ${m.formula} polar or non-polar?`, visual: { kind: "molecule", id: m.id }, options: [{ id: "polar", label: "Polar (μ ≠ 0)" }, { id: "nonpolar", label: "Non-polar (μ = 0)" }], right: m.net.polar ? "polar" : "nonpolar", explain: m.explain };
}
function qCancel(R) {
  const pool = POLARITY_SET.filter((id) => getMolecule(id).net.hasPolarBonds); const m = getMolecule(pool[Math.floor(R() * pool.length)]);
  return { type: "cancel", prompt: `Do the bond dipoles in ${m.formula} cancel each other?`, visual: { kind: "molecule", id: m.id }, options: [{ id: "yes", label: "Yes, they cancel" }, { id: "no", label: "No, there is a net dipole" }], right: m.net.cancels ? "yes" : "no", explain: m.explain };
}
const shapeLabel = (m) => `${m.geometry.toLowerCase()}, ${m.net.polar ? "polar" : "non-polar"}`;
function qMatch(R) {
  const m = getMolecule(["co2", "h2o", "bf3", "nh3", "ccl4", "ch3cl", "so2"][Math.floor(R() * 7)]);
  const wrong = shuffle(POLARITY_SET.map(getMolecule).filter((x) => shapeLabel(x) !== shapeLabel(m)), R); const seen = new Set([shapeLabel(m)]); const opts = [{ id: shapeLabel(m), label: shapeLabel(m) }];
  for (const w of wrong) { if (opts.length >= 3) break; if (!seen.has(shapeLabel(w))) { seen.add(shapeLabel(w)); opts.push({ id: shapeLabel(w), label: shapeLabel(w) }); } }
  return { type: "match", prompt: `Which description matches ${m.formula}?`, visual: { kind: "molecule", id: m.id }, options: shuffle(opts, R), right: shapeLabel(m), explain: m.explain };
}
const BUILD = { en: qEN, partial: qPartial, arrow: qArrow, polar: qPolar, cancel: qCancel, match: qMatch };

/** A round of ROUND_LENGTH questions: deterministic for a seed; a mix of the atom-level and the molecule-level types. */
export function buildRound(seed = 1) {
  const R = rng(seed); const order = shuffle(["en", "partial", "arrow", "polar", "cancel", "match"], R).slice(0, ROUND_LENGTH);
  return order.map((t, i) => { const q = BUILD[t](rng(seed * 101 + i * 17 + 3)); return { ...q, id: `q${i + 1}` }; });
}
export const check = (q, choice) => ({ correct: choice === q.right, right: q.right, explain: q.explain });
export function stars(correct, total = ROUND_LENGTH) { const f = correct / total; return f >= 0.99 ? 3 : f >= 0.6 ? 2 : correct >= 1 ? 1 : 0; }
