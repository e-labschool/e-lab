import { MiniSwitch, SettingToggle } from "../../../../components/simulation/SimulationDashboard.jsx";
import { GAMMA_H1, HBAR, MU_Z, sci } from "../physics/constants.js";
import { CONE_ANGLE } from "../physics/spinEnsemble.js";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import Slot from "../../components/Slot.jsx";
import ProtonScene from "../scene/ProtonScene.jsx";
import { Explain, Group, PredictBox, Stats, TeacherNote } from "../../components/ui.jsx";
import { usePhase } from "../../components/useTimeline.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";

const deg = (r) => ((r * 180) / Math.PI).toFixed(1);

/** The two allowed orientations of the moment relative to B0 (side view). */
function OrientationDiagram() {
  const th = CONE_ANGLE; const L = 86; const cx = 110; const cy = 120;
  const tip = (s) => [cx + L * Math.sin(th), cy - s * L * Math.cos(th)];
  const [ax, ay] = tip(1); const [bx, by] = tip(-1);
  return (
    <svg viewBox="0 0 230 250" className="ss-orient" role="img" aria-label="Side view: the proton magnetic moment can only make an angle of 54.7 degrees with the field direction (alpha) or 125.3 degrees (beta)" data-testid="orientation-diagram">
      <defs><marker id="ss-ah" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="context-stroke" /></marker></defs>
      <line x1={cx} y1={cy + 105} x2={cx} y2={cy - 108} stroke="var(--ss-b0)" strokeWidth="2.4" markerEnd="url(#ss-ah)" />
      <text x={cx + 6} y={cy - 104} className="ss-svgtext" fill="var(--ss-b0)">B₀ (z)</text>
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="var(--ss-alpha)" strokeWidth="3" markerEnd="url(#ss-ah)" />
      <line x1={cx} y1={cy} x2={bx} y2={by} stroke="var(--ss-beta)" strokeWidth="3" markerEnd="url(#ss-ah)" />
      <line x1={ax} y1={ay} x2={cx} y2={ay} stroke="var(--ss-alpha)" strokeDasharray="3 3" /><line x1={bx} y1={by} x2={cx} y2={by} stroke="var(--ss-beta)" strokeDasharray="3 3" />
      <text x={ax + 6} y={ay + 4} className="ss-svgtext" fill="var(--ss-alpha)">α  m = +½</text>
      <text x={bx + 6} y={by + 4} className="ss-svgtext" fill="var(--ss-beta)">β  m = −½</text>
      <text x={cx - 8} y={ay + 14} textAnchor="end" className="ss-svgtext ss-svgtext--sm" fill="var(--ss-alpha)">μz = +γħ/2</text>
      <text x={cx - 8} y={by - 6} textAnchor="end" className="ss-svgtext ss-svgtext--sm" fill="var(--ss-beta)">μz = −γħ/2</text>
      <path d={`M ${cx} ${cy - 30} A 30 30 0 0 1 ${cx + 30 * Math.sin(th)} ${cy - 30 * Math.cos(th)}`} fill="none" stroke="var(--ss-neutral)" />
      <text x={cx + 16} y={cy - 34} className="ss-svgtext ss-svgtext--sm">{deg(th)}°</text>
      <text x={cx} y="244" textAnchor="middle" className="ss-svgtext ss-svgtext--sm">only these two z-components are allowed</text>
    </svg>
  );
}
export { OrientationDiagram };

