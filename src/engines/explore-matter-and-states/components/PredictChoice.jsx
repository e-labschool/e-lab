import { useId, useState } from "react";
import { usePredictTally } from "./predictTally.js";

// "Predict, then observe" (GS-27): the student commits to one of a few answers BEFORE the observation is shown.
// onAnswer(guessId, correct) runs once. `skip` (optional) lets them look without guessing; skipped looks are not scored.
export default function PredictChoice({ question, choices, correct, onAnswer, onSkip, disabled = false, testId = "predict" }) {
  const gid = useId();
  const tally = usePredictTally();
  const [guess, setGuess] = useState(null);
  const pick = (c) => {
    if (guess || disabled) return;
    setGuess(c.id);
    const ok = c.id === correct;
    tally.record(ok);
    onAnswer?.(c.id, ok);
  };
  const right = guess != null && guess === correct;
  return (
    <div role="group" aria-labelledby={gid} className="rounded-md border border-dashed border-[var(--color-line)] px-3 py-2" data-testid={testId}>
      <p id={gid} className="mb-1.5 text-sm font-medium text-[var(--color-ink)]">Predict first: {question}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c)}
            aria-pressed={guess === c.id}
            disabled={disabled || (guess != null && guess !== c.id)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-default ${guess === c.id ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" : "border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-ink)] disabled:opacity-40"}`}
            data-testid={`${testId}-${c.id}`}
          >
            {c.label}
          </button>
        ))}
        {guess == null && onSkip && (
          <button type="button" onClick={onSkip} className="px-2 py-1.5 text-xs text-[var(--color-ink-soft)] underline underline-offset-2" data-testid={`${testId}-skip`}>
            Just show me
          </button>
        )}
      </div>
      {guess != null && (
        <p role="status" className="mt-1.5 text-sm" data-testid={`${testId}-feedback`}>
          {right ? "Your prediction matches what is observed." : `Not this time: the observation is "${choices.find((c) => c.id === correct)?.label}".`}
        </p>
      )}
    </div>
  );
}
