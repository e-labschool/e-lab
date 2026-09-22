import { useState } from "react";
import { CHALLENGES, checkChallenge, pickNextChallenge } from "../lib/challenges.js";

function FeedbackRow({ label, correct, hint }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={correct ? "text-[var(--color-teal)]" : "text-[var(--color-coral)]"}>{correct ? "\u2713" : "\u2717"}</span>
      <span className="font-medium text-[var(--color-ink)]">{label}</span>
      {!correct && hint && <span className="text-[var(--color-ink-faint)]">{"\u2014 "}{hint}</span>}
    </div>
  );
}

/** Always-visible "Build This Atom / Ion" task -- there is no separate
 * Explore/Challenge mode toggle; free exploration is just the
 * simulation itself, and this card offers an optional task alongside
 * it using the SAME +/- controls, never its own separate input. */
export default function ChallengeMode({ atom, derived }) {
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null); // null until Check is pressed for the CURRENT attempt
  const challenge = CHALLENGES[index];

  function handleCheck() {
    setResult(checkChallenge(challenge, atom));
  }

  function handleNext() {
    setIndex((i) => pickNextChallenge(i));
    setResult(null);
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"\uD83C\uDFAF Build This Atom / Ion"}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{challenge.prompt}</p>

      <div className="mt-2 flex gap-2">
        <button type="button" onClick={handleCheck} className="rounded-md bg-[var(--color-indigo)] px-3 py-1.5 text-xs font-semibold text-white">
          Check
        </button>
        <button type="button" onClick={handleNext} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
          New Challenge
        </button>
      </div>

      {result && (
        <div className="mt-2 rounded-lg p-2.5" style={{ backgroundColor: result.correct ? "var(--color-teal-soft)" : "var(--color-coral-soft)" }}>
          <p className="text-sm font-bold" style={{ color: result.correct ? "var(--color-teal)" : "var(--color-coral)" }}>
            {result.correct ? "\u2713 CORRECT!" : "NOT YET"}
          </p>
          <div className="mt-1 space-y-0.5">
            <FeedbackRow label={`Protons: ${atom.protons}`} correct={result.protonsCorrect} hint="Check the atomic number." />
            <FeedbackRow label={`Neutrons: ${atom.neutrons}`} correct={result.neutronsCorrect} hint="Check the mass number." />
            <FeedbackRow label={`Electrons: ${atom.electrons}`} correct={result.electronsCorrect} hint="Check the charge." />
          </div>
          {result.correct && derived.nuclideName && (
            <p className="mt-1.5 text-xs font-semibold text-[var(--color-ink)]">
              You built: {derived.nuclideName}
              {derived.netCharge !== 0 ? ` (${derived.netCharge > 0 ? "+" : ""}${derived.netCharge})` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
