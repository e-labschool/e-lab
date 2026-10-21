import { Lightbulb } from "lucide-react";

// Short, state-aware explanation (chosen by model.selectExplanation, debounced
// by the parent). aria-live="polite" so screen readers get settled updates.
export default function WhatIsHappening({ text, dense }) {
  return (
    <section
      aria-label="What Is Happening?"
      className={"rounded-2xl border border-[#E3EAF6] bg-white/90 shadow-[0_2px_10px_rgba(60,90,150,0.07)] " + (dense ? "px-3 py-2" : "px-4 py-3")}
    >
      <h3 className="flex items-center gap-2 text-[15px] font-bold leading-tight text-[#14226B]">
        <Lightbulb size={18} className="text-[#2F7BF5]" aria-hidden="true" />
        What Is Happening?
      </h3>
      <p
        className={"mt-1.5 rounded-lg bg-[#EAF2FE] px-3 text-[13px] leading-snug text-[#1E2A44] " + (dense ? "py-1.5 min-h-[3.4em]" : "py-2 min-h-[3.8em]")}
        aria-live="polite"
        aria-atomic="true"
        data-testid="what-is-happening"
      >
        {text}
      </p>
    </section>
  );
}
