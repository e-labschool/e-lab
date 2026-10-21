import { CircleHelp } from "lucide-react";
import { CAUTION_TEXT, DEVIATION_BOUNDS, DEVIATION_CLASSES, UNRELIABLE_TEXT } from "../model.js";

const SUMMARY = [
  "At the current conditions, the real gas behaves very similarly to an ideal gas.",
  "The real gas shows a small deviation from the ideal-gas prediction.",
  "The real gas deviates noticeably from the ideal-gas prediction.",
  "The real gas differs strongly from the ideal-gas prediction.",
];

const HELP =
  `Deviation = |P_real - P_ideal| / P_ideal x 100 at the same T, V and n. ` +
  `Very close < ${DEVIATION_BOUNDS.veryClose}%, small < ${DEVIATION_BOUNDS.small}%, moderate up to ${DEVIATION_BOUNDS.moderate}%, large above. ` +
  `Real gases approach ideal behaviour at high temperature and low pressure; they never become ideal.`;

// Real-gas only. Everything shown is computed from model.compareWithIdeal().
export default function ComparisonPanel({ comparison, dense }) {
  const ok = comparison.status === "ok";
  const summary = ok ? SUMMARY[comparison.cls.index] : UNRELIABLE_TEXT[comparison.reason] || UNRELIABLE_TEXT["invalid-state"];
  const label = ok
    ? `Deviation from ideal: ${comparison.deviationPct.toFixed(1)} percent, ${comparison.cls.label}`
    : "Comparison unavailable: model unreliable in this region";
  return (
    <section
      aria-label="Comparison with ideal gas"
      className={"rounded-2xl border border-[#E3EAF6] bg-white/90 shadow-[0_2px_10px_rgba(60,90,150,0.07)] " + (dense ? "p-3" : "p-4")}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={(dense ? "text-[14px]" : "text-[16px]") + " font-bold leading-tight text-[#14226B]"}>Comparison with ideal gas</h3>
        <span title={HELP} aria-label={HELP} role="img" className="shrink-0 cursor-help text-[#8A97B2]">
          <CircleHelp size={16} aria-hidden="true" />
        </span>
      </div>
      <p
        className={"mt-1 text-[12px] leading-snug " + (ok ? "text-[#33415F]" : "font-medium text-[#9A5B00]")}
        data-testid="comparison-summary"
        role="status"
      >
        {summary}
      </p>
      {ok && comparison.caution && (
        <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#9A5B00]" data-testid="comparison-caution">{CAUTION_TEXT[comparison.caution]}</p>
      )}
      {ok && (
        <p className="mt-0.5 text-[11px] tabular-nums text-[#6B7A99]" data-testid="comparison-value">
          Deviation <strong className="text-[#14226B]">{comparison.deviationPct.toFixed(comparison.deviationPct < 10 ? 1 : 0)}%</strong>
          {" "}(P real {comparison.pReal.toFixed(2)} vs ideal {comparison.pIdeal.toFixed(2)} atm)
        </p>
      )}
      <div className="relative mt-2.5 px-1.5" role="img" aria-label={label} data-testid="comparison-bar">
        <div
          className="h-2.5 rounded-full"
          style={{
            background: ok
              ? "linear-gradient(90deg,#4cc9e0 0%,#6fdc9a 28%,#f4dc4f 52%,#f7a043 76%,#f26a63 100%)"
              : "repeating-linear-gradient(90deg,#D5DAE3 0 6px,#EEF1F6 6px 12px)",
          }}
        />
        {[25, 50, 75].map((p) => (
          <span key={p} className="absolute top-0 h-2.5 w-px bg-white/70" style={{ left: `calc(6px + (100% - 12px) * ${p / 100})` }} aria-hidden="true" />
        ))}
        {ok && (
          <span
            data-testid="comparison-marker"
            data-pos={comparison.marker.toFixed(4)}
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1F2D3D] shadow transition-[left] duration-200"
            style={{ left: `calc(6px + (100% - 12px) * ${comparison.marker})` }}
          />
        )}
      </div>
      <div className="mt-1 grid grid-cols-4 text-center text-[10px] leading-tight text-[#33415F]" aria-hidden="true">
        {DEVIATION_CLASSES.map((c, i) => (
          <span key={c.id} className={ok && comparison.cls.index === i ? "font-bold text-[#14226B]" : ""}>{c.label.replace(" to ideal", "")}{i === 0 ? <><br />to ideal</> : null}</span>
        ))}
      </div>
    </section>
  );
}
