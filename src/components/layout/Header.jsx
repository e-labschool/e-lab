import { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { Menu, X, ArrowLeftRight } from "lucide-react";
import Wordmark from "./Wordmark.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Container from "../ui/Container.jsx";
import AuthHeaderControl from "../auth/AuthHeaderControl.jsx";
import { getProgramme, getSubject } from "../../data/programmes.js";

const STUDENT_TABS = [
  { segment: "learn", label: "Learn" },
  { segment: "practice", label: "Practice" },
  { segment: "assess", label: "Assess" },
  { segment: "resources", label: "Resources" },
];
const TEACHER_TABS = [
  { segment: "teach", label: "Teach" },
  { segment: "quiz", label: "Quiz" },
  { segment: "q-builder", label: "Q Builder" },
  { segment: "resources", label: "Resources" },
];

function linkClasses({ isActive }) {
  return `border-b-2 pb-1 text-sm transition-colors ${
    isActive
      ? "border-[var(--color-indigo)] font-medium text-[var(--color-ink)]"
      : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-line)] hover:text-[var(--color-ink)]"
  }`;
}

// The header is context-aware rather than showing one static global nav:
// outside a chosen Student/Teacher x Programme x Subject context it shows
// only the logo and theme toggle (the homepage stays a clean landing page,
// not a dashboard); once inside that context it shows exactly the three
// tabs for that role, a small breadcrumb, and a way to switch role. There
// is only ever one navigation system visible at a time.
export default function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const studentMatch = location.pathname.match(/^\/student\/([^/]+)\/([^/]+)/);
  const teacherMatch = location.pathname.match(/^\/teacher\/([^/]+)\/([^/]+)/);
  const match = studentMatch || teacherMatch;
  const role = studentMatch ? "student" : teacherMatch ? "teacher" : null;

  let base = null, tabs = [], programme = null, subject = null, switchRoleTo = null;
  if (match) {
    const [, programmeId, subjectId] = match;
    base = `/${role}/${programmeId}/${subjectId}`;
    tabs = role === "student" ? STUDENT_TABS : TEACHER_TABS;
    programme = getProgramme(programmeId);
    subject = getSubject(programmeId, subjectId);
    const otherRole = role === "student" ? "teacher" : "student";
    const otherDefault = otherRole === "student" ? "learn" : "teach";
    switchRoleTo = `/${otherRole}/${programmeId}/${subjectId}/${otherDefault}`;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Wordmark />
          {match && (
            <span className="hidden text-xs text-[var(--color-ink-faint)] sm:inline">
              {role === "student" ? "Student" : "Teacher"} &middot; {programme?.shortLabel} &middot; {subject?.label}
            </span>
          )}
        </div>

        {tabs.length > 0 && (
          <nav className="hidden items-center gap-7 md:flex">
            {tabs.map((tab) => (
              <NavLink key={tab.segment} to={`${base}/${tab.segment}`} className={linkClasses}>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="hidden items-center gap-3 md:flex">
          {match && (
            <Link
              to={switchRoleTo}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
            >
              <ArrowLeftRight size={13} /> Switch role
            </Link>
          )}
          <ThemeToggle />
          <AuthHeaderControl />
        </div>

        {tabs.length > 0 && (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink)] md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}
        {tabs.length === 0 && (
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <AuthHeaderControl />
          </div>
        )}
      </Container>

      {mobileOpen && tabs.length > 0 && (
        <div className="border-t border-[var(--color-line)] md:hidden">
          <Container className="flex flex-col gap-4 py-5">
            {match && (
              <span className="text-xs text-[var(--color-ink-faint)]">
                {role === "student" ? "Student" : "Teacher"} &middot; {programme?.shortLabel} &middot; {subject?.label}
              </span>
            )}
            {tabs.map((tab) => (
              <NavLink
                key={tab.segment}
                to={`${base}/${tab.segment}`}
                className={linkClasses}
                onClick={() => setMobileOpen(false)}
              >
                {tab.label}
              </NavLink>
            ))}
            <div className="mt-2 flex items-center justify-between">
              <Link
                to={switchRoleTo}
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
              >
                <ArrowLeftRight size={13} /> Switch role
              </Link>
              <ThemeToggle />
            </div>
            <AuthHeaderControl />
          </Container>
        </div>
      )}
    </header>
  );
}
