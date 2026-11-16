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
/** A ligand drawn as ONE of several equivalent resonance forms: the Lewis structure shows a single form, the 3D model shows equal bonds. */
const R = (symbol, order) => ({ symbol, order, res: true });

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
/** "+1" -> "⁺", "-2" -> "²⁻" (charge 0 -> ""). */
export const chargeSuffix = (q) => (!q ? "" : `${Math.abs(q) > 1 ? String(Math.abs(q)).split("").map((d) => SUP[d]).join("") : ""}${q > 0 ? "⁺" : "⁻"}`);
/** ASCII form for text that must not use super-scripts ("CO3 2-", "NH4+"). */
export const chargePlain = (q) => (!q ? "" : q > 0 ? (q === 1 ? "+" : `${q}+`) : (q === -1 ? "-" : `${-q}-`));
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
  // ---- more neutral molecules ----
  { id: "h2s", formula: "H2S", name: "Hydrogen sulfide", central: "S", ligands: L("H", 1, 2), lonePairs: 2,
    angles: [approx(92.1, "H–S–H", "≈ 92°: much smaller than H₂O because S–H bonds are longer and the lone pairs are more diffuse")],
    explain: "Four domains (2 bonding + 2 lone pairs): tetrahedral electron-domain geometry, bent molecular geometry, like water. The angle is only about 92° because sulfur is larger, its bonding pairs are further from the nucleus and repel each other less.", challengeAngles: [90] },
  { id: "o3", formula: "O3", name: "Ozone", central: "O", ligands: [R("O", 2), R("O", 1)], lonePairs: 1, resonance: "Two equivalent resonance structures (O=O–O ↔ O–O=O): the two O–O bonds are identical (bond order 1.5).",
    angles: [approx(116.8, "O–O–O", "≈ 117°")],
    explain: "Three domains on the central oxygen (two O–O bonds and one lone pair): trigonal planar electron domains, bent molecule. The lone pair squeezes the angle to about 117°. The two O–O bonds are equal (resonance).", challengeAngles: [116] },
  // ---- ions and polyatomic species (charge = overall charge; resonance forms are drawn as equal bonds) ----
  { id: "nh4p", formula: "NH4", charge: 1, name: "Ammonium ion", central: "N", ligands: L("H", 1, 4), lonePairs: 0, note: "One of the four N–H bonds is a coordinate (dative) bond, but all four are identical.",
    angles: [ideal(109.5, "H–N–H")],
    explain: "Four bonding domains and no lone pairs: tetrahedral, 109.5°. The nitrogen lone pair of NH₃ now forms a coordinate bond to H⁺, so the ion has no lone pair and the angle is the full tetrahedral angle.", challengeAngles: [109.5] },
  { id: "h3op", formula: "H3O", charge: 1, name: "Hydronium ion", central: "O", ligands: L("H", 1, 3), lonePairs: 1,
    angles: [approx(113, "H–O–H", "≈ 113° (Tang and Oka, infrared spectroscopy; textbooks often quote about 107–109°)")],
    explain: "Four domains (3 bonding + 1 lone pair): tetrahedral electron domains, trigonal pyramidal ion, like NH₃. The lone pair squeezes the H–O–H angle to a little under 109.5°.", challengeAngles: [113] },
  { id: "co32m", formula: "CO3", charge: -2, name: "Carbonate ion", central: "C", ligands: [R("O", 2), R("O", 1), R("O", 1)], lonePairs: 0, resonance: "Three equivalent resonance structures: each C–O bond has the same length and bond order 1⅓; the 2− charge is delocalised over the three oxygens.",
    angles: [ideal(120, "O–C–O")],
    explain: "Three bonding domains around carbon and no lone pairs: trigonal planar, 120°. Resonance makes the three C–O bonds identical.", challengeAngles: [120] },
  { id: "no3m", formula: "NO3", charge: -1, name: "Nitrate ion", central: "N", ligands: [R("O", 2), R("O", 1), R("O", 1)], lonePairs: 0, resonance: "Three equivalent resonance structures: the three N–O bonds are identical (bond order 1⅓).",
    angles: [ideal(120, "O–N–O")],
    explain: "Three bonding domains and no lone pairs on nitrogen: trigonal planar, 120°. Resonance makes the three N–O bonds identical.", challengeAngles: [120] },
  { id: "no2m", formula: "NO2", charge: -1, name: "Nitrite ion", central: "N", ligands: [R("O", 2), R("O", 1)], lonePairs: 1, resonance: "Two equivalent resonance structures: both N–O bonds are identical (bond order 1.5).",
    angles: [approx(115, "O–N–O", "≈ 115°")],
    explain: "Three domains on nitrogen (two N–O bonds and one lone pair): trigonal planar electron domains, bent ion with an angle a little under 120°.", challengeAngles: [116] },
  { id: "no2p", formula: "NO2", charge: 1, name: "Nitronium ion", central: "N", ligands: L("O", 2, 2), lonePairs: 0,
    angles: [ideal(180, "O=N=O")],
    explain: "Two double bonds are two domains, with no lone pair on nitrogen: linear, 180° (isoelectronic with CO₂).", challengeAngles: [180] },
  { id: "so32m", formula: "SO3", charge: -2, name: "Sulfite ion", central: "S", ligands: [{ symbol: "O", order: 2, res: true }, R("O", 1), R("O", 1)], lonePairs: 1, resonance: "The three S–O bonds are equivalent (resonance); the 2− charge is shared over the oxygens.",
    angles: [approx(106, "O–S–O", "≈ 106°, a little under 109.5°")],
    explain: "Four domains on sulfur (3 bonding + 1 lone pair): tetrahedral electron domains, trigonal pyramidal ion with angles a little under 109.5°.", challengeAngles: [107] },
  { id: "so42m", formula: "SO4", charge: -2, name: "Sulfate ion", central: "S", ligands: [R("O", 2), R("O", 2), R("O", 1), R("O", 1)], lonePairs: 0, resonance: "All four S–O bonds are the same length (resonance); the form shown minimises formal charges (expanded octet on S).",
    angles: [ideal(109.5, "O–S–O")],
    explain: "Four bonding domains and no lone pairs: tetrahedral, 109.5°. All four S–O bonds are identical.", challengeAngles: [109.5] },
  { id: "po43m", formula: "PO4", charge: -3, name: "Phosphate ion", central: "P", ligands: [R("O", 2), R("O", 1), R("O", 1), R("O", 1)], lonePairs: 0, resonance: "All four P–O bonds are the same length (resonance); the form shown minimises formal charges (expanded octet on P).",
    angles: [ideal(109.5, "O–P–O")],
    explain: "Four bonding domains and no lone pairs: tetrahedral, 109.5°. All four P–O bonds are identical.", challengeAngles: [109.5] },
  { id: "clo4m", formula: "ClO4", charge: -1, name: "Perchlorate ion", central: "Cl", ligands: [R("O", 2), R("O", 2), R("O", 2), R("O", 1)], lonePairs: 0, resonance: "All four Cl–O bonds are the same length (resonance); the form shown minimises formal charges.",
    angles: [ideal(109.5, "O–Cl–O")],
    explain: "Four bonding domains and no lone pairs: tetrahedral, 109.5°.", challengeAngles: [109.5] },
  { id: "bf4m", formula: "BF4", charge: -1, name: "Tetrafluoroborate ion", central: "B", ligands: L("F", 1, 4), lonePairs: 0, note: "One B–F bond is a coordinate bond (F⁻ donates a lone pair to BF₃), but all four are identical.",
    angles: [ideal(109.5, "F–B–F")],
    explain: "Four bonding domains and no lone pairs: tetrahedral, 109.5°. Boron completes its octet by accepting a lone pair from F⁻ (BF₃ + F⁻).", challengeAngles: [109.5] },
  { id: "icl4m", formula: "ICl4", charge: -1, name: "Tetrachloroiodate ion", central: "I", ligands: L("Cl", 1, 4), lonePairs: 2,
    angles: [ideal(90, "Cl–I–Cl (adjacent)"), ideal(180, "Cl–I–Cl (opposite)")],
    explain: "Six domains (4 bonding + 2 lone pairs): octahedral electron domains. The two lone pairs sit opposite each other, leaving a square planar ion, like XeF₄.", challengeAngles: [90, 180] },
  { id: "i3m", formula: "I3", charge: -1, name: "Triiodide ion", central: "I", ligands: L("I", 1, 2), lonePairs: 3,
    angles: [ideal(180, "I–I–I")],
    explain: "Five domains (2 bonding + 3 lone pairs): trigonal bipyramidal electron domains. The three lone pairs lie in the equatorial plane, so the two iodines are axial: linear, 180°.", challengeAngles: [180] },
];

