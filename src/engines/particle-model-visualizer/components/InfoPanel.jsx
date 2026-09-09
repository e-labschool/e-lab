import { STATE_INFO } from "../data/stateInfo.js";

export default function InfoPanel({ state }) {
  const info = STATE_INFO[state];
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-indigo)]">{info.label}</p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{info.tagline}</p>
      <p className="mt-1.5 text-sm text-[var(--color-ink)]">{info.movement}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] text-[var(--color-ink-soft)]">
          Attraction &middot; {info.attraction}
        </span>
        <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] text-[var(--color-ink-soft)]">
          Shape &middot; {info.shape}
        </span>
        <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] text-[var(--color-ink-soft)]">
          Volume &middot; {info.volume}
        </span>
      </div>
    </div>
  );
}
