import { useState } from "react";
import { CheckCircle2, Lightbulb, Beaker } from "lucide-react";

const METHODS = ["Filtration", "Solvation", "Evaporation", "Distillation", "Recrystallization", "Paper chromatography"];

const CHALLENGES = [
  {
    id: "sand-water", title: "Sand + Water", goal: "Separate the sand from the water.",
    correct: "Filtration", hint: "Sand is insoluble in water — think about what physically holds the solid back.",
    reveal: <FiltrationResult />,
  },
  {
    id: "salt-water-recover-salt", title: "Salt + Water", goal: "Recover the dissolved salt.",
    correct: "Evaporation", hint: "You only need to keep the salt — the water itself doesn't need to be collected.",
    reveal: <EvaporationResult />,
  },
  {
    id: "salt-water-collect-water", title: "Salt + Water", goal: "This time, collect the water too.",
    correct: "Distillation", hint: "You need the liquid AND to recover it separately — think about vaporizing then condensing.",
    reveal: <DistillationResult />,
  },
];

function FiltrationResult() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <svg viewBox="0 0 120 90" className="h-24 w-32">
        <polygon points="30,10 90,10 65,55 55,55" fill="none" stroke="#8A909C" strokeWidth="2" />
        <circle cx="52" cy="30" r="2.5" fill="#C9A876" /><circle cx="65" cy="35" r="2.5" fill="#C9A876" />
        <circle cx="58" cy="45" r="2.5" fill="#C9A876" /><circle cx="68" cy="25" r="2.5" fill="#C9A876" />
        <rect x="45" y="60" width="30" height="20" fill="none" stroke="#8A909C" strokeWidth="2" />
        <rect x="47" y="68" width="26" height="10" fill="#8FB4E8" opacity="0.5" />
      </svg>
      <p className="grid grid-cols-2 gap-3 text-xs">
        <span><strong className="text-[var(--color-ink)]">Residue</strong><br />sand, remains on the filter paper</span>
        <span><strong className="text-[var(--color-ink)]">Filtrate</strong><br />water, passes through</span>
      </p>
    </div>
  );
}
function EvaporationResult() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <svg viewBox="0 0 120 70" className="h-20 w-32">
        <rect x="30" y="35" width="60" height="25" fill="none" stroke="#8A909C" strokeWidth="2" />
        {[0, 1, 2].map((i) => <path key={i} d={`M${45 + i * 15} 35 q -3 -10 0 -20`} stroke="#8FB4E8" strokeWidth="1.5" fill="none" opacity="0.6" />)}
        {[0, 1, 2, 3].map((i) => <rect key={i} x={40 + i * 10} y="50" width="5" height="5" fill="var(--color-indigo)" />)}
      </svg>
      <p className="text-xs text-[var(--color-ink-soft)]">The solvent (water) evaporates away, leaving solid salt crystals behind.</p>
    </div>
  );
}
function DistillationResult() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <svg viewBox="0 0 160 80" className="h-20 w-40">
        <rect x="10" y="45" width="35" height="25" fill="none" stroke="#8A909C" strokeWidth="2" />
        <path d="M45 50 L90 20" stroke="#8A909C" strokeWidth="2" fill="none" />
        <path d="M55 45 q5 -5 0 -10 q-5 -5 0 -10" stroke="#8FB4E8" strokeWidth="1.5" fill="none" />
        <rect x="85" y="10" width="45" height="14" fill="none" stroke="#8A909C" strokeWidth="2" />
        <path d="M130 17 L150 45" stroke="#8A909C" strokeWidth="2" fill="none" />
        <rect x="135" y="45" width="20" height="20" fill="none" stroke="#8A909C" strokeWidth="2" />
        <circle cx="145" cy="58" r="3" fill="#8FB4E8" />
      </svg>
      <p className="text-xs text-[var(--color-ink-soft)]">Water vaporizes, travels through the condenser, cools back to liquid, and is collected separately.</p>
    </div>
  );
}

function MethodChallenge({ challenge, onSolved }) {
  const [attempt, setAttempt] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState(false);

  function choose(method) {
    setAttempt(method);
    if (method === challenge.correct) {
      setSolved(true);
      onSolved?.();
    } else {
      setShowHint(true);
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--color-ink)]">{challenge.title}</p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{challenge.goal}</p>

      {!solved ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => choose(m)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  attempt === m && m !== challenge.correct
                    ? "border-[var(--color-coral)] bg-[var(--color-coral-soft)] text-[var(--color-coral)]"
                    : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {showHint && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-[var(--color-amber-soft)] px-3 py-2 text-xs text-[var(--color-amber)]">
              <Lightbulb size={14} className="mt-0.5 shrink-0" /> <span>{challenge.hint}</span>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 rounded-md border border-[var(--color-teal)]/30 bg-[var(--color-teal-soft)] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-teal)]"><CheckCircle2 size={14} /> {challenge.correct} — correct!</p>
          <div className="mt-3">{challenge.reveal}</div>
        </div>
      )}
    </div>
  );
}

// One reusable interactive covering multiple separation challenges,
// per the brief's explicit instruction to avoid six unrelated simulations.
export default function SeparationLabInteractive() {
  const [index, setIndex] = useState(0);
  const [multiStepDone, setMultiStepDone] = useState(false);
  const isMultiStep = index === CHALLENGES.length;
  const challenge = CHALLENGES[index];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {CHALLENGES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${index === i ? "border-[var(--color-indigo)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-faint)]"}`}
          >
            {i + 1}. {c.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIndex(CHALLENGES.length)}
          className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${isMultiStep ? "border-[var(--color-indigo)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-faint)]"}`}
        >
          4. Salt + Sand
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-line)] p-4">
        {!isMultiStep ? (
          <MethodChallenge key={challenge.id} challenge={challenge} />
        ) : (
          <SaltSandChallenge done={multiStepDone} onDone={() => setMultiStepDone(true)} />
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)]"><Beaker size={12} /> Impure crystals (recrystallization) and mixed dyes (chromatography) are covered further below.</p>
    </div>
  );
}

const SALT_SAND_STEPS = ["Add water", "Filter", "Evaporate"];

function SaltSandChallenge({ done, onDone }) {
  const [completedSteps, setCompletedSteps] = useState([]);
  const [error, setError] = useState(null);

  function attemptStep(step) {
    const expectedNext = SALT_SAND_STEPS[completedSteps.length];
    if (step !== expectedNext) {
      setError(`Not yet — think about what needs to happen before "${step}" can work.`);
      return;
    }
    setError(null);
    const next = [...completedSteps, step];
    setCompletedSteps(next);
    if (next.length === SALT_SAND_STEPS.length) onDone();
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--color-ink)]">Salt + Sand</p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Recover both the salt and the sand — put the steps in the right order.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SALT_SAND_STEPS.map((step) => {
          const isDone = completedSteps.includes(step);
          return (
            <button
              key={step}
              type="button"
              onClick={() => attemptStep(step)}
              disabled={isDone || done}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${isDone ? "border-[var(--color-teal)] bg-[var(--color-teal-soft)] text-[var(--color-teal)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"}`}
            >
              {isDone && "\u2713 "}{step}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-amber)]">{error}</p>}
      {done && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--color-teal)]">
          <CheckCircle2 size={14} /> Add water (salt dissolves) → Filter (sand separated) → Evaporate (salt recovered).
        </p>
      )}
    </div>
  );
}
