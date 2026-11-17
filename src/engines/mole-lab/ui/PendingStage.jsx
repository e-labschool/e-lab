import { Hammer } from "lucide-react";
import StageFrame from "./StageFrame.jsx";
import { ReferencePanel } from "./parts.jsx";

/** Stages 3-6 are NOT built yet.  This screen says so plainly and does nothing else (no fake controls, no placeholder science). */
export default function PendingStage({ layout, stage }) {
  return (
    <StageFrame layout={layout} stageTitle={stage.title} stageBlurb={stage.purpose} status="This stage is not available yet." reference={<ReferencePanel compact={layout !== "wide"} />}
      workspace={<div className="ml-pending" data-testid="ml-pending"><Hammer size={28} aria-hidden="true" /><h4>Coming in the next build</h4><p><b>{stage.title}</b> is planned but <u>not built yet</u>. Nothing in this tab is interactive, and no results are shown for it.</p><p className="ml-muted">Stages 1 and 2 are fully working and use the same packet system this stage will use.</p></div>}
      controls={null} calc={null} />
  );
}
