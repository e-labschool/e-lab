import { Play } from "lucide-react";
import MsFrame from "./common.jsx";
import { Scene } from "../components/ui.jsx";
import InstrumentScene from "../components/InstrumentScene.jsx";
import { Badge } from "../../components/ui.jsx";
import { usePhase, useTransition } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { INSTRUMENT_NOTES } from "../data/instrument.js";

/** Stage 2: sample introduction. "Introduce Sample" opens the valve and methane molecules flow through the inlet into the ionisation chamber. */
export default function Stage2Sample() {
  const a = useMsActions(); const released = useMs((s) => s.s2.released);
  const release = useTransition({ id: "ms-s2-release", target: released ? 1 : 0, seconds: 7, from: 0 });
  const phase = usePhase();
  const viz = (
    <div className="ms-boxfill" data-testid="sample-view" data-released={released ? "1" : "0"} data-progress={release.toFixed(2)}>
      <Scene>{({ w, h }) => <InstrumentScene w={w} h={h} phase={phase} release={release} released={released} />}</Scene>
      <Badge className="ss-badge--tl" testId="sample-label"><b>Illustrative instrument model.</b> Sample: methane, CH₄ (gas). Electron ionisation (EI).</Badge>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={() => a.patch("s2", { released: true })} disabled={released} data-testid="introduce-sample"><Play size={18} aria-hidden="true" /> Introduce Sample</button>
      <span className="ss-stripnote" data-testid="sample-status" aria-live="polite">{released ? "Valve open: methane molecules flow into the ionisation chamber." : "Valve closed: the molecules wait in the sample reservoir."}</span>
    </div>
  );
  const teacher = (
    <>
      <p><b>Sample introduction depends on the ionisation method.</b> {INSTRUMENT_NOTES.sample}</p>
      <p><b>Electron ionisation (EI)</b> needs molecules in the gas phase, so the introductory model uses a gas (methane). {INSTRUMENT_NOTES.ei}</p>
      <p><b>Vacuum.</b> {INSTRUMENT_NOTES.vacuum}</p>
    </>
  );
  return (
    <MsFrame stage={2} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--ms-inst">
      <p data-testid="s2-text">The sample must reach the ion source in a form that suits the <b>ionisation method</b>. Here it is a <b>gas</b>, so the introductory <b>electron ionisation (EI)</b> model works: molecules enter through the <b>inlet</b> and drift into the <b>ionisation chamber</b>.</p>
      <p>Mass spectrometry does not measure these neutral molecules directly. It measures <b>ions</b>, which are made next.</p>
      <p className="ss-note" data-testid="s2-note">Not every sample has to be vaporised first: other ionisation methods can handle liquids and solids.</p>
    </MsFrame>
  );
}
