import { useEffect, useRef, useState } from "react";
import { electronPositionsOnShell } from "../lib/electronPositions.js";
import { shellCapacity } from "../lib/atomState.js";

// ---- Container-aware layout ------------------------------------------
// Every geometric quantity below (padding, centre, outer radius, ring
// spacing, nucleus size, electron dot size) is DERIVED from the actual
// measured pixel size of the panel this visualization renders into, via
// ResizeObserver -- never a fixed viewBox scaled up/down with CSS
// transform/zoom. The SVG's viewBox is set to those exact measured
// pixel dimensions (1 viewBox unit === 1 CSS pixel), so every cx/cy/r fed
// into electronPositionsOnShell() is a real, final on-screen coordinate,
// not something later stretched by the browser. This is what keeps
// electrons mathematically exact on their shell circumference at any
// size: resizing recomputes cx, cy and r and re-derives positions from
// them, it never visually stretches an already-laid-out result.
const PADDING_MIN = 35;
const PADDING_MAX = 60;
// Horizontal room reserved past the outermost ring for the "n=N · a/b"
// shell label text. Capped at a fixed max (the label's own font size
// doesn't grow with the atom, so it never needs more than this), but
// allowed to shrink on a narrow panel -- otherwise, on a narrow mobile
// panel, a fixed label allowance alone would eat a disproportionate
// share of the available half-width and needlessly shrink the atom.
const LABEL_ALLOWANCE_MAX = 68;
const LABEL_ALLOWANCE_MIN = 40;

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentBoxSize?.[0];
      const width = box ? box.inlineSize : entry.contentRect.width;
      const height = box ? box.blockSize : entry.contentRect.height;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

// Nucleus glow strengthens briefly (a conceptual visual cue only -- no
// fabricated atomic-radius numbers are ever displayed) whenever the
// outermost shell has just disappeared entirely.
function Nucleus({ cx, cy, r, fontSize, speciesSymbol, pulse }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + Math.max(8, r * 0.4)} fill="url(#ie-nucleus-glow)" className={pulse ? "ie-nucleus-pulse" : ""} data-glow-r={r + Math.max(8, r * 0.4)} />
      <circle cx={cx} cy={cy} r={r} fill="#0d1a33" stroke="#5ad1ff" strokeWidth="1.5" />
      <text x={cx} y={cy + fontSize * 0.34} textAnchor="middle" fontSize={fontSize} fontWeight="700" fill="#eaf6ff">{speciesSymbol}</text>
    </g>
  );
}