export const subFormula = (f) => toSubscripts(f);

export const PRESETS = RAW.map((p) => {
  const b = p.ligands.length; const l = p.lonePairs; const n = b + l; const charge = p.charge ?? 0;
  return {
    ...p, charge, display: `${toSubscripts(p.formula)}${chargeSuffix(charge)}`, plain: `${p.formula}${chargePlain(charge)}`, bonding: b, domains: n, axe: axeNotation(b, l),
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

/** Signature used to recognise a free-built arrangement: central symbol + sorted ligands + lone pairs + overall charge.
 *  Charged species are resonance hybrids, so their bond orders are ignored (CO3 2- is recognised however the double bond is placed). */
export function signature(central, ligands, lonePairs, charge = 0) {
  const lig = ligands.map((x) => (charge ? x.symbol : `${x.symbol}${x.order}`)).sort().join(",");
  return `${central}|${lig}|${lonePairs}|${charge}`;
}
const SIGS = new Map(PRESETS.map((p) => [signature(p.central, p.ligands, p.lonePairs, p.charge), p]));
export const matchPreset = (central, ligands, lonePairs, charge = 0) => SIGS.get(signature(central, ligands, lonePairs, charge)) ?? null;

/** MODEL_ANGLES overrides so the 3D reference arrangement of a species shows ITS listed angle (H2S 92 deg, not water's 104.5). */
export function modelAnglesFor(p) {
  if (!p || p.angles.length !== 1 || p.angles[0].kind !== "approx") return null;
  const v = p.angles[0].value; const b = p.bonding; const l = p.lonePairs;
  if (b === 2 && l === 2) return { bent4: v };
  if (b === 3 && l === 1) return { trigonalPyramidal: v };
  if (b === 2 && l === 1) return { bent3: v };
  return null;
}

export function searchPresets(query) {
  const q = query.trim().toLowerCase();
  if (!q) return PRESETS;
  return PRESETS.filter((p) => [p.formula, p.plain, p.display, p.name, p.mg, p.ed, p.axe, p.central].some((s) => String(s).toLowerCase().includes(q)));
}
