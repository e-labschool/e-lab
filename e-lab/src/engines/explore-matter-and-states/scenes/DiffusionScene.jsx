import { useState } from "react";
import ParticleField from "../components/ParticleField.jsx";
import RevealChip from "../components/RevealChip.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";

export default function DiffusionScene({ forceToken }) {
  const [tab, setTab] = useState("gas");
  const [mixed, setMixed] = useState(false);
  const [diffusing, setDiffusing] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow="Diffusion">Why do substances mix on their own?</SceneQuestion>

      <div className="inline-flex w-fit rounded-full border border-[var(--color-line)] p-0.5 text-sm">
        {["gas", "liquid"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 capitalize transition-colors ${tab === t ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "gas" ? (
        <div className="flex flex-col gap-4">
          <ParticleField mode="gas" twoSpecies mixed={mixed} particleCount={20} />
          {!mixed ? (
            <button type="button" onClick={() => setMixed(true)} className="self-start rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]">
              Remove divider
            </button>
          ) : (
            <RevealChip label="Why does mixing occur?" forceToken={forceToken}>
              <ConclusionBadge tone="yes">CONTINUOUS RANDOM PARTICLE MOTION</ConclusionBadge>
            </RevealChip>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ParticleField mode="liquid" dyeCount={4} particleCount={30} />
          {!diffusing ? (
            <button type="button" onClick={() => setDiffusing(true)} className="self-start rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]">
              Add coloured solute
            </button>
          ) : (
            <p className="text-sm text-[var(--color-ink-soft)]">
              Watch the highlighted solute particles gradually distribute through the liquid &mdash; visual
              evidence of continuous particle motion.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
