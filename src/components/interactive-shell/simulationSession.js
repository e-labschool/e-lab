import { createContext, useContext } from "react";
import { useSessionState, sessionKey } from "../../lib/sessionState.js";

// Shared, opt-in persistence for simulation UI state across a page reload or
// navigating away and back (sessionStorage, per browser tab). The Learn page
// wraps each simulation block in <SimulationSessionProvider scope="lessonId:blockId">;
// an engine swaps `useState(x)` for `useSimulationSessionState("name", x)` for
// the state worth restoring (selected mode, slider values, toggles). Without a
// provider it behaves exactly like useState. Ordinary tab switches never need
// this: the simulation stays mounted and keeps its live state.
// Engines currently wired: see docs/STATE_PERSISTENCE.md.
const SimulationSessionContext = createContext(null);
export const SimulationSessionProvider = SimulationSessionContext.Provider;

export function useSimulationSessionState(name, initial, validate) {
  const scope = useContext(SimulationSessionContext);
  const key = scope ? sessionKey("sim", scope, name) : null;
  return useSessionState(key, initial, { validate });
}
