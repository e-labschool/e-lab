import { useState, useEffect } from "react";
import { electronPositionsOnShell } from "../lib/electronPositions.js";
import { shellCapacity } from "../lib/atomState.js";

const CX = 200;
const CY = 200;
const NUCLEUS_R = 26;
const RING_GAP = 34;
const FIRST_RING_R = 50;

function shellRadius(n) {
  return FIRST_RING_R + (n - 1) * RING_GAP;
}

// Nucleus glow strengthens briefly (a conceptual visual cue only -- no
// fabricated atomic-radius numbers are ever displayed) whenever the
// outermost shell has just disappeared entirely.
function Nucleus({ speciesSymbol, pulse }) {
  return (
    <g>
      <circle cx={CX} cy={CY} r={NUCLEUS_R + 10} fill="url(#ie-nucleus-glow)" className={pulse ? "ie-nucleus-pulse" : ""} />
      <circle cx={CX} cy={CY} r={NUCLEUS_R} fill="#0d1a33" stroke="#5ad1ff" strokeWidth="1.5" />
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize="16" fontWeight="700" fill="#eaf6ff">{speciesSymbol}</text>
    </g>
  );
}

function ShellRing({ n, occupancy, isTarget }) {
  const r = shellRadius(n);
  const capacity = shellCapacity(n);
  const positions = electronPositionsOnShell(occupancy, r, CX, CY);
  return (
    <g>
      <circle cx={CX} cy={CY} r={r} fill="none" stroke={isTarget ? "#5ad1ff" : "#274063"} strokeWidth="1" strokeDasharray="2 4" />
      <text x={CX + r + 6} y={CY - r + 4} fontSize="9" fill="#7fa8d9">n={n} &middot; {occupancy}/{capacity}</text>
      {positions.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="5" fill="#5ad1ff" stroke="#eaf6ff" strokeWidth="0.75">
          <title>{`Shell n=${n}, electron ${i + 1} of ${occupancy}`}</title>
        </circle>
      ))}
    </g>
  );
}

// The one animated electron mid-removal: travels from its ring position
// radially outward past the outermost drawn ring, then fades -- only
// AFTER it has clearly left. Reduced-motion uses a much shorter,
// non-travelling opacity transition instead, but reaches the exact same
// end state and fires the same onDone callback.
function RemovingElectron({ shell, index, occupancyAtRemoval, reducedMotion, onDone }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Fallback commit timer: guarantees the new atomic state is always
  // reached even if a transitionend event is somehow missed (e.g. the
  // element unmounts mid-transition), matching "electron must not
  // permanently move" / must always resolve to the correct final state.
  useEffect(() => {
    const ms = reducedMotion ? 260 : 950;
    const id = setTimeout(() => onDone?.(), ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = shellRadius(shell);
  const positions = electronPositionsOnShell(occupancyAtRemoval, r, CX, CY);
  const start = positions[index] ?? positions[positions.length - 1];
  if (!start) return null;
  const outR = shellRadius(shell) + 90;
  const endX = CX + outR * Math.cos(start.angle);
  const endY = CY + outR * Math.sin(start.angle);

  return (
    <circle
      cx={start.x}
      cy={start.y}
      r={active ? 7 : 6}
      fill="#ffd166"
      stroke="#fff3d6"
      strokeWidth="1"
      style={{
        transformBox: "fill-box",
        transformOrigin: "center",
        transition: reducedMotion ? "opacity 220ms ease-out" : "transform 650ms cubic-bezier(.3,.6,.3,1), opacity 650ms ease-in 250ms",
        transform: active && !reducedMotion ? `translate(${endX - start.x}px, ${endY - start.y}px)` : "translate(0,0)",
        opacity: active ? 0 : 1,
      }}
    />
  );
}

/** The single hero atom visualization. `atomState` is `deriveAtomState()`
 * output (single source of truth). `removing` (optional) describes an
 * in-flight removal animation: { shell, indexInShell, occupancyAtRemoval }. */
export default function AtomVisualization({ atomState, removing, reducedMotion, onRemovalAnimationEnd, innerShellPulse }) {
  const shellEntries = Object.entries(atomState.shells).map(([n, occ]) => [Number(n), occ]).sort((a, b) => a[0] - b[0]);

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 400 400" className="h-[320px] w-full max-w-[420px] sm:h-[380px]" role="img" aria-label={`Atom diagram: ${atomState.speciesSymbol}, ${atomState.electronCount} electrons`}>
        <defs>
          <radialGradient id="ie-nucleus-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5ad1ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#5ad1ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {shellEntries.map(([n, occ]) => (
          <ShellRing key={n} n={n} occupancy={occ} isTarget={removing?.shell === n} />
        ))}
        <Nucleus speciesSymbol={atomState.speciesSymbol} pulse={innerShellPulse} />
        {removing && (
          <RemovingElectron
            shell={removing.shell}
            index={removing.indexInShell}
            occupancyAtRemoval={removing.occupancyAtRemoval}
            reducedMotion={reducedMotion}
            onDone={onRemovalAnimationEnd}
          />
        )}
      </svg>
      <p className="mt-1 max-w-xs text-center text-[10px] leading-snug text-[var(--color-ink-faint)]">
        Shells are shown as a simplified energy-level representation. Electrons do not travel in fixed circular orbits.
      </p>
      <style>{`
        .ie-nucleus-pulse { animation: ie-pulse 900ms ease-out 1; }
        @keyframes ie-pulse { 0% { opacity: 0.9; r: ${NUCLEUS_R + 10}; } 60% { opacity: 0.25; r: ${NUCLEUS_R + 2}; } 100% { opacity: 0.55; r: ${NUCLEUS_R + 10}; } }
        @media (prefers-reduced-motion: reduce) { .ie-nucleus-pulse { animation: none; } }
      `}</style>
    </div>
  );
}
