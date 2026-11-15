import { Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Container from "../ui/Container.jsx";
import ELabLoader from "../ui/ELabLoader.jsx";
import LockedContent from "./LockedContent.jsx";
import SimulationErrorBoundary from "./SimulationErrorBoundary.jsx";
import { SimulationSessionProvider } from "../interactive-shell/simulationSession.js";
import { SIMULATION_COMPONENTS } from "../../data/simulationEngineComponents.js";
import { getFeaturedSimulations, isLive } from "../../data/simulationCatalogue.js";
import { checkAccess, tierBadge, tierLabel } from "../../lib/access/accessPolicy.js";
import { recordRecentUse } from "../../lib/simulationLibraryModel.js";

/**
 * Shows ONE simulation inside the role layout (/student/simulations/:id, /teacher/simulations/:id).  The engine is the
 * normal lazy engine component rendered in the same `compact` embedded mode the Learn pages use, so its own
 * InteractiveFrame supplies Fullscreen and Open in New Tab exactly once -- this page adds no duplicate buttons.
 * Access is decided by accessPolicy.checkAccess(); a denial shows LockedContent instead of the engine.
 */
export default function SimulationViewer({ role, userId, simulationId, entries, ctx, basePath, components = SIMULATION_COMPONENTS }) {
  const entry = entries.find((e) => e.id === simulationId) ?? null;
  const Sim = entry && isLive(entry) ? components[entry.id] : null;
  const access = entry ? checkAccess(entry, ctx) : { allowed: false, reason: "ok" };
  const allowed = Boolean(Sim) && access.allowed;

  useEffect(() => {
    if (allowed) recordRecentUse(userId, simulationId);
  }, [allowed, userId, simulationId]);

  useEffect(() => {
    if (!entry) return undefined;
    const previous = document.title;
    document.title = `${entry.label} · e-Lab`;
    return () => { document.title = previous; };
  }, [entry]);

  const back = (
    <Link to={basePath} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
      <ArrowLeft size={15} aria-hidden="true" /> Simulations
    </Link>
  );

  if (!entry || !Sim) {
    return (
      <Container className="py-10">
        {back}
        <h1 className="mt-4 font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Simulation not available</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          {entry && !isLive(entry) ? `${entry.label} is not ready yet.` : `We don’t have a simulation called “${simulationId}”.`}
        </p>
      </Container>
    );
  }

  const badge = tierBadge(entry, ctx?.config);
  const meta = [entry.syllabus?.join(", "), entry.topic].filter(Boolean).join(" · ");

  return (
    <Container className="py-5 md:py-6">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {back}
        <h1 className="font-[var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-ink)] md:text-2xl">{entry.label}</h1>
        {meta && <span className="text-sm text-[var(--color-ink-faint)]">{meta}</span>}
        {badge && <span data-tier-badge={badge} className="rounded-full border border-[var(--color-line)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">{tierLabel(badge)}</span>}
      </div>
      {access.allowed ? (
        <SimulationSessionProvider value={`library:${role}:${entry.id}`}>
          <SimulationErrorBoundary resetKey={entry.id}>
            <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><ELabLoader /></div>}>
              <Sim compact />
            </Suspense>
          </SimulationErrorBoundary>
        </SimulationSessionProvider>
      ) : (
        <LockedContent entry={entry} reason={access.reason} backTo={basePath} previews={getFeaturedSimulations(entries).filter((e) => e.id !== entry.id)} />
      )}
    </Container>
  );
}
