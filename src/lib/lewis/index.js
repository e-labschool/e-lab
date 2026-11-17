// Lewis-structure engine (pure): element facts, resolver, curated library, geometry, polarity, recognition.
export * from "./data.js";
export * from "./format.js";
export { resolveAtoms, searchStructures, validateStructure, finalizeStructure, canonical, centreOf, ownedElectrons, MAX_ATOMS, MAX_HEAVY, CHARGE_TRIALS, chargeLabel } from "./resolve.js";
export { parseSmiles } from "./smiles.js";
export { getLibrary, getEntry, findByComposition, searchLibrary, LIBRARY_CATEGORIES, LIBRARY_SIZE } from "./library.js";
export { domainsOf, shapeCentres, shapeText, embed3D, layout2D, lonePairDirections, bondLength3D, minNonBondedGap } from "./geometry.js";
export { recognise, describeStructure, buildSummary, condensedText } from "./recognise.js";
export * as polarity from "./polarity.js";
