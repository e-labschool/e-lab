import { useState, useEffect, useRef, useCallback } from "react";
import { MoleculeA, MoleculeB, MoleculeProduct, REACTIVE_ROTATION, NON_REACTIVE_ROTATION } from "./Molecule.jsx";

// A scripted, parameterized slow-motion replay -- NOT derived from live
// particle physics (Collision mode's ambient container is what shows
// genuine random events; this panel demonstrates specific, reliably
// reproducible worked examples for teaching).
//
// `mode` structurally controls what this panel is even ABLE to show,
// rather than relying on the caller to pass "correct" booleans:
//   "collision-only" -- Collision mode. NEVER evaluates energy/
//                       orientation, NEVER forms a product, always ends
//                       in separation. Energy/orientation props are
//                       ignored entirely in this mode.
//   "energy-only"    -- Activation Energy mode. Shows only the energy
//                       badge; even when energy is sufficient the
//                       outcome is "Reaction possible", never a formed
//                       product (orientation hasn't been considered yet).
//   "full"           -- Orientation mode. Shows both badges; only
//                       energy-sufficient AND orientation-correct forms
//                       a product, via a genuine bond-rearrangement
//                       sequence, not an instant swap.
const PHASE_DURATIONS_MS = { approach: 1300, impact: 450, rearrange: 700, outcome: 800 };

export default function CollisionViewer({ mode, energySufficient, orientationCorrect, resultLine, speed, onSpeedChange, replayKey }) {
  const [phase, setPhase] = useState("approach");
  const timeoutsRef = useRef([]);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  // The ONLY place "does this collision succeed" is decided -- and
  // Collision mode structurally can never reach a true value here,
  // regardless of whatever energySufficient/orientationCorrect props a
  // caller happened to pass.
  const successful = mode === "full" && energySufficient && orientationCorrect;

  const play = useCallback(() => {
    clearTimers();
    setPhase("approach");
    const scale = 1 / speed;
    const t1 = PHASE_DURATIONS_MS.approach * scale;
    const t2 = t1 + PHASE_DURATIONS_MS.impact * scale;
    const t3 = t2 + (successful ? PHASE_DURATIONS_MS.rearrange * scale : 0);
    timeoutsRef.current.push(setTimeout(() => setPhase("impact"), t1));
    if (successful) {
      timeoutsRef.current.push(setTimeout(() => setPhase("rearrange"), t2));
      timeoutsRef.current.push(setTimeout(() => setPhase("outcome"), t3));
    } else {
      timeoutsRef.current.push(setTimeout(() => setPhase("outcome"), t2));
    }
  }, [speed, clearTimers, successful]);

  useEffect(() => {
    play();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, mode, energySufficient, orientationCorrect, speed]);

  const showOrientationVisual = mode === "full";
  const aRotation = !showOrientationVisual || orientationCorrect ? REACTIVE_ROTATION.a : NON_REACTIVE_ROTATION.a;
  const bRotation = !showOrientationVisual || orientationCorrect ? REACTIVE_ROTATION.b : NON_REACTIVE_ROTATION.b;

  const approached = phase !== "approach";
  const separated = phase === "outcome" && !successful;
  const aX = approached ? 118 : 60;
  const bX = approached ? 202 : 260;
  const aSeparateX = separated ? -45 : 0;
  const bSeparateX = separated ? 45 : 0;

  // During "rearrange", crossfade the reactant pair out and the product
  // in AT THE COLLISION POINT -- a genuine (if simple) visual bridge
  // between reactants and product, rather than an instant swap.
  const reactantsOpacity = phase === "rearrange" || (phase === "outcome" && successful) ? 0 : 1;
  const productOpacity = phase === "rearrange" ? 0.55 : phase === "outcome" && successful ? 1 : 0;
  const productX = phase === "outcome" && successful ? 200 : 160;

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
      <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Collision Viewer</p>
      <svg viewBox="0 0 320 110" className="w-full">
        <g style={{ opacity: reactantsOpacity, transition: "opacity 350ms ease" }}>
          <g style={{ transition: `transform ${PHASE_DURATIONS_MS.approach / speed}ms ease-in-out`, transform: `translateX(${aSeparateX}px)` }}>
            <MoleculeA x={aX} y={55} rotation={aRotation} size={1.4} label={false} />
          </g>
          <g style={{ transition: `transform ${PHASE_DURATIONS_MS.approach / speed}ms ease-in-out`, transform: `translateX(${bSeparateX}px)` }}>
            <MoleculeB x={bX} y={55} rotation={bRotation} size={1.4} label={false} />
          </g>
        </g>

        {mode === "full" && (
          <g style={{ opacity: productOpacity, transition: `opacity ${PHASE_DURATIONS_MS.rearrange / speed}ms ease-in, transform ${PHASE_DURATIONS_MS.outcome / speed}ms ease-out`, transform: `translateX(${productX - 160}px)` }}>
            <MoleculeProduct x={160} y={55} size={1.3} />
          </g>
        )}

        {phase === "impact" && <circle cx={(aX + bX) / 2} cy={55} r="18" fill={successful ? "var(--color-teal)" : "var(--color-coral)"} opacity="0.25" />}
        {phase === "rearrange" && <circle cx={160} cy={55} r="22" fill="var(--color-teal)" opacity="0.18" />}
      </svg>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs">
        {mode !== "collision-only" && <Badge ok={energySufficient} label={energySufficient ? "Energy \u2265 Ea" : "Energy < Ea"} />}
        {mode === "full" && <Badge ok={orientationCorrect} label={orientationCorrect ? "Orientation \u2713" : "Orientation \u2715"} />}
      </div>
      {phase === "outcome" && resultLine && <p className="mt-1 text-center text-sm font-semibold text-[var(--color-ink)]">{resultLine}</p>}

      <div className="mt-2 flex items-center justify-center gap-2">
        <button type="button" onClick={play} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
          Replay
        </button>
        <span className="text-[11px] text-[var(--color-ink-faint)]">Speed:</span>
        {[0.25, 0.5, 1].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeedChange(s)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${speed === s ? "bg-[var(--color-indigo)] text-white" : "text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30"}`}
          >
            {s}{"\u00d7"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Badge({ ok, label }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-semibold ${ok ? "bg-[var(--color-teal-soft)] text-[var(--color-teal)]" : "bg-[var(--color-coral-soft)] text-[var(--color-coral)]"}`}>
      {label}
    </span>
  );
}
