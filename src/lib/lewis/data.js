// Element facts for the Lewis-structure engine (pure data, no React).
//   valence    outer-shell electrons, DERIVED from the periodic-table group in data/chemistry/elements.js (not typed in here)
//   period     row of the periodic table (decides whether an octet may be expanded)
//   en         Pauling electronegativity, IB data-booklet rounding (1 decimal place)
//   cov        covalent radius in pm (Cordero et al., Dalton Trans. 2008, 2832) -- only used to give bonds believable relative lengths
// The table is the single source for the Bonding Visualizer's polarity panel too (model/polarity.js re-exports `EN`).
import { getElementBySymbol } from "../../data/chemistry/elements.js";

/** Pauling electronegativities, IB data booklet (section 8) rounding. Metals are included so ionic / metallic modes can share it. */
export const EN = Object.freeze({
  H: 2.2, Li: 1.0, Be: 1.6, B: 2.0, C: 2.6, N: 3.0, O: 3.4, F: 4.0,
  Na: 0.9, Mg: 1.3, Al: 1.6, Si: 1.9, P: 2.2, S: 2.6, Cl: 3.2,
  K: 0.8, Ca: 1.0, Se: 2.6, As: 2.2, Br: 3.0, I: 2.7, Xe: 2.6,
});

/** Covalent radii (pm), Cordero 2008. */
export const COVALENT_PM = Object.freeze({ H: 31, Be: 96, B: 84, C: 76, N: 71, O: 66, F: 57, Al: 121, Si: 111, P: 107, S: 105, Cl: 102, Br: 120, I: 139, Xe: 140 });

/** Elements the covalent engine can place (display order). */
export const LEWIS_SYMBOLS = Object.freeze(["H", "Be", "B", "C", "N", "O", "F", "Al", "Si", "P", "S", "Cl", "Br", "I", "Xe"]);

/** Atoms that complete the octet by sharing, so an incomplete octet is an accepted exception (IB: BeCl2, BF3, AlCl3). */
export const INCOMPLETE_OK = new Set(["Be", "B", "Al"]);
/** Elements that never take a second bond in school chemistry. */
const TERMINAL_ONLY = new Set(["H", "F"]);

const cache = new Map();
/** { symbol, Z, name, valence, period, group, en, cov } or null when the symbol is not part of the covalent model. */
export function lewisElement(symbol) {
  if (cache.has(symbol)) return cache.get(symbol);
  let rec = null;
  if (LEWIS_SYMBOLS.includes(symbol)) {
    const e = getElementBySymbol(symbol);
    if (e) {
      const valence = e.group <= 2 ? e.group : e.group - 10;
      rec = Object.freeze({ symbol, Z: e.atomicNumber, name: e.name, valence, period: e.period, group: e.group, en: EN[symbol], cov: COVALENT_PM[symbol] });
    }
  }
  cache.set(symbol, rec);
  return rec;
}

/** Largest number of electrons the atom may have around it: octet (duet for H); expanded when allowed and period >= 3. */
export function maxElectrons(symbol, beyond) {
  const e = lewisElement(symbol);
  if (symbol === "H") return 2;
  if (beyond && e.period >= 3) return symbol === "Xe" ? 16 : 14;
  return 8;
}

/** Largest number of sigma neighbours an atom may have. */
export function maxDegree(symbol, beyond) {
  if (TERMINAL_ONLY.has(symbol)) return 1;
  if (symbol === "O") return 3; // H3O+
  if (symbol === "Xe") return beyond ? 8 : 0;
  return Math.floor(maxElectrons(symbol, beyond) / 2);
}

/** Highest bond order two atoms may share (IB level: no multiple bonds to H, F, Be, B, Al; triple bonds among C, N and C-O only). */
export function maxPairOrder(a, b, beyond) {
  if (TERMINAL_ONLY.has(a) || TERMINAL_ONLY.has(b)) return 1;
  if (["Be", "B", "Al"].some((s) => s === a || s === b)) return 1;
  const heavy2 = (s) => lewisElement(s).period === 2;
  const canMultiple = (s) => heavy2(s) || ["S", "Si", "P"].includes(s) || (beyond && ["Cl", "Br", "I", "Xe"].includes(s));
  if (!canMultiple(a) || !canMultiple(b)) return 1;
  const trip = (x, y) => (["C", "N"].includes(x) && ["C", "N", "O"].includes(y)) || (["C", "N"].includes(y) && ["C", "N", "O"].includes(x)) || (x === "P" && y === "P") || (x === "C" && y === "P") || (y === "C" && x === "P");
  return trip(a, b) ? 3 : 2;
}

export const isKnownSymbol = (s) => lewisElement(s) !== null;
export const electronegativity = (s) => EN[s];
