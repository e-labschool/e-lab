import ParticleField from "../components/ParticleField.jsx";
import RevealChip from "../components/RevealChip.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";
import { MISCONCEPTIONS } from "../data/misconceptions.js";

const VISUAL_PROPS = {
  "solid-frozen": { mode: "solid", paused: true },
  "gas-shrunk-particles": { mode: "gas", compressionFactor: 1, particleCount: 12 },
  "liquid-spread": { mode: "gas", particleCount: 12 },
  "gas-uniform-speed": { mode: "gas", particleCount: 12 },
  "solid-bonds": { mode: "solid", paused: true },
};

const TONE = { no: "no", oversimplified: "warn" };

export default function MisconceptionsScene({ forceToken }) {
  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow="Discussion">Are these particle diagrams correct?</SceneQuestion>

      <div className="grid gap-5 sm:grid-cols-2">
        {MISCONCEPTIONS.map((m) => (
          <div key={m.id} className="rounded-md border border-[var(--color-line)] p-4">
            <ParticleField {...VISUAL_PROPS[m.visual]} />
            <p className="mt-3 text-sm text-[var(--color-ink-soft)]">{m.prompt}</p>
            <div className="mt-2.5">
              <RevealChip label="Correct?" forceToken={forceToken}>
                <ConclusionBadge tone={TONE[m.verdict] ?? "no"}>{m.reveal}</ConclusionBadge>
              </RevealChip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
