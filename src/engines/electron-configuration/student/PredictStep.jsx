import { useState } from "react";

const BLOCKS = ["s", "p", "d", "f"];

export default function PredictStep({ config, onContinue }) {
  const [guess, setGuess] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = guess === config.element.block;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Step 1 &middot; Predict</p>
        <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
          Before building it: which block of the periodic table is{" "}
          <strong className="text-[var(--color-ink)]">{config.element.name}</strong> (Z = {config.element.atomicNumber}) in?
        </p>
      </div>

      <div className="flex gap-2">
        {BLOCKS.map((block) => (
          <button
            key={block}
            type="button"
            disabled={submitted}
            onClick={() => setGuess(block)}
            className={`rounded-md border px-4 py-2 text-sm capitalize transition-colors ${
              guess === block
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                : "border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-ink)]"
            } disabled:cursor-not-allowed`}
          >
            {block}-block
          </button>
        ))}
      </div>

      {!submitted ? (
        <button
          type="button"
          disabled={!guess}
          onClick={() => setSubmitted(true)}
          className="self-start rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)] disabled:opacity-40"
        >
          Submit prediction
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className={`text-sm ${isCorrect ? "text-[var(--color-teal)]" : "text-[var(--color-amber)]"}`}>
            {isCorrect
              ? "Correct — now let's build the full configuration."
              : `Not quite — ${config.element.name} is actually ${config.element.block}-block. Let's build it and see why.`}
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="self-start rounded-md border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink)] hover:border-[var(--color-ink)]"
          >
            Continue to construct
          </button>
        </div>
      )}
    </div>
  );
}
