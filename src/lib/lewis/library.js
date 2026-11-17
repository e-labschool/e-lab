// Curated, hand-verified library of school-level molecules and ions (IB DP Chemistry S2.2 and the usual teaching set).
//
// Every structure is WRITTEN BY HAND as a SMILES string with explicit formal charges, so it is an independent record of the
// correct Lewis structure.  The reader (smiles.js) derives the lone pairs from the electron count of each written atom; the test
// suite (scripts/test-lewis-engine.mjs) then checks that
//   * every entry is electron-consistent (validateStructure),
//   * the resolver, given only the atoms (and charge), arrives at the same structure,
//   * entries flagged `beyond` are refused with the "beyond the course" reason when that switch is off.
// `octet` is the second hand-written form for species the course draws two ways: the octet-rule form (formal charges, e.g. SO3 with
// S2+) shown by default, and the expanded-octet form (no formal charges, e.g. S=O x3) shown with the HL / beyond-the-course switch.
import { prettyFormula, compositionKey } from "./format.js";
import { parseSmiles } from "./smiles.js";

const RAW = [];
/** E(id, name, smiles, { cat, octet, beyond, isomers, alias }) -- id = plain formula with charge ("SO4 2-", "NH4+"). */
function E(id, name, smiles, o = {}) { RAW.push({ id, name, smiles, octet: o.octet ?? null, beyond: !!o.beyond, isomers: !!o.isomers, alias: o.alias ?? [], cat: o.cat }); }

