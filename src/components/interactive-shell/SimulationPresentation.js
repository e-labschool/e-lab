import { createContext, useContext } from "react";

// Single shared source of truth for "how is this simulation currently
// being presented?" -- EMBEDDED (inline in a Learn page, or an engine's
// own dev/preview render), FULLSCREEN (native Fullscreen API active on
// this exact InteractiveFrame instance), or STANDALONE (the dedicated
// /simulation/:id "Open in New Tab" route, not fullscreened). Provided by
// InteractiveFrame, which already owns both the real fullscreen state
// (via useFullscreen) and whether it's being asked to render in
// standalone mode -- so an engine that needs to adapt its OWN internal
// layout (e.g. Ionization Energy Explorer's 3-column + graph grid) can
// call useSimulationPresentation() instead of separately inspecting
// document.fullscreenElement or window.location itself. Most engines
// never need this at all: InteractiveFrame's own CSS already handles the
// viewport-height / no-scroll contract for them.
const SimulationPresentationContext = createContext({
  mode: "embedded",
  isEmbedded: true,
  isViewport: false,
  isFullscreen: false,
  isStandalone: false,
});

export const SimulationPresentationProvider = SimulationPresentationContext.Provider;

/** FULLSCREEN and STANDALONE both count as `isViewport` -- the shared
 * "fit the complete simulation in one screen, no page scroll" compact
 * density contract applies identically to both (see InteractiveFrame.jsx
 * and SimulationStandalonePage.jsx). Only `isEmbedded` gets the normal,
 * content-driven Learn-page layout. */
export function useSimulationPresentation() {
  return useContext(SimulationPresentationContext);
}
