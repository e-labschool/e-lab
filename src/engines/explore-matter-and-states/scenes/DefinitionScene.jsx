import RevealChip from "../components/RevealChip.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";

export default function DefinitionScene({ forceToken }) {
  return (
    <div className="flex flex-col gap-8">
      <SceneQuestion eyebrow="Building the definition">What do all of these samples have in common?</SceneQuestion>

      <div className="flex flex-col items-center gap-6 py-6">
        <RevealChip label="Reveal criterion 1" forceToken={forceToken}>
          <div className="rounded-md border border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] px-6 py-3 text-lg font-medium text-[var(--color-indigo)]">
            HAS MASS
          </div>
        </RevealChip>

        <span className="text-2xl text-[var(--color-ink-faint)]">+</span>

        <RevealChip label="Reveal criterion 2" forceToken={forceToken}>
          <div className="rounded-md border border-[var(--color-teal)] bg-[var(--color-teal-soft)] px-6 py-3 text-lg font-medium text-[var(--color-teal)]">
            OCCUPIES SPACE
          </div>
        </RevealChip>

        <span className="text-2xl text-[var(--color-ink-faint)]">=</span>

        <RevealChip label="Reveal MATTER" forceToken={forceToken}>
          <div className="rounded-md border-2 border-[var(--color-ink)] px-8 py-4 text-2xl font-semibold text-[var(--color-ink)]">
            MATTER
          </div>
        </RevealChip>
      </div>
    </div>
  );
}
