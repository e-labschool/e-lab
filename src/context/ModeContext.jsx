import { createContext, useContext, useEffect, useState } from "react";

const ModeContext = createContext(null);
const STORAGE_KEY = "e-lab:mode";

export function ModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined") return "student";
    return window.localStorage.getItem(STORAGE_KEY) || "student";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = () => setMode((m) => (m === "student" ? "teacher" : "student"));

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within a ModeProvider");
  return ctx;
}
