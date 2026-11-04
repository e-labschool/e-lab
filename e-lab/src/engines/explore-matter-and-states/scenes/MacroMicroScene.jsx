import { useState } from "react";
import MacroContainers from "../components/MacroContainers.jsx";
import ParticleField from "../components/ParticleField.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";
import { STATE_COLOR } from "../data/stateContent.js";

const QUESTIONS = [
  { id: "solid-shape", question: "Why does a solid retain its shape?", state: "solid", highlight: "Restricted particle positions" },
  { id: "liquid-flow", question: "Why does a liquid flow?", state: "liquid", highlight: "Particles moving past one another" },
  { id: "gas-compress", question: "Why is a gas compressible?", state: "gas", highlight: "Large spaces between particles" },
  { id: "gas-fill", question: "Why does a gas fill its container?", state: "gas", highlight: "Free, random translational motion" },
];

export default function MacroMicroScene() {
  const [activeId, setActiveId] = useState(null);
  const active = QUESTIONS.find((q) => q.id === activeId);

  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow="Macro \u2194 particle">Explain observable properties using particle-level reasoning.</SceneQuestion>

      <div className="flex flex-wrap gap-2">
        {QUESTIONS.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setActiveId(q.id)}
            className={`rounded-md border px-3.5 py-2 text-sm text-left transition-colors ${activeId === q.id ? "border-[var(--color-ink)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)] hover:border-[var(--color-ink)]"}`}
          >
            {q.question}
          </button>
        ))}
      </div>

      {active && (
        <div className="grid gap-6 border-t border-[var(--color-line)] pt-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Macroscopic</p>
            <MacroContainers state={active.state} color={STATE_COLOR[active.state]} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Particle level</p>
            <ParticleField mode={active.state} />
            <p className="mt-2 text-sm font-medium" style={{ color: STATE_COLOR[active.state] }}>{active.highlight}</p>
          </div>
        </div>
      )}
    </div>
  );
}
