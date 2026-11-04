import { createContext, useContext, useState, useEffect } from "react";
import { getPublicSettings, DEFAULT_PUBLIC_SETTINGS } from "../lib/settingsService.js";

const SettingsContext = createContext(null);

// Fetched exactly once per app load (not per route, not per component) —
// "avoid unnecessary repeated Supabase requests" — and works for
// signed-out visitors too, since both the registration-availability check
// (on /auth, pre-login) and the maintenance check (on any protected
// route) need this before or regardless of authentication.
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_PUBLIC_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  return <SettingsContext.Provider value={{ settings, loading }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
