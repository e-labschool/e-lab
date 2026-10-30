// VALIDATED molecule dataset for the VSEPR Explorer (pure data + a validator; no React / three).
// Every entry is checked against the geometry engine by validatePreset() and, independently, against a hand-written
// oracle table in scripts/test-vsepr-model.mjs.
//
// Conventions
//   central        symbol of the central atom (the only atom whose domains are counted)
//   ligands        surrounding atoms: { symbol, order }  (order 1, 2 or 3 = ONE electron domain each)
//   lonePairs      lone-pair DOMAINS on the CENTRAL atom only. Lone pairs on terminal atoms are not domains of the central
//                  atom (the Lewis view derives and may draw them).
//   angles         bond angles: kind "ideal" = idealised VSEPR angle of the regular shape, kind "approx" = approximate
//                  experimental value (distortion caused by lone pairs / multiple bonds). Never a single invented number
//                  where several differ.
import { axeNotation, electronDomainName, molecularGeometryName, toSubscripts } from "./geometry.js";

const L = (symbol, order = 1, count = 1) => Array.from({ length: count }, () => ({ symbol, order }));
const ideal = (value, label, note) => ({ value, label, kind: "ideal", note });
const approx = (value, label, note) => ({ value, label, kind: "approx", note });

const RAW = [
  { id: "becl2", formula: "BeCl2", name: "Beryllium chloride", central: "Be", ligands: L("Cl", 1, 2), lonePairs: 0,
    angles: [ideal(180, "Cl–Be–Cl")],
    explain: "Two bonding domains and no lone pairs. Two regions of electron density are farthest apart when they are opposite each other, so the molecule is linear (Be has only 4 electrons, an incomplete octet).", challengeAngles: [180] },
  { id: "co2", formula: "CO2", name: "Carbon dioxide", central: "C", ligands: L("O", 2, 2), lonePairs: 0,
    angles: [ideal(180, "O=C=O")],
    explain: "Each C=O double bond is ONE electron domain. Two domains and no lone pairs on carbon put the oxygens on opposite sides: linear.", challengeAngles: [180] },
  { id: "hcn", formula: "HCN", name: "Hydrogen cyanide", central: "C", ligands: [{ symbol: "H", order: 1 }, { symbol: "N", order: 3 }], lonePairs: 0,
    angles: [ideal(180, "H–C≡N")],
    explain: "The C≡N triple bond counts as one domain and the C–H bond as another. Two domains, no lone pairs on carbon: linear.", challengeAngles: [180] },
  { id: "bf3", formula: "BF3", name: "Boron trifluoride", central: "B", ligands: L("F", 1, 3), lonePairs: 0,
    angles: [ideal(120, "F–B–F")],
    explain: "Three bonding domains and no lone pairs spread out in a plane, 120° apart: trigonal planar (B has 6 electrons, an incomplete octet).", challengeAngles: [120] },
  { id: "so3", formula: "SO3", name: "Sulfur trioxide", central: "S", ligands: L("O", 2, 3), lonePairs: 0,
    angles: [ideal(120, "O=S=O")],
    explain: "Three S=O double bonds are three domains (one each). With no lone pair on sulfur the oxygens are 120° apart: trigonal planar.", challengeAngles: [120] },
  { id: "ch2o", formula: "CH2O", name: "Methanal (formaldehyde)", central: "C", ligands: [{ symbol: "H", order: 1 }, { symbol: "H", order: 1 }, { symbol: "O", order: 2 }], lonePairs: 0,
    angles: [approx(116.5, "H–C–H", "about 116°; the C=O domain is slightly more repulsive than C–H"), approx(121.7, "H–C=O", "about 122°")],
    explain: "Three domains (two C–H and one C=O) and no lone pairs on carbon: trigonal planar. The double-bond domain is a little more repulsive, so H–C–H is slightly less than 120°.", challengeAngles: [120] },
  { id: "so2", formula: "SO2", name: "Sulfur dioxide", central: "S", ligands: L("O", 2, 2), lonePairs: 1,
    angles: [approx(119, "O–S–O", "slightly less than 120°")],
    explain: "Three domains on sulfur (two S=O and one lone pair): the electron-domain geometry is trigonal planar. Only the two oxygen atoms are 'seen', so the shape is bent, with the lone pair squeezing the angle to a little under 120°.", challengeAngles: [120] },
  { id: "ch4", formula: "CH4", name: "Methane", central: "C", ligands: L("H", 1, 4), lonePairs: 0,
    angles: [ideal(109.5, "H–C–H")],
    explain: "Four identical bonding domains repel equally and point to the corners of a tetrahedron: 109.5° apart.", challengeAngles: [109.5] },
  { id: "nh3", formula: "NH3", name: "Ammonia", central: "N", ligands: L("H", 1, 3), lonePairs: 1,
    angles: [approx(107, "H–N–H", "experimental ≈ 107°, less than 109.5°")],
    explain: "Four domains (3 bonding + 1 lone pair) give a tetrahedral electron-domain geometry. The lone pair is not an atom, so the molecule is trigonal pyramidal. Lone pair–bonding pair repulsion is stronger than bonding pair–bonding pair, which squeezes the H–N–H angle to about 107°.", challengeAngles: [107] },
  { id: "h2o", formula: "H2O", name: "Water", central: "O", ligands: L("H", 1, 2), lonePairs: 2,
    angles: [approx(104.5, "H–O–H", "experimental ≈ 104.5°")],
    explain: "Four domains (2 bonding + 2 lone pairs): tetrahedral electron-domain geometry, bent molecular geometry. Two lone pairs repel more strongly (LP–LP > LP–BP > BP–BP), closing the angle to about 104.5°.", challengeAngles: [104.5] },
  { id: "pcl5", formula: "PCl5", name: "Phosphorus pentachloride", central: "P", ligands: L("Cl", 1, 5), lonePairs: 0,
    angles: [ideal(90, "Cl(axial)–P–Cl(equatorial)"), ideal(120, "Cl(eq)–P–Cl(eq)"), ideal(180, "Cl(ax)–P–Cl(ax)")],
    explain: "Five bonding domains and no lone pairs form a trigonal bipyramid with two axial and three equatorial positions: 90°, 120° and 180° angles (P has an expanded octet).", challengeAngles: [90, 120, 180] },
  { id: "sf4", formula: "SF4", name: "Sulfur tetrafluoride", central: "S", ligands: L("F", 1, 4), lonePairs: 1,
    angles: [approx(173, "F(ax)–S–F(ax)", "≈ 173°"), approx(102, "F(eq)–S–F(eq)", "≈ 102°")],
    explain: "Five domains (4 bonding + 1 lone pair) give a trigonal bipyramidal electron-domain geometry. The lone pair takes an equatorial position, where it has fewer close 90° neighbours, so the shape is seesaw and the angles close up (axial ≈ 173°, equatorial ≈ 102°).", challengeAngles: [102, 180] },
  { id: "clf3", formula: "ClF3", name: "Chlorine trifluoride", central: "Cl", ligands: L("F", 1, 3), lonePairs: 2,
    angles: [approx(87.5, "F(ax)–Cl–F(eq)", "≈ 87.5°, a little less than 90°"), approx(175, "F(ax)–Cl–F(ax)", "≈ 175°")],
    explain: "Five domains (3 bonding + 2 lone pairs): trigonal bipyramidal electron domains. Both lone pairs sit equatorial, leaving a T-shaped molecule with F–Cl–F angles a little under 90°.", challengeAngles: [90, 180] },
  { id: "xef2", formula: "XeF2", name: "Xenon difluoride", central: "Xe", ligands: L("F", 1, 2), lonePairs: 3,
    angles: [ideal(180, "F–Xe–F")],
    explain: "Five domains (2 bonding + 3 lone pairs). The three lone pairs occupy the equatorial plane, 120° apart, so the two fluorines end up axial: linear, 180°.", challengeAngles: [180] },
  { id: "sf6", formula: "SF6", name: "Sulfur hexafluoride", central: "S", ligands: L("F", 1, 6), lonePairs: 0,
    angles: [ideal(90, "F–S–F (adjacent)"), ideal(180, "F–S–F (opposite)")],
    explain: "Six bonding domains, no lone pairs: an octahedron with 90° between neighbours and 180° between opposite fluorines (expanded octet).", challengeAngles: [90, 180] },
  { id: "brf5", formula: "BrF5", name: "Bromine pentafluoride", central: "Br", ligands: L("F", 1, 5), lonePairs: 1,
    angles: [approx(85, "F(apical)–Br–F(basal)", "≈ 85°, a little less than 90°")],
    explain: "Six domains (5 bonding + 1 lone pair): octahedral electron-domain geometry. The lone pair takes one position, leaving a square pyramid; it pushes the four basal fluorines slightly toward the apex (≈ 85°).", challengeAngles: [90] },
  { id: "xef4", formula: "XeF4", name: "Xenon tetrafluoride", central: "Xe", ligands: L("F", 1, 4), lonePairs: 2,
    angles: [ideal(90, "F–Xe–F (adjacent)"), ideal(180, "F–Xe–F (opposite)")],
    explain: "Six domains (4 bonding + 2 lone pairs): octahedral electron domains. The two lone pairs sit opposite each other (180° apart, minimising LP–LP repulsion), leaving the four fluorines in a square plane.", challengeAngles: [90, 180] },
];

