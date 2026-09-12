import { PALETTE } from "../../particle-model-visualizer/data/palette.js";

/**
 * Small on purpose — this is only showing "HCl is being added", not
 * trying to represent particle counts (concentration differences are far
 * too large for that to mean anything visually; the bars do that job).
 */
export default function DropperBeaker({ dropFalling, onAddDrop, onReset, disabled }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: PALETTE.textSecondary }}>HCl + Water</span>

      <div className="relative flex flex-col items-center" style={{ height: 80 }}>
        {/* dropper */}
        <svg width="22" height="70" viewBox="0 0 22 70" aria-hidden="true">
          <rect x="4" y="0" width="14" height="46" rx="3" fill={PALETTE.panelRaised} stroke={PALETTE.borderStrong} />
          <path d="M4 46 L18 46 L11 62 Z" fill={PALETTE.panelRaised} stroke={PALETTE.borderStrong} />
          <circle cx="11" cy="10" r="4" fill="#D97757" opacity="0.85" />
        </svg>

        {/* falling drop */}
        <div
          className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
          style={{
            top: 64,
            background: "#D97757",
            opacity: dropFalling ? 1 : 0,
            transform: dropFalling ? "translate(-50%, 26px)" : "translate(-50%, 0px)",
            transition: dropFalling ? "transform 380ms ease-in, opacity 380ms ease-in" : "none",
          }}
        />
      </div>

      {/* beaker */}
      <svg width="130" height="115" viewBox="0 0 130 115" aria-hidden="true">
        <path d="M20 10 L20 95 Q20 108 33 108 L97 108 Q110 108 110 95 L110 10" fill="none" stroke={PALETTE.borderStrong} strokeWidth="2.5" />
        <path d="M23 55 L107 55 L107 95 Q107 105 97 105 L33 105 Q23 105 23 95 Z" fill="#3654D6" opacity="0.28" />
        <line x1="14" y1="10" x2="26" y2="10" stroke={PALETTE.borderStrong} strokeWidth="2.5" />
        <line x1="104" y1="10" x2="116" y2="10" stroke={PALETTE.borderStrong} strokeWidth="2.5" />
      </svg>

      <p className="text-[11px]" style={{ color: PALETTE.textFaint }}>Pure Water &middot; 25&deg;C</p>

      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onAddDrop}
          disabled={disabled}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          style={{ background: "#3654D6" }}
        >
          Add HCl Drop
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border px-2.5 py-1.5 text-xs font-medium"
          style={{ borderColor: PALETTE.borderStrong, color: PALETTE.textSecondary }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
