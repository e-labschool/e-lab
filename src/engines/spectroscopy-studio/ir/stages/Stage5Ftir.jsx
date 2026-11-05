import { ChevronRight, RotateCcw } from "lucide-react";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge } from "../../components/ui.jsx";
import { usePhase, useTransition } from "../../components/useAnim.js";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import { FTIR_OPS } from "../state/irState.js";
import { ftirDemo } from "../physics/ftirDemo.js";
import FtirInstrument from "../components/FtirInstrument.jsx";
import { IR_STAGES } from "./common.js";

const TEXT = [
  { head: "The IR source", body: <>A hot ceramic or wire glows and emits <b>all</b> infrared wavenumbers at once. There is no single-frequency source and no scanning of one frequency at a time.</> },
  { head: "The interferometer", body: <>A beamsplitter sends half of the beam to a fixed mirror and half to a <b>moving mirror</b>. The beams recombine. As the mirror moves, the <b>path difference</b> changes and each wavenumber alternately reinforces and cancels itself.</> },
  { head: "The sample", body: <>The recombined beam passes through the sample. Wavenumbers that match its <b>IR-active vibrations</b> are absorbed; the rest pass through.</> },
  { head: "The detector", body: <>The detector measures the total intensity as the mirror moves. This signal is an <b>interferogram</b>: every wavenumber is in it at once, summed. It does not look like a spectrum.</> },
  { head: "The computer", body: <>The computer applies a <b>Fourier transform</b> to the interferogram. It separates the signal into the intensity at each wavenumber, with and without the sample.</> },
  { head: "The IR spectrum", body: <>Dividing the sample by the no-sample result gives the <b>transmittance</b> at each wavenumber: the IR spectrum, with absorption bands pointing down.</> },
];

/** Stage 5: one animated FTIR spectrometer, walked through source -> interferometer -> sample -> detector -> computer -> spectrum. */
export default function Stage5Ftir() {
  const a = useIrActions(); const op = useIr((s) => s.s5.op);
  const D = ftirDemo();
  const scan = useTransition({ id: "ftir-scan", target: op >= 1 ? 1 : 0, seconds: 7, from: 0 });
  const ft = useTransition({ id: `ftir-ft-${op >= 5 ? 5 : op}`, target: op >= 4 ? 1 : 0, seconds: 3.2, from: 0 });
  const phase = usePhase();
  const last = op === FTIR_OPS.length - 1; const t = TEXT[op];
  const goto = (i) => { a.patch("s5", { op: i }); };
  const next = () => goto(last ? 0 : op + 1);
  const viz = (
    <div className="ss-instrbox" data-testid="ftir-view" data-op={op} data-op-id={FTIR_OPS[op].id}>
      <FtirInstrument op={op} scan={scan} ft={ft} phase={phase} />
      <Badge className="ss-badge--tl" testId="ftir-label"><b>Illustrative FTIR model.</b> Real spectrometers differ in detail.</Badge>
      <p className="ss-oplabel" data-testid="ftir-part" aria-live="polite">Now showing: <b>{FTIR_OPS[op].label}</b></p>
    </div>
  );
  const strip = (
    <div className="ss-controlrow ss-controlrow--ops">
      <ol className="ss-opdots" aria-label="Parts of the spectrometer">
        {FTIR_OPS.map((o, i) => (
          <li key={o.id}>
            <button type="button" className="sim-btn ss-opdot" aria-current={i === op ? "step" : undefined} onClick={() => goto(i)} data-testid={`op-dot-${i}`} aria-label={`Part ${i + 1}: ${o.label}`} title={o.label}>
              <span className="ss-opdot-n" aria-hidden="true">{i + 1}</span><span className="ss-opdot-l">{o.short}</span>
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
      <p><b>The signal.</b> For a Michelson interferometer with path difference x, each wavenumber ν̃ contributes a term ∝ cos(2πν̃x) to the detector signal. The interferogram is the sum over all wavenumbers; the transform I(x) → S(ν̃) recovers them. Here the transform is a real FFT of the {D.points.toLocaleString("en-US")} points shown (path range ±{(D.halfPathCm * 10).toFixed(1)} mm, resolution about {D.resolution} cm⁻¹ = 1 / total path), computed in your browser.</p>
      <p><b>Why FTIR?</b> All wavenumbers reach the detector all the time (the multiplex or Fellgett advantage), and a scan takes about a second, so many scans can be averaged. An older dispersive instrument measured one narrow band of wavenumbers at a time.</p>
      <p><b>Sample spectrum</b> = sample single-beam ÷ background single-beam. The source and sample here are illustrative: a smooth broadband source and the representative bands of propanone. Not drawn: the laser that measures mirror position, apodisation details, phase correction, the purge gas and the sample compartment optics.</p>
    </>
  );
  return (
    <StepFrame step={5} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--ftir">
      <p className="ss-opcount" data-testid="op-count">Stage {op + 1} of {FTIR_OPS.length}: <b>{t.head}</b></p>
      <p data-testid="what-is-happening" aria-live="polite">{t.body}</p>
      <p className="ss-note" data-testid="ftir-statement"><b>An FTIR spectrometer does not scan one frequency at a time.</b> It records an <b>interferogram</b>, which the computer Fourier-transforms into the spectrum.</p>
    </StepFrame>
  );
}
