import MsFrame from "./common.jsx";
import { ChipGroup, Equation, Scene } from "../components/ui.jsx";
import FragmentScene from "../components/FragmentScene.jsx";
import { Badge } from "../../components/ui.jsx";
import { usePhase, useTransition } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { FRAGMENTATION_STATEMENT, NOT_EQUAL_NOTE, PATHWAYS, PATHWAY_BY_ID } from "../data/fragmentation.js";

/** Stage 4: fragmentation of the methane molecular ion. Select a pathway: the charged and the neutral product separate; only the charged one continues. */
export default function Stage4Fragment() {
  const a = useMsActions(); const pathId = useMs((s) => s.s4.path); const path = PATHWAY_BY_ID[pathId];
  const p = useTransition({ id: `ms-s4-${pathId}`, target: 1, seconds: 7, from: 0 });
  const phase = usePhase();
  const viz = (
    <div className="ms-boxfill" data-testid="fragment-view" data-path={pathId}>
      <Scene>{({ w, h }) => <FragmentScene w={w} h={h} p={p} phase={phase} pathId={pathId} />}</Scene>
      <Equation testId="path-equation" className="ms-eq--over" parts={[{ t: path.eq, on: true }]} />
      <Badge className="ss-badge--tr" testId="frag-legend"><b>Orange</b> = charged · <b>grey / white</b> = neutral</Badge>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <span className="ss-stripnote">Pathway</span>
      <ChipGroup label="Fragmentation pathway" options={PATHWAYS.map((x) => ({ id: x.id, label: x.eq, title: x.text }))} value={pathId} onChange={(id) => a.patch("s4", { path: id })} testId="path" small />
    </div>
  );
  const teacher = (
    <>
      <p><b>Why ions fragment.</b> The electron that is knocked out carries away little energy, but the molecular ion keeps the excess as internal (vibrational and electronic) energy. If that exceeds the energy needed to break a bond, the ion splits. A radical cation M⁺• gives one charged fragment and one neutral fragment (a radical or a molecule); the charge stays with whichever piece can best carry it.</p>
      <p><b>Which fragments appear</b> depends on the structure: weak bonds break more easily and stable ions (here CH₃⁺) form more often. That is why the pattern of peaks tells us about the molecule.</p>
      <p><b>Caution.</b> The peak sizes in the table are the sizes of the peaks in the representative methane spectrum, not branching ratios of one step: a peak can be fed by more than one route, and secondary steps start from fragments.</p>
    </>
  );
  return (
    <MsFrame stage={4} viz={viz} strip={strip} teacher={teacher} ribbon="ionisation" vizClass="ss-viz--ms-inst">
      <p data-testid="s4-text">The molecular ion has <b>excess internal energy</b>, so bonds can break. This makes a smaller <b>charged fragment</b> and a <b>neutral fragment</b>. <b>Only charged particles</b> are accelerated, pass through the analyser and count in the mass spectrum.</p>
      <ul className="ms-pathbars" data-testid="path-bars" aria-label="Relative size of the peak made by each pathway in the representative spectrum">
        {PATHWAYS.map((x) => (
          <li key={x.id} className={x.id === pathId ? "is-sel" : ""} data-path={x.id}><span className="ms-pb-eq">{x.eq}</span><span className="ms-pb-bar" aria-hidden="true"><i style={{ width: `${x.rel}%` }} /></span><span className="ms-pb-val">m/z {x.mzOut}: {x.rel} %</span></li>
        ))}
      </ul>
      <p className="ss-note" data-testid="s4-unequal">{NOT_EQUAL_NOTE}</p>
      <p className="ss-prompt" data-testid="s4-statement">{FRAGMENTATION_STATEMENT}</p>
    </MsFrame>
  );
}
