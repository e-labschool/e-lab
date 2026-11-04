import ParticleField from "../components/ParticleField.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";
import { STATE_COLOR, SUMMARY_POINTS } from "../data/stateContent.js";

const STATES = ["solid", "liquid", "gas"];

export default function SummaryScene() {
  return (
    <div className="flex flex-col gap-10">
      <SceneQuestion eyebrow="Summary">Solid, liquid, gas &mdash; the complete picture.</SceneQuestion>

      <div className="grid gap-4 sm:grid-cols-3">
        {STATES.map((state) => (
          <div key={state} className="rounded-md border border-[var(--color-line)] p-4">
            <p className="mb-2 text-sm font-medium" style={{ color: STATE_COLOR[state] }}>{state[0].toUpperCase() + state.slice(1)}</p>
            <ParticleField mode={state} particleCount={state === "gas" ? 10 : undefined} />
            <ul className="mt-3 flex flex-col gap-1 text-xs text-[var(--color-ink-soft)]">
              {SUMMARY_POINTS[state].map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 border-t border-[var(--color-line)] pt-8 text-center">
        <span className="text-base font-medium text-[var(--color-ink)]">MACROSCOPIC PROPERTIES</span>
        <span className="text-xl text-[var(--color-ink-faint)]">&updownarrow;</span>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-[var(--color-ink-soft)]">
          <span>Particle arrangement</span>
          <span className="text-[var(--color-ink-faint)]">+</span>
          <span>Particle motion</span>
          <span className="text-[var(--color-ink-faint)]">+</span>
          <span>Particle interactions</span>
        </div>
      </div>
    </div>
  );
}
