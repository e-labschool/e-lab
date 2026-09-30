import { useRef } from "react";
import ModeToggle from "../layout/ModeToggle.jsx";
import SimulationActions from "./SimulationActions.jsx";
import { useFullscreen } from "./useFullscreen.js";
import { getSimulationIdForTitle } from "../../data/simulationRegistry.js";
import CopyrightNotice from "../layout/CopyrightNotice.jsx";

// The shared wrapper every engine renders inside. Handles chrome common to
// ALL interactives (title, mode toggle, fullscreen, open-in-new-tab) so
// new engines inherit consistent presentation for free. Interactive-
// specific teacher/student controls are NOT here — they live inside each
// engine's own teacher/ and student/ folders and render as `children`.
//
// `compact` (used when an engine renders inline inside a Student Learn
// page block) normally hides the title/subtitle header entirely to save
// space. It's overridden back on whenever this exact instance is
// currently fullscreen: entering Full Screen from an embedded Learn-page
// simulation turns it into the same full "dedicated learning environment"
// header the standalone /simulation/:id view gets, then reverts the
// moment fullscreen exits (via the real fullscreenchange event, so Escape
// / browser chrome / another script exiting fullscreen is handled exactly
// like the button) — all without unmounting `children`, so simulation
// state is never reset by entering/exiting.
export default function InteractiveFrame({ title, subtitle, children, compact = false }) {
  const frameRef = useRef(null);
  const { isFullscreen } = useFullscreen(frameRef);
  const simulationId = getSimulationIdForTitle(title);
  const showFullHeader = !compact || isFullscreen;

  return (
    <div
      ref={frameRef}
      className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] [&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:flex-col [&:fullscreen]:overflow-y-auto [&:fullscreen]:rounded-none [&:fullscreen]:border-none [&:fullscreen]:bg-[var(--color-paper)] [&:fullscreen]:p-0"
    >
      {showFullHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-medium text-[var(--color-ink)]">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--color-ink-faint)]">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2.5">
            <ModeToggle compact />
            <SimulationActions targetRef={frameRef} simulationId={simulationId} />
          </div>
        </div>
      ) : (
        <div className="flex justify-end px-2 pt-2">
          <SimulationActions targetRef={frameRef} simulationId={simulationId} />
        </div>
      )}
      <div className={showFullHeader ? "p-5 md:p-7" : "p-0"}>{children}</div>
      {/* Placed as its own row AFTER the interactive content, never
          absolutely positioned over it -- guarantees it can never
          overlap graphs/controls/particles/etc regardless of what a
          given engine renders. */}
      <div className="flex justify-end px-3 pb-2">
        <CopyrightNotice variant="simulation" />
      </div>
    </div>
  );
}
