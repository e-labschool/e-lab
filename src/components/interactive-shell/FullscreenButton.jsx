import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";

export default function FullscreenButton({ targetRef }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === targetRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [targetRef]);

  function toggleFullscreen() {
    if (!targetRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      targetRef.current.requestFullscreen?.();
    }
  }

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
    >
      {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
    </button>
  );
}
