import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, PenLine, Library, TrendingUp, User } from "lucide-react";
import { getSubject } from "../../data/programmes.js";
import ProtectedRoute from "../../components/auth/ProtectedRoute.jsx";
import Container from "../../components/ui/Container.jsx";
import Wordmark from "../../components/layout/Wordmark.jsx";
import AccountMenu from "../../components/auth/AccountMenu.jsx";
import ThemeToggle from "../../components/layout/ThemeToggle.jsx";

// The subject is resolved internally (there is currently exactly one:
// IB DP Chemistry) rather than taken from the URL — so /student/learn is a
// stable, flat, bookmarkable route today, while the underlying
// programmes.js data layer that WOULD support a subject picker if a
// second subject is added later is left completely intact underneath.
const PROGRAMME_ID = "ibdp";
const SUBJECT_ID = "chemistry";

const TABS = [
  { to: "/student", end: true, label: "Home", icon: BookOpen },
  { to: "/student/learn", label: "Learn", icon: BookOpen },
  { to: "/student/solve", label: "Solve", icon: PenLine },
  { to: "/student/resources", label: "Resources", icon: Library },
  { to: "/student/progress", label: "Progress", icon: TrendingUp },
  { to: "/student/profile", label: "Profile", icon: User },
];

function StudentChrome() {
  const subject = getSubject(PROGRAMME_ID, SUBJECT_ID);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Wordmark />
            <nav className="hidden items-center gap-6 md:flex">
              {TABS.slice(1).map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `border-b-2 pb-1 text-sm transition-colors ${
                      isActive
                        ? "border-[var(--color-indigo)] font-medium text-[var(--color-ink)]"
                        : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-line)] hover:text-[var(--color-ink)]"
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </Container>
        {/* Mobile tab row */}
        <nav className="flex items-center justify-around border-t border-[var(--color-line)] py-2 md:hidden">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 text-[10px] ${isActive ? "text-[var(--color-indigo)]" : "text-[var(--color-ink-faint)]"}`}
            >
              <tab.icon size={17} />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet context={{ subject, programmeId: PROGRAMME_ID, subjectId: SUBJECT_ID }} />
      </main>
    </div>
  );
}

export default function StudentLayout() {
  return (
    <ProtectedRoute role="student">
      <StudentChrome />
    </ProtectedRoute>
  );
}
