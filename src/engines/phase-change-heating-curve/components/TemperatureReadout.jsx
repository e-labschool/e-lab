import { forwardRef, useImperativeHandle, useRef } from "react";
import { PALETTE } from "../../particle-model-visualizer/data/palette.js";
import { temperatureAt } from "../data/timeline.js";

/**
 * Exposes render(t) so the orchestrator's single tick can push the same
 * value it sends to the graph — both read temperatureAt(t) from the exact
 * same clock, so they can never show a mismatched number.
 */
const TemperatureReadout = forwardRef(function TemperatureReadout(_, ref) {
  const valueRef = useRef(null);

  useImperativeHandle(ref, () => ({
    render(t) {
      if (valueRef.current) valueRef.current.textContent = `${Math.round(temperatureAt(t))}°C`;
    },
  }));

  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-1.5" style={{ borderColor: PALETTE.border, background: PALETTE.panel }}>
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: PALETTE.eyebrow }}>Temperature</span>
      <span ref={valueRef} className="text-lg font-semibold tabular-nums" style={{ color: PALETTE.textPrimary }}>
        -20°C
      </span>
    </div>
  );
});

export default TemperatureReadout;
