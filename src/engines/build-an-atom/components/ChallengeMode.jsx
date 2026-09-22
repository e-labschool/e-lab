import { useState, useMemo } from "react";
import { CHALLENGES } from "../lib/challenges.js";

export default function ChallengeMode({ derived, active, onToggle }) {
  const [challengeIndex, setChallengeIndex] = useState(0);
  const challenge = CHALLENGES[challengeIndex];
  const isCorrect = useMemo(() => (active && derived.protons > 0 ? challenge.check(derived) : false), [active, derived, challenge]);

  function nextChallenge() {
    setChallengeIndex((i) => (i + 1) % CHALLENGES.length);
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Mode</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onToggle(false)}
            aria-pressed={!active}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${!active ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
          >
            Explore
          </button>
          <button
            type="button"
            onClick={() => onToggle(true)}
            aria-pressed={active}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${active ? "bg-[var(--color-teal)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
          >
            Challenge
          </button>
        </div>
      </div>

      {active && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-[var(--color-ink)]">{challenge.prompt}</p>
          {isCorrect ? (
            <div className="mt-2 rounded-lg bg-[var(--color-teal-soft)] p-2.5">
              <p className="text-sm font-bold text-[var(--color-teal)]">{"\u2713 Excellent!"}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{challenge.explain(derived)}</p>
              <button type="button" onClick={nextChallenge} className="mt-2 rounded-md bg-[var(--color-teal)] px-3 py-1 text-xs font-semibold text-white">
                Next Challenge
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">Adjust the particles to match the task.</p>
          )}
        </div>
      )}
    </div>
  );
}
