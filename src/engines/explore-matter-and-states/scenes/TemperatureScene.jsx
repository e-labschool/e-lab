import { useState } from "react";
import ParticleField from "../components/ParticleField.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";
import { STATE_COLOR } from "../data/stateContent.js";

const STATES = ["solid", "liquid", "gas"];

export default function TemperatureScene() {
  const [temperature, setTemperature] = useState(50);
  const [trailsOn, setTrailsOn] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow="Temperature and particle motion">
        How does temperature affect particle motion in each state?
      </SceneQuestion>

      <div className="grid gap-4 sm:grid-cols-3">
        {STATES.map((state) => (
          <div key={state}>
            <p className="mb-1.5 text-sm font-medium" style={{ color: STATE_COLOR[state] }}>{state[0].toUpperCase() + state.slice(1)}</p>
            <ParticleField mode={state} temperature={temperature} trackParticle={trailsOn} autoTrack={trailsOn} showTrail={trailsOn} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex flex-1 items-center gap-3">
          <span className="text-xs text-[var(--color-ink-faint)]">Cooler</span>
          <input
            aria-label="Temperature setting, cooler to warmer"
            aria-valuetext={`${temperature} out of 100`}
            data-testid="temperature-slider"
            type="range"
            min={5}
            max={100}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="flex-1 accent-[var(--color-indigo)]"
          />
          <span className="text-xs text-[var(--color-ink-faint)]">Warmer</span>
          <output className="min-w-[8.5rem] text-xs tabular-nums text-[var(--color-ink-soft)]" data-testid="temperature-readout">Setting {temperature} / 100</output>
        </div>
        <button
          type="button"
          onClick={() => setTrailsOn((v) => !v)}
          className={`rounded-md border px-3.5 py-1.5 text-sm transition-colors ${trailsOn ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
        >
          Show motion trails
        </button>
      </div>

      <p className="max-w-xl text-sm text-[var(--color-ink-soft)]">
        Higher temperature corresponds to greater <em>average</em> particle kinetic energy &mdash; not every
        particle moves at exactly the same speed. The setting is a relative scale (about 50 is room temperature), not degrees. The particles in each box are the same
        particles whatever the setting: only their average energy changes, so a solid vibrates harder but its particles stay in place.
      </p>
    </div>
  );
}
