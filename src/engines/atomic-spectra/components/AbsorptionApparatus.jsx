import { wavelengthToCSS } from "../lib/wavelengthColor.js";
import { VISIBLE_MIN_NM, VISIBLE_MAX_NM } from "../lib/spectrumMath.js";

const CELL_W = 90;
const CELL_H = 40;

// Same fixed atom-marker layout convention as VapourLampSchematic --
// deterministic, never randomised per render.
const ATOM_POSITIONS = [
  { x: 18, y: 12 }, { x: 34, y: 24 }, { x: 52, y: 10 },
  { x: 66, y: 26 }, { x: 44, y: 30 }, { x: 24, y: 22 },
];

function WhiteLightBulb() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" role="img" aria-label="White light source, a continuous-spectrum broadband source">
      <circle cx="20" cy="16" r="12" fill="#fffef2" stroke="#c9c48a" strokeWidth="1.2" />
      <path d="M 14 26 L 14 30 L 26 30 L 26 26 Z" fill="#8b8f9e" />
      <path d="M 15 30 L 15 34 L 25 34 L 25 34 L 25 30" fill="none" stroke="#8b8f9e" strokeWidth="1.2" />
      <path d="M 15 12 Q 20 20 25 12" fill="none" stroke="#c9a94a" strokeWidth="1" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r1 = 13, r2 = 17;
        const rad = (deg * Math.PI) / 180;
        return (
          <line key={deg} x1={20 + r1 * Math.cos(rad)} y1={16 + r1 * Math.sin(rad)} x2={20 + r2 * Math.cos(rad)} y2={16 + r2 * Math.sin(rad)} stroke="#e8c96b" strokeWidth="1.2" opacity="0.8" />
        );
      })}
    </svg>
  );
}

/** Continuous-spectrum beam: white light genuinely contains every
 * visible wavelength at once, so it is drawn as a real rainbow
 * gradient bar rather than a single schematic wave train (which
 * would misrepresent it as monochromatic). */
function ContinuumBeam({ width = 60 }) {
  const gid = "absorption-continuum-beam";
  return (
    <svg viewBox={`0 0 ${width} 14`} width={width} height="14" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
          {Array.from({ length: 14 }, (_, i) => {
            const t = i / 13;
            const wl = VISIBLE_MIN_NM + t * (VISIBLE_MAX_NM - VISIBLE_MIN_NM);
            return <stop key={i} offset={t} stopColor={wavelengthToCSS(wl)} />;
          })}
        </linearGradient>
      </defs>
      <rect x="0" y="3" width={width} height="8" rx="2" fill={`url(#${gid})`} opacity="0.9" />
    </svg>
  );
}

function GasCellSchematic({ elementName, species }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${CELL_W} ${CELL_H}`} width={CELL_W} height={CELL_H} role="img" aria-label={`Cooler ${elementName} atomic gas cell containing ${species}`}>
        <rect x="4" y="4" width={CELL_W - 8} height={CELL_H - 8} rx="4" fill="rgba(30,32,40,0.35)" stroke="#5a5f70" strokeWidth="1.5" />
        <rect x="4" y="4" width={CELL_W - 8} height={CELL_H - 8} rx="4" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        {ATOM_POSITIONS.map((p, i) => (
          <circle key={i} cx={8 + p.x} cy={6 + p.y} r="1.7" fill="#9aa0b0" opacity="0.75" />
        ))}
      </svg>
      <p className="text-center text-[9px] font-bold text-[var(--color-ink)]">{"Cooler "}{elementName}{" gas"}</p>
      <p className="text-center text-[8px] text-[var(--color-ink-faint)]">{species}{", unexcited"}</p>
    </div>
  );
}

/** Full absorption apparatus: a broadband white-light source shines
 * through a cooler sample of atomic gas (atoms in the ground state,
 * able to absorb only their own characteristic energies) and on into
 * the spectroscope -- distinct from the emission apparatus, which has
 * no white-light source and an electrically-excited lamp instead. */
export default function AbsorptionApparatus({ elementName, species }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div className="flex flex-col items-center gap-1">
        <WhiteLightBulb />
        <p className="text-center text-[9px] font-bold text-[var(--color-ink)]">White light</p>
        <p className="text-center text-[8px] text-[var(--color-ink-faint)]">continuous spectrum</p>
      </div>
      <ContinuumBeam />
      <GasCellSchematic elementName={elementName} species={species} />
      <ContinuumBeam />
    </div>
  );
}
