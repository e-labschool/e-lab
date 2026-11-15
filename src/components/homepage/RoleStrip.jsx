import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Presentation, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Container from "../ui/Container.jsx";
import { useLandingLinks } from "./useLandingLinks.js";

const ROLES = [
  { id: "student", label: "I'm a Student", icon: GraduationCap },
  { id: "teacher", label: "I'm a Teacher", icon: Presentation },
];

// "Who are you?" -- the role entry buttons.  The routing rule is exactly the one the previous RoleCards used:
// already signed in as THIS role -> straight into that area; otherwise -> the one auth page with ?role=.
export default function RoleStrip() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { signedIn, continuePath } = useLandingLinks();

  function choose(roleId) {
    if (user && profile?.role === roleId) navigate(`/${roleId}`);
    else navigate(`/auth?role=${roleId}`);
  }

  return (
    <section aria-labelledby="who-title" className="border-b border-[var(--color-line)] bg-[var(--color-paper-raised)]/60 py-7">
      <Container>
        <h2 id="who-title" className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Who are you?</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {ROLES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => choose(id)} data-role-card={id}
              className="group flex items-center justify-between gap-3 rounded-lg bg-[#12172A] px-5 py-4 text-left shadow-[0_1px_2px_rgba(20,30,80,0.2),0_6px_16px_-4px_rgba(20,30,80,0.3)] transition-colors hover:bg-[#1F2747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] dark:border dark:border-white/20">
              <span className="flex items-center gap-3"><Icon size={21} aria-hidden="true" className="shrink-0 text-white/80" strokeWidth={1.75} /><span className="text-base font-bold text-white">{label}</span></span>
              <ArrowRight size={17} aria-hidden="true" className="shrink-0 text-white/70 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
            </button>
          ))}
          <Link to={continuePath ?? "/auth"} data-continue-card
            className="group flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-5 py-4 text-left text-[var(--color-ink)] hover:border-[var(--color-ink)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)]">
            <span className="text-[15px] font-semibold">{signedIn && continuePath ? "Continue where you left off" : "Already have an account? Log in"}</span>
            <ArrowRight size={17} aria-hidden="true" className="shrink-0 text-[var(--color-ink-faint)]" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
