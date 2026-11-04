import { useEffect } from "react";
import { useSimulationTimeline } from "../lib/simulationTimeline.js";
import { useInView } from "../lib/useInView.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import SimulationControls from "./SimulationControls.jsx";

const DURATION_MS = 9000;

/**
 * Owns ONE timeline instance for the currently selected mixture+method.
 * The parent mounts this with `key={`${mixtureId}-${methodId}`}` so that
 * switching mixture or method fully unmounts/remounts this component --
 * a fresh timeline, fresh progress=0, nothing carried over from the
 * previous selection. This is what guarantees "previous simulation
 * state must be completely discarded" without hand-written reset
 * bookkeeping that could miss a field.
 */
export default function SimulationStage({ SimulationComponent }) {
  const reducedMotion = useReducedMotion();
  const [containerRef, inView] = useInView({ threshold: 0.15 });
  const timeline = useSimulationTimeline({ durationMs: DURATION_MS, reducedMotion, active: inView });

  // Autoplay once the stage first becomes visible -- respects reduced
  // motion (jumps straight to the settled end state) and never restarts
  // just because the student scrolls it in and out of view again.
  useEffect(() => {
    if (inView && timeline.status === "idle") timeline.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return (
    <div ref={containerRef}>
      <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        <SimulationComponent progress={timeline.progress} />
      </div>
      <div className="mt-3">
        <SimulationControls status={timeline.status} onPlay={timeline.play} onPause={timeline.pause} onReplay={timeline.replay} onReset={timeline.reset} />
      </div>
    </div>
  );
}
