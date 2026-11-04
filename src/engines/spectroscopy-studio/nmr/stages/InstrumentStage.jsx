import { ActivityBar } from "../../components/ui.jsx";
import { INSTRUMENT_ACTIVITIES } from "../../state/studioState.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import SpectrometerView from "./SpectrometerView.jsx";
import SignalView from "./SignalView.jsx";

const TITLES = { spectrometer: "Click the components of an illustrative spectrometer and follow one experiment", signal: "The free induction decay and its Fourier transform" };

/** Stage 2: The Instrument. */
export default function InstrumentStage({ slots }) {
  const a = useStudioActions();
  const act = useStudio((s) => s.activity.instrument);
  const View = act === "signal" ? SignalView : SpectrometerView;
  return (
    <>
      <ActivityBar items={INSTRUMENT_ACTIVITIES.map((x) => ({ ...x, title: TITLES[x.id] }))} value={act} onChange={(id) => a.setActivity("instrument", id)} ariaLabel="Instrument activities" testIdPrefix="act-i" />
      <div className="ss-activity-body" data-testid={`view-${act}`}><View slots={slots} /></div>
    </>
  );
}
