import { PH_MIN, PH_MAX, formatPH } from "../lib/ph.js";

const GRADIENT =
  "linear-gradient(to right, #D8432C 0%, #E4732F 14%, #EDA93A 28%, #E9C948 43%, #8FBF4A 50%, #46A16A 57%, #2F9793 64%, #3A84C4 78%, #5566C6 92%, #7A4FB0 100%)";

export default function PHScale({ pH }) {
  const percent = ((pH - PH_MIN) / (PH_MAX - PH_MIN)) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>
        pH scale
      </p>

      <div className="relative pt-3">
        <div
          className="h-3 w-full rounded-full"
          style={{ background: GRADIENT, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
          role="img"
          aria-label={`pH scale from 0 to 14, current value ${formatPH(pH)}`}
        />
        <div
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center duration-150 ease-out"
          style={{ left: `${percent}%`, transition: "left 150ms ease-out" }}
        >
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white" style={{ background: "var(--color-ink)" }}>
            {formatPH(pH)}
          </span>
          <span
            className="h-3 w-3 -translate-y-0.5 rotate-45 border"
            style={{ background: "var(--color-ink)", borderColor: "var(--color-paper)" }}
          />
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: "var(--color-ink-soft)" }}>
        <span>More acidic ←</span>
        <span className="font-medium" style={{ color: "var(--color-ink)" }}>pH 7 — Neutral</span>
        <span>→ More basic</span>
      </div>
    </div>
  );
}
