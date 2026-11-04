import { useState } from "react";
import { Droplet, ZoomIn } from "lucide-react";
import { ModelNotice } from "./AnalogyBlock.jsx";

// A simple, original, step-through "zoom in" sequence — deliberately built
// with CSS/SVG rather than photographs (never implying the final particle
// scene is an actual microscope image, per the brief).
export default function ZoomSequenceVisual({ steps, observeLabel, observe, modelLabel, model }) {
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;
  const scale = 1 + step * 0.6;

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
      <div className="flex h-52 items-center justify-center overflow-hidden rounded-md bg-[var(--color-indigo-soft)]">
        {!isLast ? (
          <div className="flex flex-col items-center gap-2 transition-transform duration-500" style={{ transform: `scale(${scale})` }}>
            <Droplet size={40} className="text-[var(--color-indigo)]" strokeWidth={1.5} />
          </div>
        ) : (
          <svg viewBox="0 0 200 120" className="h-40 w-64" role="img" aria-label="Simplified particle model">
            {Array.from({ length: 24 }, (_, i) => (
              <circle
                key={i}
                cx={20 + (i % 6) * 30 + (Math.floor(i / 6) % 2 === 0 ? 0 : 12)}
                cy={20 + Math.floor(i / 6) * 25}
                r="7"
                fill="var(--color-indigo)"
                opacity="0.85"
              />
            ))}
          </svg>
        )}
      </div>

      <p className="mt-3 text-center text-sm font-medium text-[var(--color-ink)]">{steps[step]}</p>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}
          disabled={isLast}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-indigo)] disabled:cursor-default disabled:opacity-40"
        >
          <ZoomIn size={15} /> {isLast ? "Fully zoomed in" : "Zoom in"}
        </button>
      </div>

      {isLast && (
        <div className="mt-5 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{observeLabel}</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink)]">{observe}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{modelLabel}</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink)]">{model}</p>
          </div>
        </div>
      )}
      <ModelNotice>This zoom sequence is illustrative, not an actual microscope image.</ModelNotice>
    </div>
  );
}
