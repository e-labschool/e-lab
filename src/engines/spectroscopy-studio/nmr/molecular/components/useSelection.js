// Hook that binds the shared selection to the molecular model: the environment selected in the molecule and the multiplet selected in the
// spectrum always change together (model/linking.js). `studio` = { selectedEnvId, selectedMultipletId, setSelectedEnvId, setSelectedMultipletId }.
import { useCallback, useEffect } from "react";
import { emptySelection, envIdOfMultiplet, selectEnvironment } from "../model/linking.js";

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
