import { useState } from "react";
import { Outlet, useParams, useOutletContext } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import CurriculumSidebar from "./CurriculumSidebar.jsx";
import { usePreferences } from "../../context/PreferencesContext.jsx";

// Desktop: a 260px collapsible sidebar that slides out (not just fades) —
// fast, subtle animation per the brief. Tablet: same, just narrower.
// Mobile: the sidebar becomes a full slide-in drawer instead of ever
// permanently occupying width. Collapse preference persists for signed-in
// students via usePreferences; signed-out visitors just keep it for the
// session (component state).
export default function LearnLayout() {
  const { conceptId } = useParams();
  const { subject } = useOutletContext();
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const basePath = "/student/learn";

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)]">
      {/* Desktop/tablet collapsible panel */}
      <aside
        className={`hidden shrink-0 overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-paper)] transition-[width] duration-200 ease-out md:block ${
          sidebarCollapsed ? "w-0 border-r-0" : "w-[260px]"
        }`}
      >
        <div className="h-full w-[260px] overflow-y-auto px-3 py-5">
          <CurriculumSidebar activeConceptId={conceptId} basePath={basePath} />
        </div>
      </aside>

      {/* Collapse/reopen edge button — desktop/tablet only */}
      <button
        type="button"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        aria-label={sidebarCollapsed ? "Show curriculum panel" : "Hide curriculum panel"}
        className="sticky top-20 hidden h-8 w-8 shrink-0 -translate-x-1/2 items-center justify-center self-start rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-faint)] shadow-sm hover:text-[var(--color-ink)] md:flex"
      >
        {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
      </button>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink)] shadow-md md:hidden"
        aria-label="Open curriculum panel"
      >
        <PanelLeftOpen size={18} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative h-full w-[280px] overflow-y-auto bg-[var(--color-paper)] px-3 py-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close"
              className="mb-3 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40"
            >
              <X size={16} />
            </button>
            <CurriculumSidebar activeConceptId={conceptId} basePath={basePath} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <Outlet context={{ subject, basePath }} />
      </div>
    </div>
  );
}
