// The structure library of the Structure Investigation tab: every structure that can be the UNKNOWN or appear among the four CHOICES. PURE DATA.
//
// A structure is only a molecular graph (heavy atoms with 2D coordinates for the skeletal drawing, bonds with orders) plus names. The formula, molar
// mass, degree of unsaturation, ¹H environments, splitting and IR groups are DERIVED from the graph (model/graph.js), so they cannot disagree with
// the drawing. Spectra live in data/compounds.js and exist only for the eight unknowns; the other structures are distractors.
//
// `msBase` (optional): the m/z at which the structure is normally expected to give its strongest EI peak. Given ONLY where the author is confident
// of the textbook pattern; it is used for feedback, never drawn.
import { analyse, prettyFormula } from "../model/graph.js";

const A = 0.866; // zig-zag step for a unit bond length
const C = (id, x, y) => ({ id, el: "C", x, y });
const O = (id, x, y) => ({ id, el: "O", x, y });

const RAW = [
  { id: "ethanol", name: "ethanol", aliases: ["ethyl alcohol"], condensed: "CH3CH2OH", atoms: [C("a", 0, 0), C("b", A, 0.5), O("c", 2 * A, 0)], bonds: [["a", "b", 1], ["b", "c", 1]], msBase: 31 },
  { id: "methoxymethane", name: "methoxymethane", aliases: ["dimethyl ether"], condensed: "CH3OCH3", atoms: [C("a", 0, 0), O("b", A, 0.5), C("c", 2 * A, 0)], bonds: [["a", "b", 1], ["b", "c", 1]] },
  { id: "ethanal", name: "ethanal", aliases: ["acetaldehyde"], condensed: "CH3CHO", atoms: [C("a", 0, 0), C("b", A, 0.5), O("c", A, 1.5)], bonds: [["a", "b", 1], ["b", "c", 2]], msBase: 29 },
  { id: "ethanoic-acid", name: "ethanoic acid", aliases: ["acetic acid"], condensed: "CH3COOH", atoms: [C("a", 0, 0), C("b", A, 0.5), O("c", A, 1.5), O("d", 2 * A, 0)], bonds: [["a", "b", 1], ["b", "c", 2], ["b", "d", 1]], msBase: 43 },
  { id: "propanone", name: "propanone", aliases: ["acetone", "dimethyl ketone"], condensed: "CH3COCH3", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), O("d", A, 1.5)], bonds: [["a", "b", 1], ["b", "c", 1], ["b", "d", 2]], msBase: 43 },
  { id: "propanal", name: "propanal", aliases: ["propionaldehyde"], condensed: "CH3CH2CHO", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), O("d", 2 * A, -1)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 2]], msBase: 29 },
  { id: "prop-2-en-1-ol", name: "prop-2-en-1-ol", aliases: ["allyl alcohol"], condensed: "CH2=CHCH2OH", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), O("d", 3 * A, 0.5)], bonds: [["a", "b", 2], ["b", "c", 1], ["c", "d", 1]] },
  { id: "propan-2-ol", name: "propan-2-ol", aliases: ["isopropanol", "2-propanol", "isopropyl alcohol"], condensed: "(CH3)2CHOH", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), O("d", A, 1.5)], bonds: [["a", "b", 1], ["b", "c", 1], ["b", "d", 1]], msBase: 45 },
  { id: "propan-1-ol", name: "propan-1-ol", aliases: ["1-propanol", "n-propanol"], condensed: "CH3CH2CH2OH", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), O("d", 3 * A, 0.5)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 1]], msBase: 31 },
  { id: "methoxyethane", name: "methoxyethane", aliases: ["ethyl methyl ether"], condensed: "CH3OCH2CH3", atoms: [C("a", 0, 0), C("b", A, 0.5), O("c", 2 * A, 0), C("d", 3 * A, 0.5)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 1]] },
  { id: "methyl-methanoate", name: "methyl methanoate", aliases: ["methyl formate"], condensed: "HCOOCH3", atoms: [C("a", 0, 0), O("b", A, 0.5), C("c", 2 * A, 0), O("d", 2 * A, -1)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 2]] },
  { id: "methyloxirane", name: "methyloxirane", aliases: ["propylene oxide", "1,2-epoxypropane"], condensed: "CH3CH(O)CH2", atoms: [C("a", 0, 0), C("b", 1, 0), O("c", 0.5, 0.866), C("d", 1 + A, 0.5)], bonds: [["a", "b", 1], ["a", "c", 1], ["b", "c", 1], ["b", "d", 1]] },
  { id: "butanone", name: "butanone", aliases: ["butan-2-one", "methyl ethyl ketone"], condensed: "CH3COCH2CH3", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), C("d", 3 * A, 0.5), O("e", A, 1.5)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 1], ["b", "e", 2]], msBase: 43 },
  { id: "butanal", name: "butanal", aliases: ["butyraldehyde"], condensed: "CH3CH2CH2CHO", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), C("d", 3 * A, 0.5), O("e", 3 * A, 1.5)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 1], ["d", "e", 2]], msBase: 44 },
  { id: "2-methylpropanal", name: "2-methylpropanal", aliases: ["isobutyraldehyde"], condensed: "(CH3)2CHCHO", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), C("d", A, 1.5), O("e", 2 * A, -1)], bonds: [["a", "b", 1], ["b", "c", 1], ["b", "d", 1], ["c", "e", 2]] },
  { id: "but-3-en-2-ol", name: "but-3-en-2-ol", aliases: [], condensed: "CH2=CHCH(OH)CH3", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), C("d", 3 * A, 0.5), O("e", 2 * A, -1)], bonds: [["a", "b", 2], ["b", "c", 1], ["c", "d", 1], ["c", "e", 1]] },
  { id: "ethyl-ethanoate", name: "ethyl ethanoate", aliases: ["ethyl acetate"], condensed: "CH3COOCH2CH3", atoms: [C("a", 0, 0), C("b", A, 0.5), O("c", A, 1.5), O("d", 2 * A, 0), C("e", 3 * A, 0.5), C("f", 4 * A, 0)], bonds: [["a", "b", 1], ["b", "c", 2], ["b", "d", 1], ["d", "e", 1], ["e", "f", 1]], msBase: 43 },
  { id: "methyl-propanoate", name: "methyl propanoate", aliases: ["methyl propionate"], condensed: "CH3CH2COOCH3", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), O("d", 2 * A, -1), O("e", 3 * A, 0.5), C("f", 4 * A, 0)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 2], ["c", "e", 1], ["e", "f", 1]], msBase: 57 },
  { id: "propyl-methanoate", name: "propyl methanoate", aliases: ["propyl formate"], condensed: "HCOOCH2CH2CH3", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), O("d", 3 * A, 0.5), C("e", 4 * A, 0), O("f", 4 * A, -1)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 1], ["d", "e", 1], ["e", "f", 2]] },
  { id: "butanoic-acid", name: "butanoic acid", aliases: ["butyric acid"], condensed: "CH3CH2CH2COOH", atoms: [C("a", 0, 0), C("b", A, 0.5), C("c", 2 * A, 0), C("d", 3 * A, 0.5), O("e", 3 * A, 1.5), O("f", 4 * A, 0)], bonds: [["a", "b", 1], ["b", "c", 1], ["c", "d", 1], ["d", "e", 2], ["d", "f", 1]], msBase: 60 },
];

export const STRUCTURES = {};
for (const r of RAW) {
  const graph = analyse(r);
  STRUCTURES[r.id] = { ...r, graph, formula: graph.formula, formulaPretty: prettyFormula(graph.formula), nominal: graph.nominal, molarMass: graph.molarMass, dou: graph.dou };
}
export const STRUCTURE_IDS = RAW.map((r) => r.id);
export const getStructure = (id) => STRUCTURES[id] ?? null;
