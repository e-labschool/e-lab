import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, BookOpen, FolderOpen, HelpCircle, Users, Lock, Settings, Menu, X } from "lucide-react";
import ProtectedRoute from "../../components/auth/ProtectedRoute.jsx";
import Wordmark from "../../components/layout/Wordmark.jsx";
import AccountMenu from "../../components/auth/AccountMenu.jsx";
import ThemeToggle from "../../components/layout/ThemeToggle.jsx";

// Deliberately a LEFT-SIDEBAR CMS layout, not the top-tab chrome
// Student/TeacherLayout use — the brief is explicit this should read as a
// professional admin console, not another learning surface. Uses the
// neutral --color-ink accent (rather than indigo/amber, already claimed
// by Student/Teacher) so it's visually distinct at a glance.
const NAV = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/learn-content", label: "Learn Content", icon: BookOpen },
  { to: "/admin/resources", label: "Resources", icon: FolderOpen },
  { to: "/admin/question-bank", label: "Question Bank", icon: HelpCircle },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/access", label: "Access", icon: Lock },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function SidebarNav({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-[var(--color-ink)] font-medium text-[var(--color-paper)]"
                : "text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"
            }`
          }
        >
          <item.icon size={16} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function AdminChrome() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-paper-raised)] transition-[width] duration-200 md:flex ${collapsed ? "w-16" : "w-60"}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-line)] px-4">
          {!collapsed && (
            <div>
              <Wordmark />
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Admin</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"
          >
            <Menu size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {collapsed ? (
            <nav className="flex flex-col items-center gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  className={({ isActive }) =>
                    `flex h-9 w-9 items-center justify-center rounded-md ${isActive ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"}`
                  }
                >
                  <item.icon size={16} />
                </NavLink>
              ))}
            </nav>
          ) : (
            <SidebarNav />
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
            className="rounded-md p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30 md:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex h-full w-64 flex-col bg-[var(--color-paper-raised)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <Wordmark />
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Admin</p>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="rounded-md p-1.5 text-[var(--color-ink-faint)]">
                <X size={18} />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  return (
    <ProtectedRoute role="admin">
      <AdminChrome />
    </ProtectedRoute>
  );
}
