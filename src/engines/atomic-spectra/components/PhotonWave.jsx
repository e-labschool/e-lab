import { wavelengthToCSS } from "../lib/wavelengthColor.js";
import { classifyRegion } from "../lib/photonMath.js";

/** A small schematic EM-wave train whose visual spacing qualitatively
 * reflects wavelength (shorter lambda -> tighter wave spacing) --
 * never literal nanometre scale, always labelled schematic. Colour
 * comes from the centralized wavelengthToColor mapping; UV/IR get a
 * neutral schematic tone instead of a fabricated visible colour. */
export default function PhotonWave({ wavelengthNm, direction = "right" }) {
  const region = classifyRegion(wavelengthNm);
  const color = region === "visible" ? wavelengthToCSS(wavelengthNm) : "#7a7f94";
  // Qualitative spacing: map wavelength (roughly 90-750nm across this
  // model's range) to a visual period between ~6 and ~22px -- shorter
  // lambda genuinely draws tighter, longer lambda genuinely draws wider.
  const period = Math.max(6, Math.min(22, 6 + (wavelengthNm - 90) / (750 - 90) * 16));
  const cycles = 6;
  const width = period * cycles;
  const points = [];
  for (let i = 0; i <= cycles * 16; i++) {
    const x = (i / (cycles * 16)) * width;
    const y = 10 + 8 * Math.sin((2 * Math.PI * x) / period);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const path = `M ${points.join(" L ")}`;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg viewBox={`0 0 ${width} 20`} width={Math.min(width, 140)} height="20" style={{ transform: direction === "left" ? "scaleX(-1)" : undefined }}>
        <path d={path} fill="none" stroke={color} strokeWidth="1.8" />
      </svg>
      {region !== "visible" && (
        <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color }}>
          {region === "ultraviolet" ? "Ultraviolet" : "Infrared"}
        </span>
      )}
      <span className="text-[8px] text-[var(--color-ink-faint)]">{"Schematic \u2014 not to scale"}</span>
    </div>
  );
}
