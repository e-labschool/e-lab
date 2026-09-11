import { useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import EquationPanel from "./components/EquationPanel.jsx";
import ConcentrationControls from "./components/ConcentrationControls.jsx";
import PHScale from "./components/PHScale.jsx";
import FactorOfTenPanel from "./components/FactorOfTenPanel.jsx";
import { DEFAULT_PH } from "./lib/ph.js";

// Single source of truth is pH itself (not concentration) — a slider
// linear in pH already behaves as a logarithmic concentration slider,
// which keeps the whole component simple: every other value (the big
// [H3O+] readout, the scale marker, the factor-of-10 neighbours) is
// derived from this one number, so nothing can ever get out of sync.
export default function PHCalculatorVisualizer({ compact = false }) {
  const [pH, setPH] = useState(DEFAULT_PH);

  const body = (
    <div className="flex flex-col gap-4 rounded-xl border p-3 sm:p-4" style={{ borderColor: "var(--color-line)", background: "var(--color-paper)" }}>
      <EquationPanel pH={pH} />
      <ConcentrationControls pH={pH} onChange={setPH} />
      <PHScale pH={pH} />
      <FactorOfTenPanel pH={pH} />
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame title="pH Calculator & Visualizer" subtitle="See how [H3O+] and pH move together on a logarithmic scale.">
      {body}
    </InteractiveFrame>
  );
}
