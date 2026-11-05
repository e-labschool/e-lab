import { useRef } from "react";
import { Users, User } from "lucide-react";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge, Legend } from "../../components/ui.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useReducedMotion, useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import SampleScene, { NO_STATES } from "../scene/SampleScene.jsx";
import { SPIN_CLARIFICATION } from "./texts.js";

/** Step 1: one proton model with its magnetic-moment arrow, then (button) an ensemble of proton models whose moments point in random directions. */
export default function Step1Nucleus() {
  const a = useStudioActions();
  const sample = useStudio((s) => s.nucleus.sample);
  const paused = useStudio((s) => s.paused);
  const speed = useStudio((s) => s.speed);
  const reduced = useReducedMotion();
  const p = useTransition({ id: "nucleus-sample", target: sample ? 1 : 0, seconds: 2.6 });
  const live = useRef({ p: 0, grow: 0, apply: 0, states: NO_STATES, paused: false, reduced: false, speed: 1 });
  const e = p * p * (3 - 2 * p);
  live.current = { p, grow: e, apply: 0, states: NO_STATES, paused, reduced, speed };
  const done = p > 0.97; const single = p < 0.15;
  const setSample = (v) => { a.setPaused(false); a.patch("nucleus", { sample: v }); };

  const viz = (
    <>
      <ThreeCanvas label="A proton model: a sphere with a turning surface stripe and an arrow with a cone head for its magnetic moment. After the button is pressed, many such protons, each with its own randomly oriented moment arrow" position={[4.3, -5.15, 2.9]} fallback="The picture of the proton needs WebGL. In words: a proton has a magnetic moment (an arrow); in a sample the moments of many protons point in random directions.">
        <SampleScene live={live} single={single} />
      </ThreeCanvas>
      <Badge className="ss-badge--tl" testId="concept-badge" tone={sample ? "warn" : undefined}>
        {sample ? <><b>Conceptual picture.</b> {done ? "Each arrow is the magnetic moment of one proton. Real samples have about 10²⁰ nuclei; only a few dozen are drawn." : "The proton is being replaced by many protons…"}</> : <><b>One ¹H nucleus (a proton).</b> The arrow is its magnetic moment μ. Drag to rotate.</>}
      </Badge>
      <Legend className="ss-legend-bl" items={[{ color: "#fcd34d", label: "arrow: magnetic moment μ", shape: "arrow" }, { color: "#a9d8ff", label: "sphere: a proton (conceptual)", shape: "dot" }, { color: "#fbbf24", label: "turning stripe: teaching analogy for spin", shape: "bar" }]} />
    </>
  );
  const strip = (
    <div className="ss-btnrow">
      {!sample ? (
        <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={() => setSample(true)} data-testid="show-sample"><Users size={18} aria-hidden="true" /> Show Proton Sample</button>
      ) : (
        <button type="button" className="sim-btn ss-bigbtn" onClick={() => setSample(false)} data-testid="show-single"><User size={18} aria-hidden="true" /> Back to a single nucleus</button>
      )}
      <span className="ss-stripnote" data-testid="sample-state" data-sample={sample ? "1" : "0"} data-progress={p.toFixed(2)}>{sample ? (done ? "Sample: moments point in random directions" : "Changing…") : "Single nucleus"}</span>
    </div>
  );
  const teacher = (
    <>
      <p>The proton has spin quantum number I = ½. Its magnetic moment is μ = γħI, so the allowed values along any chosen axis are only ±γħ/2, a fact the next step uses. “Spin” is intrinsic angular momentum with no classical picture: the proton is not a tiny ball that turns round on its axis.</p>
      <p>The turning stripe on the sphere is only a <b>teaching analogy</b>: it makes the idea of a rotating charge, and so of a magnetic moment, easy to see, but it must not be taken as the explanation of nuclear spin. The arrow is the physical quantity (μ); it is drawn on the turning axis because for a proton μ is parallel to the spin angular momentum.</p>
      <p>Random orientations mean the vector sum of the moments is zero, so a bulk sample has no net magnetisation until a field is applied.</p>
    </>
  );
  return (
    <StepFrame step={1} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--sample">
      {!sample ? (
        <>
          <p data-testid="what-is-happening">A hydrogen nucleus is a single proton. It has an <b>intrinsic property called spin</b>, and because the proton is charged it behaves like a tiny bar magnet: the arrow is its <b>magnetic moment μ</b>.</p>
          <p className="ss-note" data-testid="spin-note">{SPIN_CLARIFICATION}</p>
          <p className="ss-prompt">Press <b>Show Proton Sample</b> to see what a real sample contains.</p>
        </>
      ) : (
        <>
          <p data-testid="what-is-happening">A real sample contains an enormous number of hydrogen nuclei. With <b>no magnetic field</b> each moment points in its own random direction, so there is <b>no preferred orientation</b> and the moments cancel: the sample has no net magnetisation.</p>
          <p className="ss-note" data-testid="spin-note">{SPIN_CLARIFICATION}</p>
          <p className="ss-prompt">Next: what happens when we switch on a magnetic field?</p>
        </>
      )}
    </StepFrame>
  );
}
