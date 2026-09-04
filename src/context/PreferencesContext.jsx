import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "./AuthContext.jsx";

const PreferencesContext = createContext(null);
const LOCAL_KEY = "e-lab:guest-preferences";

function readLocal() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "{}");
  } catch {
    return {};
  }
}

// Small, single-row-per-user preferences: last concept studied (drives
// Continue Learning) and sidebar collapsed state. Same Supabase-for-signed
// -in / localStorage-for-guest split as ProgressContext, for the same
// reason — never treated as authoritative once a real account exists.
//
// PreferencesProvider itself only decides WHICH state (guest vs. this
// user's account) applies; PreferencesInner is remounted via `key`
// whenever that identity changes (user?.id, or "guest"), which is React's
// own recommended way to reset state on an identity change — cleaner than
// synchronizing it with a setState call inside an effect.
export function PreferencesProvider({ children }) {
  const { user, isConfigured } = useAuth();
  return (
    <PreferencesInner key={user?.id ?? "guest"} user={isConfigured ? user : null}>
      {children}
    </PreferencesInner>
  );
}

function PreferencesInner({ user, children }) {
  const [preferences, setPreferences] = useState(() => (user ? {} : readLocal()));

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setPreferences(data ?? {}));
  }, [user]);

  const update = useCallback(
    async (patch) => {
      if (user) {
        const { data, error } = await supabase
          .from("user_preferences")
          .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
          .select()
          .single();
        if (!error && data) setPreferences(data);
      } else {
        setPreferences((prev) => {
          const next = { ...prev, ...patch };
          window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
          return next;
        });
      }
    },
    [user]
  );

  function setLastConcept(conceptId, route) {
    update({ last_concept_id: conceptId, last_student_route: route });
  }

  function setSidebarCollapsed(collapsed) {
    update({ sidebar_collapsed: collapsed });
  }

  const value = {
    preferences,
    lastConceptId: preferences.last_concept_id ?? null,
    sidebarCollapsed: Boolean(preferences.sidebar_collapsed),
    setLastConcept,
    setSidebarCollapsed,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within a PreferencesProvider");
  return ctx;
}
