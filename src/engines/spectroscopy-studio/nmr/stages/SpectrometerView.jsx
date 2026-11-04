import { useMemo } from "react";
import { larmorMHz, sci } from "../physics/constants.js";
import { buildFidModel, spectrumWindow } from "../physics/fidModel.js";
import { COMPONENT_IDS, GUIDED_DURATION, STEPS, STEP_SECONDS, exploreState, guidedState, stepAt } from "../physics/instrumentModel.js";
import InstrumentViewer, { COMPONENTS, WHOLE_BOX, useViewBox } from "./InstrumentViewer.jsx";
import MagnetisationMini from "./MagnetisationMini.jsx";
import Slot from "../../components/Slot.jsx";
import { Explain, Group, TeacherNote } from "../../components/ui.jsx";
import { usePhase, useTimeline } from "../../components/useTimeline.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";

const INFO = (b0, nu0) => ({
  magnet: {
    purpose: "Produces the strong, steady and very uniform field B₀ that splits the spin energy levels and creates the equilibrium magnetisation. Research magnets use a superconducting coil kept cold in liquid helium; shim coils (not drawn) make the field uniform across the sample.",
    process: `The field points along z through the bore. At B₀ = ${b0.toFixed(1)} T a proton resonates at ν₀ = γB₀/2π = ${nu0.toFixed(1)} MHz. The field is on all the time; the lines show its direction, not a change.`,
  },
  tube: {
    purpose: "A thin glass tube holds the liquid sample, usually a solution in a deuterated solvent so that the solvent gives almost no ¹H signal. It is lowered into the probe so that the liquid sits in the centre of the field and inside the RF coil.",
    process: "In the field the ¹H nuclei acquire a tiny net magnetisation M₀ along B₀ (a very small excess in the lower-energy state). The dots are nuclei, the gold arrow is M₀ (not to scale).",
  },
  probe: {
    purpose: "Holds the tube at the centre of the magnet and contains the RF coil and its tuning circuit. The coil is tuned to the resonance frequency and can both transmit the pulse and pick up the signal.",
    process: "Transmit: current in the coil produces an oscillating field B₁ perpendicular to B₀, which tips M. Receive: afterwards the precessing transverse magnetisation induces a voltage in the same coil (Faraday induction).",
  },
  transmitter: {
    purpose: "Generates the radiofrequency at the chosen frequency (near ν₀), gates it into a short pulse of a few microseconds and amplifies it. The pulse excites a band of frequencies, so all the resonances of the sample respond together.",
    process: "The burst on the display is the carrier switched on for the pulse duration t_p; flip angle = γB₁t_p.",
  },
  receiver: {
    purpose: "Detects the tiny voltage induced in the coil, amplifies it with a low-noise preamplifier and compares it with a reference frequency, so that only small offsets from the carrier (kHz instead of hundreds of MHz) remain.",
    process: "The trace is the induced voltage after the pulse: an oscillation that dies away as the transverse magnetisation dephases (the free induction decay).",
  },
  processing: {
    purpose: "The analogue-to-digital converter turns the voltage into numbers at regular intervals and stores the FID. A computer then applies a Fourier transform to calculate the spectrum. The instrument records the signal against time; the frequency spectrum is computed afterwards, it is not measured directly.",
    process: "Drawn: samples building up the FID, then the Fourier transform turning the same numbers into a spectrum.",
  },
});

