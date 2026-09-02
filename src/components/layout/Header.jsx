import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Wordmark from "./Wordmark.jsx";
import ModeToggle from "./ModeToggle.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Container from "../ui/Container.jsx";

const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/explore", label: "Explore" },
  { to: "/interactives", label: "Interactives" },
  { to: "/topics", label: "Topics" },
  { to: "/teachers", label: "For Teachers" },
  { to: "/about", label: "About" },
];

function linkClasses({ isActive }) {
  return `text-sm transition-colors ${
    isActive ? "text-[var(--color-ink)] font-medium" : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
  }`;
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Wordmark />

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClasses}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ModeToggle compact />
          <ThemeToggle />
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink)] md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </Container>

      {mobileOpen && (
        <div className="border-t border-[var(--color-line)] md:hidden">
          <Container className="flex flex-col gap-4 py-5">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={linkClasses}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="mt-2 flex items-center justify-between">
              <ModeToggle />
              <ThemeToggle />
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
