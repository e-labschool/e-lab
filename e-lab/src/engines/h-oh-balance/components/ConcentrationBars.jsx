import { barFraction } from "../lib/math.js";
import { formatScientific } from "../../ph-calculator-visualizer/lib/ph.js";
import { PALETTE, STATE_ACCENT } from "../../particle-model-visualizer/data/palette.js";

const BAR_HEIGHT = 180;
const BAR_WIDTH = 80;

function Bar({ label, conc, accent }) {
  const fraction = barFraction(conc);
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: PALETTE.textSecondary }}>{label}</span>
      <div
        className="relative flex items-end overflow-hidden rounded-md border"
        style={{ width: BAR_WIDTH, height: BAR_HEIGHT, borderColor: PALETTE.border, background: PALETTE.panel }}
      >
        <div
          className="w-full transition-[height] duration-500 ease-out"
          style={{ height: `${fraction * 100}%`, background: accent }}
        />
      </div>
      <span className="text-[11px] font-medium tabular-nums" style={{ color: PALETTE.textPrimary }}>{formatScientific(conc)}</span>
      <span className="text-[10px]" style={{ color: PALETTE.textFaint }}>mol dm⁻³</span>
    </div>
  );
}

/**
 * Two concentration indicators, not a graph — deliberately no axes, no
 * plotted point, no crosshair. Bar height is a direct logarithmic
 * mapping of concentration (see barFraction), so equal concentrations
 * always read as visually equal bars regardless of their absolute value.
 */
export default function ConcentrationBars({ hConc, ohConc }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-semibold" style={{ color: PALETTE.textPrimary }}>Concentration Balance</p>
      <div className="flex items-end" style={{ gap: 48 }}>
        <Bar label="[H⁺]" conc={hConc} accent={STATE_ACCENT.gas} />
        <Bar label="[OH⁻]" conc={ohConc} accent={STATE_ACCENT.liquid} />
      </div>
    </div>
  );
}
