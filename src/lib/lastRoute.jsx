import { useEffect } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { saveUserScopedValue, loadUserScopedValue } from "./userScopedStorage.js";

/** Call once inside each role layout (Student/Teacher/Admin) — records
 * every sub-route visited within that role area, namespaced by user id,
 * so the NEXT time this role's bare index route is hit, it can resume
 * here instead of always defaulting to the same first tab. Only tracks
 * the path itself — never form data, never anything sensitive. */
export function useTrackLastRoute(role) {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;
    // Never record the bare role index itself as "last route" — that
    // would make the redirect point at itself and never actually resume
    // anything useful.
    if (location.pathname === `/${role}`) return;
    saveUserScopedValue(user.id, `last-route:${role}`, location.pathname);
  }, [user?.id, role, location.pathname]);
}

/** Replaces a hardcoded <Navigate to="..."> on a role's bare index route
 * — redirects to the remembered last sub-route for THIS user if one
 * exists, otherwise the same fallback the hardcoded redirect used to
 * point at. This only ever fires when the user lands on the bare role
 * path itself (e.g. "/teacher") — explicitly clicking a specific tab
 * always navigates there directly and is never overridden. */
export function RoleIndexRedirect({ role, fallback }) {
  const { user } = useAuth();
  const remembered = user?.id ? loadUserScopedValue(user.id, `last-route:${role}`, null) : null;
  return <Navigate to={remembered || fallback} replace />;
}

/** Same as RoleIndexRedirect, but for a role whose bare index route is a
 * REAL page (Admin's Dashboard) rather than a redirect target — renders
 * the fallback element directly if nothing is remembered yet, instead of
 * redirecting to a fallback path. */
export function RoleIndexResume({ role, fallbackElement }) {
  const { user } = useAuth();
  const remembered = user?.id ? loadUserScopedValue(user.id, `last-route:${role}`, null) : null;
  if (remembered) return <Navigate to={remembered} replace />;
  return fallbackElement;
}

/** Student Learn index resume: when the user explicitly returns to the Learn tab,
 * reopen the last lesson they studied. First-time users still see LearnCmsHome. */
export function LearnIndexResume({ fallbackElement }) {
  const { user } = useAuth();
  const lessonId = user?.id ? loadUserScopedValue(user.id, "learn:last-lesson", null) : null;
  if (lessonId) return <Navigate to={`/student/learn/${lessonId}`} replace />;
  return fallbackElement;
}
