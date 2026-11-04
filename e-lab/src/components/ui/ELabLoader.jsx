import { useEffect, useState } from "react";
import "./ELabLoader.css";

// Uses the ACTUAL e-Lab logo asset (public/branding/e-lab-icon.png) —
// the same file Wordmark.jsx uses elsewhere — never a redrawn or
// reinterpreted flask. Sizes are deliberately small per the brief: normal
// page/component loading sits in the 36-44px range, and even the larger
// "initial app" variant tops out at 56px, nowhere near a centered
// full-screen mark.
const SIZES = {
  compact: 32, // inline/section use (e.g. an interactive loading inside a concept page)
  default: 42, // normal page-level loading (e.g. a protected route resolving)
  app: 52, // the single largest size this loader ever uses
};

/**
 * <ELabLoader />                 indeterminate — logo breathes gently,
 *                                 a couple of small bubbles rise near
 *                                 its neck, no fixed target level.
 * <ELabLoader progress={65} />   same restrained animation; at 100 the
 *                                 loader fades out and calls onComplete.
 * <ELabLoader size="compact|default|app" />
 */
export default function ELabLoader({ progress, size = "default", label = "Loading", onComplete, className = "" }) {
  const isIndeterminate = progress == null;
  const clamped = isIndeterminate ? null : Math.max(0, Math.min(100, progress));
  const isComplete = clamped != null && clamped >= 100;
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!isComplete) return;
    const holdTimer = setTimeout(() => setExiting(true), 300);
    const completeTimer = setTimeout(() => onComplete?.(), 300 + 350);
    return () => { clearTimeout(holdTimer); clearTimeout(completeTimer); };
  }, [isComplete, onComplete]);

  const px = SIZES[size] ?? SIZES.default;
  const ariaLabel = isIndeterminate ? label : `${label}, ${Math.round(clamped)} percent complete`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={`relative inline-flex items-center justify-center ${exiting ? "elab-loader-exit" : ""} ${className}`}
      style={{ width: px, height: px }}
    >
      <img
        src="/branding/e-lab-icon.png"
        alt=""
        aria-hidden="true"
        className="elab-loader-mark h-full w-full object-contain"
        width={px}
        height={px}
      />
      {/* Two small bubbles near the flask's neck — positioned relative to
          the image, never overlapping/obscuring the mark itself. */}
      <span className="elab-loader-bubble absolute rounded-full bg-[#22D3EE]" style={{ width: px * 0.09, height: px * 0.09, top: px * 0.16, left: px * 0.56, animationDuration: "1.3s", animationDelay: "0s" }} />
      <span className="elab-loader-bubble absolute rounded-full bg-[#2563EB]" style={{ width: px * 0.06, height: px * 0.06, top: px * 0.08, left: px * 0.68, animationDuration: "1.6s", animationDelay: "0.4s" }} />
    </div>
  );
}
