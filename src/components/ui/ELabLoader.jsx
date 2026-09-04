import { useEffect, useState, useId } from "react";
import "./ELabLoader.css";

// The e-Lab flask, redrawn as a clean vector silhouette so it can actually
// animate — the real brand asset (public/branding/e-lab-icon.png) is a
// raster PNG, which can't be clipped/masked for a rising-liquid effect.
// This path deliberately preserves the source icon's defining features
// (a bent, offset neck; straight flaring conical body; rounded thick
// strokes) rather than becoming a generic beaker — same flask, now able
// to move. The real PNG logo elsewhere in the app (Wordmark.jsx) is
// completely untouched.
const FLASK_PATH = "M 38 10 L 60 10 L 60 26 L 78 90 Q 80 98 72 98 L 28 98 Q 20 98 22 90 L 38 26 Z";

const BOTTOM_Y = 95;
const NECK_TOP_Y = 11;
const OVERFLOW_Y = 3;

// Brand blue -> cyan, matching the actual logo's gradient direction —
// defined locally (not the app's muted --color-indigo UI token) since the
// loader IS the logo and should read exactly like it.
const LIQUID_GRADIENT_ID_BASE = "elab-loader-liquid";
const OUTLINE_GRADIENT_ID_BASE = "elab-loader-outline";

const SIZES = {
  default: { width: 96, height: 125 },
  compact: { width: 40, height: 52 },
};

const BUBBLES = [
  { cx: 42, r: 2.2, duration: 2.4, delay: 0 },
  { cx: 55, r: 1.6, duration: 3.1, delay: 0.6 },
  { cx: 48, r: 2.8, duration: 2.8, delay: 1.3 },
  { cx: 60, r: 1.8, duration: 3.6, delay: 0.3 },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * The e-Lab beaker/flask loading indicator.
 *
 * <ELabLoader />                 indeterminate — liquid/bubbles animate
 *                                 naturally, no fixed target level.
 * <ELabLoader progress={65} />   liquid height reflects real progress
 *                                 (0-100); an overflow moment plays at
 *                                 100 before the loader fades away.
 * <ELabLoader size="compact" />  small variant for inline/section use.
 */
export default function ELabLoader({ progress, size = "default", label = "Loading", onComplete, className = "" }) {
  const uid = useId();
  const liquidGradientId = `${LIQUID_GRADIENT_ID_BASE}-${uid}`;
  const outlineGradientId = `${OUTLINE_GRADIENT_ID_BASE}-${uid}`;
  const clipId = `elab-loader-clip-${uid}`;

  const isIndeterminate = progress == null;
  const clamped = isIndeterminate ? null : Math.max(0, Math.min(100, progress));
  const isComplete = clamped != null && clamped >= 100;
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!isComplete) return;
    // Hold briefly so the overflow moment is actually seen, then fade —
    // "smoothly fade/scale the loader away and reveal the page."
    const holdTimer = setTimeout(() => setExiting(true), 550);
    const completeTimer = setTimeout(() => onComplete?.(), 550 + 450);
    return () => { clearTimeout(holdTimer); clearTimeout(completeTimer); };
  }, [isComplete, onComplete]);

  const liquidTopY = isIndeterminate
    ? lerp(BOTTOM_Y, NECK_TOP_Y, 0.62) // base level; the wobble is pure CSS (elab-loader-indeterminate)
    : clamped >= 98
      ? lerp(NECK_TOP_Y, OVERFLOW_Y, (clamped - 98) / 2)
      : lerp(BOTTOM_Y, NECK_TOP_Y, clamped / 98);

  const { width, height } = SIZES[size] ?? SIZES.default;
  const ariaLabel = isIndeterminate ? label : `${label}, ${Math.round(clamped)} percent complete`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={`inline-flex flex-col items-center gap-2 ${exiting ? "elab-loader-exit" : ""} ${className}`}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 130"
        fill="none"
        aria-hidden="true"
        className={isIndeterminate ? "elab-loader-indeterminate" : ""}
      >
        <defs>
          <linearGradient id={liquidGradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <linearGradient id={outlineGradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <clipPath id={clipId}>
            <path d={FLASK_PATH} />
          </clipPath>
        </defs>

        {/* Liquid + bubbles, clipped strictly to the flask's interior */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            className="elab-loader-fill"
            x="14"
            y={liquidTopY}
            width="72"
            height={BOTTOM_Y - liquidTopY + 30}
            fill={`url(#${liquidGradientId})`}
            opacity="0.92"
          />
          <rect className="elab-loader-liquid-surface" x="14" y={liquidTopY - 1.5} width="72" height="3" fill="#22D3EE" opacity="0.65" />

          {BUBBLES.map((b, i) => (
            <circle
              key={i}
              className="elab-loader-bubble"
              cx={b.cx}
              cy={BOTTOM_Y - 6}
              r={b.r}
              fill="#FFFFFF"
              style={{ animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }}
            />
          ))}
        </g>

        {/* Flask outline, drawn on top so the stroke stays crisp over the liquid */}
        <path
          d={FLASK_PATH}
          stroke={`url(#${outlineGradientId})`}
          strokeWidth="4.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Overflow moment — only at true completion, per the brief; restrained, not a splash */}
        {isComplete && (
          <>
            <circle className="elab-loader-overflow-bubble" cx={44} cy={8} r="2" fill="#22D3EE" style={{ animationDelay: "0s" }} />
            <circle className="elab-loader-overflow-bubble" cx={53} cy={6} r="1.5" fill="#FFFFFF" style={{ animationDelay: "0.35s" }} />
          </>
        )}
      </svg>
    </div>
  );
}
