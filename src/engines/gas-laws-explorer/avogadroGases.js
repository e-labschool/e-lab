// Gas Laws Explorer -- the two-gas Avogadro comparison (GS-19). Pure data and arithmetic, no DOM.
// Molar masses are sums of the relative atomic masses in the IB data booklet (H 1.01, He 4.00, C 12.01, N 14.01, O 16.00, Ne 20.18).
import { AVOGADRO, R_GAS } from "./model.js";

export const AVOGADRO_GASES = Object.freeze([
  { id: "H2", tag: "H₂", name: "Hydrogen", M: 2.02, colour: "#2F7BF5" },
  { id: "He", tag: "He", name: "Helium", M: 4.0, colour: "#0E8F6B" },
  { id: "CH4", tag: "CH₄", name: "Methane", M: 16.05, colour: "#B45309" },
  { id: "N2", tag: "N₂", name: "Nitrogen", M: 28.02, colour: "#6B7A99" },
  { id: "O2", tag: "O₂", name: "Oxygen", M: 32.0, colour: "#D93A30" },
  { id: "CO2", tag: "CO₂", name: "Carbon dioxide", M: 44.01, colour: "#8B5CF6" },
]);
export const gasById = (id) => AVOGADRO_GASES.find((g) => g.id === id) ?? AVOGADRO_GASES[1];

/** Two gases in two cylinders of the SAME volume V at the same P and T: PV = nRT gives the same n, hence the same number of molecules;
 *  only the mass (and so the density) differs. n comes from the investigation's state. */
export function compareTwoGases(state, idA, idB) {
  const n = (state.P * state.V) / (R_GAS * state.T);
  const one = (g) => ({ gas: g, n, molecules: n * AVOGADRO, mass: n * g.M, density: (n * g.M) / state.V });
  return { V: state.V, P: state.P, T: state.T, n, A: one(gasById(idA)), B: one(gasById(idB)), sameMolecules: true };
}
