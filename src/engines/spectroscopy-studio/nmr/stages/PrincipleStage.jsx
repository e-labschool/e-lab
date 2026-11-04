import { ActivityBar } from "../../components/ui.jsx";
import { PRINCIPLE_ACTIVITIES } from "../../state/studioState.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import ProtonView from "./ProtonView.jsx";
import FieldView from "./FieldView.jsx";
import RFView from "./RFView.jsx";
import ResonanceView from "./ResonanceView.jsx";

const VIEWS = { proton: ProtonView, field: FieldView, rf: RFView, resonance: ResonanceView };
const TITLES = { proton: "Examine a ¹H nucleus", field: "Apply the magnetic field B₀", rf: "Excite with a radiofrequency pulse", resonance: "When does the RF match the resonance?" };

/** Stage 1: Principle. Four activities, one shared experiment (B0, RF settings, field state live in the studio store). */
export default function PrincipleStage({ slots }) {
  const a = useStudioActions();
  const act = useStudio((s) => s.activity.principle);
  const View = VIEWS[act] ?? ProtonView;
  return (
    <>
      <ActivityBar items={PRINCIPLE_ACTIVITIES.map((x) => ({ ...x, title: TITLES[x.id] }))} value={act} onChange={(id) => a.setActivity("principle", id)} ariaLabel="Principle activities" testIdPrefix="act-p" />
      <div className="ss-activity-body" data-testid={`view-${act}`}><View slots={slots} /></div>
    </>
  );
}