const STEP_TEXT = [
  "Step 1 — Insert the sample. The tube, holding a solution that contains hydrogen-1 nuclei, is lowered into the probe in the bore of the magnet. These nuclei are capable of giving an NMR response.",
  "Step 2 — Apply the magnetic field. The superconducting magnet is energised all the time: in its field B₀ the nuclei reach an equilibrium in which the lower-energy state is very slightly favoured, giving the net magnetisation M₀ along B₀ (it builds up over a few T₁).",
  "Step 3 — Transmit an RF pulse. The transmitter sends a short pulse to the coil. The oscillating field B₁ tips the net magnetisation away from B₀: a 90° pulse turns M₀ into the transverse plane (the small panel uses the Bloch model).",
  "Step 4 — Detect the signal. The tilted magnetisation precesses about B₀. A magnetisation rotating in the transverse plane changes the magnetic flux through the coil and induces a voltage there, at the (offset) resonance frequencies.",
  "Step 5 — Generate the FID. The receiver amplifies the voltage and the digitiser samples it: an oscillating signal that decays with time, the free induction decay.",
  "Step 6 — Fourier transform. The computer converts the sampled time-domain signal into a frequency-domain spectrum. The spectrometer never measures the spectrum directly: it records the FID and the spectrum is calculated from it.",
];