export const subFormula = (f) => toSubscripts(f);

export const PRESETS = RAW.map((p) => {
  const b = p.ligands.length; const l = p.lonePairs; const n = b + l;
  return {
    ...p, display: toSubscripts(p.formula), bonding: b, domains: n, axe: axeNotation(b, l),
    ed: electronDomainName(n), mg: molecularGeometryName(b, l),
  };
});
export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

/** Library groups by electron-domain count / electron-domain geometry. */
export const PRESET_GROUPS = [2, 3, 4, 5, 6].map((n) => ({
  id: `d${n}`, domains: n, title: `${n} domains`, ed: electronDomainName(n), presets: PRESETS.filter((p) => p.domains === n),
}));

/** Problems found in one preset (empty = valid). Pure consistency check against the engine. */
export function validatePreset(p) {
  const problems = [];
  const b = p.ligands.length;
  if (!p.central) problems.push("no central atom");
  if (b < 2) problems.push("needs at least two surrounding atoms");
  if (p.lonePairs < 0 || !Number.isInteger(p.lonePairs)) problems.push("bad lone-pair count");
  for (const lig of p.ligands) if (![1, 2, 3].includes(lig.order)) problems.push(`bad bond order ${lig.order}`);
  if (p.domains !== b + p.lonePairs) problems.push("domain count != bonding + lone pairs");
  if (p.bonding !== b) problems.push("bonding count mismatch");
  if (p.axe !== axeNotation(b, p.lonePairs)) problems.push("AXE mismatch");
  if (p.ed !== electronDomainName(p.domains)) problems.push("ED geometry mismatch");
  if (p.mg !== molecularGeometryName(b, p.lonePairs)) problems.push("MG geometry mismatch");
  if (!p.angles?.length) problems.push("no angles");
  for (const a of p.angles ?? []) if (!(a.value > 0 && a.value <= 180) || !["ideal", "approx"].includes(a.kind)) problems.push(`bad angle ${a.label}`);
  if (!p.explain || p.explain.length < 40) problems.push("missing explanation");
  return problems;
}
export function validateAllPresets() {
  const out = {}; const ids = new Set();
  for (const p of PRESETS) { if (ids.has(p.id)) out[p.id] = ["duplicate id"]; ids.add(p.id); const pr = validatePreset(p); if (pr.length) out[p.id] = [...(out[p.id] ?? []), ...pr]; }
  return out;
}

/** Signature used to recognise a free-built arrangement: central symbol + sorted ligands + lone pairs. */
export function signature(central, ligands, lonePairs) {
  return `${central}|${ligands.map((x) => `${x.symbol}${x.order}`).sort().join(",")}|${lonePairs}`;
}
const SIGS = new Map(PRESETS.map((p) => [signature(p.central, p.ligands, p.lonePairs), p]));
export const matchPreset = (central, ligands, lonePairs) => SIGS.get(signature(central, ligands, lonePairs)) ?? null;

export function searchPresets(query) {
  const q = query.trim().toLowerCase();
  if (!q) return PRESETS;
  return PRESETS.filter((p) => [p.formula, p.display, p.name, p.mg, p.ed, p.axe, p.central].some((s) => String(s).toLowerCase().includes(q)));
}
