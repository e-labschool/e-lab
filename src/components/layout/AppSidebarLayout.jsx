import { NavLink, Outlet, useNavigate } from "react-router-dom";
import ProtectedRoute from "../auth/ProtectedRoute.jsx";
import Wordmark from "./Wordmark.jsx";
import AccountMenu from "../auth/AccountMenu.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { ArrowLeft } from "lucide-react";
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

function TopTabBar({ tabs, accentHex, role }) {
  const navigate = useNavigate();
  return (
    <div className="sticky top-0 z-40 border-b shadow-sm" style={{ backgroundColor: TAB_BAR_BG, borderColor: "#1B2436" }}>
      <div className="mx-auto flex min-h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="shrink-0 pr-2 [&_*]:text-white"><Wordmark /></div>
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="flex shrink-0 items-center gap-1 px-2 text-sm font-semibold text-[#AAB3CE] hover:text-white"><ArrowLeft size={16}/> Back</button>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {tabs.map((tab) => <NavLink key={tab.to} to={tab.to} end={tab.end} className={({isActive})=>`flex shrink-0 items-center gap-2 border-b-2 px-4 py-5 text-[15px] font-semibold transition-colors ${isActive ? "border-current text-white" : "border-transparent text-[#8C97B8] hover:text-white"}`} style={({isActive})=>isActive?{color:"#fff",borderColor:accentHex}:undefined}><tab.icon size={17}/>{tab.label}</NavLink>)}
        </nav>
        <div className="flex shrink-0 items-center gap-2 text-white"><span className="hidden text-xs font-medium capitalize text-[#AAB3CE] sm:inline">{role}</span><DisplaySettingsButton/><ThemeToggle/><AccountMenu/></div>
      </div>
    </div>
  );
}

function AppSidebarLayout({ tabs, accentHex, role, subject, programmeId, subjectId }) {
  const { settings } = useDisplaySettings();
  const displayClass = `elab-display-surface elab-text-${settings.textSize} elab-width-${settings.contentWidth} elab-lines-${settings.lineSpacing} elab-contrast-${settings.contrast}`;
  return (
    <div className="flex min-h-screen flex-col">
      {/* One compact sticky app bar: brand, Back, role tabs, display/theme/profile. */}
      <TopTabBar tabs={tabs} accentHex={accentHex} role={role} />

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
