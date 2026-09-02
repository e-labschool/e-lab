import ParticleField from "../components/ParticleField.jsx";
import RevealChip from "../components/RevealChip.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";
import { COMPARE_TABLE, STATE_COLOR } from "../data/stateContent.js";

const STATES = ["solid", "liquid", "gas"];

export default function CompareScene({ forceToken }) {
  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow="Compare">Solid, liquid and gas &mdash; side by side.</SceneQuestion>

      <div className="grid gap-4 sm:grid-cols-3">
        {STATES.map((state) => (
          <div key={state}>
            <p className="mb-1.5 text-sm font-medium" style={{ color: STATE_COLOR[state] }}>
              {state[0].toUpperCase() + state.slice(1)}
            </p>
            <ParticleField mode={state} particleCount={state === "solid" ? 16 : state === "liquid" ? 18 : 10} />
          </div>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
        {COMPARE_TABLE.map((row) => (
          <div key={row.property} className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-[160px_1fr]">
            <span className="text-sm font-medium text-[var(--color-ink)]">{row.property}</span>
            <RevealChip label="Reveal" forceToken={forceToken}>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <span style={{ color: STATE_COLOR.solid }}>{row.solid}</span>
                <span style={{ color: STATE_COLOR.liquid }}>{row.liquid}</span>
                <span style={{ color: STATE_COLOR.gas }}>{row.gas}</span>
              </div>
            </RevealChip>
          </div>
        ))}
      </div>
    </div>
  );
}
