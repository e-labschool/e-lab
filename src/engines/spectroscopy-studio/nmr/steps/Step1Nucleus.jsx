import { useRef } from "react";
import { Users, User } from "lucide-react";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge, Legend } from "../../components/ui.jsx";
import { usePhase, useTransition } from "../../components/useAnim.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import SampleScene from "../scene/SampleScene.jsx";

/** Step 1: one hydrogen nucleus and its magnetic moment, then (button) a conceptual sample of many nuclei with no preferred orientation. */
export default function Step1Nucleus() {
  const a = useStudioActions();
  const sample = useStudio((s) => s.nucleus.sample);
  const p = useTransition({ id: "nucleus-sample", target: sample ? 1 : 0, seconds: 2.6 });
  const phase = usePhase();
  const live = useRef({ p: 0, phase: 0 });
  live.current = { p, phase };
  const done = p > 0.97; const single = p < 0.15;
  const setSample = (v) => { a.setPaused(false); a.patch("nucleus", { sample: v }); };

  const viz = (
    <>
      <ThreeCanvas label="A large hydrogen nucleus with an arrow for its magnetic moment; after the button is pressed, many nuclei each with a randomly oriented line" position={[2.5, -3.0, 1.7]} fallback="The picture of the nucleus needs WebGL. In words: a hydrogen nucleus has a magnetic moment (an arrow); in a sample the moments of many nuclei point in random directions.">
        <SampleScene live={live} single={single} />
      </ThreeCanvas>
      <Badge className="ss-badge--tl" testId="concept-badge" tone={sample ? "warn" : undefined}>
        {sample ? <><b>Conceptual picture.</b> {done ? "Each line shows the orientation of one nucleus's magnetic moment. Real samples have about 10²⁰ nuclei; only a few dozen are drawn." : "The nucleus is being replaced by many nuclei…"}</> : <><b>One ¹H nucleus.</b> The arrow is its magnetic moment μ. Drag to rotate.</>}
      </Badge>
      <Legend className="ss-legend-bl" items={sample ? [{ color: "#fde68a", label: "line: orientation of one moment (no arrowhead: conceptual)", shape: "bar" }, { color: "#7dd3fc", label: "sphere: one nucleus", shape: "dot" }] : [{ color: "#fcd34d", label: "arrow: magnetic moment μ", shape: "arrow" }, { color: "#7dd3fc", label: "fuzzy sphere: where the nucleus is", shape: "dot" }]} />
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
      <p>The proton has spin quantum number I = ½. Its magnetic moment is μ = γħI, so the allowed values along any chosen axis are only ±γħ/2, a fact the next step uses. “Spin” is intrinsic angular momentum with no classical picture; the nucleus is not a tiny ball that rotates. The fuzzy sphere only marks where the nucleus is.</p>
      <p>The ensemble drawing is deliberately not made of arrows: arrows are reserved for physical vectors (μ here, B₀ and M later). Random orientations mean the vector sum is zero, so a bulk sample has no net magnetisation until a field is applied.</p>
    </>
  );
  return (
    <StepFrame step={1} viz={viz} strip={strip} teacher={teacher}>
      {!sample ? (
        <>
          <p data-testid="what-is-happening">A hydrogen nucleus is a single proton. It has an <b>intrinsic property called spin</b>, and because the proton is charged it behaves like a tiny bar magnet: the arrow is its <b>magnetic moment μ</b>.</p>
          <p>Spin is a quantum property. It does <b>not</b> mean the nucleus is a little ball turning round.</p>
          <p className="ss-prompt">Press <b>Show Proton Sample</b> to see what a real sample contains.</p>
        </>
      ) : (
        <>
          <p data-testid="what-is-happening">A real sample contains an enormous number of hydrogen nuclei. With <b>no magnetic field</b> each moment points in its own random direction, so there is <b>no preferred orientation</b> and the moments cancel: the sample has no net magnetisation.</p>
          <p>This is a <b>conceptual picture</b>: positions and directions are illustrative, and the lines gently tumble to show that nothing is aligned.</p>
          <p className="ss-prompt">Next: what happens when we switch on a magnetic field?</p>
        </>
      )}
    </StepFrame>
  );
}
