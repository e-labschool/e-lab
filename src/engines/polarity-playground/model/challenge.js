// Polarity Challenge (pure): five short questions per round, immediate feedback with reasoning, stars. No timers.
import { PAULING, elementBond, NAMES } from "../../shared-3d/electronCloud/electronegativity.js";
import { getMolecule } from "./molecules.js";

export const ROUND_LENGTH = 5;
export const TYPES = ["en", "partial", "arrow", "polar", "cancel", "match", "rank", "pick", "direction"];
function rng(seed) { let a = (seed >>> 0) + 0x9e3779b9; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (arr, R) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const PAIRS = [["H", "Cl"], ["H", "F"], ["C", "O"], ["N", "H"], ["O", "H"], ["C", "Cl"], ["H", "Br"], ["C", "N"], ["S", "O"], ["F", "Cl"], ["H", "C"], ["H", "H"], ["Cl", "Cl"], ["O", "O"], ["C", "F"], ["N", "O"], ["P", "Cl"], ["S", "H"], ["Br", "Br"], ["Si", "O"], ["B", "F"], ["C", "S"], ["N", "F"], ["I", "Cl"]].filter(([a, b]) => PAULING[a] && PAULING[b]);
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
const POLARITY_SET = ["h2", "hcl", "co2", "h2o", "bf3", "nh3", "ch4", "ch3cl", "ccl4", "so2", "hf", "hbr", "ch2cl2", "chcl3", "pcl3", "becl2", "sf6", "cis-dce", "trans-dce"]; // the core ten + the "more molecules" that are not special cases (no O3, no HL XeF4)
const DIRECTION_SET = ["hcl", "h2o", "nh3", "ch3cl", "so2", "hf", "hbr", "ch2cl2", "chcl3", "pcl3"];
const MATCH_SET = ["co2", "h2o", "bf3", "nh3", "ccl4", "ch3cl", "so2", "becl2", "sf6", "pcl3", "chcl3", "trans-dce", "cis-dce"];
function qPolar(R) {
  const m = getMolecule(POLARITY_SET[Math.floor(R() * POLARITY_SET.length)]);
  return { type: "polar", prompt: `Is the molecule ${m.formula} polar or non-polar?`, visual: { kind: "molecule", id: m.id, delta: true }, options: [{ id: "polar", label: "Polar (μ ≠ 0)" }, { id: "nonpolar", label: "Non-polar (μ = 0)" }], right: m.net.polar ? "polar" : "nonpolar", explain: m.explain };
}
function qCancel(R) {
  const pool = POLARITY_SET.filter((id) => getMolecule(id).net.hasPolarBonds); const m = getMolecule(pool[Math.floor(R() * pool.length)]);
  return { type: "cancel", prompt: `Do the bond dipoles in ${m.formula} cancel each other?`, visual: { kind: "molecule", id: m.id, delta: true }, options: [{ id: "yes", label: "Yes, they cancel" }, { id: "no", label: "No, there is a net dipole" }], right: m.net.cancels ? "yes" : "no", explain: m.explain };
}
const shapeLabel = (m) => `${m.geometry.toLowerCase()}, ${m.net.polar ? "polar" : "non-polar"}`;
function qMatch(R) {
  const m = getMolecule(MATCH_SET[Math.floor(R() * MATCH_SET.length)]);
  const wrong = shuffle(MATCH_SET.map(getMolecule).filter((x) => shapeLabel(x) !== shapeLabel(m)), R); const seen = new Set([shapeLabel(m)]); const opts = [{ id: shapeLabel(m), label: shapeLabel(m) }];
  for (const w of wrong) { if (opts.length >= 3) break; if (!seen.has(shapeLabel(w))) { seen.add(shapeLabel(w)); opts.push({ id: shapeLabel(w), label: shapeLabel(w) }); } }
  return { type: "match", prompt: `Which description matches ${m.formula}?`, visual: { kind: "molecule", id: m.id, delta: true }, options: shuffle(opts, R), right: shapeLabel(m), explain: m.explain };
}
const bondLabel = ([a, b]) => `${a}–${b}`;
function qRank(R) { // rank three bonds from least to most polar by delta-EN
  const pool = shuffle(PAIRS, R); const pick = [];
  for (const pr of pool) { const d = elementBond(pr[0], pr[1]).dEN; if (pick.every((q) => Math.abs(elementBond(q[0], q[1]).dEN - d) >= 0.25)) pick.push(pr); if (pick.length === 3) break; }
  const order = [...pick].sort((p, q) => elementBond(p[0], p[1]).dEN - elementBond(q[0], q[1]).dEN); const key = (arr) => arr.map(bondLabel).join(" < ");
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map((ix) => ix.map((k) => order[k])); const right = key(order);
  const wrong = shuffle(perms.filter((p) => key(p) !== right), R).slice(0, 2); const options = shuffle([right, ...wrong.map(key)].map((k, n) => ({ id: `r${n}`, label: k, k })), R);
  const dens = order.map((b) => `${bondLabel(b)} ${elementBond(b[0], b[1]).dEN.toFixed(2)}`).join(", ");
  return { type: "rank", prompt: "Rank these bonds from least polar to most polar.", visual: { kind: "bonds", bonds: shuffle(pick, R) }, options: options.map(({ id, label }) => ({ id, label })), right: options.find((o) => o.k === right).id,
    explain: `The larger the electronegativity difference, the more polar the bond. ΔEN: ${dens}. So the order is ${right}.` };
}
function qPick(R) { // which of three molecules is polar / non-polar (shape decides)
  const wantPolar = R() < 0.5; const pool = POLARITY_SET.map(getMolecule); const hit = shuffle(pool.filter((m) => m.net.polar === wantPolar), R)[0];
  const others = shuffle(pool.filter((m) => m.net.polar !== wantPolar && m.formula !== hit.formula), R).slice(0, 2); const set = shuffle([hit, ...others], R);
  const line = (m) => `${m.formula}: ${m.net.polar ? "the bond dipoles do not cancel (polar)" : m.net.hasPolarBonds ? "the bond dipoles cancel (non-polar)" : "no polar bonds (non-polar)"}`;
  return { type: "pick", prompt: `Which of these molecules is ${wantPolar ? "polar" : "non-polar"}?`, visual: { kind: "set", ids: set.map((m) => m.id) }, options: set.map((m) => ({ id: m.id, label: m.formula })), right: hit.id, explain: `${set.map(line).join("; ")}.` };
}
function qDirection(R) { // predict the direction of the net dipole of a polar molecule
  const m = getMolecule(DIRECTION_SET[Math.floor(R() * DIRECTION_SET.length)]); const minusEl = m.atoms[m.signs.findIndex((x) => x < 0)].el;
  const counts = {}; m.atoms.forEach((a) => { if (a.el !== minusEl) counts[a.el] = (counts[a.el] ?? 0) + 1; }); const other = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const side = (el) => `Towards the ${el} atom${m.atoms.filter((a) => a.el === el).length > 1 ? "s" : ""}`;
  const options = shuffle([{ id: "minus", label: side(minusEl) }, { id: "plus", label: side(other) }], R);
  return { type: "direction", prompt: `Which way does the net dipole of ${m.formula} point?`, visual: { kind: "molecule", id: m.id, delta: false }, options, right: "minus",
    explain: `The net dipole points towards the more electronegative (δ−) side: ${minusEl} is more electronegative than ${other}, and the bond dipoles do not cancel in ${m.formula}, so the whole molecule has its negative end on the ${minusEl} side.` };
}
const BUILD = { en: qEN, partial: qPartial, arrow: qArrow, polar: qPolar, cancel: qCancel, match: qMatch, rank: qRank, pick: qPick, direction: qDirection };
const MOLECULE_LEVEL = new Set(["polar", "cancel", "match", "pick", "direction"]);

/** A round of ROUND_LENGTH questions: deterministic for a seed; a mix of the atom-level and the molecule-level types. */
export function buildRound(seed = 1) {
  const R = rng(seed); let order = shuffle(TYPES, R).slice(0, ROUND_LENGTH);
  // always a mix: at least two bond-level and at least two molecule-level questions
  const molN = () => order.filter((t) => MOLECULE_LEVEL.has(t)).length;
  if (molN() < 2) { const add = TYPES.find((t) => MOLECULE_LEVEL.has(t) && !order.includes(t)); const i = order.findIndex((t) => !MOLECULE_LEVEL.has(t)); if (add && i >= 0) order[i] = add; }
  if (molN() > 3) { const add = TYPES.find((t) => !MOLECULE_LEVEL.has(t) && !order.includes(t)); const i = order.findIndex((t) => MOLECULE_LEVEL.has(t)); if (add && i >= 0) order[i] = add; }
  return order.map((t, i) => { const q = BUILD[t](rng(seed * 101 + i * 17 + 3)); return { ...q, id: `q${i + 1}` }; });
}
export const check = (q, choice) => ({ correct: choice === q.right, right: q.right, explain: q.explain });
export function stars(correct, total = ROUND_LENGTH) { const f = correct / total; return f >= 0.99 ? 3 : f >= 0.6 ? 2 : correct >= 1 ? 1 : 0; }
