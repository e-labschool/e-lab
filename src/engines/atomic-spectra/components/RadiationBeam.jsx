import { wavelengthToCSS } from "../lib/wavelengthColor.js";
import { classifyRegion } from "../lib/photonMath.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

const HEIGHT = 26;

function wavePath(width, period, amplitude, phaseOffset = 0) {
  const points = [];
  const steps = Math.round((width / period) * 24);
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = HEIGHT / 2 + amplitude * Math.sin((2 * Math.PI * x) / period + phaseOffset);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M ${points.join(" L ")}`;
}

/** Real electromagnetic wave trains -- one <path> per spectral line,
 * drawn as an actual sine curve (never a ball/dot travelling along a
 * path). Multiple close lines (the sodium doublet) are drawn with the
 * SAME schematic period -- a genuine 0.6nm difference is invisible at
 * any honest schematic scale, so giving the two lines visibly
 * different periods or spacing would be the exaggeration the brief
 * explicitly warns against. Propagation is shown as gentle continuous
 * motion, switched off under prefers-reduced-motion (a static frame
 * is drawn instead, not merely a paused one). */
export default function RadiationBeam({ lines, width = 130, animate = true }) {
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;
  // Schematic period: shared across all lines passed in so relative
  // spacing on THIS beam is never exaggerated -- based on the mean
  // wavelength of the set, mapped qualitatively (shorter lambda -> tighter).
  const meanNm = lines.reduce((s, l) => s + l.wavelengthNm, 0) / lines.length;
  const period = Math.max(7, Math.min(24, 7 + ((meanNm - 90) / (750 - 90)) * 17));
  const region = classifyRegion(meanNm);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} aria-hidden="true">
        <defs>
          <clipPath id={`beam-clip-${width}`}>
            <rect x="0" y="0" width={width} height={HEIGHT} />
          </clipPath>
        </defs>
        <g clipPath={`url(#beam-clip-${width})`}>
          {lines.map((line, i) => {
            const amp = 7 - i * 1.2;
            const phase = i * 0.9; // small phase stagger so overlapping lines stay visually distinguishable
            const tileWidth = width + period * 2;
            return (
              <g key={i} style={shouldAnimate ? { animation: `atomic-spectra-beam-scroll 1.6s linear infinite`, animationDelay: `${i * -0.1}s` } : undefined}>
                <path d={wavePath(tileWidth, period, amp, phase)} fill="none" stroke={line.color ?? wavelengthToCSS(line.wavelengthNm)} strokeWidth={1.6} opacity={0.9 - i * 0.15} />
                {shouldAnimate && (
                  <path d={wavePath(tileWidth, period, amp, phase)} fill="none" stroke={line.color ?? wavelengthToCSS(line.wavelengthNm)} strokeWidth={1.6} opacity={0.9 - i * 0.15} transform={`translate(${-tileWidth},0)`} />
                )}
              </g>
            );
          })}
        </g>
        <style>{`@keyframes atomic-spectra-beam-scroll { from { transform: translateX(0); } to { transform: translateX(${period * 2}px); } }`}</style>
      </svg>
      {region !== "visible" && (
        <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: "#7a7f94" }}>
          {region === "ultraviolet" ? "Ultraviolet" : "Infrared"}
        </span>
      )}
      <span className="text-center text-[7px] leading-tight text-[var(--color-ink-faint)]">{"Schematic — wavelength not to scale"}</span>
    </div>
  );
}
