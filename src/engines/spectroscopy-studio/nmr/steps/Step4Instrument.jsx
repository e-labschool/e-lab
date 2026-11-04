import { useMemo } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge } from "../../components/ui.jsx";
import { usePhase, useTransition } from "../../components/useAnim.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { OPS } from "../../state/stepMachine.js";
import { larmorMHz } from "../physics/constants.js";
import { STEPS as OP_MODEL, STEP_SECONDS, guidedState } from "../physics/instrumentModel.js";
import { getMoleculeFid } from "../molecular/model/moleculeFid.js";
import InstrumentViewer, { COMPONENTS, useViewBox } from "./InstrumentViewer.jsx";
import MagnetisationMini from "./MagnetisationMini.jsx";
import PulseSequence from "./PulseSequence.jsx";
import { miniData } from "./signalData.js";

// Zoom window for each operation (SVG user units of the instrument drawing): only the relevant part is shown, the rest is dimmed.
const BOXES = [[170, 0, 320, 490], [150, 20, 360, 430], [10, 60, 500, 420], [250, 60, 550, 420], [510, 70, 290, 420], [510, 190, 290, 300]];
const TEXT = [
  { head: "Sample into the magnet", body: <>The compound is dissolved in a solvent in a thin glass tube. The tube is lowered into the <b>probe</b>, right in the middle of the magnet's bore.</> },
  { head: "The magnetic field", body: <>A superconducting <b>magnet</b> produces the strong static field B₀ along the bore. The hydrogen nuclei in the sample develop a tiny net magnetisation <b>M₀</b> along B₀ (step 2).</> },
  { head: "A short RF pulse", body: <>The <b>transmitter</b> sends a brief burst of radiofrequency, at about ν₀, through the coil in the probe. Because it is so short it contains a whole band of frequencies, so <b>all</b> environments are excited at once. A 90° pulse tips M₀ into the plane perpendicular to B₀.</> },
  { head: "Detecting the signal", body: <>The tipped magnetisation turns at the resonance frequencies. A rotating magnet induces a tiny oscillating voltage in the coil: this is the <b>signal</b>. The <b>receiver</b> amplifies it.</> },
  { head: "The FID", body: <>The computer records the voltage against time: the <b>free induction decay</b> (FID). It is a mixture of all the frequencies, and it dies away as the nuclei lose coherence (relaxation).</> },
  { head: "The Fourier transform", body: <>A <b>Fourier transform</b> turns the time-domain FID into a frequency-domain <b>spectrum</b>: each frequency present in the FID becomes a peak. Step 5 shows this transform in detail.</> },
];
const SEQ_ACTIVE = [0, 0, 2, 3, 3, 0];

/** Step 4: one large animated instrument. Next Stage walks through insert, field, pulse, detect, FID, Fourier transform. */
export default function Step4Instrument() {
  const a = useStudioActions();
  const op = useStudio((s) => s.instrument.op);
  const b0 = useStudio((s) => s.b0Tesla);
  const moleculeId = useStudio((s) => s.moleculeId);
  const p = useTransition({ id: `instrument-op-${op}`, target: 1, seconds: STEP_SECONDS, from: 0 });
  const phase = usePhase({ scale: 1 });
  const nu0 = larmorMHz(b0);
  const model = useMemo(() => getMoleculeFid(moleculeId, nu0), [moleculeId, nu0]);
  const mini = useMemo(() => miniData(model), [model]);
  const view = guidedState(op, p, phase);
  const viewBox = useViewBox(BOXES[op]);
  const last = op === OPS.length - 1;
  const goto = (i) => { a.setTime(`instrument-op-${i}`, 0); a.setPaused(false); a.setOp(i); };
  const next = () => goto(last ? 0 : op + 1);
  const t = TEXT[op];

  const viz = (
    <div className="ss-instrbox" data-testid="instrument-view" data-op={op} data-op-id={OPS[op].id} data-progress={p.toFixed(2)}>
      <InstrumentViewer view={view} selected={OP_MODEL[op].focus} phase={phase} b0={b0} nu0={nu0} fid={mini} viewBox={viewBox} dimOthers />
      <Badge className="ss-badge--tl" testId="instrument-label"><b>Illustrative instrument model.</b> Real spectrometers differ in detail.</Badge>
      {(op === 2 || op === 3 || op === 4) && (
        <div className="ss-inset" data-testid="magnetisation-inset" aria-label="Magnetisation during this operation">
          <MagnetisationMini mz={view.mz} mxy={view.mxy} azimuth={view.az} size={86} label={false} />
          <span className="ss-inset-cap">magnetisation M (side and top view)</span>
        </div>
      )}
      <p className="ss-oplabel" data-testid="instrument-part" aria-live="polite">Now showing: <b>{COMPONENTS[OP_MODEL[op].focus].label}</b></p>
    </div>
  );
  const strip = (
    <div className="ss-controlrow ss-controlrow--ops">
      <ol className="ss-opdots" aria-label="Operations of the experiment">
        {OPS.map((o, i) => (
          <li key={o.id}>
            <button type="button" className="sim-btn ss-opdot" aria-current={i === op ? "step" : undefined} onClick={() => goto(i)} data-testid={`op-dot-${i}`} aria-label={`Operation ${i + 1}: ${o.label}`} title={o.label}>
              <span className="ss-opdot-n" aria-hidden="true">{i + 1}</span><span className="ss-opdot-l">{o.short ?? o.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={next} data-testid="next-stage">
        {last ? <><RotateCcw size={18} aria-hidden="true" /> Start again</> : <>Next Stage <ChevronRight size={18} aria-hidden="true" /></>}
      </button>
    </div>
  );
  const teacher = (
    <>
      <p>During the pulse the magnetisation in the picture comes from the Bloch equations (a 90° pulse of about 10 µs from a 25 kHz RF field, on resonance); the later motion is drawn to illustrate the decay. Nothing here is a measurement of a real instrument.</p>
      <p>The pulsed method is why modern NMR is fast: one short pulse excites every ¹H resonance, and the Fourier transform separates them afterwards. A continuous-wave scan (step 3) would have to find each resonance in turn.</p>
      <p>Not drawn: the liquid-helium cryostat, shim coils that make B₀ uniform, the lock channel, quadrature detection and the tuning circuit of the probe.</p>
    </>
  );
  return (
    <StepFrame step={4} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--instr">
      <p className="ss-opcount" data-testid="op-count">Stage {op + 1} of {OPS.length}: <b>{t.head}</b></p>
      <p data-testid="what-is-happening" aria-live="polite">{t.body}</p>
      <PulseSequence active={SEQ_ACTIVE[op]} />
    </StepFrame>
  );
}
