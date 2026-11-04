import { NON_MATTER_EXAMPLES } from "../data/examples.js";
import { NON_MATTER_ICONS } from "../components/MatterIcons.jsx";
import RevealChip from "../components/RevealChip.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";

export default function NonMatterScene({ forceToken }) {
  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow="Contrast">Not everything real is matter.</SceneQuestion>

      <div className="grid gap-4 sm:grid-cols-2">
        {NON_MATTER_EXAMPLES.map((ex) => {
          const Icon = NON_MATTER_ICONS[ex.id];
          return (
            <div key={ex.id} className="rounded-md border border-[var(--color-line)] p-5">
              <div className="flex items-center gap-3">
                <div className="scale-125">
                  <Icon />
                </div>
                <span className="text-sm font-medium text-[var(--color-ink)]">{ex.label}</span>
              </div>
              <div className="mt-4">
                <RevealChip label={`Is the ${ex.objectLabel.toLowerCase()} matter?`} forceToken={forceToken}>
                  <div className="flex flex-col gap-2">
                    <ConclusionBadge tone="yes">{ex.objectLabel.toUpperCase()} = MATTER</ConclusionBadge>
                    <ConclusionBadge tone="no">{ex.phenomenonLabel.toUpperCase()} = NOT MATTER</ConclusionBadge>
                    <p className="text-xs text-[var(--color-ink-faint)]">{ex.phenomenonNote}</p>
                  </div>
                </RevealChip>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
