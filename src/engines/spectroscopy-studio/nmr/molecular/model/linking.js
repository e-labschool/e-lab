// Linked selection between the molecule, the spectrum, the integration and the coupling graph. PURE state transitions
// (no React): the UI calls these and writes the result through the studio setters. Works for EVERY molecule.
//
// Selection state = { selectedEnvId, selectedMultipletId }.  The multiplet id of an environment is `m-<envId>` (one multiplet
// per environment in this model); both ids always change together so the molecule and the spectrum can never disagree.

import { getMolecule } from "./molecules.js";
import { neighbourSets } from "./spectrum.js";

export const multipletIdOfEnv = (envId) => (envId ? `m-${envId}` : null);
export const envIdOfMultiplet = (multipletId) => (typeof multipletId === "string" && multipletId.startsWith("m-") ? multipletId.slice(2) : multipletId ?? null);

const valid = (mol, envId) => (envId && mol.environments.some((e) => e.id === envId) ? envId : null);
export const emptySelection = () => ({ selectedEnvId: null, selectedMultipletId: null });

/** Molecule (or list) -> spectrum: select an environment, which selects its multiplet. */
export function selectEnvironment(mol, envId) {
  const id = valid(mol, envId);
  return { selectedEnvId: id, selectedMultipletId: multipletIdOfEnv(id) };
}
/** Spectrum -> molecule: select a multiplet, which selects its environment. */
export function selectMultiplet(mol, multipletId) { return selectEnvironment(mol, envIdOfMultiplet(multipletId)); }
/** Click on an atom: a hydrogen selects its environment; a heavy atom selects the environment of the H it carries (if any). */
export function selectAtom(mol, atomIdx) {
  const a = mol.atoms[atomIdx];
  if (!a) return emptySelection();
  const envId = a.isHydrogen ? mol.envOfAtom[atomIdx] : a.hydrogens.length ? mol.envOfAtom[a.hydrogens[0]] : null;
  return selectEnvironment(mol, envId);
}
/** Toggle behaviour used by clicks: clicking the already selected environment clears the selection. */
export function toggleEnvironment(mol, current, envId) { return current === envId ? emptySelection() : selectEnvironment(mol, envId); }

/** Hydrogen atoms of an environment (all equivalent H highlighted in the same colour). */
export function atomsOfEnvironment(mol, envId) { return mol.environments.find((e) => e.id === envId)?.atoms ?? []; }
/** Heavy atoms that carry the environment's H. */
export function carrierAtoms(mol, envId) { return mol.environments.find((e) => e.id === envId)?.heavyAtoms ?? []; }

/** Environments that couple to the given one (those whose H split it), excluding exchange-decoupled ones. */
export function coupledEnvironments(mol, envId) { return neighbourSets(mol, envId).map((s) => s.envId); }
/** Hydrogen atoms of the coupled neighbours (for "click splitting -> neighbouring coupled hydrogen groups highlight"). */
export function coupledAtoms(mol, envId) { return coupledEnvironments(mol, envId).flatMap((id) => atomsOfEnvironment(mol, id)); }

/** Everything a view needs to draw the current selection. */
export function highlightModel(mol, selectedEnvId, { showCoupled = false } = {}) {
  const env = valid(mol, selectedEnvId);
  const coupledEnvIds = env && showCoupled ? coupledEnvironments(mol, env) : [];
  return {
    envId: env, multipletId: multipletIdOfEnv(env),
    hydrogens: env ? atomsOfEnvironment(mol, env) : [], carriers: env ? carrierAtoms(mol, env) : [],
    coupledEnvIds, coupledHydrogens: coupledEnvIds.flatMap((id) => atomsOfEnvironment(mol, id)),
  };
}

/** Sanitise externally supplied ids (e.g. after the molecule changed): a selection from another molecule is dropped. */
export function reconcileSelection(moleculeId, selectedEnvId, selectedMultipletId) {
  const mol = getMolecule(moleculeId);
  const fromEnv = valid(mol, selectedEnvId);
  const fromMult = valid(mol, envIdOfMultiplet(selectedMultipletId));
  const envId = fromEnv ?? fromMult;
  return { mol, ...selectEnvironment(mol, envId) };
}
