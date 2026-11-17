// Module 1 -- SUBSTANCE DATA.  The one table every stage reads (formulas, entity type, structure, ions, state).
// To add a substance: add a record to SUBSTANCE_LIST (formula must parse; ionic ions must sum to the formula and be
// charge-neutral -- test-mole-lab-engine.mjs checks all of that for every record) and, for a new element, add it to elements.js.
//
// Entity types follow spec A1/A3: a mole of Fe is a mole of Fe ATOMS, of H2O a mole of H2O MOLECULES, of NaOH a mole of NaOH
// FORMULA UNITS (solid: Na+ and OH- ions in a lattice; aqueous: hydrated Na+ and OH- ions).
import { parseFormula, toUnicodeFormula, ionLabel, atomTotal } from "./formula.js";
import { atomicMass, DEFAULT_POLICY, ELEMENTS } from "./elements.js";
import { clean } from "./numeric.js";
import { bent, linearTriatomic, pyramid, tetrahedral, diatomic, single } from "./geometry.js";

const ENT = {
  molecule: { kind: "molecule", singular: "molecule", plural: "molecules" },
  formulaUnit: { kind: "formula-unit", singular: "formula unit", plural: "formula units" },
  atom: { kind: "atom", singular: "atom", plural: "atoms" },
  ion: { kind: "ion", singular: "ion", plural: "ions" },
};
const ion = (formula, charge, count = 1) => ({ formula, charge, count, label: ionLabel(formula, charge), composition: parseFormula(formula) });

const LIST = [
  { id: "H2O", name: "Water", formula: "H2O", state: "l", kind: "molecular", entity: ENT.molecule,
    geometry: { name: "Bent (V-shaped)", angleDeg: 104.5, angleLabel: "H–O–H ≈ 104.5°", ...bent("O", "H", 0.957, 104.5) } },
  { id: "CO2", name: "Carbon dioxide", formula: "CO2", state: "g", kind: "molecular", entity: ENT.molecule,
    geometry: { name: "Linear", angleDeg: 180, angleLabel: "O=C=O = 180°", ...linearTriatomic("C", "O", 1.16, 2) } },
  { id: "NH3", name: "Ammonia", formula: "NH3", state: "g", kind: "molecular", entity: ENT.molecule,
    geometry: { name: "Trigonal pyramidal", angleDeg: 107, angleLabel: "H–N–H ≈ 107°", ...pyramid("N", "H", 1.012, 107) } },
  { id: "CH4", name: "Methane", formula: "CH4", state: "g", kind: "molecular", entity: ENT.molecule,
    geometry: { name: "Tetrahedral", angleDeg: 109.5, angleLabel: "H–C–H ≈ 109.5°", ...tetrahedral("C", "H", 1.087) } },
  { id: "H2", name: "Hydrogen", formula: "H2", state: "g", kind: "molecular", entity: ENT.molecule,
    geometry: { name: "Diatomic", angleDeg: null, angleLabel: "H–H single bond", ...diatomic("H", 0.741, 1) } },
  { id: "O2", name: "Oxygen", formula: "O2", state: "g", kind: "molecular", entity: ENT.molecule,
    geometry: { name: "Diatomic", angleDeg: null, angleLabel: "O=O double bond", ...diatomic("O", 1.208, 2) } },
  { id: "N2", name: "Nitrogen", formula: "N2", state: "g", kind: "molecular", entity: ENT.molecule,
    geometry: { name: "Diatomic", angleDeg: null, angleLabel: "N≡N triple bond", ...diatomic("N", 1.098, 3) } },
  { id: "NaCl", name: "Sodium chloride", formula: "NaCl", state: "s", kind: "ionic", entity: ENT.formulaUnit,
    ions: [ion("Na", 1), ion("Cl", -1)], lattice: { type: "rock-salt", nnPm: 282, name: "Face-centred cubic (rock-salt) ionic lattice", note: "Each Na⁺ is surrounded by six Cl⁻ and vice versa." } },
  { id: "NaOH", name: "Sodium hydroxide", formula: "NaOH", state: "s", kind: "ionic", entity: ENT.formulaUnit,
    ions: [ion("Na", 1), ion("OH", -1)], lattice: { type: "rock-salt", nnPm: 240, name: "Ionic solid of Na⁺ and OH⁻", note: "Drawn as a representative rock-salt-like fragment; the real NaOH lattice is more complex (simplification)." } },
  { id: "MgO", name: "Magnesium oxide", formula: "MgO", state: "s", kind: "ionic", entity: ENT.formulaUnit,
    ions: [ion("Mg", 2), ion("O", -2)], lattice: { type: "rock-salt", nnPm: 211, name: "Rock-salt ionic lattice of Mg²⁺ and O²⁻", note: "Each Mg²⁺ is surrounded by six O²⁻ and vice versa." } },
  { id: "Mg", name: "Magnesium", formula: "Mg", state: "s", kind: "metallic", entity: ENT.atom,
    lattice: { type: "hcp", nnPm: 320, name: "Metallic lattice (hexagonal close-packed)", note: "Atoms in a regular array in a sea of delocalised electrons; there are no Mg molecules." } },
  { id: "Fe", name: "Iron", formula: "Fe", state: "s", kind: "metallic", entity: ENT.atom,
    lattice: { type: "bcc", nnPm: 248, name: "Metallic lattice (body-centred cubic)", note: "Atoms in a regular array in a sea of delocalised electrons; there are no Fe molecules." } },
  { id: "Na", name: "Sodium", formula: "Na", state: "s", kind: "metallic", entity: ENT.atom,
    lattice: { type: "bcc", nnPm: 372, name: "Metallic lattice (body-centred cubic)", note: "Atoms in a regular array in a sea of delocalised electrons; there are no Na molecules." } },
  // Aqueous NaOH: hydrated ions only -- never intact NaOH molecules (spec D Stage 3 safeguards).  Not selectable in Stages 1-2.
  { id: "NaOH_aq", name: "Sodium hydroxide solution", formula: "NaOH", state: "aq", kind: "aqueous-ionic", entity: ENT.formulaUnit, solutionOnly: true,
    ions: [ion("Na", 1), ion("OH", -1)], lattice: null, parent: "NaOH",
    note: "Hydrated Na⁺ and OH⁻ ions; no intact NaOH molecules exist in the solution." },
];

