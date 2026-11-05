import { ChevronRight } from "lucide-react";
import MsFrame from "./common.jsx";
import MethaneStage from "../components/MethaneStage.jsx";
import { Badge, Legend } from "../../components/ui.jsx";
import { Equation } from "../components/ui.jsx";
import { useMsActions } from "../state/MsContext.jsx";

const CHAIN = ["Sample introduction", "Ionisation", "Ion separation", "Detection", "Mass spectrum"];

/** Stage 1: what does mass spectrometry measure? A rotating CH4 model, the question, m/z, and the five-step chain. */
export default function Stage1Intro() {
  const a = useMsActions();
  const viz = (
    <div className="ms-introview" data-testid="intro-view">
      <MethaneStage />
      <Badge className="ss-badge--tl" testId="intro-question"><b>How can we determine the masses of atoms and molecules?</b></Badge>
      <Legend className="ss-legend-bl" items={[{ color: "#9aa8cc", label: "carbon" }, { color: "#f4f7ff", label: "hydrogen" }, { color: "#aab6d6", label: "bond", shape: "bar" }]} />
    </div>
  );
  const strip = (
    <div className="ss-controlrow ss-controlrow--ops">
      <ol className="ms-chain" aria-label="The stages of mass spectrometry" data-testid="intro-chain">
        {CHAIN.map((c, i) => <li key={c}><span className="ms-chain-n" aria-hidden="true">{i + 1}</span>{c}{i < CHAIN.length - 1 && <span className="ms-chain-arrow" aria-hidden="true">→</span>}</li>)}
      </ol>
      <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={a.nextStage} data-testid="begin">Begin: sample introduction <ChevronRight size={18} aria-hidden="true" /></button>
    </div>
  );
  const teacher = (
    <>
      <p><b>m/z is a pure number.</b> Mass spectra conventionally use m/z: the mass of the ion measured in unified atomic mass units (u, relative to one twelfth of the mass of a ¹²C atom) divided by its charge number z (a multiple of the elementary charge e). For a singly charged ion (z = 1) the number m/z equals the ion's mass in u.</p>
      <p><b>What is actually measured.</b> A mass spectrometer does not weigh neutral molecules. It detects ions, and the position or arrival time of an ion depends on its m/z. Different instruments use different ionisation methods and analysers; this module follows electron ionisation and two analysers.</p>
      <p><b>Terms that must not be mixed up:</b> mass number (a whole number), isotopic mass (in u, not a whole number), relative atomic mass Aᵣ (an abundance-weighted mean) and m/z.</p>
    </>
  );
  return (
    <MsFrame stage={1} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--ms-intro">
      <p data-testid="s1-text">A <b>mass spectrometer</b> turns sample particles into <b>ions</b> and measures their <b>mass-to-charge ratios</b>.</p>
      <Equation parts={[{ t: "m/z = " }, { t: "mass of ion (in u)" }, { t: " ÷ " }, { t: "charge number z" }]} testId="mz-equation" className="ms-eq--block" />
      <p className="ss-note">m/z is a number, not a mass: for a singly charged ion it equals the ion's mass in u.</p>
      <p className="ss-prompt">Press Begin, or Next, and follow one sample through the instrument.</p>
    </MsFrame>
  );
}