// ---- elements and diatomic molecules ----
E("H2", "Hydrogen", "[H][H]", { cat: "diatomic" });
E("N2", "Nitrogen", "N#N", { cat: "diatomic" });
E("O2", "Oxygen", "O=O", { cat: "diatomic" });
E("F2", "Fluorine", "FF", { cat: "diatomic" });
E("Cl2", "Chlorine", "ClCl", { cat: "diatomic" });
E("Br2", "Bromine", "BrBr", { cat: "diatomic" });
E("I2", "Iodine", "II", { cat: "diatomic" });
E("HF", "Hydrogen fluoride", "F", { cat: "hydrides" });
E("HCl", "Hydrogen chloride", "Cl", { cat: "hydrides" });
E("HBr", "Hydrogen bromide", "Br", { cat: "hydrides" });
E("HI", "Hydrogen iodide", "I", { cat: "hydrides" });
E("ICl", "Iodine monochloride", "ClI", { cat: "diatomic" });
// ---- hydrides ----
E("H2O", "Water", "O", { cat: "hydrides", alias: ["dihydrogen monoxide"] });
E("H2S", "Hydrogen sulfide", "S", { cat: "hydrides" });
E("NH3", "Ammonia", "N", { cat: "hydrides" });
E("PH3", "Phosphine", "P", { cat: "hydrides" });
E("CH4", "Methane", "C", { cat: "hydrides" });
E("SiH4", "Silane", "[SiH4]", { cat: "hydrides" });
E("H2O2", "Hydrogen peroxide", "OO", { cat: "hydrides" });
E("N2H4", "Hydrazine", "NN", { cat: "hydrides" });
// ---- halides ----
E("BF3", "Boron trifluoride", "B(F)(F)F", { cat: "halides" });
E("BCl3", "Boron trichloride", "B(Cl)(Cl)Cl", { cat: "halides" });
E("BeCl2", "Beryllium chloride", "Cl[Be]Cl", { cat: "halides" });
E("AlCl3", "Aluminium chloride (covalent monomer)", "Cl[Al](Cl)Cl", { cat: "halides", alias: ["aluminum chloride"] });
E("CCl4", "Tetrachloromethane", "ClC(Cl)(Cl)Cl", { cat: "halides", alias: ["carbon tetrachloride"] });
E("CF4", "Tetrafluoromethane", "FC(F)(F)F", { cat: "halides" });
E("CHCl3", "Trichloromethane", "ClC(Cl)Cl", { cat: "halides", alias: ["chloroform"] });
E("CH2Cl2", "Dichloromethane", "ClCCl", { cat: "halides" });
E("CH3Cl", "Chloromethane", "CCl", { cat: "halides", alias: ["methyl chloride"] });
E("CH3Br", "Bromomethane", "CBr", { cat: "halides" });
E("SiCl4", "Silicon tetrachloride", "Cl[Si](Cl)(Cl)Cl", { cat: "halides" });
E("PCl3", "Phosphorus trichloride", "ClP(Cl)Cl", { cat: "halides" });
E("NF3", "Nitrogen trifluoride", "FN(F)F", { cat: "halides" });
E("NCl3", "Nitrogen trichloride", "ClN(Cl)Cl", { cat: "halides" });
E("OF2", "Oxygen difluoride", "FOF", { cat: "halides" });
E("Cl2O", "Dichlorine monoxide", "ClOCl", { cat: "halides" });
E("SCl2", "Sulfur dichloride", "ClSCl", { cat: "halides" });
E("COCl2", "Carbonyl chloride", "O=C(Cl)Cl", { cat: "halides", alias: ["phosgene"] });
E("HOCl", "Hypochlorous acid", "OCl", { cat: "acids", alias: ["HClO"] });
// ---- oxides ----
E("CO", "Carbon monoxide", "[C-]#[O+]", { cat: "oxides" });
E("CO2", "Carbon dioxide", "O=C=O", { cat: "oxides" });
E("CS2", "Carbon disulfide", "S=C=S", { cat: "oxides" });
E("COS", "Carbonyl sulfide", "O=C=S", { cat: "oxides" });
E("SO2", "Sulfur dioxide", "O=S=O", { cat: "oxides", octet: "[O-][S+]=O" });
E("SO3", "Sulfur trioxide", "O=S(=O)=O", { cat: "oxides", octet: "[O-][S+2]([O-])=O" });
E("N2O", "Dinitrogen monoxide", "N#[N+][O-]", { cat: "oxides", alias: ["nitrous oxide", "laughing gas"] });
E("O3", "Ozone", "[O-][O+]=O", { cat: "oxides" });
E("NO", "Nitrogen monoxide", "[N]=O", { cat: "oxides", beyond: true, alias: ["nitric oxide"] });
E("NO2", "Nitrogen dioxide", "[O-][N+]=O", { cat: "oxides", beyond: true });
// ---- carbon compounds ----
E("C2H2", "Ethyne", "C#C", { cat: "organic", alias: ["acetylene"] });
E("C2H4", "Ethene", "C=C", { cat: "organic", alias: ["ethylene"] });
E("C2H6", "Ethane", "CC", { cat: "organic" });
E("C3H8", "Propane", "CCC", { cat: "organic" });
E("C4H10", "Butane", "CCCC", { cat: "organic", isomers: true });
E("C3H6", "Propene", "CC=C", { cat: "organic", isomers: true });
E("C3H4", "Propyne", "CC#C", { cat: "organic", isomers: true });
E("CH3OH", "Methanol", "CO", { cat: "organic" });
E("C2H5OH", "Ethanol", "CCO", { cat: "organic", isomers: true });
E("CH3OCH3", "Methoxymethane", "COC", { cat: "organic", isomers: true, alias: ["dimethyl ether"] });
E("CH2O", "Methanal", "C=O", { cat: "organic", alias: ["formaldehyde"] });
E("CH3CHO", "Ethanal", "CC=O", { cat: "organic", isomers: true, alias: ["acetaldehyde"] });
E("CH3COCH3", "Propanone", "CC(=O)C", { cat: "organic", isomers: true, alias: ["acetone"] });
E("HCOOH", "Methanoic acid", "C(=O)O", { cat: "organic", alias: ["formic acid"] });
E("CH3COOH", "Ethanoic acid", "CC(=O)O", { cat: "organic", isomers: true, alias: ["acetic acid"] });
E("CH3NH2", "Methylamine", "CN", { cat: "organic", alias: ["aminomethane"] });
E("HCN", "Hydrogen cyanide", "C#N", { cat: "organic" });
E("CH3CN", "Ethanenitrile", "CC#N", { cat: "organic", alias: ["acetonitrile"] });
E("CH3NO2", "Nitromethane", "C[N+](=O)[O-]", { cat: "organic", isomers: true }); // the resolver prefers an all-zero-charge isomer (formal charges are minimised); the library holds the real nitro compound
// ---- oxoacids ----
E("HNO3", "Nitric acid", "O[N+](=O)[O-]", { cat: "acids" });
E("HNO2", "Nitrous acid", "ON=O", { cat: "acids" });
E("H2CO3", "Carbonic acid", "OC(=O)O", { cat: "acids" });
E("H2SO4", "Sulfuric acid", "OS(=O)(=O)O", { cat: "acids", octet: "O[S+2]([O-])([O-])O" });
E("H3PO4", "Phosphoric acid", "OP(=O)(O)O", { cat: "acids", octet: "O[P+]([O-])(O)O" });
// ---- ions ----
E("NH4+", "Ammonium ion", "[NH4+]", { cat: "ions" });
E("H3O+", "Hydronium ion", "[OH3+]", { cat: "ions", alias: ["oxonium"] });
E("OH-", "Hydroxide ion", "[OH-]", { cat: "ions" });
E("CN-", "Cyanide ion", "[C-]#N", { cat: "ions" });
E("NO3-", "Nitrate ion", "[O-][N+](=O)[O-]", { cat: "ions" });
E("NO2-", "Nitrite ion", "[O-]N=O", { cat: "ions" });
E("CO3 2-", "Carbonate ion", "[O-]C(=O)[O-]", { cat: "ions" });
E("HCO3-", "Hydrogencarbonate ion", "OC(=O)[O-]", { cat: "ions", alias: ["bicarbonate"] });
E("HCOO-", "Methanoate ion", "C(=O)[O-]", { cat: "ions", alias: ["formate"] });
E("CH3COO-", "Ethanoate ion", "CC(=O)[O-]", { cat: "ions", isomers: true, alias: ["acetate"] });
E("SO4 2-", "Sulfate ion", "[O-]S(=O)(=O)[O-]", { cat: "ions", octet: "[O-][S+2]([O-])([O-])[O-]" });
E("SO3 2-", "Sulfite ion", "[O-]S(=O)[O-]", { cat: "ions", octet: "[O-][S+]([O-])[O-]" });
E("HSO4-", "Hydrogensulfate ion", "OS(=O)(=O)[O-]", { cat: "ions", octet: "O[S+2]([O-])([O-])[O-]", alias: ["bisulfate"] });
E("PO4 3-", "Phosphate ion", "[O-]P(=O)([O-])[O-]", { cat: "ions", octet: "[O-][P+]([O-])([O-])[O-]" });
E("ClO-", "Hypochlorite ion", "[O-]Cl", { cat: "ions" });
E("ClO3-", "Chlorate ion", "[O-]Cl(=O)=O", { cat: "ions", octet: "[O-][Cl+2]([O-])[O-]" });
E("ClO4-", "Perchlorate ion", "[O-]Cl(=O)(=O)=O", { cat: "ions", octet: "[O-][Cl+3]([O-])([O-])[O-]" });
E("NH2-", "Amide ion", "[NH2-]", { cat: "ions" });
E("PH4+", "Phosphonium ion", "[PH4+]", { cat: "ions" });
E("NO+", "Nitrosonium ion", "N#[O+]", { cat: "ions" });
E("NO2+", "Nitronium ion", "O=[N+]=O", { cat: "ions" });
E("BF4-", "Tetrafluoroborate ion", "F[B-](F)(F)F", { cat: "ions" });
E("AlCl4-", "Tetrachloroaluminate ion", "Cl[Al-](Cl)(Cl)Cl", { cat: "ions" });
E("BH4-", "Tetrahydridoborate ion", "[BH4-]", { cat: "ions", alias: ["borohydride"] });
E("N3-", "Azide ion", "[N-]=[N+]=[N-]", { cat: "ions" });
// ---- dual-form molecules ----
E("SOCl2", "Thionyl chloride", "O=S(Cl)Cl", { cat: "halides", octet: "[O-][S+](Cl)Cl" });
E("POCl3", "Phosphoryl chloride", "O=P(Cl)(Cl)Cl", { cat: "halides", octet: "[O-][P+](Cl)(Cl)Cl" });
// ---- beyond the octet rule (HL / beyond the course) ----
E("PCl5", "Phosphorus pentachloride", "ClP(Cl)(Cl)(Cl)Cl", { cat: "beyond", beyond: true });
E("PF5", "Phosphorus pentafluoride", "FP(F)(F)(F)F", { cat: "beyond", beyond: true });
E("SF4", "Sulfur tetrafluoride", "FS(F)(F)F", { cat: "beyond", beyond: true });
E("SF6", "Sulfur hexafluoride", "FS(F)(F)(F)(F)F", { cat: "beyond", beyond: true });
E("XeF2", "Xenon difluoride", "F[Xe]F", { cat: "beyond", beyond: true });
E("XeF4", "Xenon tetrafluoride", "F[Xe](F)(F)F", { cat: "beyond", beyond: true });
E("ClF3", "Chlorine trifluoride", "FCl(F)F", { cat: "beyond", beyond: true });
E("BrF3", "Bromine trifluoride", "FBr(F)F", { cat: "beyond", beyond: true });
E("BrF5", "Bromine pentafluoride", "FBr(F)(F)(F)F", { cat: "beyond", beyond: true });
E("IF5", "Iodine pentafluoride", "FI(F)(F)(F)F", { cat: "beyond", beyond: true });
E("I3-", "Triiodide ion", "I[I-]I", { cat: "beyond", beyond: true });

