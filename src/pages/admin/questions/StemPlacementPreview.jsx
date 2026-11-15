import StimulusRenderer from "../../teacher/qbuilder/components/visuals/StimulusRenderer.jsx";
import StimulusErrorBoundary from "../../../components/ui/StimulusErrorBoundary.jsx";
import QuestionStemLayout from "../../../components/questions/QuestionStemLayout.jsx";
import { ScientificText } from "../../../lib/scientificContent.jsx";
import { getStimulusPlacement } from "../../../lib/questionLayout.js";

/** Live preview of the stem + visual placement, rendered by the same QuestionStemLayout students and teachers get. */
export default function StemPlacementPreview({ stimulus, text, questionId, widthPx }) {
  const placement = getStimulusPlacement(stimulus);
  const media = <StimulusErrorBoundary questionId={questionId}><StimulusRenderer stimulus={stimulus} questionId={questionId} /></StimulusErrorBoundary>;
  const stem = <p className="text-[15px] leading-relaxed text-[var(--color-ink)]"><ScientificText text={text || "Question text appears here."} /></p>;
  return (
    <div className="mx-auto rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4" style={{ maxWidth: widthPx ? `${widthPx}px` : undefined }} data-testid="stem-placement-preview">
      {placement ? <QuestionStemLayout placement={placement} media={media} stem={stem} /> : (<>{<div className="mb-5">{media}</div>}{stem}</>)}
    </div>
  );
}
