import { NavLink, Outlet } from "react-router-dom";
import ProtectedRoute from "../auth/ProtectedRoute.jsx";
import Wordmark from "./Wordmark.jsx";
import AccountMenu from "../auth/AccountMenu.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import DisplaySettingsButton from "./DisplaySettingsButton.jsx";
import { useDisplaySettings } from "../../context/DisplaySettingsContext.jsx";

// Shared by StudentLayout and TeacherLayout.
//
// Correction from the previous pass: MAIN navigation (Learn/Assess/
// Resources/Progress, Teach/Class Planner/Question Builder/Resources)
// lives in a dark HORIZONTAL TOP TAB BAR, not a side panel. Any side
// panel a page needs (Learn's curriculum tree, Teach's curriculum tree)
// is that PAGE's own contextual content, built inside the page itself —
// this layout has no opinion about it and doesn't render one, since a
// contextual panel changes per-tab and isn't "global navigation".
const TAB_BAR_BG = "#0B1220";

function TopTabBar({ tabs, accentHex }) {
  return (
    <nav className="sticky top-0 z-30 border-b shadow-sm" style={{ backgroundColor: TAB_BAR_BG, borderColor: "#1B2436" }}>
      <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-[15px] font-semibold transition-colors ${
                isActive ? "border-current text-white" : "border-transparent text-[#8C97B8] hover:text-white"
              }`
            }
            style={({ isActive }) => (isActive ? { color: "#fff", borderColor: accentHex } : undefined)}
          >
            <tab.icon size={17} className="shrink-0" />
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AppSidebarLayout({ tabs, accentHex, role, subject, programmeId, subjectId }) {
  const { settings } = useDisplaySettings();
  const displayClass = `elab-display-surface elab-text-${settings.textSize} elab-width-${settings.contentWidth} elab-lines-${settings.lineSpacing} elab-contrast-${settings.contrast}`;
  return (
    <div className="flex min-h-screen flex-col">
      {/* Row 1 — brand + profile, always visible, never buried in a contextual panel */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 sm:px-6 lg:px-8">
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-medium capitalize text-[var(--color-ink-faint)] sm:inline">{role}</span>
          <DisplaySettingsButton />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      {/* Row 2 — the main tab ribbon */}
      <TopTabBar tabs={tabs} accentHex={accentHex} />

      {/* Every page renders its own content below — including its own
          contextual side panel, if that page needs one. */}
      <main className={`flex-1 bg-[var(--color-paper)] ${displayClass}`}>
        <Outlet context={{ subject, programmeId, subjectId }} />
      </main>
    </div>
  );
}

export default function ProtectedAppSidebarLayout({ role, ...rest }) {
  return (
    <ProtectedRoute role={role}>
      <AppSidebarLayout role={role} {...rest} />
    </ProtectedRoute>
  );
}
