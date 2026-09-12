import { PALETTE } from "../../particle-model-visualizer/data/palette.js";

const HCL_COLOR = "#D97757";
const NAOH_COLOR = "#6C86EE";

function Dropper({ label, color, falling }) {
  return (
    <div className="relative flex flex-col items-center" style={{ width: 44, height: 66 }}>
      <svg width="20" height="46" viewBox="0 0 20 46" aria-hidden="true">
        <rect x="3" y="0" width="14" height="30" rx="3" fill={PALETTE.panelRaised} stroke={PALETTE.borderStrong} />
        <path d="M3 30 L17 30 L10 42 Z" fill={PALETTE.panelRaised} stroke={PALETTE.borderStrong} />
        <circle cx="10" cy="8" r="3.5" fill={color} opacity="0.85" />
      </svg>
      <span className="mt-0.5 text-[10px] font-semibold" style={{ color }}>{label}</span>

      <div
        className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
        style={{
          top: 40,
          background: color,
          opacity: falling ? 1 : 0,
          transform: falling ? "translate(-50%, 22px)" : "translate(-50%, 0px)",
          transition: falling ? "transform 380ms ease-in, opacity 380ms ease-in" : "none",
        }}
      />
    </div>
  );
}

/**
 * Two compact labelled droppers feeding one shared beaker — deliberately
 * not "two large laboratory setups" side by side; both reagents share
 * the same small water container, since that's what's actually being
 * modelled (one solution, one equilibrium).
 */
export default function DropperBeaker({ fallingReagent, onAddHCl, onAddNaOH, onReset, disabled }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-semibold" style={{ color: PALETTE.textSecondary }}>Reagents + Water</span>

      <div className="flex items-start justify-center gap-6">
        <Dropper label="HCl" color={HCL_COLOR} falling={fallingReagent === "hcl"} />
        <Dropper label="NaOH" color={NAOH_COLOR} falling={fallingReagent === "naoh"} />
      </div>

      <svg width="130" height="115" viewBox="0 0 130 115" aria-hidden="true">
        <path d="M20 10 L20 95 Q20 108 33 108 L97 108 Q110 108 110 95 L110 10" fill="none" stroke={PALETTE.borderStrong} strokeWidth="2.5" />
        <path d="M23 55 L107 55 L107 95 Q107 105 97 105 L33 105 Q23 105 23 95 Z" fill="#3654D6" opacity="0.28" />
        <line x1="14" y1="10" x2="26" y2="10" stroke={PALETTE.borderStrong} strokeWidth="2.5" />
        <line x1="104" y1="10" x2="116" y2="10" stroke={PALETTE.borderStrong} strokeWidth="2.5" />
      </svg>

      <p className="text-[11px]" style={{ color: PALETTE.textFaint }}>Pure Water &middot; 25&deg;C</p>

      <div className="mt-0.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onAddHCl}
          disabled={disabled}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: HCL_COLOR }}
        >
          + Add HCl
        </button>
        <button
          type="button"
          onClick={onAddNaOH}
          disabled={disabled}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: NAOH_COLOR }}
        >
          + Add NaOH
        </button>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="rounded-md border px-2.5 py-1 text-[11px] font-medium"
        style={{ borderColor: PALETTE.borderStrong, color: PALETTE.textSecondary }}
      >
        Reset
      </button>
    </div>
  );
}
