import { wavelengthToPosition, VISIBLE_MIN_NM, VISIBLE_MAX_NM } from "../lib/spectrumMath.js";
import { wavelengthToCSS } from "../lib/wavelengthColor.js";
import { classifyRegion } from "../lib/photonMath.js";

const WIDTH = 300;
const HEIGHT = 34;

/** A compact version of SpectrumDisplay for embedding inside the
 * Energy Levels view -- highlights where the CURRENT transition's
 * photon would sit on the visible spectrum, without redesigning
 * Energy Levels itself. A transition outside 380-750nm (UV/IR) has no
 * honest place on this axis, so it is reported in words instead of a
 * fabricated line position. */
export default function MiniSpectrumStrip({ wavelengthNm }) {
  const region = wavelengthNm != null ? classifyRegion(wavelengthNm) : null;
  const inRange = region === "visible";

  return (
    <div className="w-full">
      <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Where this line sits on the spectrum</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={inRange ? `Spectral line at ${wavelengthNm?.toFixed(1)} nanometres` : "Transition energy corresponds to a wavelength outside the visible range"}>
        <defs>
          <linearGradient id="mini-continuum" x1="0" x2="1" y1="0" y2="0">
            {Array.from({ length: 16 }, (_, i) => {
              const t = i / 15;
              const wl = VISIBLE_MIN_NM + t * (VISIBLE_MAX_NM - VISIBLE_MIN_NM);
              return <stop key={i} offset={t} stopColor={wavelengthToCSS(wl)} />;
            })}
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#mini-continuum)" opacity="0.55" />
        {inRange && (
          <line
            x1={wavelengthToPosition(wavelengthNm) * WIDTH}
            y1="2"
            x2={wavelengthToPosition(wavelengthNm) * WIDTH}
            y2={HEIGHT - 2}
            stroke="#0A0A0C"
            strokeWidth="3"
          />
        )}
        <line x1="0" y1={HEIGHT - 1} x2={WIDTH} y2={HEIGHT - 1} stroke="var(--color-line)" strokeWidth="1" opacity="0.5" />
        <text x="4" y={HEIGHT - 3} fontSize="7" fill="var(--color-ink-faint)">{VISIBLE_MIN_NM} nm</text>
        <text x={WIDTH - 4} y={HEIGHT - 3} textAnchor="end" fontSize="7" fill="var(--color-ink-faint)">{VISIBLE_MAX_NM} nm</text>
      </svg>
      {!inRange && wavelengthNm != null && (
        <p className="mt-0.5 text-center text-[10px] text-[var(--color-ink-faint)]">
          {region === "ultraviolet" ? "Outside the visible range (ultraviolet) — no line shown on this axis" : "Outside the visible range (infrared) — no line shown on this axis"}
        </p>
      )}
    </div>
  );
}