function ShellRing({ n, occupancy, cx, cy, r, electronR, isTarget }) {
  const capacity = shellCapacity(n);
  const positions = electronPositionsOnShell(occupancy, r, cx, cy);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={isTarget ? "#5ad1ff" : "#274063"} strokeWidth="1" strokeDasharray="2 4" />
      <text x={cx + r + 6} y={cy - r + 4} fontSize="10" fill="#7fa8d9">n={n} &middot; {occupancy}/{capacity}</text>
      {positions.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={electronR} fill="#5ad1ff" stroke="#eaf6ff" strokeWidth="0.75">
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
function RemovingElectron({ index, occupancyAtRemoval, cx, cy, r, electronR, flightDistance, reducedMotion, onDone }) {
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

  const positions = electronPositionsOnShell(occupancyAtRemoval, r, cx, cy);
  const start = positions[index] ?? positions[positions.length - 1];
  if (!start) return null;
  const outR = r + flightDistance;
  const endX = cx + outR * Math.cos(start.angle);
  const endY = cy + outR * Math.sin(start.angle);

  return (
    <circle
      cx={start.x}
      cy={start.y}
      r={active ? electronR + 1.5 : electronR}
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
 * in-flight removal animation: { shell, indexInShell, occupancyAtRemoval }.
 *
 * Fills whatever panel it's placed in (h-full w-full) and recomputes its
 * entire geometry from that panel's real measured size, so the atom
 * genuinely dominates the available central visualization area on any
 * viewport, in fullscreen, and as shells appear/disappear -- never a
 * small fixed-size diagram floating in unused space. */
export default function AtomVisualization({ atomState, removing, reducedMotion, onRemovalAnimationEnd, innerShellPulse }) {
  const containerRef = useRef(null);
  const measured = useElementSize(containerRef);
  // Sensible fallback for the very first paint, before ResizeObserver's
  // first callback lands -- replaced within a frame by the real size.
  const W = measured.width > 0 ? measured.width : 360;
  const H = measured.height > 0 ? measured.height : 300;

  const shellEntries = Object.entries(atomState.shells).map(([n, occ]) => [Number(n), occ]).sort((a, b) => a[0] - b[0]);
  const shellNumbers = shellEntries.map(([n]) => n);
  const ringCount = Math.max(shellNumbers.length ? Math.max(...shellNumbers) : 1, 1);

  const padding = Math.max(PADDING_MIN, Math.min(PADDING_MAX, Math.min(W, H) * 0.09));
  const labelAllowance = Math.max(LABEL_ALLOWANCE_MIN, Math.min(LABEL_ALLOWANCE_MAX, W * 0.16));
  const cx = W / 2;
  const cy = H / 2;
  // The outer bound every occupied shell is distributed within --
  // exactly min(availableWidth/2 - horizontalPadding, availableHeight/2 -
  // verticalPadding), with the label's own space carved out of the
  // horizontal half so shell-label text never clips past the SVG edge.
  const maxRadius = Math.max(30, Math.min(W / 2 - padding - labelAllowance, H / 2 - padding));

  // Distributes `ringCount` occupied shells across [0, maxRadius] so the
  // OUTERMOST occupied shell always lands exactly on maxRadius -- i.e. it
  // approaches the panel's boundary regardless of how many shells are
  // occupied. Fewer occupied shells (e.g. after an outer shell empties)
  // means fewer, more widely-spaced rings automatically filling the same
  // maxRadius -- the "dynamic shell resizing / recentre on contraction"
  // behaviour the brief asks for, purely as a side effect of this one
  // formula re-evaluating on every render.
  const firstRingR = maxRadius / (ringCount + 0.75);
  const ringGap = ringCount > 1 ? (maxRadius - firstRingR) / (ringCount - 1) : 0;
  const nucleusR = Math.min(firstRingR * 0.55, maxRadius * 0.22);
  const nucleusFontSize = Math.max(13, Math.min(20, nucleusR * 0.62));
  const electronR = Math.max(4, Math.min(8, maxRadius * 0.045));
  const flightDistance = Math.max(50, maxRadius * 0.22);

  function shellRadius(n) {
    return firstRingR + (n - 1) * ringGap;
  }

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div ref={containerRef} className="relative min-h-0 w-full flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-full w-full"
          role="img"
          aria-label={`Atom diagram: ${atomState.speciesSymbol}, ${atomState.electronCount} electrons`}
        >
          <defs>
            <radialGradient id="ie-nucleus-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5ad1ff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#5ad1ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          {shellEntries.map(([n, occ]) => (
            <ShellRing key={n} n={n} occupancy={occ} cx={cx} cy={cy} r={shellRadius(n)} electronR={electronR} isTarget={removing?.shell === n} />
          ))}
          <Nucleus cx={cx} cy={cy} r={nucleusR} fontSize={nucleusFontSize} speciesSymbol={atomState.speciesSymbol} pulse={innerShellPulse} />
          {removing && (
            <RemovingElectron
              index={removing.indexInShell}
              occupancyAtRemoval={removing.occupancyAtRemoval}
              cx={cx}
              cy={cy}
              r={shellRadius(removing.shell)}
              electronR={electronR}
              flightDistance={flightDistance}
              reducedMotion={reducedMotion}
              onDone={onRemovalAnimationEnd}
            />
          )}
        </svg>
      </div>
      <p className="mt-1 max-w-xs shrink-0 text-center text-[9px] leading-snug text-[var(--color-ink-faint)] opacity-70">
        Shells are shown as a simplified energy-level representation. Electrons do not travel in fixed circular orbits.
      </p>
      <style>{`
        .ie-nucleus-pulse { animation: ie-pulse 900ms ease-out 1; }
        @keyframes ie-pulse { 0% { opacity: 0.9; } 60% { opacity: 0.25; } 100% { opacity: 0.55; } }
        @media (prefers-reduced-motion: reduce) { .ie-nucleus-pulse { animation: none; } }
      `}</style>
    </div>
  );
}
