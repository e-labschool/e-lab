import MacroContainers from "../components/MacroContainers.jsx";
import RevealChip from "../components/RevealChip.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";
import { STATE_COLOR, STATE_MACRO } from "../data/stateContent.js";

export default function StateMacroScene({ state, forceToken }) {
  const content = STATE_MACRO[state];
  const color = STATE_COLOR[state];

  return (
    <div className="flex flex-col gap-8">
      <SceneQuestion eyebrow={`${content.label} \u00b7 macroscopic view`}>
        Placed into three different containers &mdash; what do you observe?
      </SceneQuestion>

      <MacroContainers state={state} color={color} />

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
        <div className="flex-1">
          <p className="mb-2 text-sm text-[var(--color-ink-soft)]">{content.q1}</p>
          <RevealChip label="Reveal" forceToken={forceToken}>
            <ConclusionBadge tone="yes">{content.r1}</ConclusionBadge>
          </RevealChip>
        </div>
        <div className="flex-1">
          <p className="mb-2 text-sm text-[var(--color-ink-soft)]">{content.q2}</p>
          <RevealChip label="Reveal" forceToken={forceToken}>
            <ConclusionBadge tone="yes">{content.r2}</ConclusionBadge>
          </RevealChip>
        </div>
      </div>
    </div>
  );
}
