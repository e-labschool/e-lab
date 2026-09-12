import { useState, useCallback } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import BeamBalance from "./components/BeamBalance.jsx";
import { computeTitrationState, excessFractionToBeamAngle, EQUIVALENCE_PRESSES } from "./lib/titration.js";

const STATUS_TEXT = {
  basic: { label: "OH\u207B in excess", sub: "BASIC" },
  approaching: { label: "Approaching equivalence\u2026", sub: null },
  equivalence: { label: "EQUIVALENCE POINT", sub: "Neither H\u207A nor OH\u207B is in excess." },
  acidic: { label: "H\u207A in excess", sub: "ACIDIC" },
};

export default function EquivalencePoint({ compact = false }) {
  const [presses, setPresses] = useState(0);
  const state = computeTitrationState(presses);
  const beamAngle = excessFractionToBeamAngle(state.excessFraction);
  const statusInfo = STATUS_TEXT[state.status];
  const canAddMore = presses < EQUIVALENCE_PRESSES + 4; // a few presses past equivalence, then stop — nothing more to demonstrate

  const handleAdd = useCallback(() => setPresses((p) => (p < EQUIVALENCE_PRESSES + 4 ? p + 1 : p)), []);
  const handleReplay = useCallback(() => setPresses(0), []);

  return (
    <InteractiveFrame title="Equivalence Point" subtitle="Add HCl little by little and observe what happens as the solution approaches the equivalence point." compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 900 }}>
        <div className="flex items-start justify-between px-2">
          <div className={`rounded-md px-3 py-1.5 text-center ${state.status === "equivalence" ? "bg-[var(--color-teal-soft)]" : "bg-[var(--color-paper-raised)]"}`}>
            <p className={`text-sm font-bold ${state.status === "equivalence" ? "text-[var(--color-teal)]" : "text-[var(--color-ink)]"}`}>{statusInfo.label}</p>
            {statusInfo.sub && <p className="text-xs font-medium text-[var(--color-ink-faint)]">{statusInfo.sub}</p>}
          </div>
          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">pH</p>
            <p className="text-lg font-bold text-[var(--color-ink)]">{state.pH.toFixed(2)}</p>
          </div>
        </div>

        <svg viewBox="0 0 900 380" className="w-full" style={{ height: "auto", maxHeight: 380 }} role="img" aria-label={`Beam balance showing ${statusInfo.label}, pH ${state.pH.toFixed(2)}`}>
          <BeamBalance angleDeg={beamAngle} />
        </svg>

        <p className="mx-auto -mt-2 max-w-xs text-center text-sm font-medium text-[var(--color-ink-soft)]">
          {"H\u207A + OH\u207B \u2192 H\u2082O"}
        </p>

        <div className="mt-3 flex justify-center gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAddMore}
            className="rounded-md bg-[var(--color-indigo)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            Add HCl
          </button>
          <button type="button" onClick={handleReplay} className="rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
            Replay
          </button>
        </div>
      </div>
    </InteractiveFrame>
  );
}
