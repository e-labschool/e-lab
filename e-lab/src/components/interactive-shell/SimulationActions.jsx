import { ExternalLink, Maximize, Minimize } from "lucide-react";
import { useFullscreen } from "./useFullscreen.js";
import "./simulation-controls.css";

function openSimulationInNewTab(simulationId) {
  if (!simulationId) return;
  // Safe by construction: simulationId only ever comes from the
  // SIMULATION_REGISTRY (never user input), and window.open is called
  // with noopener,noreferrer so the new tab gets no back-reference to
  // this window.
  window.open(`/simulation/${simulationId}`, "_blank", "noopener,noreferrer");
}

// Shared control style (src/components/interactive-shell/simulation-controls.css): a solid fill, a >= 3:1
// boundary, visible hover / active / disabled / focus-visible states, on light AND dark surfaces.
const actionButtonCls = "sim-toolbar-btn";

/** The reusable "Open in New Tab" / "Full Screen" pair every e-Lab
 * simulation gets for free, rendered once inside InteractiveFrame (the
 * shared simulation shell) rather than copy-pasted into each engine.
 *
 * - `targetRef` is the element Full Screen expands -- InteractiveFrame's
 *   own root container, i.e. the WHOLE simulation workspace, never just
 *   one inner canvas.
 * - `simulationId` is resolved by InteractiveFrame from the shared
 *   SIMULATION_REGISTRY (see simulationRegistry.js). When it can't be
 *   resolved for a given engine, "Open in New Tab" simply doesn't
 *   render -- Full Screen still does, since it needs no id.
 *
 * Secondary interface chrome: a clearly outlined, solid-fill button (never
 * white-on-white) that still reads as secondary next to an engine's own
 * primary action button.
 * Labels collapse to icon-only + a native tooltip below the `sm`
 * breakpoint; aria-labels are always present regardless. */
export default function SimulationActions({ targetRef, simulationId, iconOnly = false }) {
  const labelCls = iconOnly ? "hidden" : "hidden sm:inline";
  const { isFullscreen, isSupported, toggle } = useFullscreen(targetRef);

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {simulationId && (
        <button
          type="button"
          onClick={() => openSimulationInNewTab(simulationId)}
          aria-label="Open simulation in new tab"
          title="Open in new tab"
          className={actionButtonCls}
        >
          <ExternalLink size={14} aria-hidden="true" />
          <span className={labelCls}>Open in New Tab</span>
        </button>
      )}
      {isSupported && (
        <button
          type="button"
          onClick={toggle}
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          className={actionButtonCls}
        >
          {isFullscreen ? <Minimize size={14} aria-hidden="true" /> : <Maximize size={14} aria-hidden="true" />}
          <span className={labelCls}>{isFullscreen ? "Exit Full Screen" : "Full Screen"}</span>
        </button>
      )}
    </div>
  );
}