export const LIBRARY_CATEGORIES = Object.freeze([
  { id: "all", label: "All" },
  { id: "diatomic", label: "Diatomic" },
  { id: "hydrides", label: "Hydrides" },
  { id: "halides", label: "Halides" },
  { id: "oxides", label: "Oxides" },
  { id: "organic", label: "Carbon" },
  { id: "acids", label: "Acids" },
  { id: "ions", label: "Ions" },
  { id: "beyond", label: "Beyond the octet (HL)" },
]);

/** Library entries: { id, name, formula (pretty), cat, beyond, isomers, alias, smiles, octet, structure, octetStructure, key }. Parsed once, on first use. */
let parsed = null;
export function getLibrary() {
  if (parsed) return parsed;
  parsed = RAW.map((r) => {
    const structure = parseSmiles(r.smiles);
    const octetStructure = r.octet ? parseSmiles(r.octet) : null;
    return Object.freeze({ ...r, formula: prettyFormula(r.id), structure, octetStructure, charge: structure.charge, key: compositionKey(structure.atoms, structure.charge) });
  });
  return parsed;
}
export const LIBRARY_SIZE = RAW.length;
export const getEntry = (id) => getLibrary().find((e) => e.id === id) ?? null;

/** Library entries whose atoms and charge equal the given composition (preferred entry first). */
export function findByComposition(symbols, charge = 0) {
  const key = compositionKey(symbols, charge);
  return getLibrary().filter((e) => e.key === key);
}

const norm = (s) => String(s).toLowerCase().replace(/[\s_\-()]/g, "").replace(/[₀-₉]/g, (d) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(d))).replace(/[⁺]/g, "+").replace(/[⁻]/g, "-");
/** Search by formula, name or alias (prefix and substring), best matches first. */
export function searchLibrary(query, category = "all") {
  const q = norm(query);
  const list = getLibrary().filter((e) => category === "all" || e.cat === category);
  if (!q) return list;
  const score = (e) => {
    const fields = [e.id, e.formula, e.name, ...e.alias].map(norm);
    if (fields.some((f) => f === q)) return 0;
    if (fields.some((f) => f.startsWith(q))) return 1;
    if (fields.some((f) => f.includes(q))) return 2;
    return 9;
  };
  return list.map((e) => [e, score(e)]).filter(([, s]) => s < 9).sort((a, b) => a[1] - b[1]).map(([e]) => e);
}
