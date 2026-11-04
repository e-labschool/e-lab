import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { listPublishedLessonMeta } from "../../lib/learnContentService.js";
import { getResourcesByStatus } from "../../data/resources-registry.js";

const MAX_RESULTS = 8;

function matches(haystacks, query) {
  return haystacks.some((h) => h && String(h).toLowerCase().includes(query));
}

/**
 * Learn lesson metadata is fetched once (it's a lightweight list, already
 * used the same way by the sidebar) and filtered client-side on every
 * keystroke — no per-keystroke network round trip. Only students get
 * Learn results: teachers currently have no lesson-viewer route to land
 * on, so surfacing them would be a dead link; resources/simulations
 * search still works for both roles.
 */
export default function SiteSearch({ role }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lessons, setLessons] = useState([]);
  const desktopRef = useRef(null);
  const mobileRef = useRef(null);
  const mobileInputRef = useRef(null);

  useEffect(() => {
    if (role !== "student") return;
    let active = true;
    listPublishedLessonMeta(profile?.level)
      .then((rows) => { if (active) setLessons(rows); })
      .catch(() => { if (active) setLessons([]); });
    return () => { active = false; };
  }, [role, profile?.level]);

  useEffect(() => {
    function onClickOutside(e) {
      const inDesktop = desktopRef.current && desktopRef.current.contains(e.target);
      const inMobile = mobileRef.current && mobileRef.current.contains(e.target);
      if (!inDesktop && !inMobile) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (mobileOpen) mobileInputRef.current?.focus();
  }, [mobileOpen]);

  const q = query.trim().toLowerCase();
  const results = [];
  if (q.length >= 2) {
    if (role === "student") {
      for (const lesson of lessons) {
        if (matches([lesson.title, lesson.lesson_code, ...(lesson.syllabus_codes || [])], q)) {
          results.push({
            key: `lesson-${lesson.id}`,
            title: lesson.title,
            type: "Lesson",
            code: lesson.lesson_code || (lesson.syllabus_codes || [])[0] || "",
            to: `/student/learn/${lesson.id}`,
          });
        }
      }
    }
    for (const resource of getResourcesByStatus("live")) {
      if (matches([resource.title, resource.description, resource.id], q)) {
        results.push({
          key: `resource-${resource.id}`,
          title: resource.title,
          type: resource.resourceType ? resource.resourceType[0].toUpperCase() + resource.resourceType.slice(1) : "Resource",
          code: "",
          to: `/interactives/${resource.id}`,
        });
      }
    }
  }
  const shown = results.slice(0, MAX_RESULTS);

  function goTo(result) {
    setOpen(false);
    setMobileOpen(false);
    setQuery("");
    navigate(result.to);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") { setOpen(false); setMobileOpen(false); }
    else if (e.key === "Enter" && shown[0]) goTo(shown[0]);
  }

  const dropdown = open && q.length >= 2 && (
    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-md border shadow-lg" style={{ borderColor: "var(--color-line)", background: "var(--color-paper-raised)" }}>
      {shown.length === 0 ? (
        <p className="px-3 py-3 text-xs" style={{ color: "var(--color-ink-faint)" }}>No results for "{query}".</p>
      ) : (
        shown.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => goTo(r)}
            className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-[var(--color-line)]/30"
            style={{ borderColor: "var(--color-line)" }}
          >
            <span className="min-w-0 truncate text-sm" style={{ color: "var(--color-ink)" }}>{r.title}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
              {r.code && <span className="font-mono">{r.code}</span>}
              <span className="rounded-full px-1.5 py-0.5" style={{ background: "var(--color-line)" }}>{r.type}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: compact inline search field in the top bar */}
      <div ref={desktopRef} className="relative hidden w-52 shrink-0 sm:block lg:w-64">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8C97B8]" />
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search e-Lab..."
          aria-label="Search e-Lab"
          className="h-9 w-full rounded-md border border-transparent bg-white/10 pl-8 pr-2 text-[13px] text-white placeholder:text-[#8C97B8] focus:border-white/30 focus:bg-white/15 focus:outline-none"
        />
        {dropdown}
      </div>

      {/* Mobile: icon that opens a full-width overlay field right below the bar */}
      <div className="relative sm:hidden">
        <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-label="Search e-Lab" className="flex h-9 w-9 items-center justify-center rounded-md text-[#AAB3CE] hover:bg-white/10 hover:text-white">
          <Search size={17} />
        </button>
        {mobileOpen && (
          <div className="fixed inset-x-0 top-16 z-50 border-b p-2 shadow-lg" style={{ borderColor: "var(--color-line)", background: "var(--color-paper-raised)" }}>
            <div ref={mobileRef} className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--color-ink-faint)" }} />
              <input
                ref={mobileInputRef}
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onKeyDown={handleKeyDown}
                placeholder="Search e-Lab..."
                aria-label="Search e-Lab"
                className="h-9 w-full rounded-md border pl-8 pr-8 text-[13px]"
                style={{ borderColor: "var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
              />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close search" className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--color-ink-faint)" }}>
                <X size={15} />
              </button>
              {dropdown}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
