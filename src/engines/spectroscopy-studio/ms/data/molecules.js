// The molecules of the six-stage Mass Spectrometry experiment: structure (3D ball-and-stick geometry) and the VERIFIED fragmentation pathways. PURE DATA + a small builder.
//
// WHAT IS HERE. For each molecule: the heavy-atom skeleton (angstrom, typical bond lengths and angles), the hydrogens placed on it by a geometry rule, and the
// pathways that appear in the representative EI spectrum of the molecule (data/spectra.js). A pathway says which bonds break, which atoms stay with the charge
// (the charged fragment), which atoms leave as the neutral product, and which peak of the spectrum it feeds. NOTHING is invented to look good: every pathway
// below is a textbook route, and scripts/test-ms-model.mjs checks mechanically that
//   * the atoms of the charged fragment add up (nominal mass) to the m/z of the peak it points to,
//   * charged mass + neutral mass = the mass of the species it comes from (so the equation balances),
//   * the radical-cation dot of the label agrees with the electron count (odd number of electrons = radical cation).
// The pathway "rel" is the relative intensity of the PEAK in the representative spectrum (not a branching ratio of a single step).
// Pathways marked `secondary` start from a fragment (`from`), not from the molecular ion.
import { SPECTRA } from "./spectra.js";

const D2R = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const perp = (a) => { const t = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; return norm(cross(a, t)); };
export const ATOM_MASS = Object.freeze({ H: 1, C: 12, O: 16, N: 14, Cl: 35, Br: 79 });
const CH_BOND = 1.09; const OH_BOND = 0.96;

/** Directions (unit vectors) for the hydrogens of one heavy atom, from the unit vectors to its heavy neighbours. */
function hydrogenDirs(dirs, nH) {
  if (nH === 0) return [];
  if (dirs.length === 0) { const T = 1 / Math.sqrt(3); return [[T, T, T], [T, -T, -T], [-T, T, -T], [-T, -T, T]].slice(0, nH); }
  if (dirs.length === 1) {
    const a = mul(dirs[0], -1); const u = perp(a); const v = cross(a, u); const ang = (nH === 1 ? 75.5 : 70.5) * D2R;
    return Array.from({ length: nH }, (_, j) => { const phi = (2 * Math.PI * j) / Math.max(nH, 1) + (nH === 1 ? Math.PI / 2 : 0.4); return add(mul(a, Math.cos(ang)), mul(add(mul(u, Math.cos(phi)), mul(v, Math.sin(phi))), Math.sin(ang))); });
  }
  if (dirs.length === 2) {
    const b = norm(mul(add(dirs[0], dirs[1]), -1)); let n = cross(dirs[0], dirs[1]); n = Math.hypot(...n) < 1e-6 ? perp(b) : norm(n); const a = 54.75 * D2R;
    return [add(mul(b, Math.cos(a)), mul(n, Math.sin(a))), add(mul(b, Math.cos(a)), mul(n, -Math.sin(a)))].slice(0, nH);
  }
  return [norm(mul(dirs.reduce(add, [0, 0, 0]), -1))];
}

/** def.heavy [{id, el, p, nH}], def.bonds [[a, b, order]] between heavy atoms. Returns { atoms:[{id, el, p, heavy}], bonds:[[idA, idB, order]] } with hydrogens "<heavy>h<k>". */
export function buildGeometry(def) {
  const byId = Object.fromEntries(def.heavy.map((h) => [h.id, h]));
  const nb = Object.fromEntries(def.heavy.map((h) => [h.id, []]));
  for (const [a, b] of def.bonds) { nb[a].push(b); nb[b].push(a); }
  const atoms = def.heavy.map((h) => ({ id: h.id, el: h.el, p: h.p, heavy: true }));
  const bonds = def.bonds.map(([a, b, o = 1]) => [a, b, o]);
  for (const h of def.heavy) {
    const dirs = nb[h.id].map((id) => norm(sub(byId[id].p, h.p)));
    hydrogenDirs(dirs, h.nH ?? 0).forEach((d, k) => {
      const id = `${h.id}h${k + 1}`; atoms.push({ id, el: "H", p: add(h.p, mul(d, h.el === "O" ? OH_BOND : CH_BOND)), heavy: false, parent: h.id }); bonds.push([h.id, id, 1]);
    });
  }
  return { atoms, bonds };
}
/** a heavy atom together with its hydrogens */
export const withH = (...ids) => ids.flatMap((id) => [id, ...[1, 2, 3, 4].map((k) => `${id}h${k}`)]);

