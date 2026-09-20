import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Molecule, REACTIVE_ROTATION, NON_REACTIVE_ROTATION } from "./Molecule.jsx";
import { buildEventGeometry, synthesizeEncounter } from "../lib/collisionGeometry.js";

// The large right-hand magnified panel -- ONE continuous animated space.
// Every position used here comes from buildEventGeometry(), derived
// from a real captured vessel encounter OR a synthesized-but-varied one
// for curated teaching cases -- BOTH go through the identical geometry
// pipeline, so a curated case still looks like a genuinely moving pair
// of molecules, never a visibly different "more artificial" path.
//
// `mode` structurally controls what this panel is even ABLE to show:
//   "collision"   -- real captured vessel encounters, no energy/
//                    orientation evaluation, no product formation ever.
//   "activation"  -- energy badge only; even sufficient energy stops at
//                    "Reaction possible", never forms a product.
//   "orientation" -- both badges; only energy-sufficient AND
//                    orientation-correct forms a product, via a
//                    continuous bond-rearrangement sequence.
const PHASE_DURATIONS_MS = { approach: 1300, contact: 450, rearrange: 700, outcome: 850 };
const W = 560, H = 200;
const CX = W / 2, CY = H / 2;
const MAGNIFY = 5.2; // scales the captured/synthesized vessel-scale geometry up to fill the panel

function stableSuccessFor(encounterId) {
  let hash = 0;
  const s = String(encounterId ?? "0");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 1000;
  return hash % 2 === 0;
}

