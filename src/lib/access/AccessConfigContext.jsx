import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { DEFAULT_ACCESS_CONFIG } from "./accessPolicy.js";
import { fetchAccessConfig, fetchSimulationOverrides } from "./accessConfigService.js";
import { SIMULATION_CATALOGUE, applyAccessOverrides } from "../../data/simulationCatalogue.js";

// Provides the site access config + per-simulation overrides to the whole app, and the merged catalogue.
//
// Before anything has loaded (and whenever Supabase / the settings columns / the simulation_access table are missing or
// error) the value is DEFAULT_ACCESS_CONFIG + the catalogue defaults, i.e. "everything is free" -- so the first paint is
// already correct and nothing flickers into a locked state.  Results are cached for the page's lifetime; call refresh()
// after an admin change.
const AccessConfigContext = createContext({
  config: DEFAULT_ACCESS_CONFIG,
  source: "default",
  overrides: {},
  overridesAvailable: false,
  catalogue: SIMULATION_CATALOGUE,
  loading: false,
  refresh: async () => {},
});

export function AccessConfigProvider({ children }) {
  const [state, setState] = useState({ config: DEFAULT_ACCESS_CONFIG, source: "default", overrides: {}, overridesAvailable: false, loading: true });

  const load = useCallback(async () => {
    const [cfg, ov] = await Promise.all([fetchAccessConfig(), fetchSimulationOverrides()]);
    setState({ config: cfg.config, source: cfg.source, overrides: ov.overrides, overridesAvailable: ov.available, loading: false });
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAccessConfig(), fetchSimulationOverrides()]).then(([cfg, ov]) => {
      if (cancelled) return;
      setState({ config: cfg.config, source: cfg.source, overrides: ov.overrides, overridesAvailable: ov.available, loading: false });
    }).catch(() => { if (!cancelled) setState((s) => ({ ...s, loading: false })); });
    return () => { cancelled = true; };
  }, []);

  const catalogue = useMemo(() => applyAccessOverrides(SIMULATION_CATALOGUE, state.overrides), [state.overrides]);
  const value = useMemo(() => ({ ...state, catalogue, refresh: load }), [state, catalogue, load]);
  return <AccessConfigContext.Provider value={value}>{children}</AccessConfigContext.Provider>;
}

/** { config, source, overrides, overridesAvailable, catalogue, loading, refresh } */
export const useAccessConfig = () => useContext(AccessConfigContext);

/** The `ctx` argument accessPolicy.checkAccess() wants for the current visitor.  `entitlement` stays null until a
 *  server-side entitlement source exists (see docs/PLATFORM_ACCESS_MODEL.md) -- it must never come from user metadata. */
export function useAccessContext() {
  const { config } = useAccessConfig();
  const { user, profile } = useAuth();
  return useMemo(() => ({ signedIn: Boolean(user), role: profile?.role, entitlement: null, config }), [user, profile?.role, config]);
}
