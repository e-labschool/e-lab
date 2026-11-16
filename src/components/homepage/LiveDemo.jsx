import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import ELabLoader from "../ui/ELabLoader.jsx";
import SimulationThumb from "../simulation-library/SimulationThumb.jsx";
import SimulationErrorBoundary from "../simulation-library/SimulationErrorBoundary.jsx";
import { SimulationSessionProvider } from "../interactive-shell/simulationSession.js";
import { SIMULATION_COMPONENTS } from "../../data/simulationEngineComponents.js";
import { getFeaturedSimulations } from "../../data/simulationCatalogue.js";
import { canAccess } from "../../lib/access/accessPolicy.js";
import { useAccessConfig } from "../../lib/access/AccessConfigContext.jsx";
import { detectWebGL } from "../../engines/shared-3d/webgl.js";

/** Demos whose stage is WebGL.  Without WebGL the hero keeps the static screenshot and says so, instead of mounting an engine that can only show a notice. */
const NEEDS_WEBGL = new Set(["vsepr-explorer-3d", "hybridisation-explorer", "bonding-visualizer", "intermolecular-forces-visualiser"]);

/** Short chip names for the demo switcher (the full label is the panel title). */
const CHIP = { "build-an-atom": "Build an Atom", "vsepr-explorer-3d": "VSEPR 3D", "phase-change-heating-curve": "Heating & cooling curve", "hybridisation-explorer": "Hybridisation 3D", "collision-theory-visualizer": "Collision theory", "buffer-action-visualizer": "Buffer action", "bonding-visualizer": "Bonding" };

/**
 * The hero's live demo.  NOTHING from any simulation engine is loaded or mounted until the visitor asks for it:
 * before that the panel shows the simulation's static screenshot and a "Run" button.  Pressing Run -- or the hero's
 * "Try a simulation" button, which sets `requested` -- mounts the engine (lazy chunk, behind an error boundary whose
 * fallback is that same screenshot).  The chips switch between the featured simulations; each one only loads when picked.
 * It is public: it lists only featured simulations a signed-out visitor is allowed to open (accessPolicy), and never shows
 * Premium chrome.
 */
export default function LiveDemo({ requested, onRequest }) {
  const { catalogue, config } = useAccessConfig();
  const demos = useMemo(
    () => getFeaturedSimulations(catalogue).filter((e) => SIMULATION_COMPONENTS[e.id] && canAccess(e, { signedIn: false, config })).slice(0, 4),
    [catalogue, config]
  );
  const [activeId, setActiveId] = useState(null);
  const [running, setRunning] = useState(false);
  const current = demos.find((d) => d.id === activeId) ?? demos[0];

  useEffect(() => { if (requested) setRunning(true); }, [requested]);

  // WebGL is probed only once the visitor has asked for the demo (nothing 3D is touched while the page just sits there)
  const gl = useMemo(() => (running ? detectWebGL() : true), [running]);
  const run = useCallback(() => { setRunning(true); onRequest?.(); }, [onRequest]);
  if (!current) return null;
  const Sim = SIMULATION_COMPONENTS[current.id];
  const noGL = running && NEEDS_WEBGL.has(current.id) && !gl;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] shadow-[0_18px_50px_-18px_rgba(20,30,80,0.35)]" data-live-demo data-running={running ? "true" : "false"}>
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--color-line)]" /><i className="h-2.5 w-2.5 rounded-full bg-[var(--color-line)]" /><i className="h-2.5 w-2.5 rounded-full bg-[var(--color-line)]" /></span>
        <p className="min-w-0 flex-1 truncate text-center text-xs font-medium text-[var(--color-ink-soft)]">{current.label}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-teal-soft)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-teal)]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" /> Live demo
        </span>
      </div>

      <div className="relative h-[34rem] bg-[#0F172A] sm:h-[38rem] lg:h-[clamp(32rem,calc(100dvh-9rem),44rem)]" data-demo-stage>
        {running && !noGL ? (
          <div className="h-full w-full overflow-hidden bg-[var(--color-paper)]">
            <SimulationSessionProvider value={`landing:${current.id}`}>
              <SimulationErrorBoundary resetKey={current.id} fallback={<DemoPoster entry={current} note="The live demo could not load here. Try the simulation library instead." />}>
                <Suspense fallback={<div className="flex h-full items-center justify-center"><ELabLoader /></div>}>
                  <Sim key={current.id} standalone />
                </Suspense>
              </SimulationErrorBoundary>
            </SimulationSessionProvider>
          </div>
        ) : (
          <DemoPoster entry={current} onRun={noGL ? undefined : run} note={noGL ? "This 3D demo needs WebGL, which this browser or device does not provide. Open the simulation library to use the 2D tools." : undefined} />
        )}
      </div>

      <div role="group" aria-label="Choose a demo simulation" className="flex flex-wrap gap-2 border-t border-[var(--color-line)] px-4 py-3">
        {demos.map((d) => (
          <button key={d.id} type="button" aria-pressed={d.id === current.id} onClick={() => setActiveId(d.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] ${d.id === current.id ? "border-[#2647C4] bg-[#2647C4] text-white" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/40 hover:text-[var(--color-ink)]"}`}>
            {CHIP[d.id] ?? d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoPoster({ entry, onRun, note }) {
  return (
    <div className="relative h-full w-full">
      <SimulationThumb id={entry.id} src={entry.thumbnail} label={entry.label} eager fit="contain" className="!aspect-auto h-full" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B1220]/55 px-6 text-center">
        {onRun ? (
          <button type="button" onClick={onRun} data-run-demo className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[#12172A] shadow-lg hover:bg-[#EEF1FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220]">
            <Play size={15} aria-hidden="true" /> Run {entry.label}
          </button>
        ) : <p role="status" className="max-w-xs text-sm font-medium text-white">{note}</p>}
        {onRun && <p className="text-xs text-white/80">Runs in your browser. No sign-up needed.</p>}
      </div>
    </div>
  );
}
