// Lewis-structure resolver: PURE. Takes the multiset of atoms a student has placed (plus an optional overall charge) and works out
// the best Lewis structure:  skeleton (which atoms bond to which)  ->  bond orders  ->  lone pairs  ->  formal charges.
//
// How it decides (the same order a teacher would use):
//   1. count the valence electrons, subtract the charge (a 2- ion has two extra electrons);
//   2. try every skeleton (a tree of the non-hydrogen atoms, hydrogens hung on them; H and F can only be terminal);
//   3. for each skeleton try every bond order (single / double / triple) that the two atoms may share;
//   4. put the remaining electrons on atoms as lone pairs, giving each atom a full octet (duet for H) first, then the smallest
//      formal charges, then negative charge on the more electronegative atom;
//   5. prefer the skeleton whose central atom is the least electronegative one (a small tie-break only: formal charges decide first).
// Anything that needs MORE than an octet (PCl5, SF6, XeF4 ...) or an unpaired electron (NO, NO2) is refused unless `beyond` is set:
// that is the same "beyond the course" switch idea the Hybridisation Explorer uses.  Rings are not searched (chains and branches only).
//
// The structure returned has the shape of a model/covalent.js molecule so the existing polarity code can read it:
//   { atoms:[symbol], bonds:[[i, j, order, {donor,n}?]], lonePairs:[n], radicals:[0|1], formal:[n], ionCharges:[n], charge, ... }
import { INCOMPLETE_OK, EN, lewisElement, maxDegree, maxElectrons, maxPairOrder } from "./data.js";

export const MAX_ATOMS = 14;
export const MAX_HEAVY = 6;
const BUDGET = 120000; // candidate evaluations before the search gives up (random inputs must never hang the page)
const TIME_LIMIT_MS = 1500; // wall-clock limit of one resolveAtoms() call, shared by the charge suggestions
const EPS = 1e-6;
const W_OO = 30; const W_OXHAL = 25; const W_FORMAL = 10; const W_MISSING = 100; const W_EXPAND = 4; const W_EN = 0.4; const W_SKELETON = 1.0; const W_ADJACENT = 15; const W_RADICAL_TERMINAL = 25;

const sumBy = (a, f) => a.reduce((s, x, i) => s + f(x, i), 0);
const isH = (s) => s === "H";
/** Atoms that can only ever be on the end of a bond (one bond): they are hung on the skeleton instead of being part of it. */
const isLeafOnly = (s) => s === "H" || s === "F";

// ---------------------------------------------------------------------------------------------------------------
// Canonical form (isomorphism test for labelled trees / small graphs): Weisfeiler-Lehman colour refinement.
// ---------------------------------------------------------------------------------------------------------------
/** A string that is equal for two structures exactly when they are the same molecule (atoms, bond orders, lone pairs, formal charges). */
export function canonical(s) {
  const n = s.atoms.length;
  const adj = Array.from({ length: n }, () => []);
  for (const [i, j, o] of s.bonds) { adj[i].push([j, o]); adj[j].push([i, o]); }
  let col = s.atoms.map((a, i) => `${a}|${s.lonePairs[i]}|${s.formal[i]}|${s.radicals?.[i] ?? 0}`);
  for (let r = 0; r < Math.max(3, n); r += 1) {
    col = col.map((c, i) => `${c}[${adj[i].map(([j, o]) => `${o}:${col[j]}`).sort().join(",")}]`);
    // shrink the strings so they do not grow without bound
    const map = new Map(); [...new Set(col)].sort().forEach((c, k) => map.set(c, `c${k}`));
    col = col.map((c) => map.get(c));
    if (r > 0 && new Set(col).size === n) break;
  }
  const base = s.atoms.map((a, i) => `${a}|${s.lonePairs[i]}|${s.formal[i]}|${s.radicals?.[i] ?? 0}`);
  // second pass keeps the readable base labels in the final string so equal strings really mean equal graphs for trees
  return [...col.map((c, i) => `${base[i]}~${c}`)].sort().join(";") + `#${s.bonds.length}`;
}

