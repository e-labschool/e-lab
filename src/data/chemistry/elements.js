// The authoritative periodic-table dataset: physical facts only
// (symbol, name, period, group, block). Electron configuration is NOT
// stored here — it's computed on demand by the electron-configuration
// engine (engines/electron-configuration/logic/buildConfiguration.js) so
// this file can be reused by any future tool (Periodic Trends Explorer,
// Ion Formation Explorer, bonding tools, ...) without duplicating data.
//
// Block/group convention used here (a standard teaching convention, not
// the only valid one): La (57) and Ac (89) are placed in the d-block as
// group 3; Ce-Lu (58-71) and Th-Lr (90-103) form the f-block footnote rows
// with group: null. This matches the ground-state configurations used in
// electron-config-exceptions.js (La and Ac both fill a d-electron before
// an f-electron).

const elements = [
  { atomicNumber: 1, symbol: "H", name: "Hydrogen", period: 1, group: 1, block: "s" },
  { atomicNumber: 2, symbol: "He", name: "Helium", period: 1, group: 18, block: "s" },
  { atomicNumber: 3, symbol: "Li", name: "Lithium", period: 2, group: 1, block: "s" },
  { atomicNumber: 4, symbol: "Be", name: "Beryllium", period: 2, group: 2, block: "s" },
  { atomicNumber: 5, symbol: "B", name: "Boron", period: 2, group: 13, block: "p" },
  { atomicNumber: 6, symbol: "C", name: "Carbon", period: 2, group: 14, block: "p" },
  { atomicNumber: 7, symbol: "N", name: "Nitrogen", period: 2, group: 15, block: "p" },
  { atomicNumber: 8, symbol: "O", name: "Oxygen", period: 2, group: 16, block: "p" },
  { atomicNumber: 9, symbol: "F", name: "Fluorine", period: 2, group: 17, block: "p" },
  { atomicNumber: 10, symbol: "Ne", name: "Neon", period: 2, group: 18, block: "p" },
  { atomicNumber: 11, symbol: "Na", name: "Sodium", period: 3, group: 1, block: "s" },
  { atomicNumber: 12, symbol: "Mg", name: "Magnesium", period: 3, group: 2, block: "s" },
  { atomicNumber: 13, symbol: "Al", name: "Aluminium", period: 3, group: 13, block: "p" },
  { atomicNumber: 14, symbol: "Si", name: "Silicon", period: 3, group: 14, block: "p" },
  { atomicNumber: 15, symbol: "P", name: "Phosphorus", period: 3, group: 15, block: "p" },
  { atomicNumber: 16, symbol: "S", name: "Sulfur", period: 3, group: 16, block: "p" },
  { atomicNumber: 17, symbol: "Cl", name: "Chlorine", period: 3, group: 17, block: "p" },
  { atomicNumber: 18, symbol: "Ar", name: "Argon", period: 3, group: 18, block: "p" },
  { atomicNumber: 19, symbol: "K", name: "Potassium", period: 4, group: 1, block: "s" },
  { atomicNumber: 20, symbol: "Ca", name: "Calcium", period: 4, group: 2, block: "s" },
  { atomicNumber: 21, symbol: "Sc", name: "Scandium", period: 4, group: 3, block: "d" },
  { atomicNumber: 22, symbol: "Ti", name: "Titanium", period: 4, group: 4, block: "d" },
  { atomicNumber: 23, symbol: "V", name: "Vanadium", period: 4, group: 5, block: "d" },
  { atomicNumber: 24, symbol: "Cr", name: "Chromium", period: 4, group: 6, block: "d" },
  { atomicNumber: 25, symbol: "Mn", name: "Manganese", period: 4, group: 7, block: "d" },
  { atomicNumber: 26, symbol: "Fe", name: "Iron", period: 4, group: 8, block: "d" },
  { atomicNumber: 27, symbol: "Co", name: "Cobalt", period: 4, group: 9, block: "d" },
  { atomicNumber: 28, symbol: "Ni", name: "Nickel", period: 4, group: 10, block: "d" },
  { atomicNumber: 29, symbol: "Cu", name: "Copper", period: 4, group: 11, block: "d" },
  { atomicNumber: 30, symbol: "Zn", name: "Zinc", period: 4, group: 12, block: "d" },
  { atomicNumber: 31, symbol: "Ga", name: "Gallium", period: 4, group: 13, block: "p" },
  { atomicNumber: 32, symbol: "Ge", name: "Germanium", period: 4, group: 14, block: "p" },
  { atomicNumber: 33, symbol: "As", name: "Arsenic", period: 4, group: 15, block: "p" },
  { atomicNumber: 34, symbol: "Se", name: "Selenium", period: 4, group: 16, block: "p" },
  { atomicNumber: 35, symbol: "Br", name: "Bromine", period: 4, group: 17, block: "p" },
  { atomicNumber: 36, symbol: "Kr", name: "Krypton", period: 4, group: 18, block: "p" },
  { atomicNumber: 37, symbol: "Rb", name: "Rubidium", period: 5, group: 1, block: "s" },
  { atomicNumber: 38, symbol: "Sr", name: "Strontium", period: 5, group: 2, block: "s" },
  { atomicNumber: 39, symbol: "Y", name: "Yttrium", period: 5, group: 3, block: "d" },
  { atomicNumber: 40, symbol: "Zr", name: "Zirconium", period: 5, group: 4, block: "d" },
  { atomicNumber: 41, symbol: "Nb", name: "Niobium", period: 5, group: 5, block: "d" },
  { atomicNumber: 42, symbol: "Mo", name: "Molybdenum", period: 5, group: 6, block: "d" },
  { atomicNumber: 43, symbol: "Tc", name: "Technetium", period: 5, group: 7, block: "d" },
  { atomicNumber: 44, symbol: "Ru", name: "Ruthenium", period: 5, group: 8, block: "d" },
  { atomicNumber: 45, symbol: "Rh", name: "Rhodium", period: 5, group: 9, block: "d" },
  { atomicNumber: 46, symbol: "Pd", name: "Palladium", period: 5, group: 10, block: "d" },
  { atomicNumber: 47, symbol: "Ag", name: "Silver", period: 5, group: 11, block: "d" },
  { atomicNumber: 48, symbol: "Cd", name: "Cadmium", period: 5, group: 12, block: "d" },
  { atomicNumber: 49, symbol: "In", name: "Indium", period: 5, group: 13, block: "p" },
  { atomicNumber: 50, symbol: "Sn", name: "Tin", period: 5, group: 14, block: "p" },
  { atomicNumber: 51, symbol: "Sb", name: "Antimony", period: 5, group: 15, block: "p" },
  { atomicNumber: 52, symbol: "Te", name: "Tellurium", period: 5, group: 16, block: "p" },
  { atomicNumber: 53, symbol: "I", name: "Iodine", period: 5, group: 17, block: "p" },
  { atomicNumber: 54, symbol: "Xe", name: "Xenon", period: 5, group: 18, block: "p" },
  { atomicNumber: 55, symbol: "Cs", name: "Caesium", period: 6, group: 1, block: "s" },
  { atomicNumber: 56, symbol: "Ba", name: "Barium", period: 6, group: 2, block: "s" },
  { atomicNumber: 57, symbol: "La", name: "Lanthanum", period: 6, group: 3, block: "d" },
  { atomicNumber: 58, symbol: "Ce", name: "Cerium", period: 6, group: null, block: "f" },
  { atomicNumber: 59, symbol: "Pr", name: "Praseodymium", period: 6, group: null, block: "f" },
  { atomicNumber: 60, symbol: "Nd", name: "Neodymium", period: 6, group: null, block: "f" },
  { atomicNumber: 61, symbol: "Pm", name: "Promethium", period: 6, group: null, block: "f" },
  { atomicNumber: 62, symbol: "Sm", name: "Samarium", period: 6, group: null, block: "f" },
  { atomicNumber: 63, symbol: "Eu", name: "Europium", period: 6, group: null, block: "f" },
  { atomicNumber: 64, symbol: "Gd", name: "Gadolinium", period: 6, group: null, block: "f" },
  { atomicNumber: 65, symbol: "Tb", name: "Terbium", period: 6, group: null, block: "f" },
  { atomicNumber: 66, symbol: "Dy", name: "Dysprosium", period: 6, group: null, block: "f" },
  { atomicNumber: 67, symbol: "Ho", name: "Holmium", period: 6, group: null, block: "f" },
  { atomicNumber: 68, symbol: "Er", name: "Erbium", period: 6, group: null, block: "f" },
  { atomicNumber: 69, symbol: "Tm", name: "Thulium", period: 6, group: null, block: "f" },
  { atomicNumber: 70, symbol: "Yb", name: "Ytterbium", period: 6, group: null, block: "f" },
  { atomicNumber: 71, symbol: "Lu", name: "Lutetium", period: 6, group: null, block: "f" },
  { atomicNumber: 72, symbol: "Hf", name: "Hafnium", period: 6, group: 4, block: "d" },
  { atomicNumber: 73, symbol: "Ta", name: "Tantalum", period: 6, group: 5, block: "d" },
  { atomicNumber: 74, symbol: "W", name: "Tungsten", period: 6, group: 6, block: "d" },
  { atomicNumber: 75, symbol: "Re", name: "Rhenium", period: 6, group: 7, block: "d" },
  { atomicNumber: 76, symbol: "Os", name: "Osmium", period: 6, group: 8, block: "d" },
  { atomicNumber: 77, symbol: "Ir", name: "Iridium", period: 6, group: 9, block: "d" },
  { atomicNumber: 78, symbol: "Pt", name: "Platinum", period: 6, group: 10, block: "d" },
  { atomicNumber: 79, symbol: "Au", name: "Gold", period: 6, group: 11, block: "d" },
  { atomicNumber: 80, symbol: "Hg", name: "Mercury", period: 6, group: 12, block: "d" },
  { atomicNumber: 81, symbol: "Tl", name: "Thallium", period: 6, group: 13, block: "p" },
  { atomicNumber: 82, symbol: "Pb", name: "Lead", period: 6, group: 14, block: "p" },
  { atomicNumber: 83, symbol: "Bi", name: "Bismuth", period: 6, group: 15, block: "p" },
  { atomicNumber: 84, symbol: "Po", name: "Polonium", period: 6, group: 16, block: "p" },
  { atomicNumber: 85, symbol: "At", name: "Astatine", period: 6, group: 17, block: "p" },
  { atomicNumber: 86, symbol: "Rn", name: "Radon", period: 6, group: 18, block: "p" },
  { atomicNumber: 87, symbol: "Fr", name: "Francium", period: 7, group: 1, block: "s" },
  { atomicNumber: 88, symbol: "Ra", name: "Radium", period: 7, group: 2, block: "s" },
  { atomicNumber: 89, symbol: "Ac", name: "Actinium", period: 7, group: 3, block: "d" },
  { atomicNumber: 90, symbol: "Th", name: "Thorium", period: 7, group: null, block: "f" },
  { atomicNumber: 91, symbol: "Pa", name: "Protactinium", period: 7, group: null, block: "f" },
  { atomicNumber: 92, symbol: "U", name: "Uranium", period: 7, group: null, block: "f" },
  { atomicNumber: 93, symbol: "Np", name: "Neptunium", period: 7, group: null, block: "f" },
  { atomicNumber: 94, symbol: "Pu", name: "Plutonium", period: 7, group: null, block: "f" },
  { atomicNumber: 95, symbol: "Am", name: "Americium", period: 7, group: null, block: "f" },
  { atomicNumber: 96, symbol: "Cm", name: "Curium", period: 7, group: null, block: "f" },
  { atomicNumber: 97, symbol: "Bk", name: "Berkelium", period: 7, group: null, block: "f" },
  { atomicNumber: 98, symbol: "Cf", name: "Californium", period: 7, group: null, block: "f" },
  { atomicNumber: 99, symbol: "Es", name: "Einsteinium", period: 7, group: null, block: "f" },
  { atomicNumber: 100, symbol: "Fm", name: "Fermium", period: 7, group: null, block: "f" },
  { atomicNumber: 101, symbol: "Md", name: "Mendelevium", period: 7, group: null, block: "f" },
  { atomicNumber: 102, symbol: "No", name: "Nobelium", period: 7, group: null, block: "f" },
  { atomicNumber: 103, symbol: "Lr", name: "Lawrencium", period: 7, group: null, block: "f" },
  { atomicNumber: 104, symbol: "Rf", name: "Rutherfordium", period: 7, group: 4, block: "d" },
  { atomicNumber: 105, symbol: "Db", name: "Dubnium", period: 7, group: 5, block: "d" },
  { atomicNumber: 106, symbol: "Sg", name: "Seaborgium", period: 7, group: 6, block: "d" },
  { atomicNumber: 107, symbol: "Bh", name: "Bohrium", period: 7, group: 7, block: "d" },
  { atomicNumber: 108, symbol: "Hs", name: "Hassium", period: 7, group: 8, block: "d" },
  { atomicNumber: 109, symbol: "Mt", name: "Meitnerium", period: 7, group: 9, block: "d" },
  { atomicNumber: 110, symbol: "Ds", name: "Darmstadtium", period: 7, group: 10, block: "d" },
  { atomicNumber: 111, symbol: "Rg", name: "Roentgenium", period: 7, group: 11, block: "d" },
  { atomicNumber: 112, symbol: "Cn", name: "Copernicium", period: 7, group: 12, block: "d" },
  { atomicNumber: 113, symbol: "Nh", name: "Nihonium", period: 7, group: 13, block: "p" },
  { atomicNumber: 114, symbol: "Fl", name: "Flerovium", period: 7, group: 14, block: "p" },
  { atomicNumber: 115, symbol: "Mc", name: "Moscovium", period: 7, group: 15, block: "p" },
  { atomicNumber: 116, symbol: "Lv", name: "Livermorium", period: 7, group: 16, block: "p" },
  { atomicNumber: 117, symbol: "Ts", name: "Tennessine", period: 7, group: 17, block: "p" },
  { atomicNumber: 118, symbol: "Og", name: "Oganesson", period: 7, group: 18, block: "p" },
];

export const elementsByNumber = Object.fromEntries(elements.map((e) => [e.atomicNumber, e]));
export const elementsBySymbol = Object.fromEntries(elements.map((e) => [e.symbol, e]));

export function getElement(atomicNumber) {
  return elementsByNumber[atomicNumber] ?? null;
}

export function getElementBySymbol(symbol) {
  return elementsBySymbol[symbol] ?? null;
}

export function searchElements(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return elements.filter(
    (e) =>
      e.name.toLowerCase().startsWith(q) ||
      e.symbol.toLowerCase() === q ||
      e.symbol.toLowerCase().startsWith(q) ||
      String(e.atomicNumber) === q
  );
}

export default elements;
