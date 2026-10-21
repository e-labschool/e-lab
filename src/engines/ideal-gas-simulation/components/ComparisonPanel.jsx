import { CircleHelp } from "lucide-react";
import { CAUTION_TEXT, DEVIATION_BOUNDS, DEVIATION_CLASSES, UNRELIABLE_TEXT } from "../model.js";
import { DashPanel } from "../../../components/simulation/SimulationDashboard.jsx";

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

const GRADIENT = "linear-gradient(90deg,#4cc9e0 0%,#6fdc9a 28%,#f4dc4f 52%,#f7a043 76%,#f26a63 100%)";
const GREY = "repeating-linear-gradient(90deg,#D5DAE3 0 6px,#EEF1F6 6px 12px)";

// Compact "Real vs Ideal" deviation indicator (chamber column). Everything shown
// is computed by model.compareWithIdeal(); in Ideal mode the strip keeps its size
// (greyed) so switching gas type never moves the chamber.
export default function ComparisonPanel({ comparison, real }) {
  const ok = real && comparison.status === "ok";
  const summary = !real
    ? "Ideal gas: P = nRT/V exactly, so there is no deviation. Choose Real gas to compare."
    : ok ? SUMMARY[comparison.cls.index] : UNRELIABLE_TEXT[comparison.reason] || UNRELIABLE_TEXT["invalid-state"];
  const label = !real
    ? "Comparison unavailable in ideal gas mode"
    : ok ? `Deviation from ideal: ${comparison.deviationPct.toFixed(1)} percent, ${comparison.cls.label}` : "Comparison unavailable: model unreliable in this region";
  const caution = ok && comparison.caution ? CAUTION_TEXT[comparison.caution] : null;
  return (
    <DashPanel
      fixed ariaLabel="Comparison with ideal gas" testId="comparison-panel"
      title="Real vs ideal"
      aside={
        <span className="inline-flex items-center gap-1.5">
          {ok && (
            <span className="text-[length:var(--sd-fs)] font-bold tabular-nums text-[#14226B]" data-testid="comparison-value" title={`P real ${comparison.pReal.toFixed(2)} atm vs P ideal ${comparison.pIdeal.toFixed(2)} atm`}>
              Deviation {comparison.deviationPct.toFixed(comparison.deviationPct < 10 ? 1 : 0)}%
            </span>
          )}
          <span title={HELP} aria-label={HELP} role="img" className="sd-help"><CircleHelp size={15} aria-hidden="true" /></span>
        </span>
      }
      noBody
    >
      <div className="relative px-1.5" role="img" aria-label={label} data-testid="comparison-bar">
        <div className="h-2.5 rounded-full" style={{ background: ok ? GRADIENT : GREY }} />
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
      <div className="grid grid-cols-4 text-center text-[length:var(--sd-fs-sm)] leading-tight text-[#33415F]" aria-hidden="true">
        {DEVIATION_CLASSES.map((c, i) => (
          <span key={c.id} className={ok && comparison.cls.index === i ? "font-bold text-[#14226B]" : ""}>{c.label.replace(" deviation", "").replace(" to ideal", "")}</span>
        ))}
      </div>
      <p className={"sd-text min-h-[2.75em] " + (!real || ok ? "" : "font-medium text-[#8a5300]")} data-testid="comparison-summary" role="status">
        {summary}
        {caution && <span className="font-medium text-[#8a5300]" data-testid="comparison-caution"> {caution}</span>}
      </p>
    </DashPanel>
  );
}
