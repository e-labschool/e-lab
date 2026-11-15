import { useCallback, useId, useMemo, useState } from "react";
import { Search, Star, X } from "lucide-react";
import Container from "../ui/Container.jsx";
import SimulationCard from "./SimulationCard.jsx";
import { isLive } from "../../data/simulationCatalogue.js";
import { showTierFilters } from "../../lib/access/accessPolicy.js";
import { curriculumDisplay } from "../../data/curricula.js";
import { curriculaOf, filterSimulations, loadFavourites, loadRecent, toggleFavourite, topicsOf } from "../../lib/simulationLibraryModel.js";

const chipBase = "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)]";
const chipOn = "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]";
const chipOff = "border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/50 hover:text-[var(--color-ink)]";

/**
 * The ONE simulation library, used by /student/simulations and /teacher/simulations.
 *
 * Props
 *   role      'student' | 'teacher'  (teacher cards say "Present")
 *   userId    namespaces favourites / recently-used in localStorage (best-effort; works without storage)
 *   entries   catalogue entries, already merged with admin overrides (useAccessConfig().catalogue)
 *   ctx       accessPolicy context { signedIn, role, entitlement, config }.  Free / Premium chips and tier badges render
 *             ONLY when showTierFilters(ctx.config) (= premiumEnabled) is true.
 *   basePath  '/student/simulations' | '/teacher/simulations'
 */
export default function SimulationLibrary({ role = "student", userId, entries, ctx, basePath }) {
  const searchId = useId();
  const sortId = useId();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("az");
  const [chip, setChip] = useState({ kind: "all" });
  const [curriculum, setCurriculum] = useState(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [favourites, setFavourites] = useState(() => loadFavourites(userId));
  const [recent] = useState(() => loadRecent(userId));

  const tierUi = showTierFilters(ctx?.config);
  const live = useMemo(() => entries.filter(isLive), [entries]);
  const comingSoonCount = entries.length - live.length;
  const topics = useMemo(() => topicsOf(live), [live]);
  // Curriculum filter: hidden while only one curriculum has simulations (today: IB DP only).
  const curricula = useMemo(() => curriculaOf(live), [live]);
  const curriculumUi = curricula.length > 1;
  const activeCurriculum = curriculumUi ? curriculum : null;
  const results = useMemo(
    () => filterSimulations(entries, { query, sort, chip, curriculum: activeCurriculum, favourites, recent, showComingSoon }),
    [entries, query, sort, chip, activeCurriculum, favourites, recent, showComingSoon]
  );
  const onToggleFavourite = useCallback((id) => setFavourites((cur) => toggleFavourite(userId, cur, id)), [userId]);
  const isChip = (kind, value) => chip.kind === kind && (value === undefined || chip.value === value);
  const filtersActive = query.trim() !== "" || chip.kind !== "all" || activeCurriculum != null;
  const clearAll = () => { setQuery(""); setChip({ kind: "all" }); setCurriculum(null); };
  const actionLabel = role === "teacher" ? "Present" : "Open";

  const chipEl = (kind, value, children) => (
    
<button key={`${kind}:${value ?? ""}`} type="button" aria-pressed={isChip(kind, value)} onClick={() => setChip(kind === "all" ? { kind } : { kind, value })} className={`${chipBase} ${isChip(kind, value) ? chipOn : chipOff}`} data-chip={`${kind}${value ? `:${value}` : ""}`}>
      {children}
    </button>
  );

  return (
    <Container className="py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-4xl">Simulations</h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-ink-soft)]">
            {role === "teacher" ? "Pick a simulation to present to your class." : "Explore every e-Lab simulation. Pick one to practise a concept."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm font-medium text-[var(--color-ink-soft)]">Sort</label>
          <select id={sortId} value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-[var(--color-ink)]/40 bg-[var(--color-paper-raised)] px-3 py-2 text-sm font-semibold text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)]">
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
        </div>
      </div>

      <div className="relative mt-5">
        <label htmlFor={searchId} className="sr-only">Search simulations</label>
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
        <input
          id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off"
          placeholder={'Search simulations (e.g. "titration", "S2.2", "spectroscopy")'}
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] py-3 pl-10 pr-10 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus-visible:border-[var(--color-indigo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)]/30"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter simulations" className="mt-4 flex flex-wrap items-center gap-2">
        {chipEl("all", undefined, `All ${live.length}`)}
        {tierUi && (
          <>
            {chipEl("tier", "free", "Free")}
            {chipEl("tier", "premium", "Premium")}
          </>
        )}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-[var(--color-line)] sm:block" />
        {topics.map((t) => chipEl("topic", t, t))}
        {chipEl("favourites", undefined, <span className="inline-flex items-center gap-1"><Star size={13} aria-hidden="true" /> Favourites</span>)}
        {chipEl("recent", undefined, "Recently used")}
      </div>

      {curriculumUi && (
        <div role="group" aria-label="Filter by curriculum" data-curriculum-filter className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={curriculum == null} onClick={() => setCurriculum(null)} data-chip="curriculum:all" className={`${chipBase} ${curriculum == null ? chipOn : chipOff}`}>All curricula</button>
          {curricula.map((id) => (
            <button key={id} type="button" aria-pressed={curriculum === id} onClick={() => setCurriculum(id)} data-chip={`curriculum:${id}`} className={`${chipBase} ${curriculum === id ? chipOn : chipOff}`}>{curriculumDisplay(id, "", { short: true })}</button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-ink-soft)]">
        <p role="status" aria-live="polite" data-result-count>
          {results.length === 1 ? "1 simulation" : `${results.length} simulations`}{filtersActive ? " match" : ""}
        </p>
        {comingSoonCount > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={showComingSoon} onChange={(e) => setShowComingSoon(e.target.checked)} className="h-4 w-4 accent-[#2647C4]" />
            Show coming soon ({comingSoonCount})
          </label>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-paper-raised)] px-6 py-14 text-center" data-empty>
          <p className="font-medium text-[var(--color-ink)]">
            {chip.kind === "favourites" && !query ? "No favourites yet" : chip.kind === "recent" && !query ? "Nothing used recently" : "No simulations match"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {chip.kind === "favourites" && !query ? "Use the star on a card to keep a simulation here." : chip.kind === "recent" && !query ? "Simulations you open will appear here." : "Try a different word or clear the filters."}
          </p>
          {filtersActive && <button type="button" onClick={clearAll} className="mt-4 rounded-md border border-[var(--color-ink)]/40 px-3.5 py-1.5 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)]">Clear filters</button>}
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" data-sim-grid>
          {results.map((entry) => (
            <li key={entry.id} className="min-w-0">
              <SimulationCard entry={entry} to={`${basePath}/${entry.id}`} actionLabel={actionLabel} favourite={favourites.includes(entry.id)} onToggleFavourite={onToggleFavourite} ctx={ctx} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
