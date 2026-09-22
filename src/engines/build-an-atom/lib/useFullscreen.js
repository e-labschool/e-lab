import { useState, useEffect, useCallback } from "react";

/** Wraps the Fullscreen API for a single element (via a ref), scoped
 * to that one element only -- never the whole Learn page. Tracks the
 * real fullscreen state via the `fullscreenchange` event, so pressing
 * ESC (which the browser handles natively, exiting fullscreen without
 * calling our own exit function) is still correctly reflected in
 * `isFullscreen`, not just clicks on our own button.
 *
 * Falls back to `null`/false-only behaviour if the API is unavailable
 * (e.g. some in-app browsers) -- callers should treat `supported:
 * false` as "use a CSS expanded-mode fallback instead", per the brief. */
export function useFullscreen(elementRef) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const supported = typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === elementRef.current);
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, [elementRef]);

  const enter = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;
    if (supported && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Some browsers reject requestFullscreen outside a direct user
        // gesture or under certain permissions policies -- silently
        // fall back to the CSS expanded mode rather than throwing.
        setIsFullscreen(false);
      });
    }
  }, [elementRef, supported]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  return { isFullscreen, supported, enter, exit };
}
