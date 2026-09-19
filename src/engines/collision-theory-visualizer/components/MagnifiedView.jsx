import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Molecule, REACTIVE_ROTATION, NON_REACTIVE_ROTATION } from "./Molecule.jsx";

// The large right-hand magnified panel -- ONE continuous animated space
// (never three separate static approach/collision/product panels).
// `mode` controls what this panel is even ABLE to show:
//
//   "collision"   -- Collision tab. Shows REAL captured vessel encounters.
//                    Success is decided once per encounter (deterministic
//                    per encounter id, not re-randomized on replay) --
//                    deliberately with NO energy/orientation badges and
//                    NO explanation, so the student just observes that
//                    some collisions form products and some don't.
//   "activation"  -- Activation Energy tab. Shows the energy badge only;
//                    even a sufficient-energy case stops at "Reaction
//                    possible", never forms a product (orientation
//                    hasn't been considered).
//   "orientation" -- Orientation tab. Shows both badges; only
//                    energy-sufficient AND orientation-correct forms a
//                    product, via a genuine bond-rearrangement sequence.
const PHASE_DURATIONS_MS = { approach: 1100, impact: 400, rearrange: 650, outcome: 750 };

function stableSuccessFor(encounterId) {
  // A simple deterministic hash -- the SAME captured encounter always
  // shows the same outcome on Replay, but different encounters vary
  // naturally, giving the "some collisions work, some don't" mix
  // Collision mode needs without any random flicker on replay.
  let hash = 0;
  const s = String(encounterId ?? "0");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 1000;
  return hash % 2 === 0;
}

export default function MagnifiedView({ mode, encounterId, energySufficient, orientationCorrect, calloutLine, resultLine, speed, onSpeedChange, replayKey }) {
  const [phase, setPhase] = useState("approach");
  const timeoutsRef = useRef([]);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const collisionSuccess = useMemo(() => (mode === "collision" ? stableSuccessFor(encounterId) : false), [mode, encounterId]);
  const successful = mode === "orientation" ? energySufficient && orientationCorrect : mode === "collision" ? collisionSuccess : false;
  const effectiveResultLine = mode === "collision" ? undefined : resultLine; // Collision mode deliberately gives no explanation

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
  }, [replayKey, encounterId, mode, energySufficient, orientationCorrect, speed]);

  const showOrientationVisual = mode === "orientation";
  const aRotation = !showOrientationVisual || orientationCorrect ? REACTIVE_ROTATION.left : NON_REACTIVE_ROTATION.left;
  const bRotation = !showOrientationVisual || orientationCorrect ? REACTIVE_ROTATION.right : NON_REACTIVE_ROTATION.right;

  const approached = phase !== "approach";
  const separated = phase === "outcome" && !successful;
  const aX = approached ? 210 : 110;
  const bX = approached ? 350 : 450;
  const aSeparateX = separated ? -70 : 0;
  const bSeparateX = separated ? 70 : 0;

  const reactantsOpacity = phase === "rearrange" || (phase === "outcome" && successful) ? 0 : 1;
  const productOpacity = phase === "rearrange" ? 0.55 : phase === "outcome" && successful ? 1 : 0;
  const productSpread = phase === "outcome" && successful ? 45 : 0;

  return (
    <div className="relative flex h-full flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
      {calloutLine && <p className="mb-1 text-center text-xs font-medium text-[var(--color-ink-soft)]">{calloutLine}</p>}

      <svg viewBox="0 0 560 200" className="w-full flex-1">
        <g style={{ opacity: reactantsOpacity, transition: "opacity 350ms ease" }}>
          <g style={{ transition: `transform ${PHASE_DURATIONS_MS.approach / speed}ms ease-in-out`, transform: `translateX(${aSeparateX}px)` }}>
            <Molecule species="A" x={aX} y={100} rotation={aRotation} size={2.4} label={false} />
          </g>
          <g style={{ transition: `transform ${PHASE_DURATIONS_MS.approach / speed}ms ease-in-out`, transform: `translateX(${bSeparateX}px)` }}>
            <Molecule species="B" x={bX} y={100} rotation={bRotation} size={2.4} label={false} />
          </g>
        </g>

        {mode === "orientation" && (
          <g style={{ opacity: productOpacity, transition: `opacity ${PHASE_DURATIONS_MS.rearrange / speed}ms ease-in` }}>
            <g style={{ transition: `transform ${PHASE_DURATIONS_MS.outcome / speed}ms ease-out`, transform: `translateX(${-productSpread}px)` }}>
              <Molecule species="C" x={280} y={100} rotation={REACTIVE_ROTATION.left} size={2.4} label={false} />
            </g>
            <g style={{ transition: `transform ${PHASE_DURATIONS_MS.outcome / speed}ms ease-out`, transform: `translateX(${productSpread}px)` }}>
              <Molecule species="D" x={280} y={100} rotation={REACTIVE_ROTATION.right} size={2.4} label={false} />
            </g>
          </g>
        )}

        {phase === "impact" && <circle cx={(aX + bX) / 2} cy={100} r="32" fill={successful ? "var(--color-teal)" : "var(--color-coral)"} opacity="0.22" />}
        {phase === "rearrange" && <circle cx={280} cy={100} r="38" fill="var(--color-teal)" opacity="0.16" />}
      </svg>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs">
        {mode !== "collision" && <Badge ok={energySufficient} label={energySufficient ? "Energy \u2265 Ea" : "Energy < Ea"} />}
        {mode === "orientation" && <Badge ok={orientationCorrect} label={orientationCorrect ? "Orientation \u2713" : "Orientation \u2715"} />}
      </div>
      {phase === "outcome" && effectiveResultLine && <p className="mt-1 text-center text-sm font-semibold text-[var(--color-ink)]">{effectiveResultLine}</p>}

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