export default function MagnifiedView({ mode, encounter, encounterId, energySufficient, orientationCorrect, calloutLine, resultLine, speed, onSpeedChange, replayKey }) {
  const [phase, setPhase] = useState("approach");
  const timeoutsRef = useRef([]);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const collisionSuccess = useMemo(() => (mode === "collision" ? stableSuccessFor(encounterId) : false), [mode, encounterId]);
  const successful = mode === "orientation" ? energySufficient && orientationCorrect : mode === "collision" ? collisionSuccess : false;
  const effectiveResultLine = mode === "collision" ? undefined : resultLine; // Collision mode deliberately gives no explanation

  // The event geometry: real captured encounter if provided, otherwise a
  // deterministic-per-replayKey synthesized one (curated demos) -- both
  // go through buildEventGeometry() identically. For "orientation" mode,
  // the encounter's own rotations are overridden with the correct/
  // incorrect reactive-site alignment, since that IS the variable being
  // taught in that tab.
  const geometry = useMemo(() => {
    const baseEncounter = encounter ?? synthesizeEncounter(replayKey);
    let enc = baseEncounter;
    if (mode === "orientation") {
      enc = {
        ...baseEncounter,
        aRot: orientationCorrect ? REACTIVE_ROTATION.left : NON_REACTIVE_ROTATION.left,
        bRot: orientationCorrect ? REACTIVE_ROTATION.right : NON_REACTIVE_ROTATION.right,
        aSpin: 0,
        bSpin: 0,
      };
    }
    return buildEventGeometry(enc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter, replayKey, mode, orientationCorrect]);

  const play = useCallback(() => {
    clearTimers();
    setPhase("approach");
    const scale = 1 / speed;
    const t1 = PHASE_DURATIONS_MS.approach * scale;
    const t2 = t1 + PHASE_DURATIONS_MS.contact * scale;
    const t3 = t2 + (successful ? PHASE_DURATIONS_MS.rearrange * scale : 0);
    timeoutsRef.current.push(setTimeout(() => setPhase("contact"), t1));
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
  }, [replayKey, encounterId, mode, energySufficient, orientationCorrect, speed, geometry]);

  // Positions at each phase, all derived from `geometry` -- never a
  // fixed scripted coordinate. The approach position smoothly
  // transitions (via CSS transition on `transform`) into the contact
  // position, which then transitions into the outcome position -- the
  // SAME <g>/<Molecule> elements throughout, never remounted, so there
  // is nothing to "jump" or "reset" between phases.
  const aPos = phase === "approach" ? geometry.aApproachRel : phase === "outcome" && !successful ? add(geometry.aContactRel, geometry.aSeparate) : geometry.aContactRel;
  const bPos = phase === "approach" ? geometry.bApproachRel : phase === "outcome" && !successful ? add(geometry.bContactRel, geometry.bSeparate) : geometry.bContactRel;

  // Rotation continues smoothly through the approach (as if the
  // molecules had been spinning at aSpin/bSpin the whole time) into the
  // captured contact rotation.
  const approachDurationS = PHASE_DURATIONS_MS.approach / 1000;
  const aRotAtApproachStart = geometry.aRot - geometry.aSpin * approachDurationS;
  const bRotAtApproachStart = geometry.bRot - geometry.bSpin * approachDurationS;
  const aRotation = phase === "approach" ? aRotAtApproachStart : geometry.aRot;
  const bRotation = phase === "approach" ? bRotAtApproachStart : geometry.bRot;

  const reactantsOpacity = phase === "rearrange" || (phase === "outcome" && successful) ? 0 : 1;
  const productOpacity = phase === "rearrange" ? 0.55 : phase === "outcome" && successful ? 1 : 0;
  const cPos = phase === "outcome" && successful ? geometry.cSeparate : { x: 0, y: 0 };
  const dPos = phase === "outcome" && successful ? geometry.dSeparate : { x: 0, y: 0 };

  return (
    <div className="relative flex h-full flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
      {calloutLine && <p className="mb-1 text-center text-xs font-medium text-[var(--color-ink-soft)]">{calloutLine}</p>}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1">
        <g style={{ opacity: reactantsOpacity, transition: "opacity 350ms ease" }}>
          <g style={{ transition: `transform ${PHASE_DURATIONS_MS.approach / speed}ms ease-in-out, opacity 200ms`, transform: `translate(${CX + aPos.x * MAGNIFY}px, ${CY + aPos.y * MAGNIFY}px) rotate(${aRotation}deg)` }}>
            <Molecule species="A" x={0} y={0} rotation={0} size={2.2} label={false} />
          </g>
          <g style={{ transition: `transform ${PHASE_DURATIONS_MS.approach / speed}ms ease-in-out, opacity 200ms`, transform: `translate(${CX + bPos.x * MAGNIFY}px, ${CY + bPos.y * MAGNIFY}px) rotate(${bRotation}deg)` }}>
            <Molecule species="B" x={0} y={0} rotation={0} size={2.2} label={false} />
          </g>
        </g>

        {mode === "orientation" && (
          <g style={{ opacity: productOpacity, transition: `opacity ${PHASE_DURATIONS_MS.rearrange / speed}ms ease-in` }}>
            <g style={{ transition: `transform ${PHASE_DURATIONS_MS.outcome / speed}ms ease-out`, transform: `translate(${CX + cPos.x}px, ${CY + cPos.y}px)` }}>
              <Molecule species="C" x={0} y={0} rotation={geometry.aRot} size={2.2} label={false} />
            </g>
            <g style={{ transition: `transform ${PHASE_DURATIONS_MS.outcome / speed}ms ease-out`, transform: `translate(${CX + dPos.x}px, ${CY + dPos.y}px)` }}>
              <Molecule species="D" x={0} y={0} rotation={geometry.bRot} size={2.2} label={false} />
            </g>
          </g>
        )}

        {phase === "contact" && <circle cx={CX} cy={CY} r="30" fill={successful ? "var(--color-teal)" : "var(--color-coral)"} opacity="0.22" />}
        {phase === "rearrange" && <circle cx={CX} cy={CY} r="36" fill="var(--color-teal)" opacity="0.16" />}
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

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function Badge({ ok, label }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-semibold ${ok ? "bg-[var(--color-teal-soft)] text-[var(--color-teal)]" : "bg-[var(--color-coral-soft)] text-[var(--color-coral)]"}`}>
      {label}
    </span>
  );
}