/** Stage 1 / Stage 2 selector order: water first (spec: start with H2O). */
export const SELECTABLE_IDS = Object.freeze(["H2O", "CO2", "NH3", "CH4", "H2", "O2", "N2", "NaCl", "NaOH", "MgO", "Mg", "Fe", "Na"]);

function finish(raw) {
  const composition = parseFormula(raw.formula);
  const geometry = raw.geometry ? { ...raw.geometry, atoms: raw.geometry.atoms.map((a) => ({ ...a })), bonds: raw.geometry.bonds.map((b) => ({ ...b })) }
    : raw.kind === "metallic" ? { name: "Single atom", angleDeg: null, ...single(raw.formula) } : null;
  const out = {
    ...raw, composition, display: `${toUnicodeFormula(raw.formula)}(${raw.state})`, formulaDisplay: toUnicodeFormula(raw.formula),
    atomsPerEntity: atomTotal(composition), geometry, counting: false, ions: raw.ions ?? null,
  };
  return Object.freeze(out);
}

/** Counting entities used by "Separate into counting packets" (A4): packets of one kind of ATOM or ION.  They are not chemical
 *  substances you could buy -- they are the "N mol of H atoms" in n(H) = 2 n(H2O). */
function atomEntity(symbol) {
  const el = ELEMENTS[symbol];
  return Object.freeze({ id: `atoms:${symbol}`, name: `${el.name} atoms`, formula: symbol, formulaDisplay: symbol, display: `${symbol} atoms`, state: null, kind: "atom-entity", entity: ENT.atom,
    composition: { [symbol]: 1 }, atomsPerEntity: 1, geometry: { name: "Single atom", angleDeg: null, ...single(symbol) }, ions: null, lattice: null, counting: true, element: symbol });
}
function ionEntity(i) {
  const label = i.label;
  const g = i.composition && atomTotal(i.composition) > 1 ? (i.formula === "OH" ? { name: "Hydroxide ion", angleDeg: null, ...diatomic("O", 0.97, 1, "H") } : null) : { name: "Single ion", angleDeg: null, ...single(i.formula) };
  return Object.freeze({ id: `ion:${i.formula}${Math.abs(i.charge) === 1 ? "" : Math.abs(i.charge)}${i.charge > 0 ? "+" : "-"}`, name: `${label} ions`, formula: i.formula, formulaDisplay: label, display: `${label} ions`, state: "ion", kind: "ion-entity", entity: ENT.ion,
    composition: i.composition, atomsPerEntity: atomTotal(i.composition), geometry: g, ions: null, lattice: null, counting: true, charge: i.charge, ionFormula: i.formula });
}

const table = {};
for (const raw of LIST) table[raw.id] = finish(raw);
const atomTable = {}; const ionTable = {};
for (const sym of Object.keys(ELEMENTS)) atomTable[`atoms:${sym}`] = atomEntity(sym);
for (const s of Object.values(table)) for (const i of s.ions ?? []) { const e = ionEntity(i); ionTable[e.id] = e; }

export const SUBSTANCES = Object.freeze(table);
export const SUBSTANCE_LIST = Object.freeze(LIST.map((r) => table[r.id]));
export const COUNTING_ENTITIES = Object.freeze({ ...atomTable, ...ionTable });

/** Look up ANY substance, counting entity or ion by id. Throws on unknown ids (never returns a guess). */
export function getSubstance(id) {
  const s = table[id] ?? atomTable[id] ?? ionTable[id];
  if (!s) throw new Error(`Unknown substance "${id}"`);
  return s;
}
export const hasSubstance = (id) => Boolean(table[id] ?? atomTable[id] ?? ionTable[id]);
export const atomEntityId = (symbol) => `atoms:${symbol}`;
export function ionEntityId(ionDef) { return ionEntity(ionDef).id; }
export const selectableSubstances = () => SELECTABLE_IDS.map((id) => table[id]);

/** Molar mass in g mol^-1 under an EXPLICIT policy (default teaching).  Ions use their formula mass (electron mass neglected). */
export function molarMass(substanceOrId, policy = DEFAULT_POLICY) {
  const s = typeof substanceOrId === "string" ? getSubstance(substanceOrId) : substanceOrId;
  let m = 0;
  for (const [el, c] of Object.entries(s.composition)) m += c * atomicMass(el, policy);
  return clean(m);
}
/** Which elements in this substance carry a SIMPLIFIED teaching value (so the UI can label it). */
export function simplifiedElements(substanceOrId, policy = DEFAULT_POLICY) {
  if (policy !== "teaching") return [];
  const s = typeof substanceOrId === "string" ? getSubstance(substanceOrId) : substanceOrId;
  return Object.keys(s.composition).filter((el) => ELEMENTS[el].simplifiedTeaching);
}
