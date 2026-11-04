import { useCallback, useEffect, useState } from "react";

function fullscreenIsSupported() {
  if (typeof document === "undefined") return false;
  return Boolean(document.fullscreenEnabled ?? document.documentElement?.requestFullscreen);
}

/** One tiny shared hook wrapping the standards Fullscreen API
 * (requestFullscreen / exitFullscreen) for a given element ref. Tracks
 * the REAL browser fullscreen state via the `fullscreenchange` event --
 * never assumes the toggle button caused every exit, since Escape,
 * browser chrome, or another script can also exit it -- so every
 * consumer of this hook (InteractiveFrame's own layout AND
 * SimulationActions' button) always agrees on the current state.
 * Multiple components can call this with the same targetRef safely: each
 * just derives its own state from the same DOM event/comparison, so they
 * never drift out of sync with each other. */
export function useFullscreen(targetRef) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported] = useState(fullscreenIsSupported);

  useEffect(() => {
    function syncState() {
      setIsFullscreen(Boolean(targetRef.current) && document.fullscreenElement === targetRef.current);
    }
    syncState();
    document.addEventListener("fullscreenchange", syncState);
    return () => document.removeEventListener("fullscreenchange", syncState);
  }, [targetRef]);

  const enter = useCallback(() => {
    targetRef.current?.requestFullscreen?.().catch(() => { /* denied/unsupported -- button simply has no effect */ });
  }, [targetRef]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => { /* nothing else to do */ });
    }
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement === targetRef.current) exit();
    else enter();
  }, [targetRef, enter, exit]);

  return { isFullscreen, isSupported, toggle };
}
