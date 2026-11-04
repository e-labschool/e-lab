// Molecular side of the NMR simulation. Each component takes ONE prop, `studio` (see docs/NMR_MOLECULAR_MODEL.md for the contract).
export { default as MolecularProcessStage } from "./components/MolecularProcessStage.jsx";
export { default as SpectrumStage } from "./components/SpectrumStage.jsx";
export { default as InterpretationStage } from "./components/InterpretationStage.jsx";
export { default as SplittingLab } from "./components/SplittingLab.jsx";
export { MOLECULES, getMolecule } from "./model/molecules.js";
