import { useEffect, useState } from "react";
import { LiveStrip, PredictPopover } from "../../../components/simulation/SimulationDashboard.jsx";
import { predictContent } from "../predict.js";
import { IB_UNITS, fmtPressure, fmtVolume, unitLabelP, unitLabelV } from "../model.js";
import { PRESSURE_UNITS, VOLUME_UNITS } from "../../../lib/gas/gasUnits.js";


// One-line strip of small coloured live values (same colours as the slider badges).
export function LiveValues({ readings, units = IB_UNITS }) {
  const fmtP = (x) => fmtPressure(x, units); const fmtV = (x) => fmtVolume(x, units);
  // Debounced plain-language summary for screen readers (the visible numbers
  // change continuously while a slider is dragged; announcing each would spam).
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounce(`Pressure ${fmtP(readings.pressure)} ${PRESSURE_UNITS[units.pressure]?.spoken} at ${Number(readings.T.toFixed(2))} kelvin, ${fmtV(readings.V)} ${VOLUME_UNITS[units.volume]?.spoken}, ${readings.n.toFixed(2)} moles, Z ${readings.Z.toFixed(3)}.`);
    }, 700);
    return () => clearTimeout(t);
  }, [readings.pressure, readings.T, readings.V, readings.n, readings.Z, units]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <LiveStrip
        items={[
          { id: "P", label: "P", value: `${fmtP(readings.pressure)} ${unitLabelP(units)}`, bg: "#EBE4FC", testId: "live-P", title: "Pressure" },
          { id: "V", label: "V", value: `${fmtV(readings.V)} ${unitLabelV(units)}`, bg: "#DFF5E4", testId: "live-V", title: "Volume" },
          { id: "T", label: "T", value: `${Number(readings.T.toFixed(2))} K`, bg: "#FDEFD0", testId: "live-T", title: "Temperature" },
          { id: "n", label: "n", value: `${readings.n.toFixed(2)} mol`, bg: "#E1EDFD", testId: "live-N", title: "Amount of gas" },
          { id: "Z", label: "Z", value: readings.Z.toFixed(3), bg: "#F1F3F8", testId: "live-Z", title: "Compressibility factor Z = PV/(nRT)" },
        ]}
      />
      <p className="sd-sr" role="status" aria-live="polite">{announce}</p>
    </>
  );
}

// Predict: a small optional button; the question and (on request) the answer float above the strip.
export function PredictPanel({ controls, revealed, onToggle, units = IB_UNITS }) {
  const c = predictContent(controls, units);
  return <PredictPopover question={`${c.question} Try it with the sliders.`} answer={c.answer} revealed={revealed} onToggle={onToggle} />;
}
