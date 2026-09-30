import { Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { SIMULATION_REGISTRY } from "../data/simulationRegistry.js";
import { SIMULATION_COMPONENTS } from "../data/simulationEngineComponents.js";
import Container from "../components/ui/Container.jsx";
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
    <div className="min-h-screen bg-[var(--color-paper)]">
      <header className="border-b border-[var(--color-line)] px-4 py-3 sm:px-6">
        <Link to="/" className="font-[var(--font-display)] text-sm font-semibold tracking-tight text-[var(--color-ink)]">
          e-Lab
        </Link>
        <span className="ml-2 text-xs text-[var(--color-ink-faint)]">Standalone simulation view</span>
      </header>
      <Container as="main" className="py-6 sm:py-8">
        {/* No `compact` prop here -- this is exactly the "not embedded in
            a Learn page" case, so the engine's own InteractiveFrame shows
            its full title/subtitle header plus Simulation Actions. */}
        <Suspense fallback={<div className="flex justify-center py-16"><ELabLoader /></div>}>
          <Sim />
        </Suspense>
      </Container>
    </div>
  );
}
