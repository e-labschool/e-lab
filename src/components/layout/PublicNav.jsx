import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import AccountMenu from "../auth/AccountMenu.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { scrollToId } from "../homepage/useLandingLinks.js";

// Public-site navigation + auth entry (rendered by Header on every public page).  Links: Simulations, Learn, For
// teachers, About, Log in, Create free account.  Signed-in students / teachers get their own area's Simulations / Learn
// links; everyone else gets the landing-page sections.  Auth routing is unchanged: plain links to /auth.
const linkCls = "rounded-md px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)]";

function useNavItems() {
  const { user, profile } = useAuth();
  const role = user ? profile?.role : null;
  return [
    { label: "Simulations", to: role === "student" ? "/student/simulations" : role === "teacher" ? "/teacher/simulations" : "/#simulations" },
    { label: "Learn", to: role === "student" ? "/student/learn" : "/#learn" },
    { label: "For teachers", to: "/#teachers" },
    { label: "About", to: "/about" },
  ];
}

function AuthControls({ onNavigate, stacked = false }) {
  const { isConfigured, user, loadingSession } = useAuth();
  if (!isConfigured) return null;
  if (loadingSession) return <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--color-line)]" />;
  if (user) return <AccountMenu />;
  return (
    <div className={stacked ? "flex flex-col gap-2" : "flex items-center gap-2"}>
      <Link to="/auth" onClick={onNavigate} className="rounded-md border border-[var(--color-ink)]/50 px-3.5 py-1.5 text-center text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)]">Log in</Link>
      <Link to="/auth?tab=create-account" onClick={onNavigate} className="rounded-md bg-[#12172A] px-3.5 py-1.5 text-center text-sm font-semibold text-white hover:bg-[#1F2747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] dark:border dark:border-white/25">Create free account</Link>
    </div>
  );
}

export default function PublicNav() {
  const items = useNavItems();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname, location.hash]);

  function onItemClick(e, to) {
    setOpen(false);
    // Already on the landing page: scroll straight to the section (a repeated hash link would not re-trigger routing).
    if (to.startsWith("/#") && location.pathname === "/") {
      e.preventDefault();
      navigate(to);
      scrollToId(to.slice(2));
    }
  }

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {items.map((it) => it.to.includes("#")
          ? <Link key={it.label} to={it.to} onClick={(e) => onItemClick(e, it.to)} className={linkCls}>{it.label}</Link>
          : <NavLink key={it.label} to={it.to} className={linkCls}>{it.label}</NavLink>)}
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="hidden md:block"><AuthControls /></div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="public-mobile-menu" aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-md p-2 text-[var(--color-ink)] hover:bg-[var(--color-line)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] md:hidden">
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div id="public-mobile-menu" className="absolute inset-x-0 top-full border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 shadow-lg md:hidden">
          <nav aria-label="Main (mobile)" className="flex flex-col">
            {items.map((it) => <Link key={it.label} to={it.to} onClick={(e) => onItemClick(e, it.to)} className={`${linkCls} py-2.5`}>{it.label}</Link>)}
          </nav>
          <div className="mt-3 border-t border-[var(--color-line)] pt-3"><AuthControls stacked onNavigate={() => setOpen(false)} /></div>
        </div>
      )}
    </>
  );
}
