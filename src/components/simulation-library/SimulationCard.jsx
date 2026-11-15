import { Link } from "react-router-dom";
import { ArrowRight, Lock, Star } from "lucide-react";
import SimulationThumb from "./SimulationThumb.jsx";
import { isLive, SIM_STATUS } from "../../data/simulationCatalogue.js";
import { tierBadge, tierLabel, showLockChip } from "../../lib/access/accessPolicy.js";

const BADGE_CLS = {
  free: "bg-[#E7F3F0] text-[#1F5E54]",
  demo: "bg-[#EAEDFB] text-[#2647C4]",
  premium: "bg-[#FBF0E4] text-[#8F4A12]",
};

/**
 * One simulation card.  All Free / Premium / lock chrome comes from accessPolicy (tierBadge, showLockChip) and is therefore
 * absent while `ctx.config.premiumEnabled` is false.  Coming-soon entries render as a non-interactive card.
 * `to` is the role-specific viewer URL, `actionLabel` is "Open" (student) or "Present" (teacher).
 */
export default function SimulationCard({ entry, to, actionLabel = "Open", favourite = false, onToggleFavourite, ctx }) {
  const live = isLive(entry);
  const badge = tierBadge(entry, ctx?.config);
  const locked = live && showLockChip(entry, ctx);
  const code = entry.syllabus?.join(", ");
  const meta = [code, entry.topic].filter(Boolean).join(" · ");

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] shadow-[0_1px_2px_rgba(20,30,80,0.05)] transition-shadow ${live ? "hover:shadow-[0_6px_18px_-6px_rgba(20,30,80,0.25)]" : "opacity-90"}`} data-sim-id={entry.id} data-live={live ? "true" : "false"}>
      <div className="relative">
        <SimulationThumb id={entry.id} src={live ? entry.thumbnail : null} label={entry.label} />
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {!live && (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#4A5160]">
              {entry.status === SIM_STATUS.IN_DEVELOPMENT ? "In development" : "Planned"}
            </span>
          )}
          {live && badge && !locked && <span data-tier-badge={badge} className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${BADGE_CLS[badge]}`}>{tierLabel(badge)}</span>}
          {locked && <span data-lock-chip className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${BADGE_CLS.premium}`}><Lock size={11} aria-hidden="true" /> {tierLabel(entry.tier)}</span>}
        </div>
        {live && onToggleFavourite && (
          <button
            type="button"
            onClick={() => onToggleFavourite(entry.id)}
            aria-pressed={favourite}
            aria-label={favourite ? `Remove ${entry.label} from favourites` : `Add ${entry.label} to favourites`}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#12161C] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2647C4] focus-visible:ring-offset-1"
          >
            <Star size={16} aria-hidden="true" className={favourite ? "fill-[#C96A21] text-[#C96A21]" : ""} />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h2 className="font-[var(--font-display)] text-[1.0625rem] font-semibold leading-snug text-[var(--color-ink)]">
          {live ? (
            <Link to={to} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[#2647C4] focus-visible:after:rounded-xl">{entry.label}</Link>
          ) : entry.label}
        </h2>
        <p className="line-clamp-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{entry.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-[var(--color-ink-faint)]">
          <span className="min-w-0 truncate" title={meta}>{meta}</span>
          {live ? (
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--color-ink)]" aria-hidden="true">{actionLabel} <ArrowRight size={13} /></span>
          ) : (
            <span className="shrink-0 font-medium">Coming soon</span>
          )}
        </div>
      </div>
    </article>
  );
}
