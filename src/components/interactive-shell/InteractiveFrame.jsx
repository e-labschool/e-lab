import { useRef } from "react";
import ModeToggle from "../layout/ModeToggle.jsx";
import SimulationActions from "./SimulationActions.jsx";
import { useFullscreen } from "./useFullscreen.js";
import { getSimulationIdForTitle } from "../../data/simulationRegistry.js";
import { SimulationPresentationProvider } from "./SimulationPresentation.js";
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
//
// `standalone` is passed only by SimulationStandalonePage (the "Open in
// New Tab" destination). It and real browser Full Screen are the two ways
// a student can end up looking at ONE simulation filling ONE screen, and
// both must behave identically: the whole point of "full screen" is never
// "make everything bigger", it's "use the whole viewport, fit the entire
// simulation in it, no page scrolling". Both therefore switch this frame
// into VIEWPORT MODE (see SimulationPresentation.js) — a height-
// constrained CSS Grid (`auto` header row + `minmax(0,1fr)` content row,
// `min-height:0` propagated down) instead of the normal content-driven
// height an embedded Learn-page block uses. The content row keeps a
// contained `overflow-y-auto` as a safety net for any simulation whose
// internal layout hasn't been given a dedicated compact-viewport pass —
// so the OUTER PAGE never scrolls even then — but an engine that DOES
// read `useSimulationPresentation()` and lay itself out to genuinely fit
// (Ionization Energy Explorer is the reference implementation) never
// triggers that fallback at normal desktop/laptop sizes.
export default function InteractiveFrame({ title, subtitle, children, compact = false, standalone = false }) {
  const frameRef = useRef(null);
  const { isFullscreen } = useFullscreen(frameRef);
  const simulationId = getSimulationIdForTitle(title);
  const isViewport = isFullscreen || standalone;
  const showFullHeader = !compact || isViewport;
  const mode = isFullscreen ? "fullscreen" : standalone ? "standalone" : "embedded";

  return (
    <SimulationPresentationProvider
      value={{ mode, isEmbedded: !isViewport, isViewport, isFullscreen, isStandalone: mode === "standalone" }}
    >
      <div
        ref={frameRef}
        className={
          "border border-[var(--color-line)] bg-[var(--color-paper)] [&:fullscreen]:border-none [&:fullscreen]:bg-[var(--color-paper)] " +
          (isViewport
            ? // VIEWPORT MODE (fullscreen or standalone): fixed-height grid,
              // never taller than the viewport, never scrolling as a whole.
              // Three rows: header (auto), content (the only row allowed to
              // grow/shrink), tiny copyright line (auto).
              "grid h-full max-h-full w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md [&:fullscreen]:h-[100dvh] [&:fullscreen]:max-h-[100dvh] [&:fullscreen]:w-screen [&:fullscreen]:rounded-none"
            : // EMBEDDED: unchanged, ordinary content-driven height.
              "rounded-md [&:fullscreen]:flex [&:fullscreen]:h-[100dvh] [&:fullscreen]:w-screen [&:fullscreen]:flex-col [&:fullscreen]:overflow-hidden [&:fullscreen]:rounded-none")
        }
      >
        {showFullHeader ? (
          <div
            className={
              "flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] " +
              (isViewport ? "px-4 py-2" : "px-5 py-3.5")
            }
          >
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

        {isViewport ? (
          // Content row is the grid's `minmax(0,1fr)` row: it SHRINKS to
          // whatever's left after the header, never grows the frame past
          // the viewport. `min-h-0` is required here because without it a
          // grid item still refuses to shrink below its content's
          // intrinsic size, which is exactly what caused the previous
          // overflow. `overflow-y-auto` here is a last-resort safety net,
          // not the intended path -- see the file-level comment above.
          <div className="min-h-0 overflow-y-auto p-2.5 sm:p-3">{children}</div>
        ) : (
          <div className={showFullHeader ? "p-5 md:p-7" : "p-0"}>{children}</div>
        )}

        {/* Placed as its own row AFTER the interactive content, never
            absolutely positioned over it -- guarantees it can never
            overlap graphs/controls/particles/etc regardless of what a
            given engine renders. Kept as a real (shrink-to-fit) grid row
            in viewport mode too, so it never eats into the content row's
            available height beyond its own tiny actual size. */}
        <div className={"flex shrink-0 justify-end px-3 " + (isViewport ? "py-0.5" : "pb-2")}>
          <CopyrightNotice variant="simulation" />
        </div>
      </div>
    </SimulationPresentationProvider>
  );
}
