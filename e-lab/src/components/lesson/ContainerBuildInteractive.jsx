import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import ThreeCanvas from "../3d/ThreeCanvas.jsx";
import ContainerScene3D from "../3d/ContainerScene3D.jsx";

// Three fixed, chemically sensible candidate arrangements (not free-form
// drag-and-drop, which risks producing chemically meaningless structures
// — the brief explicitly warns against that). The student's task is to
// correctly MATCH a candidate to the current challenge, cycling through
// all three challenges (element, compound, mixture).
const CANDIDATES = {
  element: {
    label: "Container 1",
    particles: [
      { type: "A", position: [-0.5, 0.3, 0] }, { type: "A", position: [0.4, 0.4, -0.2] },
      { type: "A", position: [0, -0.3, 0.3] }, { type: "A", position: [-0.3, -0.4, -0.3] },
      { type: "A", position: [0.5, -0.2, 0.2] }, { type: "A", position: [0.1, 0.5, 0.4] },
    ],
    bonds: [],
  },
  compound: {
    label: "Container 2",
    particles: [
      { type: "A", position: [-0.5, 0.3, 0] }, { type: "B", position: [-0.2, 0.3, 0] },
      { type: "A", position: [0.2, -0.2, 0.2] }, { type: "B", position: [0.5, -0.2, 0.2] },
      { type: "A", position: [-0.2, -0.4, -0.3] }, { type: "B", position: [0.1, -0.4, -0.3] },
    ],
    bonds: [
      { from: [-0.5, 0.3, 0], to: [-0.2, 0.3, 0] },
      { from: [0.2, -0.2, 0.2], to: [0.5, -0.2, 0.2] },
      { from: [-0.2, -0.4, -0.3], to: [0.1, -0.4, -0.3] },
    ],
  },
  mixture: {
    label: "Container 3",
    particles: [
      { type: "A", position: [-0.5, 0.3, 0] }, { type: "A", position: [0.4, 0.4, -0.2] },
      { type: "B", position: [0, -0.3, 0.3] }, { type: "B", position: [-0.3, -0.4, -0.3] },
      { type: "A", position: [0.5, -0.2, 0.2] }, { type: "B", position: [0.1, 0.5, 0.4] },
    ],
    bonds: [],
  },
};

const CHALLENGES = [
  { id: "element", prompt: "BUILD AN ELEMENT", hint: "An element has only one particle type — no other type present." },
  { id: "compound", prompt: "BUILD A COMPOUND", hint: "A compound has different particle types chemically bonded together in a fixed ratio." },
  { id: "mixture", prompt: "BUILD A MIXTURE", hint: "A mixture has more than one particle type present, but not all chemically bonded together." },
];

export default function ContainerBuildInteractive() {
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const challenge = CHALLENGES[challengeIndex];

  function choose(candidateId) {
    setSelected(candidateId);
    setFeedback(candidateId === challenge.id ? "correct" : "incorrect");
  }

  function next() {
    setSelected(null);
    setFeedback(null);
    setChallengeIndex((i) => (i + 1) % CHALLENGES.length);
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--color-ink)]">{challenge.prompt}</p>
      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
        <span className="mr-3"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#6C86EE] align-middle" /> Particle A</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E2872F] align-middle" /> Particle B</span>
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {Object.entries(CANDIDATES).map(([id, candidate]) => {
          const isChosen = selected === id;
          const isCorrectAnswer = feedback && id === challenge.id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              disabled={Boolean(feedback)}
              className={`overflow-hidden rounded-lg border text-left transition-colors ${
                isChosen && feedback === "correct" ? "border-[var(--color-teal)]" :
                isChosen && feedback === "incorrect" ? "border-[var(--color-coral)]" :
                isCorrectAnswer ? "border-[var(--color-teal)]" : "border-[var(--color-line)]"
              }`}
            >
              <ThreeCanvas height={140} cameraDistance={2.8} fallbackLabel="Particle arrangement" fallbackDescription={candidate.label}>
                <ContainerScene3D particles={candidate.particles} bonds={candidate.bonds} />
              </ThreeCanvas>
              <p className="px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">{candidate.label}</p>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-sm ${feedback === "correct" ? "bg-[var(--color-teal-soft)] text-[var(--color-teal)]" : "bg-[var(--color-amber-soft)] text-[var(--color-amber)]"}`}>
          {feedback === "correct" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
          <span>{feedback === "correct" ? "Correct! " : "Not quite — "}{challenge.hint}</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-[var(--color-ink-faint)]">Challenge {challengeIndex + 1} of {CHALLENGES.length}</p>
        {feedback && (
          <button type="button" onClick={next} className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-paper)] hover:bg-[var(--color-indigo)]">
            Next challenge
          </button>
        )}
      </div>
    </div>
  );
}