const massOf = (geo, ids) => { const have = new Set(geo.atoms.map((a) => a.id)); return ids.filter((i) => have.has(i)).reduce((s, i) => s + ATOM_MASS[geo.atoms.find((a) => a.id === i).el], 0); };
const formulaOf = (geo, ids) => {
  const have = new Set(geo.atoms.map((a) => a.id)); const c = {};
  for (const i of ids) { if (!have.has(i)) continue; const el = geo.atoms.find((a) => a.id === i).el; c[el] = (c[el] ?? 0) + 1; }
  return ["C", "H", "O", "N", "Cl", "Br"].filter((e) => c[e]).map((e) => `${e}${c[e] > 1 ? c[e] : ""}`).join("");
};
const SUBD = "₀₁₂₃₄₅₆₇₈₉";
/** Hill-style display formula of an atom list: "C₂H₃O" */
export const displayFormula = (geo, ids) => formulaOf(geo, ids).replace(/\d/g, (d) => SUBD[d]);

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Pathway builder. `charged` = atoms that keep the charge. `from` = the id of the parent pathway, or null for the molecular ion.
const rel = (spec, mz) => spec.byMz[mz].rel;
function pathway(spec, geo, p) {
  const all = geo.atoms.map((a) => a.id);
  const parentIds = p.fromIds ?? all;
  const chargedIds = p.charged.flatMap((x) => withH(x)).filter((i, k, arr) => arr.indexOf(i) === k && all.includes(i));
  const exclude = new Set((p.chargedWithout ?? []));
  const charged = chargedIds.filter((i) => !exclude.has(i) && parentIds.includes(i));
  const neutral = parentIds.filter((i) => !charged.includes(i));
  return {
    ...p, charged, neutral, parentIds,
    mz: p.mz, rel: rel(spec, p.mz), peak: spec.byMz[p.mz],
    chargedFormula: displayFormula(geo, charged), neutralFormula: displayFormula(geo, neutral),
    chargedMass: massOf(geo, charged), neutralMass: massOf(geo, neutral),
  };
}

// ---- methane ----
const METHANE_GEO = buildGeometry({ heavy: [{ id: "C", el: "C", p: [0, 0, 0], nH: 4 }], bonds: [] });
// ---- propanone: CH3-C(=O)-CH3 ----
const PROPANONE_GEO = buildGeometry({
  heavy: [{ id: "C1", el: "C", p: [-1.31, -0.76, 0], nH: 3 }, { id: "C2", el: "C", p: [0, 0, 0], nH: 0 }, { id: "O", el: "O", p: [0, 1.22, 0], nH: 0 }, { id: "C3", el: "C", p: [1.31, -0.76, 0], nH: 3 }],
  bonds: [["C1", "C2"], ["C2", "O", 2], ["C2", "C3"]],
});
// ---- butan-2-one: CH3(C1)-C(=O)(C2)-CH2(C3)-CH3(C4) ----
const BUTANONE_GEO = buildGeometry({
  heavy: [{ id: "C1", el: "C", p: [-1.31, -0.76, 0], nH: 3 }, { id: "C2", el: "C", p: [0, 0, 0], nH: 0 }, { id: "O", el: "O", p: [0, 1.22, 0.0], nH: 0 }, { id: "C3", el: "C", p: [1.31, -0.76, 0], nH: 2 }, { id: "C4", el: "C", p: [1.1, -2.28, 0.25], nH: 3 }],
  bonds: [["C1", "C2"], ["C2", "O", 2], ["C2", "C3"], ["C3", "C4"]],
});
// ---- ethanol: CH3(C1)-CH2(C2)-OH(O) ----
const ETHANOL_GEO = buildGeometry({
  heavy: [{ id: "C1", el: "C", p: [0, 0, 0], nH: 3 }, { id: "C2", el: "C", p: [1.45, 0.5, 0], nH: 2 }, { id: "O", el: "O", p: [2.35, -0.61, 0], nH: 1 }],
  bonds: [["C1", "C2"], ["C2", "O"]],
});

const NEUTRAL_KIND = { H1: "hydrogen atom (radical)", CH3: "methyl radical", H2: "hydrogen molecule", CO: "carbon monoxide molecule", OH: "hydroxyl radical", C2H5: "ethyl radical", COCH3: "acetyl radical", COC2H5: "propanoyl radical" };