/** Tree canonical form with node labels (used to drop duplicate skeletons). */
function treeKey(labels, edges) {
  const n = labels.length;
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const rooted = (u, p) => `${labels[u]}(${adj[u].filter((v) => v !== p).map((v) => rooted(v, u)).sort().join(",")})`;
  let best = null;
  for (let r = 0; r < n; r += 1) { const k = rooted(r, -1); if (best === null || k < best) best = k; }
  return best;
}

function pruferTrees(m) {
  if (m === 1) return [[]];
  if (m === 2) return [[[0, 1]]];
  const out = [];
  const len = m - 2;
  const seq = new Array(len).fill(0);
  const decode = () => {
    const deg = new Array(m).fill(1);
    for (const v of seq) deg[v] += 1;
    const edges = [];
    for (const v of seq) {
      for (let u = 0; u < m; u += 1) if (deg[u] === 1) { edges.push([u, v]); deg[u] -= 1; deg[v] -= 1; break; }
    }
    const rest = []; for (let u = 0; u < m; u += 1) if (deg[u] === 1) rest.push(u);
    edges.push([rest[0], rest[1]]);
    return edges;
  };
  const rec = (k) => { if (k === len) { out.push(decode()); return; } for (let v = 0; v < m; v += 1) { seq[k] = v; rec(k + 1); } };
  rec(0);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Skeleton generation
// ---------------------------------------------------------------------------------------------------------------
/** Yields skeletons: { edges:[[i,j]] (all sigma bonds, atom indices of the INPUT list), heavyEdges:[[i,j]] (the ones whose order may vary) }. */
function* skeletons(symbols, beyond) {
  const heavy = []; const hyd = [];
  symbols.forEach((s, i) => (isLeafOnly(s) ? hyd : heavy).push(i));
  const nH = hyd.length;
  if (heavy.length === 0) { if (nH === 2) yield { edges: [[hyd[0], hyd[1]]], heavyEdges: [] }; return; }
  const seenHeavy = new Set();
  for (const tree of pruferTrees(heavy.length)) {
    const labelsHeavy = heavy.map((i) => symbols[i]);
    const key = treeKey(labelsHeavy, tree);
    if (seenHeavy.has(key)) continue;
    seenHeavy.add(key);
    const deg = new Array(heavy.length).fill(0);
    for (const [a, b] of tree) { deg[a] += 1; deg[b] += 1; }
    const room = heavy.map((idx, k) => maxDegree(symbols[idx], beyond) - deg[k]);
    if (room.some((r) => r < 0)) continue;
    if (sumBy(room, (r) => r) < nH) continue;
    const counts = new Array(heavy.length).fill(0);
    const seenFull = new Set();
    const rec = function* (k, left) {
      if (k === heavy.length) {
        if (left !== 0) return;
        const lab = heavy.map((idx, q) => `${symbols[idx]}H${counts[q]}`);
        const fk = treeKey(lab, tree);
        if (seenFull.has(fk)) return;
        seenFull.add(fk);
        const edges = tree.map(([a, b]) => [heavy[a], heavy[b]]);
        const heavyEdges = edges.map((e) => [...e]);
        let h = 0;
        counts.forEach((c, q) => { for (let t = 0; t < c; t += 1) edges.push([heavy[q], hyd[h++]]); });
        yield { edges, heavyEdges };
        return;
      }
      const restRoom = sumBy(room.slice(k + 1), (r) => r);
      for (let c = Math.min(room[k], left); c >= 0; c -= 1) {
        if (left - c > restRoom) break;
        counts[k] = c;
        yield* rec(k + 1, left - c);
      }
      counts[k] = 0;
    };
    yield* rec(0, nH);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Evaluation of one skeleton + bond orders
// ---------------------------------------------------------------------------------------------------------------
function evaluate(symbols, edges, V, beyond) {
  const n = symbols.length;
  const el = symbols.map(lewisElement);
  const b = new Array(n).fill(0);
  for (const [i, j, o] of edges) { b[i] += o; b[j] += o; }
  const pbond = sumBy(edges, (e) => e[2]);
  const maxEl = symbols.map((s) => maxElectrons(s, beyond));
  for (let i = 0; i < n; i += 1) if (2 * b[i] > maxEl[i]) return null;
  const rem = V - 2 * pbond;
  if (rem < 0) return null;
  const rad = rem % 2;
  if (rad && !beyond) return null;
  const pairs = (rem - rad) / 2;
  const heavyDeg = symbols.map((_, i) => edges.filter((e) => e[0] === i || e[1] === i).length);
  const hasHub = heavyDeg.some((d, i) => !isH(symbols[i]) && d > 1);

  const cost = (i, l, host) => {
    const e = 2 * l + 2 * b[i] + (host ? 1 : 0);
    const f = el[i].valence - 2 * l - b[i] - (host ? 1 : 0);
    let c = W_FORMAL * Math.abs(f) + W_EN * el[i].en * f;
    const target = isH(symbols[i]) ? 2 : host ? 7 : 8;
    if (!INCOMPLETE_OK.has(symbols[i]) && e < target) c += W_MISSING * ((target - e) / 2);
    if (e > 8 && !isH(symbols[i])) c += W_EXPAND * ((e - 8) / 2);
    return c;
  };

  let best = null;
  const hosts = rad ? symbols.map((_, i) => i).filter((i) => !isH(symbols[i])) : [-1];
  for (const host of hosts) {
    const cap = symbols.map((_, i) => Math.floor((maxEl[i] - 2 * b[i] - (i === host ? 1 : 0)) / 2));
    if (cap.some((c) => c < 0)) continue;
    if (sumBy(cap, (c) => c) < pairs) continue;
    const lp = new Array(n).fill(0);
    for (let k = 0; k < pairs; k += 1) {
      let pick = -1; let pickGain = Infinity;
      for (let i = 0; i < n; i += 1) {
        if (lp[i] >= cap[i]) continue;
        const inc = cost(i, lp[i] + 1, i === host) - cost(i, lp[i], i === host);
        if (inc < pickGain - EPS || (Math.abs(inc - pickGain) <= EPS && pick >= 0 && el[i].en > el[pick].en)) { pick = i; pickGain = inc; }
      }
      if (pick < 0) { pick = -2; break; }
      lp[pick] += 1;
    }
    if (lp.some((x, i) => x > cap[i])) continue;
    // validity
    const formal = symbols.map((_, i) => el[i].valence - 2 * lp[i] - b[i] - (i === host ? 1 : 0));
    let ok = true;
    for (let i = 0; i < n && ok; i += 1) {
      const e = 2 * lp[i] + 2 * b[i] + (i === host ? 1 : 0);
      const target = isH(symbols[i]) ? 2 : i === host ? 7 : 8;
      if (!INCOMPLETE_OK.has(symbols[i]) && e < target) ok = false;
      if (isH(symbols[i]) && (e !== 2 || formal[i] !== 0)) ok = false;
      if (Math.abs(formal[i]) > (el[i].period === 2 || isH(symbols[i]) ? 1 : 3)) ok = false;
      if (e > 8 && !isH(symbols[i]) && !beyond) ok = false;
    }
    if (!ok) continue;
    let score = sumBy(symbols, (_, i) => cost(i, lp[i], i === host));
    for (const [i, j] of edges) {
      if (formal[i] !== 0 && Math.sign(formal[i]) === Math.sign(formal[j])) score += W_ADJACENT;
      if (symbols[i] === "O" && symbols[j] === "O") score += W_OO; // peroxide / ozone links are real but never preferred over a central atom
      for (const [x, y] of [[i, j], [j, i]]) {
        // a bridging O between a halogen and another heavy atom (Hal-O-X) is unusual: thionyl chloride is O=S(Cl)2, not Cl-O-S-Cl
        if (symbols[x] === "O" && ["Cl", "Br", "I"].includes(symbols[y]) && edges.some((e) => (e[0] === x || e[1] === x) && symbols[e[0] === x ? e[1] : e[0]] !== "H" && !["Cl", "Br", "I", "F"].includes(symbols[e[0] === x ? e[1] : e[0]]))) score += W_OXHAL;
      }
    }
    for (let i = 0; i < n; i += 1) if (!isH(symbols[i])) score += W_SKELETON * (heavyDeg[i] - 1) * el[i].en;
    if (host >= 0 && heavyDeg[host] === 1 && hasHub) score += W_RADICAL_TERMINAL;
    if (!best || score < best.score - EPS) best = { score, lp, formal, host };
  }
  return best;
}

/** All bond-order assignments of the variable (heavy-heavy) edges; yields complete edge lists [i, j, order]. */
function* orderAssignments(symbols, skeleton, beyond) {
  const n = symbols.length;
  const fixed = skeleton.edges.filter((e) => !skeleton.heavyEdges.some((h) => h[0] === e[0] && h[1] === e[1])).map(([i, j]) => [i, j, 1]);
  const bSum = new Array(n).fill(0);
  for (const [i, j] of fixed) { bSum[i] += 1; bSum[j] += 1; }
  for (const [i, j] of skeleton.heavyEdges) { bSum[i] += 1; bSum[j] += 1; }
  const limit = symbols.map((s) => maxElectrons(s, beyond) / 2);
  const cur = skeleton.heavyEdges.map(([i, j]) => [i, j, 1]);
  const rec = function* (k) {
    if (k === cur.length) { yield [...fixed, ...cur.map((e) => [...e])]; return; }
    const [i, j] = cur[k];
    const mx = maxPairOrder(symbols[i], symbols[j], beyond);
    for (let o = 1; o <= mx; o += 1) {
      const di = o - 1;
      if (di > 0 && (bSum[i] + di > limit[i] || bSum[j] + di > limit[j])) break;
      cur[k][2] = o; bSum[i] += di; bSum[j] += di;
      yield* rec(k + 1);
      bSum[i] -= di; bSum[j] -= di;
    }
    cur[k][2] = 1;
  };
  yield* rec(0);
}

// ---------------------------------------------------------------------------------------------------------------
// Post-processing: central atom, resonance, coordinate (dative) bonds
// ---------------------------------------------------------------------------------------------------------------
function assemble(symbols, edges, lp, formal, host, charge) {
  const s = {
    atoms: [...symbols], bonds: edges.map(([i, j, o]) => [Math.min(i, j), Math.max(i, j), o]), lonePairs: [...lp],
    radicals: symbols.map((_, i) => (i === host ? 1 : 0)), formal: [...formal], charge,
  };
  s.bonds.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return finalizeStructure(s);
}

/** Adds the derived fields to a bare { atoms, bonds, lonePairs, radicals, formal, charge }: electrons around each atom, expanded / radical flags, central atom, coordinate bonds, resonance. */
export function finalizeStructure(s) {
  const symbols = s.atoms; const lp = s.lonePairs;
  s.radicals = s.radicals ?? symbols.map(() => 0);
  s.electronsAround = symbols.map((_, i) => 2 * lp[i] + 2 * sumBy(s.bonds.filter((b) => b[0] === i || b[1] === i), (b) => b[2]) + s.radicals[i]);
  s.expanded = symbols.map((a, i) => !isH(a) && s.electronsAround[i] > 8);
  s.isExpanded = s.expanded.some(Boolean);
  s.isRadical = s.radicals.some(Boolean);
  s.beyondUsed = s.isExpanded || s.isRadical;
  s.incomplete = symbols.map((a, i) => !isH(a) && s.electronsAround[i] < 8 && !s.radicals[i]);
  s.centre = centreOf(s);
  markDative(s);
  s.owned = ownedElectrons(s);
  s.adjFormal = s.atoms.map((a, i) => lewisElement(a).valence - s.owned[i]);
  s.resonance = resonanceOf(s);
  return s;
}

/** Index of the central atom (highest degree among non-H atoms; ties: least electronegative); null for a diatomic or a chain with no single centre. */
export function centreOf(s) {
  const deg = s.atoms.map((_, i) => s.bonds.filter((b) => b[0] === i || b[1] === i).length);
  const heavy = s.atoms.map((a, i) => i).filter((i) => !isH(s.atoms[i]));
  if (s.atoms.length <= 2) return null;
  if (heavy.length === 1) return heavy[0];
  // one centre when every other atom is a terminal atom bonded to it
  const hub = heavy.filter((i) => deg[i] > 1);
  if (hub.length === 1) return hub[0];
  return null;
}

const bondOf = (s, i, j) => s.bonds.find((b) => (b[0] === i && b[1] === j) || (b[0] === j && b[1] === i));
const neighboursOf = (s, i) => s.bonds.filter((b) => b[0] === i || b[1] === i).map((b) => (b[0] === i ? b[1] : b[0]));

/** Electrons each atom OWNS in the final picture: lone pairs + unpaired + its share of every bond (a coordinate pair belongs entirely to the donor). */
export function ownedElectrons(s) {
  return s.atoms.map((_, i) => 2 * s.lonePairs[i] + (s.radicals?.[i] ?? 0) + sumBy(s.bonds.filter((b) => b[0] === i || b[1] === i), (b) => {
    const dn = b[3]?.n ?? 0;
    return b[2] + (b[3] ? (b[3].donor === i ? dn : -dn) : 0);
  }));
}

/** Coordinate (dative) bonds where the IB course draws them: H+ joining a lone pair (NH4+, H3O+), C-/X+ triple bonds (CO), and BF3 / AlCl3 type adducts. */
function markDative(s) {
  const f = s.formal;
  // (a) a cation whose + atom carries hydrogens: that atom used a lone pair to bond to an H+ (the acceptor has no electrons)
  if (s.charge > 0) {
    for (let x = 0; x < s.atoms.length; x += 1) {
      if (f[x] !== 1 || !["N", "O", "P", "S"].includes(s.atoms[x])) continue;
      const h = neighboursOf(s, x).find((k) => isH(s.atoms[k]));
      if (h === undefined) continue;
      bondOf(s, x, h)[3] = { donor: x, n: 1 };
      return;
    }
  }
  // (b) C- triple-bonded to X+ (carbon monoxide, isocyanides): the third pair comes entirely from X
  for (const b of s.bonds) {
    if (b[2] !== 3) continue;
    for (const [c, x] of [[b[0], b[1]], [b[1], b[0]]]) {
      if (s.atoms[c] === "C" && f[c] === -1 && f[x] === 1) { b[3] = { donor: x, n: 1 }; return; }
    }
  }
  // (c) acceptor B / Al / Be (negative formal charge) joined to a + donor: H3N->BF3 style adducts
  for (const b of s.bonds) {
    if (b[2] !== 1) continue;
    for (const [acc, don] of [[b[0], b[1]], [b[1], b[0]]]) {
      if (["B", "Al", "Be"].includes(s.atoms[acc]) && f[acc] === -1 && f[don] === 1) { b[3] = { donor: don, n: 1 }; return; }
    }
  }
}

/** Atoms that are interchangeable in the skeleton but are drawn differently (equal neighbours, different bond order / charge) => resonance. */
function resonanceOf(s) {
  const groups = new Map();
  s.atoms.forEach((a, i) => {
    const nb = neighboursOf(s, i);
    if (nb.length !== 1 || isH(a)) return;
    const key = `${nb[0]}|${a}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  const out = [];
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    const centre = Number(key.split("|")[0]);
    const sig = members.map((i) => `${bondOf(s, i, centre)[2]}/${s.formal[i]}/${s.lonePairs[i]}`);
    if (new Set(sig).size < 2) continue;
    // the neighbours must also carry the same attachments (an -OH oxygen is not equivalent to a terminal =O / -O-)
    const orders = members.map((i) => bondOf(s, i, centre)[2]);
    out.push({ centre, atoms: members, orders, average: sumBy(orders, (o) => o) / orders.length, forms: combinations(members.length, orders.filter((o) => o > 1).length) });
  }
  return out.length ? out : null;
}
function combinations(n, k) { let r = 1; for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i; return Math.round(r); }

// ---------------------------------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------------------------------
/** All best structures at a fixed charge: { best, ties:[structure...] (same score, different molecule), truncated } or null when nothing is valid. */
export function searchStructures(symbols, { charge = 0, beyond = false, deadline = Infinity } = {}) {
  const V = sumBy(symbols, (s) => lewisElement(s).valence) - charge;
  if (V < 2) return null;
  // cheap impossibility tests: an odd electron count needs the unpaired-electron switch, and the electrons plus the bonds' double counting must fit in the atoms' shells
  if (!beyond && V % 2) return null;
  if (V + 2 * (symbols.length - 1) > sumBy(symbols, (x) => maxElectrons(x, beyond))) return null;
  let evals = 0; let truncated = false;
  const found = new Map();
  let bestScore = Infinity;
  outer: for (const sk of skeletons(symbols, beyond)) {
    for (const edges of orderAssignments(symbols, sk, beyond)) {
      evals += 1;
      if (evals > BUDGET || ((evals & 255) === 0 && Date.now() > deadline)) { truncated = true; break outer; }
      const r = evaluate(symbols, edges, V, beyond);
      if (!r) continue;
      if (r.score > bestScore + 2) continue;
      const s = assemble(symbols, edges, r.lp, r.formal, r.host, charge);
      const key = canonical(s);
      const prev = found.get(key);
      if (!prev || r.score < prev.score) found.set(key, { s, score: r.score });
      if (r.score < bestScore) bestScore = r.score;
    }
  }
  if (!found.size) return truncated ? { best: null, ties: [], truncated } : null;
  const ranked = [...found.values()].sort((a, b) => a.score - b.score || canonical(a.s).localeCompare(canonical(b.s)));
  const top = ranked[0];
  const ties = ranked.filter((x) => x.score <= top.score + EPS).map((x) => x.s);
  return { best: top.s, score: top.score, ties, others: ranked.slice(0, 12).map((x) => x.s), truncated, evaluations: evals };
}

/** Quick yes/no: is there any acceptable structure for these atoms at this charge? */
export const canResolve = (symbols, opts) => !!searchStructures(symbols, opts)?.best;

/** Electron bookkeeping check of any structure (returns a list of problems; empty = every electron accounted for). */
export function validateStructure(s) {
  const problems = [];
  const n = s.atoms.length;
  let valenceSum = 0;
  for (let i = 0; i < n; i += 1) {
    const el = lewisElement(s.atoms[i]);
    if (!el) { problems.push(`unknown element ${s.atoms[i]}`); return problems; }
    valenceSum += el.valence;
    const b = sumBy(s.bonds.filter((x) => x[0] === i || x[1] === i), (x) => x[2]);
    const std = el.valence - (2 * s.lonePairs[i] + (s.radicals?.[i] ?? 0) + b);
    if (std !== s.formal[i]) problems.push(`${s.atoms[i]}#${i}: formal charge ${s.formal[i]} but the electron count gives ${std}`);
  }
  const drawn = 2 * sumBy(s.lonePairs, (x) => x) + sumBy(s.radicals ?? [], (x) => x) + 2 * sumBy(s.bonds, (b) => b[2]);
  if (drawn !== valenceSum - s.charge) problems.push(`${drawn} electrons drawn but ${valenceSum - s.charge} available`);
  if (sumBy(s.formal, (x) => x) !== s.charge) problems.push(`formal charges add to ${sumBy(s.formal, (x) => x)}, not ${s.charge}`);
  if (s.adjFormal && sumBy(s.adjFormal, (x) => x) !== s.charge) problems.push("coordinate-bond accounting does not add to the charge");
  for (const b of s.bonds) {
    if (b[3] && (b[3].donor !== b[0] && b[3].donor !== b[1])) problems.push("coordinate bond donor is not on the bond");
    if (b[3] && b[3].n > b[2]) problems.push("more coordinate pairs than pairs in the bond");
  }
  const seen = new Set([0]); const st = [0];
  while (st.length) { const i = st.pop(); for (const k of neighboursOf(s, i)) if (!seen.has(k)) { seen.add(k); st.push(k); } }
  if (seen.size !== n) problems.push("the atoms are not one connected species");
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------------------------------------------
export const CHARGE_TRIALS = [1, -1, 2, -2, 3, -3];
export const chargeLabel = (q) => (q === 0 ? "0" : q > 0 ? `${q}+` : `${-q}\u2212`);

/**
 * resolveAtoms(symbols, { charge, beyond })
 *   ok:true  -> { structure, ties:[other equally good structures], searchedBeyond }
 *   ok:false -> { code, message, needsBeyond?, chargeSuggestions:[{charge, structure}] }
 * `code`: "few" | "unknown" | "too-many" | "needs-charge" | "needs-beyond" | "no-structure" | "too-complex".
 */
const MEMO = new Map();
export function resolveAtoms(symbols, opts = {}) {
  const { charge = 0, beyond = false, deadline = null } = opts;
  const key = `${[...(symbols ?? [])].sort().join(",")}|${charge}|${beyond ? 1 : 0}`;
  if (MEMO.has(key)) return MEMO.get(key);
  const out = resolveUncached(symbols, { charge, beyond, deadline });
  if (!out.truncated && !(deadline && Date.now() > deadline)) { MEMO.set(key, out); if (MEMO.size > 200) MEMO.delete(MEMO.keys().next().value); }
  return out;
}

function resolveUncached(symbols, { charge = 0, beyond = false, deadline: given = null } = {}) {
  const deadline = given ?? Date.now() + TIME_LIMIT_MS;
  if (!Array.isArray(symbols) || symbols.length < 2) return { ok: false, code: "few", message: symbols?.length === 1 ? `Add at least one more atom to bond with ${symbols[0]}.` : "Add atoms from the library.", chargeSuggestions: [] };
  const bad = symbols.find((s) => !lewisElement(s));
  if (bad) return { ok: false, code: "unknown", message: `${bad} is not part of the covalent model.`, chargeSuggestions: [] };
  if (symbols.length > MAX_ATOMS || symbols.filter((s) => !isLeafOnly(s)).length > MAX_HEAVY) {
    return { ok: false, code: "too-many", message: `Too many atoms to work out automatically (limit: ${MAX_ATOMS} atoms, and at most ${MAX_HEAVY} that are not H or F).`, chargeSuggestions: [] };
  }
  const here = searchStructures(symbols, { charge, beyond, deadline });
  if (here?.best) {
    return { ok: true, structure: here.best, ties: here.ties.filter((t) => t !== here.best), score: here.score, beyond, truncated: !!here.truncated };
  }
  if (here?.truncated) return { ok: false, code: "too-complex", truncated: true, message: "This combination has too many possible structures to search here. Try fewer atoms.", chargeSuggestions: [] };
  // not possible at this charge: is another charge possible?
  const suggestions = [];
  for (const q of [0, ...CHARGE_TRIALS]) {
    if (q === charge) continue;
    if (Date.now() > deadline) break;
    const r = searchStructures(symbols, { charge: q, beyond, deadline });
    if (r?.best) suggestions.push({ charge: q, structure: r.best, score: r.score });
  }
  suggestions.sort((a, b) => Math.abs(a.charge) - Math.abs(b.charge) || a.score - b.score);
  const sug = suggestions.slice(0, 3);
  let needsBeyond = false;
  if (!beyond) {
    needsBeyond = Date.now() < deadline && !!searchStructures(symbols, { charge, beyond: true, deadline })?.best;
    if (!needsBeyond) needsBeyond = false;
  }
  if (needsBeyond) {
    return { ok: false, code: "needs-beyond", message: "", needsBeyond: true, chargeSuggestions: sug };
  }
  if (sug.length) return { ok: false, code: "needs-charge", message: "", needsBeyond, chargeSuggestions: sug };
  return { ok: false, code: "no-structure", message: "", needsBeyond, chargeSuggestions: [] };
}
