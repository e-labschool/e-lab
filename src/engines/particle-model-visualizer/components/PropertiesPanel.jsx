import { Box, Droplet, Wind } from "lucide-react";
import { STATE_INFO } from "../data/stateInfo.js";
import { PALETTE, STATE_ACCENT } from "../data/palette.js";

const STATE_ICON = { solid: Box, liquid: Droplet, gas: Wind };

/**
 * The right-hand (desktop) / stacked-below (mobile) panel. Updates with
 * `state` so a student who just switched to LIQUID sees the liquid
 * properties right beside the liquid animation, not a separate static list.
 */
export default function PropertiesPanel({ state }) {
  const info = STATE_INFO[state];
  const Icon = STATE_ICON[state];
  const accent = STATE_ACCENT[state];

  return (
    <div
      className="flex h-full flex-col gap-3 rounded-lg border px-4 py-3.5"
      style={{ borderColor: PALETTE.border, background: PALETTE.panel }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide" style={{ color: PALETTE.textPrimary }}>
            {info.label.toUpperCase()}
          </p>
          <p className="truncate text-[11px]" style={{ color: PALETTE.textSecondary }}>
            {info.tagline}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {info.properties.map((prop) => (
          <li key={prop} className="flex gap-2 text-[12.5px] leading-snug" style={{ color: "#C3C9D9" }}>
            <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
            <span>{prop}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
