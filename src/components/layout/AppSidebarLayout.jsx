import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import ProtectedRoute from "../auth/ProtectedRoute.jsx";
import Wordmark from "./Wordmark.jsx";
import AccountMenu from "../auth/AccountMenu.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

// Shared by StudentLayout and TeacherLayout — a single dark-sidebar +
// light-workspace shell, per the brief's explicit "apply consistently,
// use shared components" instruction rather than two parallel
// hand-styled layouts. `accentHex` is the one thing that differs
// (indigo for Student, amber for Teacher) — same nav mechanics either way.
const SIDEBAR_BG = "#0B1220";
const SIDEBAR_BORDER = "#1B2436";

function NavItem({ to, end, label, icon: Icon, accentHex, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3.5 py-3 text-[15px] font-semibold transition-colors ${
          isActive ? "text-white" : "text-[#8C97B8] hover:bg-white/5 hover:text-white"
        }`
      }
      style={({ isActive }) => (isActive ? { backgroundColor: `${accentHex}26`, color: "#fff" } : undefined)}
    >
      <Icon size={18} className="shrink-0" />
      {label}
    </NavLink>
  );
}

function SidebarContent({ tabs, accentHex, role, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5">
        <Wordmark onDark />
      </div>
      <nav className="mt-6 flex flex-1 flex-col gap-1 px-3">
        {tabs.map((tab) => (
          <NavItem key={tab.to} {...tab} accentHex={accentHex} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="border-t px-3 py-3" style={{ borderColor: SIDEBAR_BORDER }}>
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-xs font-medium capitalize text-[#8C97B8]">{role}</span>
          <ThemeToggle onDark />
        </div>
        <div className="mt-1">
          <AccountMenu />
        </div>
      </div>
    </div>
  );
}

function AppSidebarLayout({ tabs, accentHex, role, subject, programmeId, subjectId }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — fixed dark surface, distinct from the app's light/dark THEME toggle */}
      <aside className="hidden w-60 shrink-0 border-r md:block" style={{ backgroundColor: SIDEBAR_BG, borderColor: SIDEBAR_BORDER }}>
        <div className="sticky top-0 h-screen">
          <SidebarContent tabs={tabs} accentHex={accentHex} role={role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 md:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-[var(--color-ink-soft)]">
            <Menu size={20} />
          </button>
          <Wordmark />
          <AccountMenu />
        </header>

        <main className="flex-1 bg-[var(--color-paper)]">
          <Outlet context={{ subject, programmeId, subjectId }} />
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-64" style={{ backgroundColor: SIDEBAR_BG }}>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 text-[#8C97B8]">
              <X size={20} />
            </button>
            <SidebarContent tabs={tabs} accentHex={accentHex} role={role} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
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
