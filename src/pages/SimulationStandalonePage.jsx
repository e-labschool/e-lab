import { Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { SIMULATION_REGISTRY } from "../data/simulationRegistry.js";
import { SIMULATION_COMPONENTS } from "../data/simulationEngineComponents.js";
import ELabLoader from "../components/ui/ELabLoader.jsx";

// The "Open in New Tab" destination -- a dedicated, standalone route
// (/simulation/:simulationId) rather than reopening the whole Student
// Learn chapter around it. Deliberately minimal chrome: just enough
// e-Lab identity to orient the student, then the simulation itself
// (rendered through the SAME InteractiveFrame shell every engine already
// uses, so it gets its own title/subtitle header and Full Screen control
// automatically -- nothing simulation-specific lives in this page).
//
// Reads BOTH the simulation id -> component map and the id -> label
// registry that Learn's CMS block picker also reads (see
// simulationRegistry.js / simulationEngineComponents.js), so a simulation
// only needs to be registered in one place to be reachable both ways.
//
// VIEWPORT MODE: this page's own outer shell fills exactly one screen
// (`h-[100dvh]`, `overflow-hidden`) and is itself the "no document-level
// scroll" boundary -- it never stacks its own header on top of a second
// Learn-page header plus a third simulation header (see practical
// guidance #4 in the fix that introduced this). Its header row is a
// single compact line, then the simulation fills every remaining pixel
// via `standalone` -- which InteractiveFrame reads (alongside real
// browser Full Screen) to switch into the same compact, height-
// constrained "viewport" layout either way. See
// components/interactive-shell/SimulationPresentation.js.
export default function SimulationStandalonePage() {
  const { simulationId } = useParams();
  const meta = SIMULATION_REGISTRY[simulationId];
  const Sim = SIMULATION_COMPONENTS[simulationId];

  if (!meta || !Sim) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--color-paper)] px-6 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          We don&rsquo;t have a simulation called &ldquo;{simulationId}&rdquo;.
        </p>
        <Link to="/" className="text-sm font-medium text-[var(--color-indigo)] underline">
          Back to e-Lab
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-[var(--color-paper)]">
      <header className="flex shrink-0 items-center border-b border-[var(--color-line)] px-4 py-1.5 sm:px-6">
        <Link to="/" className="font-[var(--font-display)] text-sm font-semibold tracking-tight text-[var(--color-ink)]">
          e-Lab
        </Link>
        <span className="ml-2 text-xs text-[var(--color-ink-faint)]">Standalone simulation view</span>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden px-2 py-2 sm:px-3">
        {/* No `compact` prop here -- this is exactly the "not embedded in
            a Learn page" case, so the engine's own InteractiveFrame shows
            its full title/subtitle header plus Simulation Actions.
            `standalone` puts the engine's InteractiveFrame into the same
            compact viewport layout Full Screen uses. */}
        <Suspense fallback={<div className="flex h-full items-center justify-center"><ELabLoader /></div>}>
          <Sim standalone />
        </Suspense>
      </main>
    </div>
  );
}
