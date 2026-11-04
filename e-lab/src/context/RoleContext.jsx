import { createContext, useContext, useEffect, useState } from "react";
import { useMode } from "./ModeContext.jsx";

const RoleContext = createContext(null);
const STORAGE_KEY = "e-lab:role";

// RoleContext is the new site-wide "who is using e-Lab right now" concept
// that drives navigation (Student -> Learn/Practice/Assess vs
// Teacher -> Teach/Quiz/Resources). It is deliberately separate from
// ModeContext, which is a per-interactive presentation toggle (does an
// engine render its Student flow or Teacher flow) — but the two should
// never visibly disagree, so choosing a role here also mirrors it into
// ModeContext. This means an interactive reached via Learn opens in student
// mode and one reached via Teach opens in teacher mode automatically,
// without any engine needing to know about roles at all.
export function RoleProvider({ children }) {
  const { setMode } = useMode();
  const [role, setRoleState] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY) || null;
  });

  useEffect(() => {
    if (role) window.localStorage.setItem(STORAGE_KEY, role);
  }, [role]);

  function setRole(nextRole) {
    setRoleState(nextRole);
    if (nextRole === "student" || nextRole === "teacher") setMode(nextRole);
  }

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