/** Stage 1, activity 1: the hydrogen-1 nucleus (NuclearSpinExplorer). */
export default function ProtonView({ slots }) {
  const a = useStudioActions();
  const f = useStudio((s) => s.field);
  const mode = useStudio((s) => s.mode);
  const phase = usePhase({ enabled: f.inField });
  const text = f.inField
    ? `In a field the moment can only take two orientations: its z-component is +γħ/2 (α, lower energy) or −γħ/2 (β, higher energy), and it precesses about B₀ on a cone at ${deg(CONE_ANGLE)}° (α) or ${deg(Math.PI - CONE_ANGLE)}° (β).`
    : "A ¹H nucleus (a proton) has spin I = ½ and therefore a magnetic moment μ. The arrow shows the moment; drag to rotate the view. The blurred sphere only marks where the nucleus is: spin is not a little ball turning round.";
  return (
    <>
      <div className="ss-viz" data-testid="proton-viz">
        <ThreeCanvas label="A hydrogen nucleus drawn as a blurred sphere with its magnetic moment as an arrow" position={[2.6, -3.4, 1.8]}>
          <ProtonScene showMu={f.mu} inField={f.inField} state={f.spin} phase={phase * 2 * Math.PI * 0.4} analogy={f.analogy} labels={f.labels} />
        </ThreeCanvas>
        {f.analogy && (
          <div className="ss-badge-tl ss-badge--warn" data-testid="analogy-note">
            <b>Analogy only: limits</b>
            <span>A real proton is not a ball spinning about an axis. Spin is intrinsic quantum angular momentum: it has no rotating surface, its size is fixed (I = ½), and along any chosen axis only two values (±½) are ever found, which a classical spinning ball does not show.</span>
          </div>
        )}
        <div className="ss-hud"><span>Drag to rotate · scroll to zoom</span></div>
      </div>
      <Slot target={slots.controls}>
        <Group title="Hydrogen-1 nucleus" testId="grp-proton">
          <SettingToggle id="ss-mu" label="Show magnetic moment μ" checked={f.mu} onChange={(v) => a.patch("field", { mu: v })} testId="toggle-mu" />
          <SettingToggle id="ss-lab" label="Show labels" checked={f.labels} onChange={(v) => a.patch("field", { labels: v })} testId="toggle-proton-labels" />
          <SettingToggle id="ss-in" label="Place the proton in a field B₀" hint="Only two orientations are allowed" checked={f.inField} onChange={(v) => a.patch("field", { inField: v })} testId="toggle-infield" />
          {f.inField && (
            <MiniSwitch ariaLabel="Spin state" testId="spin-state" fill value={f.spin} onChange={(v) => a.patch("field", { spin: v })}
              options={[{ id: "alpha", label: "α  (m = +½)" }, { id: "beta", label: "β  (m = −½)" }]} />
          )}
          <SettingToggle id="ss-analogy" label="Classical spinning-ball analogy" hint="Shows the analogy and its limits" checked={f.analogy} onChange={(v) => a.patch("field", { analogy: v })} testId="toggle-analogy" />
        </Group>
        <Group title="What is fixed" testId="grp-facts">
          <Stats columns={2} items={[
            { id: "I", label: "Spin quantum number I", value: "½" },
            { id: "m", label: "Allowed m", value: "+½, −½" },
            { id: "mu", label: "|μz| = γħ/2", value: sci(MU_Z, 3), unit: "J T⁻¹" },
            { id: "g", label: "γ(¹H)", value: sci(GAMMA_H1, 4), unit: "rad s⁻¹ T⁻¹" },
          ]} />
          <p className="ss-hint">ħ = {sci(HBAR, 4)} J s. The moment interacts with an applied field B₀, which is what NMR uses.</p>
        </Group>
        {mode === "student" && (
          <PredictBox
            testId="predict-spin" question="Is a proton a tiny ball that physically spins around its own axis?"
            options={[{ id: "yes", label: "Yes, like a spinning top" }, { id: "no", label: "No: spin is an intrinsic quantum property" }]} correct="no"
            feedback={(id) => (id === "no" ? "Right. Spin is intrinsic angular momentum with no classical rotation behind it; the proton still has a magnetic moment." : "That is the classical analogy and it fails: spin has only two allowed values along an axis and there is no rotating surface.")}
          />
        )}
        <TeacherNote title="Teacher: intrinsic angular momentum vs classical rotation">
          <p>Spin is an <b>intrinsic</b> form of angular momentum with a fixed magnitude √(I(I+1))ħ; it cannot be speeded up or slowed down and it has no axis you can see rotating. A classical spinning sphere can have any angular momentum about any axis.</p>
          <p>If you use the “spinning ball” picture, say what it is for: it explains why a moving charge has a magnetic moment, and it is wrong about everything else (size, speed, continuous orientations).</p>
        </TeacherNote>
      </Slot>
      <Slot target={slots.graph}>
        <Group title="Allowed orientations" testId="grp-orient"><OrientationDiagram /><p className="ss-hint">Not a spinning arrow that can point anywhere: only two z-components exist (a quantum result).</p></Group>
      </Slot>
      <Explain slots={slots}>{text}</Explain>
    </>
  );
}
