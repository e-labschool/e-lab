import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

const DisplaySettingsContext = createContext(null);
const DEFAULTS = { textSize: "default", contentWidth: "wide", lineSpacing: "normal", contrast: "standard" };

function keyFor(userId) { return `e-lab:${userId || "guest"}:display-settings`; }
function read(userId) {
  if (typeof window === "undefined") return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(keyFor(userId)) || "{}") }; }
  catch { return DEFAULTS; }
}

export function DisplaySettingsProvider({ children }) {
  const { user } = useAuth();
  const identity = user?.id || "guest";
  const [settings, setSettings] = useState(() => read(identity));
  useEffect(() => setSettings(read(identity)), [identity]);
  useEffect(() => {
    try { localStorage.setItem(keyFor(identity), JSON.stringify(settings)); } catch { /* optional preference */ }
  }, [identity, settings]);
  const value = useMemo(() => ({
    settings,
    updateDisplaySettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
    resetDisplaySettings: () => setSettings(DEFAULTS),
  }), [settings]);
  return <DisplaySettingsContext.Provider value={value}>{children}</DisplaySettingsContext.Provider>;
}

export function useDisplaySettings() {
  const value = useContext(DisplaySettingsContext);
  if (!value) throw new Error("useDisplaySettings must be used within DisplaySettingsProvider");
  return value;
}