function methane() {
  const S = SPECTRA.methane; const g = METHANE_GEO;
  const P = (x) => pathway(S, g, x);
  const p15 = P({ id: "mz15", mz: 15, from: null, charged: ["C"], chargedWithout: ["Ch4"], breaks: [["C", "Ch4"]], forms: [], eq: "CH₄⁺• → CH₃⁺ + H•", neutralLabel: "H•", neutralKind: NEUTRAL_KIND.H1, text: "A C–H bond breaks. The charge stays on the carbon fragment; the hydrogen atom leaves as a neutral radical." });
  const p14 = P({ id: "mz14", mz: 14, from: null, charged: ["C"], chargedWithout: ["Ch3", "Ch4"], breaks: [["C", "Ch3"], ["C", "Ch4"]], forms: [["Ch3", "Ch4"]], eq: "CH₄⁺• → CH₂⁺• + H₂", neutralLabel: "H₂", neutralKind: NEUTRAL_KIND.H2, text: "Two hydrogens leave together as a neutral H₂ molecule (a new H–H bond forms as two C–H bonds break). The charged fragment keeps the unpaired electron." });
  const p13 = P({ id: "mz13", mz: 13, from: "mz15", secondary: true, fromIds: p15.charged, charged: ["C"], chargedWithout: ["Ch2", "Ch3"], breaks: [["C", "Ch2"], ["C", "Ch3"]], forms: [["Ch2", "Ch3"]], eq: "CH₃⁺ → CH⁺ + H₂", neutralLabel: "H₂", neutralKind: NEUTRAL_KIND.H2, text: "A second step: the CH₃⁺ ion formed above can lose H₂ in turn." });
  const p12 = P({ id: "mz12", mz: 12, from: "mz13", secondary: true, fromIds: p13.charged, charged: ["C"], chargedWithout: ["Ch1"], breaks: [["C", "Ch1"]], forms: [], eq: "CH⁺ → C⁺ + H•", neutralLabel: "H•", neutralKind: NEUTRAL_KIND.H1, text: "A third step: the last hydrogen leaves. This path is a small peak." });
  return { pathways: [p15, p14, p13, p12], note: "Methane is the simplest case: only C–H bonds break, so every fragment is a CH_n ion." };
}
function propanone() {
  const S = SPECTRA.propanone; const g = PROPANONE_GEO; const P = (x) => pathway(S, g, x);
  return { pathways: [
    P({ id: "mz43", mz: 43, from: null, charged: ["C1", "C2", "O"], breaks: [["C2", "C3"]], forms: [], eq: "CH₃COCH₃⁺• → CH₃CO⁺ + •CH₃", neutralLabel: "•CH₃", neutralKind: NEUTRAL_KIND.CH3, kind: "α-cleavage", text: "α-cleavage: the C–C bond next to the C=O breaks. The charge stays on the acylium ion CH₃C≡O⁺ (very stable); the methyl leaves as a neutral radical. Either methyl group can be lost: they are equivalent." }),
    P({ id: "mz15", mz: 15, from: null, charged: ["C1"], breaks: [["C1", "C2"]], forms: [], eq: "CH₃COCH₃⁺• → CH₃⁺ + •COCH₃", neutralLabel: "•COCH₃", neutralKind: NEUTRAL_KIND.COCH3, kind: "α-cleavage", text: "The same α-cleavage, but the charge stays on the methyl group. The acetyl radical leaves as a neutral particle. CH₃⁺ is far less stable than CH₃CO⁺, so this peak is smaller." }),
  ], note: "Propanone fragments mainly by α-cleavage next to the C=O. CH₃CO⁺ can also lose CO to give CH₃⁺, which adds to the m/z 15 peak." };
}
function butanone() {
  const S = SPECTRA.butanone; const g = BUTANONE_GEO; const P = (x) => pathway(S, g, x);
  const p29 = P({ id: "mz29", mz: 29, from: null, charged: ["C3", "C4"], breaks: [["C2", "C3"]], forms: [], eq: "CH₃COC₂H₅⁺• → C₂H₅⁺ + CH₃CO•", neutralLabel: "CH₃CO•", neutralKind: NEUTRAL_KIND.COCH3, kind: "α-cleavage", text: "α-cleavage on the ethyl side, with the charge on the ethyl group. The acetyl radical leaves as a neutral particle." });
  return { pathways: [
    P({ id: "mz43", mz: 43, from: null, charged: ["C1", "C2", "O"], breaks: [["C2", "C3"]], forms: [], eq: "CH₃COC₂H₅⁺• → CH₃CO⁺ + •C₂H₅", neutralLabel: "•C₂H₅", neutralKind: NEUTRAL_KIND.C2H5, kind: "α-cleavage", text: "α-cleavage: the C–C bond between the C=O carbon and the CH₂ group breaks. The larger alkyl group leaves as a neutral radical (the preferred route), the charge stays on the acylium ion CH₃C≡O⁺." }),
    P({ id: "mz57", mz: 57, from: null, charged: ["C2", "O", "C3", "C4"], breaks: [["C1", "C2"]], forms: [], eq: "CH₃COC₂H₅⁺• → C₂H₅CO⁺ + •CH₃", neutralLabel: "•CH₃", neutralKind: NEUTRAL_KIND.CH3, kind: "α-cleavage", text: "α-cleavage on the methyl side: the methyl radical leaves, the charge stays on the acylium ion C₂H₅C≡O⁺. Losing the smaller radical is less favourable, so this peak is small." }),
    p29,
    P({ id: "mz15", mz: 15, from: null, charged: ["C1"], breaks: [["C1", "C2"]], forms: [], eq: "CH₃COC₂H₅⁺• → CH₃⁺ + •COC₂H₅", neutralLabel: "•COC₂H₅", neutralKind: NEUTRAL_KIND.COC2H5, kind: "α-cleavage", text: "The methyl-side α-cleavage with the charge on the methyl group; the propanoyl radical leaves as a neutral particle." }),
    P({ id: "mz27", mz: 27, from: "mz29", secondary: true, fromIds: p29.charged, charged: ["C3", "C4"], chargedWithout: ["C3h2", "C4h3"], breaks: [["C3", "C3h2"], ["C4", "C4h3"]], forms: [["C3h2", "C4h3"]], eq: "C₂H₅⁺ → C₂H₃⁺ + H₂", neutralLabel: "H₂", neutralKind: NEUTRAL_KIND.H2, text: "A second step: the ethyl cation loses a hydrogen molecule." }),
  ], note: "Butan-2-one fragments by α-cleavage on either side of the C=O. Losing the larger radical (•C₂H₅) gives the tallest peak. No McLafferty rearrangement is possible: it needs a γ-hydrogen." };
}
function ethanol() {
  const S = SPECTRA.ethanol; const g = ETHANOL_GEO; const P = (x) => pathway(S, g, x);
  const p29 = P({ id: "mz29", mz: 29, from: null, charged: ["C1", "C2"], breaks: [["C2", "O"]], forms: [], eq: "CH₃CH₂OH⁺• → C₂H₅⁺ + •OH", neutralLabel: "•OH", neutralKind: NEUTRAL_KIND.OH, text: "The C–O bond breaks with the charge on the ethyl group; the hydroxyl radical leaves as a neutral particle." });
  const p45 = P({ id: "mz45", mz: 45, from: null, charged: ["C1", "C2", "O"], chargedWithout: ["C2h2"], breaks: [["C2", "C2h2"]], forms: [], eq: "CH₃CH₂OH⁺• → C₂H₅O⁺ + H•", neutralLabel: "H•", neutralKind: NEUTRAL_KIND.H1, text: "Loss of a hydrogen atom from the carbon next to oxygen (M – 1). The ion is stabilised by the oxygen lone pair." });
  return { pathways: [
    P({ id: "mz31", mz: 31, from: null, charged: ["C2", "O"], breaks: [["C1", "C2"]], forms: [], eq: "CH₃CH₂OH⁺• → CH₂OH⁺ + •CH₃", neutralLabel: "•CH₃", neutralKind: NEUTRAL_KIND.CH3, kind: "α-cleavage", text: "Base peak: the C–C bond next to oxygen breaks (α-cleavage). The oxygen lone pair stabilises the CH₂=OH⁺ ion; the methyl radical leaves as a neutral particle." }),
    p45, p29,
    P({ id: "mz43", mz: 43, from: "mz45", secondary: true, fromIds: p45.charged, charged: ["C1", "C2", "O"], chargedWithout: ["C2h1", "Oh1"], breaks: [["C2", "C2h1"], ["O", "Oh1"]], forms: [["C2h1", "Oh1"]], eq: "C₂H₅O⁺ → C₂H₃O⁺ + H₂", neutralLabel: "H₂", neutralKind: NEUTRAL_KIND.H2, text: "A second step: the [M – H]⁺ ion loses a hydrogen molecule to give C₂H₃O⁺ (CH₃CO⁺)." }),
    P({ id: "mz27", mz: 27, from: "mz29", secondary: true, fromIds: p29.charged, charged: ["C1", "C2"], chargedWithout: ["C1h3", "C2h2"], breaks: [["C1", "C1h3"], ["C2", "C2h2"]], forms: [["C1h3", "C2h2"]], eq: "C₂H₅⁺ → C₂H₃⁺ + H₂", neutralLabel: "H₂", neutralKind: NEUTRAL_KIND.H2, text: "A second step: the ethyl cation loses a hydrogen molecule." }),
  ], note: "The molecular ion of an alcohol is weak: it fragments easily, mainly by α-cleavage next to the oxygen." };
}

