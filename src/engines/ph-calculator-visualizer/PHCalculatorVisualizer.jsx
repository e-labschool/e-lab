import { useState } from "react";
import { RotateCcw } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import LinkedScale from "./components/LinkedScale.jsx";
import { DEFAULT_PH, PH_MIN, PH_MAX, concentrationFromPH, hydroxideFromPH, pOHFromPH, clampPH, interpretInput, formatDecimal, formatScientific, formatPH } from "./lib/ph.js";
import "./PHCalculator.css";

function Body() {
  const { isViewport } = useSimulationPresentation();
  const [pH, setPH] = useState(DEFAULT_PH);
  const [concText, setConcText] = useState(() => formatDecimal(concentrationFromPH(DEFAULT_PH)));
  const [phText, setPhText] = useState(() => formatPH(DEFAULT_PH));
  const [message, setMessage] = useState(null);

  function apply(next) { const c = clampPH(next); setPH(c); setConcText(formatDecimal(concentrationFromPH(c))); setPhText(formatPH(c)); setMessage(null); }
  function commit(kind) {
    const r = interpretInput(kind === "ph" ? phText : concText, kind);
    if (r.ok) apply(r.pH); else setMessage(r.reason); // the typed text stays visible; nothing is silently changed
  }
  const conc = concentrationFromPH(pH);
  const OH = hydroxideFromPH(pH);
  const tag = Math.abs(pH - 7) < 0.005 ? "neutral" : pH < 7 ? "acidic" : "basic";

  return (
    <div className={"phc" + (isViewport ? " is-viewport" : "")}>
      <LinkedScale pH={pH} onChange={(p) => apply(Math.round(p * 100) / 100)} />
      <div className="phc-side">
        <div className="phc-reads" aria-live="polite">
          <div><span>[H{"₃"}O{"⁺"}] / mol dm{"⁻³"}</span><strong>{formatDecimal(conc)}</strong><small>{formatScientific(conc)}</small></div>
          <div><span>pH</span><strong>{formatPH(pH)}</strong><small>{tag}</small></div>
          <div><span>pOH</span><strong>{formatPH(pOHFromPH(pH))}</strong></div>
          <div><span>[OH{"⁻"}] / mol dm{"⁻³"}</span><strong>{formatDecimal(OH)}</strong><small>{formatScientific(OH)}</small></div>
        </div>
        <p className="phc-eq">pH = {"−"}log{"₁₀"}[H{"₃"}O{"⁺"}] {"→"} {formatPH(pH)} = {"−"}log{"₁₀"}({formatScientific(conc)}) {"·"} pH + pOH = 14 (K<sub>w</sub> = 1.00 {"×"} 10{"⁻¹⁴"} at 298 K)</p>
        <div className="phc-inputs">
          <label>Type [H{"₃"}O{"⁺"}]
            <input type="text" inputMode="decimal" value={concText} aria-invalid={!!message} aria-describedby="phc-msg" onChange={(e) => setConcText(e.target.value)} onBlur={() => commit("conc")} onKeyDown={(e) => e.key === "Enter" && commit("conc")} /></label>
          <label>or type pH
            <input type="text" inputMode="decimal" value={phText} aria-invalid={!!message} aria-describedby="phc-msg" onChange={(e) => setPhText(e.target.value)} onBlur={() => commit("ph")} onKeyDown={(e) => e.key === "Enter" && commit("ph")} /></label>
          <button type="button" className="sim-btn phc-reset" onClick={() => apply(DEFAULT_PH)}><RotateCcw size={13} aria-hidden="true" /> Reset</button>
        </div>
        <p id="phc-msg" className="phc-msg" role={message ? "alert" : undefined}>{message}</p>
        <p className="phc-note">Each step of 1 on the pH scale is a factor of 10 in [H{"₃"}O{"⁺"}]. Convention: pH is given to 2 decimal places, so concentrations to 2 significant figures. The scale runs from pH {PH_MIN} to {PH_MAX}: 10 mol dm{"⁻³"} strong acid has pH {"−"}1, and pH below 0 or above 14 is possible. Glass pH meters are only reliable from about 0 to 14, and very concentrated solutions are not ideal.</p>
        <p className="phc-note">Keyboard: focus the scale, then use {"↑↓"} (0.1), Shift+{"↑↓"} or PageUp/PageDown (1), Home and End.</p>
      </div>
    </div>
  );
}

export default function PHCalculatorVisualizer({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="pH Calculator & Visualizer" subtitle="Drag the marker to link [H3O+] and pH." compact={compact} standalone={standalone}>
      <Body />
    </InteractiveFrame>
  );
}
