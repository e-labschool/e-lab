import { useEffect, useState } from "react";
import { Eye, EyeOff, HelpCircle } from "lucide-react";
import { DashPanel, LiveTiles } from "../../../components/simulation/SimulationDashboard.jsx";
import { predictContent } from "../predict.js";

// Four small coloured tiles (same colours as the slider badges).
export function LiveValues({ readings }) {
  // Debounced plain-language summary for screen readers (the visible numbers
  // change continuously while a slider is dragged; announcing each would spam).
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounce(`Pressure ${readings.pressure.toFixed(2)} atmospheres at ${readings.T} kelvin, ${readings.V} litres, ${readings.N} particles.`);
    }, 700);
    return () => clearTimeout(t);
  }, [readings.pressure, readings.T, readings.V, readings.N]);
  return (
    <>
      <LiveTiles
        items={[
          { id: "P", label: "Pressure (P)", value: `${readings.pressure.toFixed(2)} atm`, bg: "#DDF4E2", testId: "live-P" },
          { id: "V", label: "Volume (V)", value: `${readings.V.toFixed(1)} L`, bg: "#E1EDFD", testId: "live-V" },
          { id: "T", label: "Temperature (T)", value: `${readings.T} K`, bg: "#FDEFD0", testId: "live-T" },
          { id: "N", label: "Particles (n)", value: `${readings.N}`, bg: "#E9E4FB", testId: "live-N" },
        ]}
      />
      <p className="sd-sr" role="status" aria-live="polite">{announce}</p>
    </>
  );
}

// Predict & Reveal: a short question; the answer stays hidden until requested
// and replaces the question in the same box so the row never changes height.
export function PredictPanel({ controls, revealed, onToggle }) {
  const c = predictContent(controls);
  return (
    <DashPanel
      title="Predict & Reveal" icon={<HelpCircle size={16} className="text-[#2F7BF5]" aria-hidden="true" />}
      ariaLabel="Predict and reveal" tint testId="predict"
      aside={
        <button type="button" className="sd-btn sd-btn--sm" onClick={onToggle} aria-expanded={revealed} data-testid="show-answer">
          {revealed ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
          {revealed ? "Hide answer" : "Show answer"}
        </button>
      }
    >
      <div aria-live="polite">
        {revealed ? (
          <p className="sd-text sd-text--lg" data-testid="predict-answer"><strong>Answer: </strong>{c.answer}</p>
        ) : (
          <p className="sd-text sd-text--lg" data-testid="predict-question">{c.question} Try it with the sliders.</p>
        )}
      </div>
    </DashPanel>
  );
}
