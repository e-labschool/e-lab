import StepNav from "../../components/StepNav.jsx";
import Notebook, { NotebookToggle } from "./Notebook.jsx";
import SampleView from "./SampleView.jsx";
import MsView from "./MsView.jsx";
import IrView from "./IrView.jsx";
import NmrView from "./NmrView.jsx";
import IdentifyView from "./IdentifyView.jsx";
import useInvestigation from "./useInvestigation.js";
import { useStructure } from "../state/StructureContext.jsx";
import { STAGES } from "../state/structureState.js";
import "../structure.css";

const VIEWS = { 1: SampleView, 2: MsView, 3: IrView, 4: NmrView, 5: IdentifyView };

/** The Structure Investigation tab: the same compact stepper as the other tabs (Sample -> Mass Spectrum -> IR Spectrum -> ¹H NMR -> Identify Structure) over ONE workspace. */
export default function StructureWorkbench() {
  const { store, level, sampleId } = useInvestigation();
  const stage = useStructure((s) => s.stage); const nbOpen = useStructure((s) => s.notebookOpen);
  const View = VIEWS[stage] ?? SampleView;
  return (
    <div className="ss-wb nm-root st-root" data-testid="stage-box" data-technique="structure" data-stage={`st-${stage}`}>
      <StepNav steps={STAGES} step={stage} onGoto={store.setStage} onPrev={store.prevStage} onNext={store.nextStage} ariaLabel="Structure investigation stages" />
      <div className="st-meta">
        <span className="st-metaid" data-testid="meta-id"><b>{sampleId}</b> · {level.label}</span>
        <NotebookToggle />
      </div>
      <div className="st-body" data-notebook={nbOpen ? "open" : "closed"} data-testid="step-body">
        <div className="st-main" data-testid={`step-view-${stage}`} data-step={stage}><View key={`${stage}-${sampleId}`} /></div>
        <Notebook />
      </div>
    </div>
  );
}
