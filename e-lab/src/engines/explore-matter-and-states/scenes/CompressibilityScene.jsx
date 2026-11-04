import { useEffect, useState } from "react";
import ParticleField from "../components/ParticleField.jsx";
import RevealChip from "../components/RevealChip.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";
import { STATE_COLOR } from "../data/stateContent.js";

const STATES = ["solid", "liquid", "gas"];
const OBSERVATION = { solid: "Negligible compression", liquid: "Very small compression", gas: "Significant compression" };

export default function CompressibilityScene({ forceToken }) {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (forceToken) setPressed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceToken]);

  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow="Compressibility">What happens when pressure is applied?</SceneQuestion>

      <div className="grid gap-4 sm:grid-cols-3">
        {STATES.map((state) => (
          <div key={state}>
            <p className="mb-1.5 text-sm font-medium" style={{ color: STATE_COLOR[state] }}>{state[0].toUpperCase() + state.slice(1)}</p>
            <div className="relative">
              <ParticleField mode={state} compressionFactor={pressed ? 1 : 0} particleCount={state === "gas" ? 12 : undefined} />
            </div>
            {pressed && <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{OBSERVATION[state]}</p>}
          </div>
        ))}
      </div>

      {!pressed ? (
        <button type="button" onClick={() => setPressed(true)} className="self-start rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]">
          Apply pressure
        </button>
      ) : (
        <RevealChip label="What became smaller?" forceToken={forceToken}>
          <div className="flex flex-col gap-2">
            <ConclusionBadge tone="yes">DISTANCE BETWEEN PARTICLES</ConclusionBadge>
            <ConclusionBadge tone="no">NOT PARTICLE SIZE</ConclusionBadge>
          </div>
        </RevealChip>
      )}
    </div>
  );
}
