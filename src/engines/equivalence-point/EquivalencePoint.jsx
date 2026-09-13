import { useState, useCallback, useRef, useEffect } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import BeamBalance from "./components/BeamBalance.jsx";
import Burette from "./components/Burette.jsx";
import { computeTitrationState, excessFractionToBeamAngle, EQUIVALENCE_PRESSES } from "./lib/titration.js";

const STATUS_TEXT = {
  basic: { label: "OH\u207B in excess", sub: "BASIC" },
  approaching: { label: "Approaching equivalence\u2026", sub: null },
  equivalence: { label: "EQUIVALENCE POINT", sub: "Neither H\u207A nor OH\u207B is in excess." },
  acidic: { label: "H\u207A in excess", sub: "ACIDIC" },
};

const MAX_PRESSES = EQUIVALENCE_PRESSES + 4;
const BURETTE_X = 640, BURETTE_Y = 18;

// A short, purely visual animation sequence plays on every "Add HCl"
// press, BEFORE the underlying discrete state actually advances: the
// droplet falls from the burette, then a brief highlight shows it
// meeting/consuming an excess OH- (or, past equivalence, simply joining
// the solution as excess H+) -- so the student sees acid being added
// and reacting, not just a number changing. The real state
// (computeTitrationState) only ever exists at integer press counts;
// nothing about the chemistry itself is animated or interpolated.
const DROP_FALL_MS = 550;
const REACT_FLASH_MS = 450;

export default function EquivalencePoint({ compact = false }) {
  const [presses, setPresses] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | dropping | reacting
  const timeoutsRef = useRef([]);

  const state = computeTitrationState(presses);
  const beamAngle = excessFractionToBeamAngle(state.excessFraction);
  const statusInfo = STATUS_TEXT[state.status];
  const canAddMore = presses < MAX_PRESSES && phase === "idle";

  const leftCount = state.excessSpecies === "OH" ? state.sphereCount : 0;
  const rightCount = state.excessSpecies === "H" ? state.sphereCount : 0;

  function clearTimers() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }

  useEffect(() => clearTimers, []);

  const handleAdd = useCallback(() => {
    if (presses >= MAX_PRESSES || phase !== "idle") return;
    setPhase("dropping");
    timeoutsRef.current.push(
      setTimeout(() => {
        setPhase("reacting");
        timeoutsRef.current.push(
          setTimeout(() => {
            setPresses((p) => Math.min(MAX_PRESSES, p + 1));
            setPhase("idle");
          }, REACT_FLASH_MS)
        );
      }, DROP_FALL_MS)
    );
  }, [presses, phase]);

  const handleReplay = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setPresses(0);
  }, []);

  const dropVisible = phase === "dropping";
  const reacting = phase === "reacting";

  return (
    <InteractiveFrame title="Equivalence Point" subtitle="Add HCl little by little and observe what happens as the solution approaches the equivalence point." compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 920 }}>
        <div className="flex items-start justify-between px-2">
          <div className={`rounded-md px-3 py-1.5 text-center transition-colors ${state.status === "equivalence" ? "bg-[var(--color-teal-soft)]" : "bg-[var(--color-paper-raised)]"}`}>
            <p className={`text-sm font-bold ${state.status === "equivalence" ? "text-[var(--color-teal)]" : "text-[var(--color-ink)]"}`}>{statusInfo.label}</p>
            {statusInfo.sub && <p className="text-xs font-medium text-[var(--color-ink-faint)]">{statusInfo.sub}</p>}
          </div>
          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">pH</p>
            <p className="text-lg font-bold text-[var(--color-ink)]">{state.pH.toFixed(2)}</p>
          </div>
        </div>

        <svg viewBox="0 0 900 400" className="w-full" style={{ height: "auto", maxHeight: 400 }} role="img" aria-label={`Beam balance showing ${statusInfo.label}, pH ${state.pH.toFixed(2)}`}>
          <BeamBalance angleDeg={beamAngle} leftCount={leftCount} rightCount={rightCount} />
          <Burette x={BURETTE_X} y={BURETTE_Y} dropVisible={dropVisible} dropProgress={dropVisible ? 1 : 0} />
          {reacting && (
            <circle cx={BURETTE_X} cy={BURETTE_Y + 90 + 46} r="20" fill="var(--color-amber)" opacity="0.35">
              <animate attributeName="r" values="6;24;6" dur="0.45s" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="0.45s" />
            </circle>
          )}
        </svg>

        <p className="mx-auto -mt-2 max-w-xs text-center text-sm font-medium text-[var(--color-ink-soft)]">
          {"H\u207A + OH\u207B \u2192 H\u2082O"}
        </p>
        <p className="mx-auto text-center text-[11px] text-[var(--color-ink-faint)]">
          HCl added: {Math.round(state.hclAddedMl * 10) / 10} {"cm\u00b3"}
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
