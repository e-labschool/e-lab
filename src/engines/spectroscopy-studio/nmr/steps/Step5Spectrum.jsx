import { useMemo } from "react";
import { AudioWaveform, Undo2 } from "lucide-react";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge, Readouts } from "../../components/ui.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { larmorMHz } from "../physics/constants.js";
import { getMoleculeFid, CARRIER_PPM } from "../molecular/model/moleculeFid.js";
import MoleculePicker from "../molecular/components/MoleculePicker.jsx";
import SignalGraph from "./SignalGraph.jsx";
import "../molecular/components/molecular.css";

/** Step 5: ONE large graph. The FID of the current molecule at the current operating frequency, and a button that Fourier transforms it into the spectrum. */
export default function Step5Spectrum() {
  const a = useStudioActions();
  const view = useStudio((s) => s.spectrum.view);
  const moleculeId = useStudio((s) => s.moleculeId);
  const b0 = useStudio((s) => s.b0Tesla);
  const nu0 = larmorMHz(b0);
  const freq = view === "freq";
  const m = useTransition({ id: "ft-morph", target: freq ? 1 : 0, seconds: 3.4 });
  const model = useMemo(() => getMoleculeFid(moleculeId, nu0), [moleculeId, nu0]);
  const go = (v) => { a.setPaused(false); a.patch("spectrum", { view: v }); };
  const done = m > 0.98; const moving = m > 0.02 && m < 0.98;

  const viz = (
    <div className="ss-graphwrap" data-testid="spectrum-view" data-view={view} data-molecule={moleculeId ?? ""}>
      <SignalGraph model={model} morph={m} moleculeId={moleculeId} nu0={nu0} />
      <Badge className="ss-badge--tl" testId="graph-caption"><b>{done ? "Spectrum" : moving ? "Fourier transform…" : "FID"}</b> of {model.label} at {nu0.toFixed(1)} MHz</Badge>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      {!freq ? (
        <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={() => go("freq")} data-testid="transform-btn"><AudioWaveform size={18} aria-hidden="true" /> Transform to Spectrum</button>
      ) : (
        <button type="button" className="sim-btn ss-bigbtn" onClick={() => go("time")} data-testid="back-btn"><Undo2 size={18} aria-hidden="true" /> Back to the FID</button>
      )}
      <div className="ss-pickwrap"><MoleculePicker value={moleculeId} onChange={a.setMolecule} compact testId="molecule-picker-5" /></div>
    </div>
  );
  const teacher = (
    <>
      <p><b>How this FID is built.</b> Every line of every multiplet of {model.isDefault ? "the example" : model.label} contributes one damped oscillation, A<sub>k</sub> exp(−t/T₂*) cos(2πf<sub>k</sub>t), with f<sub>k</sub> = (δ<sub>k</sub> − {CARRIER_PPM} ppm) × {nu0.toFixed(1)} MHz, the offset from the reference frequency of the receiver. A<sub>k</sub> is proportional to the line area (so to the number of H) and T₂* = 1/(π × line width).</p>
      <p><b>The transform is a real one.</b> The spectrum is the fast Fourier transform of those {model.fid.n.toLocaleString("en-US")} samples (zero-filled to twice that), computed in your browser; the animation only reveals it. Splittings are the closely spaced lines of each multiplet (first order, J about 7 Hz), so they appear as extra frequencies in the FID, beating slowly.</p>
      <p>Change B₀ in step 2 and come back: the Hz offsets in the FID change in proportion to the field, but the ppm positions of the peaks do not.</p>
    </>
  );
  return (
    <StepFrame step={5} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--graph">
      <p data-testid="what-is-happening" aria-live="polite">
        {!freq
          ? <>This is the <b>free induction decay</b> of {model.isDefault ? "an example sample" : <b>{model.label}</b>}: all the oscillating signals of the hydrogens added together, dying away. Each environment oscillates at its own frequency, so the picture is a tangle that is hard to read by eye.</>
          : <>The <b>Fourier transform</b> has sorted the FID into its frequencies. Each peak is a hydrogen environment, drawn against chemical shift δ in ppm ({model.isDefault ? "areas 3 : 2 : 1" : "the letters match the molecule in step 6"}).</>}
      </p>
      {model.isDefault && <p className="ss-note" data-testid="default-note">No molecule is chosen yet, so an example with three signals (3 : 2 : 1) is shown. Choose a molecule to see its own FID.</p>}
      <Readouts items={[
        { id: "ref", label: "Operating frequency", value: `${nu0.toFixed(1)} MHz`, tone: "b0" },
        { id: "freqs", label: "Frequencies in the FID", value: String(model.comps.length), tone: "mag" },
      ]} />
      <p className="ss-prompt">{freq ? "Press Back to the FID to see the time-domain signal again." : "Press Transform to Spectrum."}</p>
    </StepFrame>
  );
}
