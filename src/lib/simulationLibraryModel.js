// Pure model behind SimulationLibrary: search, sort, filter, plus favourites / recently-used persistence.
// No React.  Persistence goes through src/lib/userScopedStorage.js (namespaced by user id, every access wrapped in
// try/catch) and ALWAYS degrades to "works for this visit only" when localStorage is unavailable.
import { loadUserScopedValue, saveUserScopedValue } from "./userScopedStorage.js";
import { matchesTierFilter } from "./access/accessPolicy.js";
import { searchText, isLive, TOPIC_AREAS } from "../data/simulationCatalogue.js";
import { PLATFORM_CURRICULA } from "../data/curricula.js";

export const FAVOURITES_KEY = "sim-favourites";
export const RECENT_KEY = "sim-recent";
export const MAX_RECENT = 12;

const cleanIds = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);

export const loadFavourites = (userId) => cleanIds(loadUserScopedValue(userId, FAVOURITES_KEY, []));
export const loadRecent = (userId) => cleanIds(loadUserScopedValue(userId, RECENT_KEY, [])).slice(0, MAX_RECENT);

/** Returns the new favourites list; persists best-effort. */
export function toggleFavourite(userId, current, id) {
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  saveUserScopedValue(userId, FAVOURITES_KEY, next);
  return next;
}

/** Moves `id` to the front of the recent list (max MAX_RECENT); persists best-effort and returns the new list. */
export function pushRecent(userId, current, id) {
  const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX_RECENT);
  saveUserScopedValue(userId, RECENT_KEY, next);
  return next;
}

/** Records a simulation as recently used straight from storage (used by the viewer page). */
export function recordRecentUse(userId, id) {
  return pushRecent(userId, loadRecent(userId), id);
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Topic chips for the entries currently on offer, in TOPIC_AREAS order (unknown topics last, A-Z). */
export function topicsOf(entries) {
  const present = new Set(entries.map((e) => e.topic).filter(Boolean));
  const known = TOPIC_AREAS.filter((t) => present.has(t));
  const extra = [...present].filter((t) => !TOPIC_AREAS.includes(t)).sort(collator.compare);
  return [...known, ...extra];
}

/** Curriculum ids present on the given entries (missing `curriculum` counts as none), in PLATFORM_CURRICULA order.
 *  The library shows its curriculum filter row only when this has MORE THAN ONE id. */
export function curriculaOf(entries) {
  const present = new Set(entries.flatMap((e) => (Array.isArray(e.curriculum) ? e.curriculum : [])));
  return PLATFORM_CURRICULA.map((c) => c.id).filter((id) => present.has(id));
}

/**
 * @param entries  catalogue entries (already merged with any admin overrides)
 * @param opts { curriculum: null | curriculum id (narrows to entries serving it; combines with any chip),
 *               query, sort: 'az'|'za', chip: {kind:'all'|'tier'|'topic'|'favourites'|'recent', value?},
 *               favourites: string[], recent: string[], showComingSoon: boolean }
 * Rules: coming-soon items are only included when showComingSoon; they always sort after live ones.  The 'recent' chip
 * orders by recency (most recent first) instead of by name.  Search is case-insensitive and every word must match the
 * name, description, topic or a syllabus code ("s2.2", "titration", "bonding").
 */
export function filterSimulations(entries, opts = {}) {
  const { query = "", sort = "az", curriculum = null, chip = { kind: "all" }, favourites = [], recent = [], showComingSoon = false } = opts;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = entries.filter((e) => showComingSoon || isLive(e));
  if (words.length) list = list.filter((e) => { const hay = searchText(e); return words.every((w) => hay.includes(w)); });
  if (curriculum) list = list.filter((e) => Array.isArray(e.curriculum) && e.curriculum.includes(curriculum));
  if (chip.kind === "tier") list = list.filter((e) => matchesTierFilter(e, chip.value));
  else if (chip.kind === "topic") list = list.filter((e) => e.topic === chip.value);
  else if (chip.kind === "favourites") list = list.filter((e) => favourites.includes(e.id));
  else if (chip.kind === "recent") list = list.filter((e) => recent.includes(e.id));

  if (chip.kind === "recent") return list.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  const dir = sort === "za" ? -1 : 1;
  return list.sort((a, b) => {
    const live = Number(isLive(b)) - Number(isLive(a));
    return live || dir * collator.compare(a.label, b.label);
  });
}