const LIST = [
  { id: "propanone", name: "Propanone", alt: "acetone", formula: "C₃H₆O", condensed: "CH₃COCH₃", geo: PROPANONE_GEO, M: 58, ...propanone() },
  { id: "butanone", name: "Butan-2-one", alt: "methyl ethyl ketone", formula: "C₄H₈O", condensed: "CH₃COCH₂CH₃", geo: BUTANONE_GEO, M: 72, ...butanone() },
  { id: "ethanol", name: "Ethanol", alt: "", formula: "C₂H₆O", condensed: "CH₃CH₂OH", geo: ETHANOL_GEO, M: 46, ...ethanol() },
  { id: "methane", name: "Methane", alt: "", formula: "CH₄", condensed: "CH₄", geo: METHANE_GEO, M: 16, ...methane() },
];
export const SIM_MOLECULES = Object.freeze(Object.fromEntries(LIST.map((m) => [m.id, { ...m, spec: SPECTRA[m.id], pathById: Object.fromEntries(m.pathways.map((p) => [p.id, p])) }])));
export const SIM_IDS = LIST.map((m) => m.id);
export const DEFAULT_MOLECULE = "propanone";
export const getSim = (id) => SIM_MOLECULES[id] ?? SIM_MOLECULES[DEFAULT_MOLECULE];
export const MOLECULE_GEOMETRY_NOTE = "Ball-and-stick geometries are idealised (typical bond lengths and angles), not computed structures. Bond lengths of the molecular ion differ a little from those of the neutral molecule.";

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Ion identities: ONE colour, outline shape and label per m/z, used by the molecule view, the instrument and the spectrum alike.
export const SHAPES = ["circle", "square", "hexagon", "diamond", "triangle", "pentagon", "cross"];
const FRAG_COLORS = ["#2dd4bf", "#fbbf24", "#f472b6", "#38bdf8", "#a3e635", "#f87171", "#e879f9"];
export const M_COLOR = "#fb923c";
export const ISO_COLOR = "#a78bfa";
export function ionCatalogue(molId) {
  const sim = getSim(molId); const out = {}; let k = 0;
  for (const pk of sim.spec.peaks) {
    if (pk.role === "M") out[pk.mz] = { mz: pk.mz, role: "M", color: M_COLOR, shape: "circle", label: pk.label, comp: pk.comp, charge: 1, name: "molecular ion" };
    else if (pk.derived) out[pk.mz] = { mz: pk.mz, role: "isotope", color: ISO_COLOR, shape: "circle", dashed: true, label: pk.label, comp: pk.comp, charge: 1, name: "isotope peak (¹³C)" };
    else { out[pk.mz] = { mz: pk.mz, role: "fragment", color: FRAG_COLORS[k % FRAG_COLORS.length], shape: SHAPES[1 + (k % (SHAPES.length - 1))], label: pk.label, comp: pk.comp, charge: 1, name: "fragment ion" }; k += 1; }
  }
  return out;
}
/** the chain of pathways (ids, first to last) that leads from the molecular ion to the ion with this m/z, or null for the molecular ion / unknown */
export function chainTo(molId, mz) {
  const sim = getSim(molId); const p = sim.pathways.find((x) => x.mz === mz); if (!p) return null;
  const chain = [p.id]; let cur = p;
  while (cur.from) { cur = sim.pathById[cur.from]; chain.unshift(cur.id); }
  return chain;
}
