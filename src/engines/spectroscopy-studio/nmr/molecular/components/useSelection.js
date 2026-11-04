// Hooks that bind the shared `studio` props to the molecular model: the current molecule, the linked selection (env <-> multiplet
// always change together) and the per-molecule "identified environments" progress (kept across stages by useStageState).
import { useCallback, useEffect, useMemo } from "react";
import { getMolecule, MOLECULES } from "../model/molecules.js";
import { emptySelection, envIdOfMultiplet, selectEnvironment } from "../model/linking.js";
import useStageState from "./useStageState.js";

export function useMolecule(studio) { return useMemo(() => getMolecule(studio?.moleculeId), [studio?.moleculeId]); }

export function useLinkedSelection(studio, mol) {
  const envIds = mol.environments.map((e) => e.id);
  const raw = studio?.selectedEnvId ?? envIdOfMultiplet(studio?.selectedMultipletId);
  const selectedEnvId = raw && envIds.includes(raw) ? raw : null;
  const apply = useCallback((s) => { studio?.setSelectedEnvId?.(s.selectedEnvId); studio?.setSelectedMultipletId?.(s.selectedMultipletId); }, [studio]);
  const select = useCallback((envId) => apply(selectEnvironment(mol, envId)), [apply, mol]);
  const toggle = useCallback((envId) => apply(envId === selectedEnvId ? emptySelection() : selectEnvironment(mol, envId)), [apply, mol, selectedEnvId]);
  const clear = useCallback(() => apply(emptySelection()), [apply]);
  // a selection that belongs to another molecule is dropped (e.g. after the molecule changed)
  useEffect(() => {
    const stale = (studio?.selectedEnvId && !envIds.includes(studio.selectedEnvId)) || (studio?.selectedMultipletId && !envIds.includes(envIdOfMultiplet(studio.selectedMultipletId)));
    if (stale) apply(emptySelection());
  }, [mol.id, studio?.selectedEnvId, studio?.selectedMultipletId]); // eslint-disable-line react-hooks/exhaustive-deps
  return { selectedEnvId, select, toggle, clear };
}

/** Which environments the student has identified (clicked an H of, or added). Teacher mode starts with all identified. */
export function useIdentified(mol, studio) {
  const token = studio?.resetToken ?? 0;
  const [st, setSt] = useStageState(`identified:${mol.id}`, { touched: false, ids: [] }, token);
  const all = mol.environments.map((e) => e.id);
  const ids = st.touched ? st.ids : studio?.mode === "teacher" ? all : [];
  const identify = useCallback((envId) => { if (envId && !ids.includes(envId)) setSt({ touched: true, ids: [...ids, envId] }); }, [ids, setSt]);
  const identifyAll = useCallback(() => setSt({ touched: true, ids: all }), [setSt, all.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const clearAll = useCallback(() => setSt({ touched: true, ids: [] }), [setSt]);
  const unidentify = useCallback((envId) => setSt({ touched: true, ids: ids.filter((i) => i !== envId) }), [ids, setSt]);
  return { identified: useMemo(() => new Set(ids), [ids.join("|")]), ids, identify, identifyAll, clearAll, unidentify }; // eslint-disable-line react-hooks/exhaustive-deps
}

export const ALL_MOLECULES = MOLECULES;

/** Layout class from the container size supplied by the shell (never window width). */
export function layoutOf(containerSize, wideAt = 900) {
  const w = containerSize?.width ?? 1000; const h = containerSize?.height ?? 600;
  return { w, h, wide: w >= wideAt, short: h < 520, narrow: w < 620 };
}
