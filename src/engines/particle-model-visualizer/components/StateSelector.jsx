import { STATE_INFO, STATE_ORDER } from "../data/stateInfo.js";
import { PALETTE, STATE_ACCENT } from "../data/palette.js";

export default function StateSelector({ state, onChange }) {
  return (
    <div className="flex gap-1 rounded-md p-1" style={{ background: PALETTE.panel }}>
      {STATE_ORDER.map((s) => {
        const active = s === state;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={active}
            className="rounded px-3 py-1 text-xs font-medium tracking-wide transition-colors"
            style={{
              background: active ? STATE_ACCENT[s] : "transparent",
              color: active ? "#0B0E15" : PALETTE.textSecondary,
            }}
          >
            {STATE_INFO[s].label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
