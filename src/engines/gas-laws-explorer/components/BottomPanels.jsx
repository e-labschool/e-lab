import { Cog, Lightbulb } from "lucide-react";
import { predictContent } from "../model.js";

const card = "rounded-2xl border shadow-[0_2px_10px_rgba(60,90,150,0.06)] ";

export function PredictPanel({ state, revealed, onToggle, dense }) {
  const c = predictContent(state);
  return (
    <section aria-label="Predict" className={card + "border-[#D8E6FA] bg-[#EEF5FF] " + (dense ? "px-3 py-2" : "px-4 py-3")} data-testid="predict">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-bold leading-tight text-[#14226B]">
          <Lightbulb size={18} className="text-[#2F7BF5]" aria-hidden="true" /> Predict
        </h3>
        <button type="button" onClick={onToggle} aria-expanded={revealed} data-testid="show-answer"
          className="shrink-0 rounded-lg border border-[#CBD6EC] bg-white px-3 py-0.5 text-[12.5px] font-semibold text-[#14226B] shadow-sm hover:bg-[#EEF4FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5]">
          {revealed ? "Hide answer" : "Show answer"}
        </button>
      </div>
      {dense ? (
        // Viewport layout: the answer replaces the question in the same box so the row never grows.
        <div className="mt-0.5 min-h-[3.3em] text-[12.5px] leading-snug text-[#1E2A44]" aria-live="polite">
          {revealed ? (
            <p data-testid="predict-answer"><strong>Answer: </strong>{c.answer}</p>
          ) : (
            <p data-testid="predict-question">{c.question} Try adjusting the slider and observe.</p>
          )}
        </div>
      ) : (
        <>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#1E2A44]" data-testid="predict-question">
            {c.question} Try adjusting the slider and observe.
          </p>
          <div aria-live="polite">
            {revealed && (
              <p className="mt-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-[12.5px] leading-snug text-[#14226B]" data-testid="predict-answer">
                <strong>Answer: </strong>{c.answer}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function WhatIsHappening({ text, accent, dense }) {
  return (
    <section aria-label="What is happening?" className={card + (dense ? "px-3 py-2 " : "px-4 py-3 ")} style={{ background: accent.soft, borderColor: accent.border }}>
      <h3 className="flex items-center gap-2 text-[15px] font-bold leading-tight text-[#14226B]">
        <Cog size={18} style={{ color: accent.solid }} aria-hidden="true" /> What is happening?
      </h3>
      <p className={"mt-1 text-[12.5px] leading-snug text-[#1E2A44] " + (dense ? "min-h-[2.6em]" : "min-h-[3.2em]")} aria-live="polite" aria-atomic="true" data-testid="what-is-happening">
        {text}
      </p>
    </section>
  );
}
