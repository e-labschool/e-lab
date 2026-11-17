import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import PredictChoice from "./PredictChoice.jsx";

// The recurring "ask -> click -> reveal" unit used throughout this
// interactive. Owns its own local revealed state, but also listens for the
// orchestrator's "Reveal All" signal (forceToken) so the persistent toolbar
// can fast-forward everything in the current scene at once.
export default function RevealChip({ label, children, forceToken, defaultRevealed = false, predict = null }) {
  const [revealed, setRevealed] = useState(defaultRevealed);
  const [answered, setAnswered] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (forceToken) setRevealed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceToken]);

  if (predict) {
    // Predict step: the choices come first; the answer is shown once the student commits (or asks to just see it).
    return (
      <div className="flex flex-col gap-2">
        {!skipped && !(revealed && !answered) && (
          <PredictChoice
            question={predict.question} choices={predict.choices} correct={predict.correct} testId={predict.testId ?? "predict"}
            onAnswer={() => { setAnswered(true); setRevealed(true); }} onSkip={() => { setSkipped(true); setRevealed(true); }}
          />
        )}
        {revealed && <div className="animate-in fade-in">{children}</div>}
      </div>
    );
  }
  if (revealed) {
    return <div className="animate-in fade-in">{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3.5 py-2 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
    >
      {label}
      <ChevronRight size={14} className="text-[var(--color-ink-faint)]" />
    </button>
  );
}
