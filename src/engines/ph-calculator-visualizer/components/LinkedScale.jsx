import { useCallback, useRef } from "react";
import { PH_MIN, PH_MAX, concentrationFromPH, hydroxideFromPH, formatDecimal, formatScientific, formatPH, clampPH } from "../lib/ph.js";

const ROWS = Array.from({ length: PH_MAX - PH_MIN + 1 }, (_, i) => PH_MIN + i);
const ROW_H = 25;
const TRACK_H = ROW_H * (ROWS.length - 1);
const PAD = ROW_H / 2;

/**
 * One draggable marker on a ladder of pH rows with the matching [H3O+] (left) and [OH-] (right). Exposed as a real slider
 * (role="slider", arrow / Page / Home / End keys, aria-valuetext) and highlighted as a band BEHIND the text, so no line
 * ever strikes through a number.
 */
export default function LinkedScale({ pH, onChange }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const fromY = useCallback((clientY) => {
    const rect = trackRef.current.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientY - rect.top - PAD) / TRACK_H));
    onChange(PH_MIN + f * (PH_MAX - PH_MIN));
  }, [onChange]);
  const rowY = (p) => PAD + ((p - PH_MIN) / (PH_MAX - PH_MIN)) * TRACK_H;
  const onKey = (e) => {
    const big = e.shiftKey ? 1 : 0.1; let next = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = pH + big;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = pH - big;
    else if (e.key === "PageDown") next = pH + 1; else if (e.key === "PageUp") next = pH - 1;
    else if (e.key === "Home") next = PH_MIN; else if (e.key === "End") next = PH_MAX;
    if (next !== null) { e.preventDefault(); onChange(clampPH(Math.round(next * 100) / 100)); }
  };
  const nearest = Math.round(pH);
  return (
    <div className="phc-scale">
      <div className="phc-scale-head" aria-hidden="true"><span>[H{"₃"}O{"⁺"}] mol dm{"⁻³"}</span><span>pH</span><span>[OH{"⁻"}] mol dm{"⁻³"}</span></div>
      <div
        ref={trackRef} className="phc-track" style={{ height: TRACK_H + ROW_H }} tabIndex={0} role="slider" aria-orientation="vertical"
        aria-label="pH scale" aria-valuemin={PH_MIN} aria-valuemax={PH_MAX} aria-valuenow={Number(pH.toFixed(2))}
        aria-valuetext={`pH ${formatPH(pH)}, hydronium ${formatDecimal(concentrationFromPH(pH))} mol per cubic decimetre`}
        onKeyDown={onKey}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus(); fromY(e.clientY); }}
        onPointerMove={(e) => dragging.current && fromY(e.clientY)}
        onPointerUp={(e) => { dragging.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* released */ } }}
      >
        <div className="phc-band" style={{ top: rowY(pH) - 11 }} aria-hidden="true"><i /></div>
        {ROWS.map((p) => (
          <div key={p} className={"phc-row" + (p === nearest ? " is-near" : "")} style={{ top: rowY(p) - ROW_H / 2, height: ROW_H }} aria-hidden="true">
            <span className="phc-c"><b>{formatDecimal(concentrationFromPH(p))}</b><small>{formatScientific(concentrationFromPH(p))}</small></span>
            <span className={"phc-p" + (p === 7 ? " is-neutral" : "")}>{p < 0 ? `\u2212${-p}` : p}{p === 7 && <small>neutral</small>}</span>
            <span className="phc-o"><b>{formatDecimal(hydroxideFromPH(p))}</b></span>
          </div>
        ))}
      </div>
      <div className="phc-ends" aria-hidden="true"><span>Acidic: higher [H{"₃"}O{"⁺"}]</span><span>Basic: lower [H{"₃"}O{"⁺"}]</span></div>
    </div>
  );
}
