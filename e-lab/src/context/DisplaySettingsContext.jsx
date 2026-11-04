import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

const DisplaySettingsContext = createContext(null);
const DEFAULTS = { textSize: "default", contentWidth: "wide", sideSpacing: "balanced", lineSpacing: "normal", contrast: "standard" };
const STUDENT_DEFAULTS = { textSize: "default", contentWidth: "comfortable", sideSpacing: "balanced", lineSpacing: "normal", contrast: "high" };
function defaultsFor(role) { return role === "student" ? STUDENT_DEFAULTS : DEFAULTS; }

function keyFor(userId) { return `e-lab:${userId || "guest"}:display-settings`; }
function read(userId, role) {
  const defaults = defaultsFor(role);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(userId)) || "{}");
    // Earlier e-Lab versions automatically persisted the old defaults even
    // when a student never changed Display Settings. Migrate that untouched
    // legacy default to the new Student reading preset, while preserving any
    // genuine per-profile custom choices.
    const legacyUntouchedStudent = role === "student"
      && raw.textSize === DEFAULTS.textSize
      && raw.contentWidth === DEFAULTS.contentWidth
      && raw.sideSpacing === DEFAULTS.sideSpacing
      && raw.lineSpacing === DEFAULTS.lineSpacing
      && raw.contrast === DEFAULTS.contrast;
    if (legacyUntouchedStudent) return { ...STUDENT_DEFAULTS };
    return { ...defaults, ...raw };
  } catch { return defaults; }
}

export function DisplaySettingsProvider({ children }) {
  const { user, profile } = useAuth();
  const identity = user?.id || "guest";
  const role = profile?.role || "guest";
  const [settings, setSettings] = useState(() => read(identity, role));
  useEffect(() => setSettings(read(identity, role)), [identity, role]);
  useEffect(() => {
    try { localStorage.setItem(keyFor(identity), JSON.stringify(settings)); } catch { /* optional preference */ }
  }, [identity, settings]);
  const value = useMemo(() => ({
    settings,
    updateDisplaySettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
    resetDisplaySettings: () => setSettings(defaultsFor(role)),
  }), [settings, role]);
  return <DisplaySettingsContext.Provider value={value}>{children}</DisplaySettingsContext.Provider>;
}

export function useDisplaySettings() {
  const value = useContext(DisplaySettingsContext);
  if (!value) throw new Error("useDisplaySettings must be used within DisplaySettingsProvider");
  return value;
}