/** Stage 2, activity 1: NMRInstrumentViewer with the guided six-step sequence and per-component explanations. */
export default function SpectrometerView({ slots }) {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const ins = useStudio((s) => s.instrument);
  const fidState = useStudio((s) => s.fid);
  const mode = useStudio((s) => s.mode);
  const nu0 = larmorMHz(b0);
  const tl = useTimeline({ id: "instrument", duration: GUIDED_DURATION, events: Array.from({ length: 5 }, (_, i) => STEP_SECONDS * (i + 1)), initial: 0 });
  const guided = ins.guided;
  const phase = usePhase({ enabled: true, speedScale: 1 });
  const { step, p } = stepAt(tl.t);
  const view = guided ? guidedState(step, p, phase) : exploreState(ins.selected, phase);
  const selected = guided ? STEPS[step].focus : ins.selected;
  const vbTarget = selected ? COMPONENTS[selected].box : WHOLE_BOX;
  const viewBox = useViewBox(vbTarget);
  const info = INFO(b0, nu0);

  const model = useMemo(() => buildFidModel(fidState, nu0), [fidState, nu0]);
  const mini = useMemo(() => {
    const nWin = Math.round(0.04 / model.acq.dwell); const stepN = Math.max(1, Math.floor(nWin / 200)); const t = []; const y = [];
    for (let i = 0; i < nWin; i += stepN) { t.push(i * model.acq.dwell * 1000); y.push(model.fid.re[i]); }
    const [w0, w1] = spectrumWindow(model, true); const ppm = []; const spec = [];
    const idx0 = (() => { let lo = 0; let hi = model.ppm.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (model.ppm[m] < w0) lo = m + 1; else hi = m; } return lo; })();
    const idx1 = (() => { let lo = 0; let hi = model.ppm.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (model.ppm[m] > w1) hi = m - 1; else lo = m; } return lo; })();
    const st = Math.max(1, Math.floor((idx1 - idx0) / 240));
    for (let i = idx1; i >= idx0; i -= st) { ppm.push(model.ppm[i]); spec.push(model.spec.re[i] / model.specMax); }
    return { t, y, window: [0, 40], ppm, spec, ppmWin: [w0, w1] };
  }, [model]);

  const select = (id) => a.patch("instrument", { selected: ins.selected === id ? null : id, guided: false });
  const startGuided = () => { a.patch("instrument", { guided: true, selected: null }); tl.jump(0); a.setPlaying(true); };
  const jumpStep = (i) => { a.patch("instrument", { guided: true, selected: null }); tl.jump(i * STEP_SECONDS); };
  const whole = () => a.patch("instrument", { selected: null, guided: false });
  const text = guided ? STEP_TEXT[step] : ins.selected ? `${COMPONENTS[ins.selected].label}: ${info[ins.selected].purpose}` : "An illustrative cross-section of an NMR spectrometer. Click a component to zoom in and see what it does, or start the guided sequence to follow one experiment from sample to spectrum.";
  const cur = selected ? info[selected] : null;

  return (
    <>
      <div className="ss-instr-wrap" data-testid="spectrometer-view" data-step={guided ? step : -1}>
        <InstrumentViewer view={view} selected={selected} onSelect={select} phase={phase} b0={b0} nu0={nu0} fid={mini} viewBox={viewBox} dimOthers={Boolean(selected)} />
        {guided && <div className="ss-badge-tl" data-testid="step-badge"><b>Step {step + 1} of 6</b><span>{STEPS[step].title}</span></div>}
        {(guided ? step >= 2 && step <= 4 : ["tube", "probe", "transmitter", "receiver"].includes(ins.selected ?? "")) && (
          <div className="ss-hud ss-hud--mini"><MagnetisationMini mz={view.mz} mxy={view.mxy} azimuth={view.az} size={96} /></div>
        )}
        <div className="ss-hint ss-instr-foot">Illustrative instrument model. The receiver records the signal against time (the FID); the spectrum is computed from it afterwards by Fourier transformation.</div>
      </div>

      <Slot target={slots.controls}>
        <Group title="Guided sequence" testId="grp-guided">
          <button type="button" className="sd-btn sd-btn--primary" onClick={startGuided} data-testid="start-guided">{guided ? "Restart the sequence" : "Start guided sequence"}</button>
          <ol className="ss-steplist" aria-label="Guided steps">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button type="button" className="ss-steplink" aria-current={guided && step === i ? "step" : undefined} onClick={() => jumpStep(i)} data-testid={`step-${i + 1}`}>
                  <span className="ss-steplink-n" aria-hidden="true">{i + 1}</span>{s.title}
                </button>
              </li>
            ))}
          </ol>
        </Group>
        <Group title="Components" testId="grp-components-list" aside={<button type="button" className="sd-btn sd-btn--sm" onClick={whole} data-testid="whole-instrument" disabled={!selected || guided}>Whole instrument</button>}>
          <div className="ss-complist" role="group" aria-label="Instrument components">
            {COMPONENT_IDS.map((id) => (
              <button key={id} type="button" className="ss-compbtn" aria-pressed={!guided && ins.selected === id} onClick={() => select(id)} data-testid={`list-${id}`} style={{ "--c": COMPONENTS[id].color }}>
                <span className="ss-swatch" aria-hidden="true" />{COMPONENTS[id].short}
              </button>
            ))}
          </div>
        </Group>
        {cur && (
          <Group title={COMPONENTS[selected].label} testId="grp-info">
            <p className="ss-info" data-testid="comp-purpose"><b>Purpose.</b> {cur.purpose}</p>
            <p className="ss-info" data-testid="comp-process"><b>Animated process.</b> {cur.process}</p>
          </Group>
        )}
        <TeacherNote title="Teacher: real instrument vs this model">
          <p>The drawing is a teaching model. Real spectrometers use a liquid-helium cryostat, shim coils, a deuterium lock channel, tuning and matching circuits and quadrature detection. The same coil often transmits and receives.</p>
          <p>The Bloch-model panel in step 3 is a real calculation (90° pulse, 25 kHz RF, on resonance). Step 5 and 6 use the same FID model as the next activity, at B₀ = {b0.toFixed(1)} T (ν₀ = {nu0.toFixed(1)} MHz, γ = {sci(2.675222e8, 4)} rad s⁻¹ T⁻¹).</p>
        </TeacherNote>
      </Slot>
      <Slot target={slots.graph}>
        <Group title="Nuclear magnetisation" testId="grp-split-mag">
          <MagnetisationMini mz={view.mz} mxy={view.mxy} azimuth={view.az} size={132} />
          <p className="ss-hint">Synchronised with the instrument: M₀ builds up in the field (step 2), a pulse tips it into the transverse plane (step 3) and the transverse part precesses and decays while it is detected (steps 4-5).</p>
        </Group>
      </Slot>
      <Explain slots={slots}>{text}</Explain>
    </>
  );
}
