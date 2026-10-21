import { ChartColumn, MoveUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { MODES, MODE_IDS } from "../model.js";
import { ACCENTS } from "../theme.js";

const ICONS = { pv: TrendingDown, vt: TrendingUp, pt: MoveUpRight, vn: ChartColumn };

// Four relationship tabs (role=tablist, roving tabindex, arrow/Home/End keys).
export default function ModeTabs({ mode, onMode, dense }) {
  const move = (i, d) => {
    const next = MODE_IDS[(i + d + MODE_IDS.length) % MODE_IDS.length];
    onMode(next);
    requestAnimationFrame(() => document.getElementById(`gl-tab-${next}`)?.focus());
  };
  return (
    <div role="tablist" aria-label="Gas law relationship" className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="mode-tabs">
      {MODE_IDS.map((id, i) => {
        const m = MODES[id];
        const a = ACCENTS[id];
        const sel = id === mode;
        const Icon = ICONS[id];
        return (
          <button
            key={id} id={`gl-tab-${id}`} type="button" role="tab" aria-selected={sel} tabIndex={sel ? 0 : -1}
            aria-controls="gl-workspace" data-testid={`tab-${id}`}
            onClick={() => onMode(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(i, 1); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); move(i, -1); }
              else if (e.key === "Home") { e.preventDefault(); move(i, -i); }
              else if (e.key === "End") { e.preventDefault(); move(i, MODE_IDS.length - 1 - i); }
            }}
            className={"flex min-w-0 items-center justify-center gap-2.5 rounded-xl border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5] " + (dense ? "px-2.5 py-1" : "px-3 py-2.5")}
            style={sel ? { background: a.solid, borderColor: a.solid, color: "#fff" } : { background: a.tabBg, borderColor: a.border, color: a.text }}
          >
            <Icon size={dense ? 18 : 22} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 text-center leading-tight">
              <span className={"block font-bold " + (dense ? "text-[13px]" : "text-[14.5px]")}>{m.title} ({m.short})</span>
              <span className={"block font-medium " + (dense ? "text-[11px]" : "text-[12px]") + (sel ? " opacity-95" : " opacity-90")}>{m.law}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
