import { useEffect, useState } from "react";
import { LiveStrip, PredictPopover } from "../../../components/simulation/SimulationDashboard.jsx";
import { predictContent } from "../predict.js";

const fmtP = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const fmtV = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x.toFixed(3));

// One-line strip of small coloured live values (same colours as the slider badges).
export function LiveValues({ readings }) {
  // Debounced plain-language summary for screen readers (the visible numbers
  // change continuously while a slider is dragged; announcing each would spam).
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounce(`Pressure ${fmtP(readings.pressure)} atmospheres at ${readings.T} kelvin, ${fmtV(readings.V)} litres, ${readings.n.toFixed(2)} moles, Z ${readings.Z.toFixed(3)}.`);
    }, 700);
    return () => clearTimeout(t);
  }, [readings.pressure, readings.T, readings.V, readings.n, readings.Z]);
  return (
    <>
      <LiveStrip
        items={[
          { id: "P", label: "P", value: `${fmtP(readings.pressure)} atm`, bg: "#EBE4FC", testId: "live-P", title: "Pressure" },
          { id: "V", label: "V", value: `${fmtV(readings.V)} L`, bg: "#DFF5E4", testId: "live-V", title: "Volume" },
          { id: "T", label: "T", value: `${readings.T} K`, bg: "#FDEFD0", testId: "live-T", title: "Temperature" },
          { id: "n", label: "n", value: `${readings.n.toFixed(2)} mol`, bg: "#E1EDFD", testId: "live-N", title: "Amount of gas" },
          { id: "Z", label: "Z", value: readings.Z.toFixed(3), bg: "#F1F3F8", testId: "live-Z", title: "Compressibility factor Z = PV/(nRT)" },
        ]}
      />
      <p className="sd-sr" role="status" aria-live="polite">{announce}</p>
    </>
  );
}

// Predict: a small optional button; the question and (on request) the answer float above the strip.
export function PredictPanel({ controls, revealed, onToggle }) {
  const c = predictContent(controls);
  return <PredictPopover question={`${c.question} Try it with the sliders.`} answer={c.answer} revealed={revealed} onToggle={onToggle} />;
}
