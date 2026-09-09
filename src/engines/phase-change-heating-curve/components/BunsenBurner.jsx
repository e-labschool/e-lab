import { PALETTE } from "../../particle-model-visualizer/data/palette.js";

/**
 * A quiet visual cue that heat is being supplied — small on purpose, so it
 * never competes with the particle chamber for attention. `active` pauses
 * the flame flicker during the final held frame (no more energy is being
 * added once the animation has finished).
 */
export default function BunsenBurner({ active = true }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 60 56" width="44" height="41" aria-hidden="true">
        <g style={{ animationPlayState: active ? "running" : "paused" }} className="pcburner-flame">
          <path d="M30 6 C24 14 21 20 21 27 C21 34 25 38 30 38 C35 38 39 34 39 27 C39 20 36 14 30 6 Z" fill="#5AB0E8" opacity="0.55" />
          <path d="M30 14 C26 20 24 24 24 29 C24 34 27 37 30 37 C33 37 36 34 36 29 C36 24 34 20 30 14 Z" fill="#EFA23F" />
          <path d="M30 22 C28 25 27 27 27 30 C27 33 28 35 30 35 C32 35 33 33 33 30 C33 27 32 25 30 22 Z" fill="#F6D268" />
        </g>
        <rect x="26" y="38" width="8" height="6" fill={PALETTE.borderStrong} />
        <path d="M14 44 L46 44 L42 52 L18 52 Z" fill={PALETTE.panelRaised} stroke={PALETTE.border} strokeWidth="1" />
        <rect x="8" y="52" width="44" height="3" rx="1.5" fill={PALETTE.borderStrong} />
      </svg>
      <p className="text-[9px] font-medium uppercase tracking-wide" style={{ color: PALETTE.textFaint }}>
        Heat source
      </p>

      <style>{`
        .pcburner-flame {
          transform-origin: 30px 38px;
          animation: pcburner-flicker 1.1s ease-in-out infinite;
        }
        @keyframes pcburner-flicker {
          0% { transform: scaleY(1) scaleX(1); opacity: 1; }
          30% { transform: scaleY(1.08) scaleX(0.97); opacity: 0.92; }
          60% { transform: scaleY(0.94) scaleX(1.03); opacity: 1; }
          100% { transform: scaleY(1) scaleX(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
