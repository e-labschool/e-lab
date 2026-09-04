import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

function initialsFor(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }
  return (email?.[0] ?? "?").toUpperCase();
}

// Replaces the Sign In / Create Account buttons once a session exists — a
// small initials avatar that opens Profile / Sign out, never a
// personal-data-heavy header, per the brief's "keep it minimal" instruction.
export default function AccountMenu() {
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = initialsFor(profile?.full_name, user?.email);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-indigo)] text-xs font-semibold text-white transition-transform hover:scale-105"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-48 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] py-1.5 shadow-lg">
          <div className="border-b border-[var(--color-line)] px-3 py-2">
            <p className="truncate text-sm font-medium text-[var(--color-ink)]">{profile?.full_name || "Your account"}</p>
            {profile?.role && <p className="text-xs capitalize text-[var(--color-ink-faint)]">{profile.role}</p>}
            <p className="truncate text-xs text-[var(--color-ink-faint)]">{user?.email}</p>
          </div>
          <Link to={`/${profile?.role ?? "student"}/profile`} onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]">
            Profile
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); signOut(); }}
            className="block w-full px-3 py-2 text-left text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
