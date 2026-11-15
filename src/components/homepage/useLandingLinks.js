import { useAuth } from "../../context/AuthContext.jsx";

const ROLE_HOME = new Set(["student", "teacher", "admin"]);

/** Where the landing page's "browse / continue" links go for the current visitor.
 *  - signed in as student / teacher / admin -> that role's simulation library (admin: the access screen)
 *  - signed out -> the one auth page, remembering /student/simulations as the place to land after logging in. */
export function useLandingLinks() {
  const { user, profile } = useAuth();
  const role = user && ROLE_HOME.has(profile?.role) ? profile.role : null;
  const libraryPath = role === "teacher" ? "/teacher/simulations"
    : role === "admin" ? "/admin/simulations"
    : role === "student" ? "/student/simulations"
    : `/auth?role=student&next=${encodeURIComponent("/student/simulations")}`;
  return { signedIn: Boolean(user), role, libraryPath, continuePath: role ? `/${role}` : null };
}

export function scrollToId(id) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (!el) return false;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  return true;
}
