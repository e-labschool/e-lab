import { ArrowLeft } from "lucide-react";
import { useMsActions } from "../state/MsContext.jsx";
import { TeacherDisclosure } from "../../components/ui.jsx";

const NAMES = { unknown: "Identify unknown compounds", patterns: "Molecular isotope patterns", isotopes: "Isotopes and relative atomic mass" };
/** The same layout as every stage (visual + control strip | explanation), for the optional activities that are reached from stage 6, Interpretation. */
export default function ActivityFrame({ id, title = NAMES[id], viz, strip, teacher, children, vizClass = "" }) {
  const a = useMsActions();
  return (
    <div className="ss-frame" data-testid="activity-view" data-activity={id}>
      <div className="ss-vizcol">
        <div className={`ss-viz ss-viz--ms ss-viz--ms-act ${vizClass}`} data-testid="step-viz">{viz}</div>
        {strip && <div className="ss-strip" data-testid="step-strip">{strip}</div>}
      </div>
      <aside className="ss-panel" aria-label={`Stage 6 activity: ${title}`} data-testid="step-panel">
        <p className="ss-kicker">Stage 6 · Interpretation · optional activity</p>
        <h3 className="ss-ptitle" data-testid="step-title">{title}</h3>
        <button type="button" className="sim-btn ss-chipbtn ms-backbtn" onClick={() => a.setActivity(null)} data-testid="activity-back"><ArrowLeft size={15} aria-hidden="true" /> Back to my spectrum</button>
        <div className="ss-pbody">{children}</div>
        <TeacherDisclosure>{teacher}</TeacherDisclosure>
      </aside>
    </div>
  );
}
