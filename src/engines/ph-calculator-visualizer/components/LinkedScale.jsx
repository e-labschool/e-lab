import { useCallback, useRef } from "react";
import { PH_MIN, PH_MAX, concentrationFromPH, formatDecimal, formatScientific } from "../lib/ph.js";

const ROW_PH = Array.from({ length: PH_MAX - PH_MIN + 1 }, (_, i) => PH_MIN + i);
const ROW_HEIGHT = 25;
const TRACK_HEIGHT = ROW_HEIGHT * (ROW_PH.length - 1);
const PAD = ROW_HEIGHT / 2;

/**
 * The whole simulation, visually: one draggable horizontal marker that
 * slides across a fixed dual ladder of pH (right) and the matching
 * [H3O+] decade (left) — moving it updates both at once, which is the
 * point: every pH step IS a tenfold concentration step, shown directly
 * rather than explained separately.
 */
export default function LinkedScale({ pH, onChange }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  const updateFromClientY = useCallback(
    (clientY) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientY - rect.top - PAD) / TRACK_HEIGHT));
      onChange(PH_MIN + fraction * (PH_MAX - PH_MIN));
    },
    [onChange]
  );

  function handlePointerDown(e) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientY(e.clientY);
  }
  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    updateFromClientY(e.clientY);
  }
  function handlePointerUp(e) {
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  }

  function rowY(p) {
    return PAD + ((p - PH_MIN) / (PH_MAX - PH_MIN)) * TRACK_HEIGHT;
  }
  const markerTop = rowY(pH);

  return (
    <div className="select-none">
      <div className="relative h-4 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>
        <span className="absolute right-1/2 pr-2">[H₃O⁺] mol dm⁻³</span>
        <span className="absolute left-1/2 pl-2">pH</span>
      </div>

      <div
        ref={trackRef}
        className="relative mt-1 cursor-ns-resize touch-none"
        style={{ height: TRACK_HEIGHT + ROW_HEIGHT }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ background: "var(--color-line)" }} />

        {ROW_PH.map((p) => {
          const isNeutral = p === 7;
          const conc = concentrationFromPH(p);
          return (
            <div
              key={p}
              className="absolute left-0 right-0"
              style={{ top: rowY(p), height: ROW_HEIGHT, transform: "translateY(-50%)" }}
            >
              <span className="absolute right-1/2 flex items-baseline gap-1.5 pr-2" style={{ top: "50%", transform: "translateY(-50%)" }}>
                <span className="text-[12px] font-medium tabular-nums" style={{ color: "var(--color-ink)" }}>{formatDecimal(conc)}</span>
                <span className="text-[9px]" style={{ color: "var(--color-ink-faint)" }}>{formatScientific(conc)}</span>
              </span>
              <span
                className={`absolute left-1/2 whitespace-nowrap pl-2 text-[12px] tabular-nums ${isNeutral ? "font-bold" : "font-medium"}`}
                style={{ top: "50%", transform: "translateY(-50%)", color: isNeutral ? "var(--color-teal)" : "var(--color-ink-soft)" }}
              >
                {p}{isNeutral && <span className="ml-1 text-[9px] font-medium uppercase tracking-wide">Neutral</span>}
              </span>
            </div>
          );
        })}

        <div className="pointer-events-none absolute left-0 right-0" style={{ top: markerTop, height: 2, background: "var(--color-indigo)" }} />
        <div
          className="pointer-events-none absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ top: markerTop, background: "var(--color-indigo)", borderColor: "var(--color-paper)" }}
        />
      </div>

      <div className="mt-1 flex justify-between px-1 text-[10px]" style={{ color: "var(--color-ink-faint)" }}>
        <span>Acidic — higher [H₃O⁺]</span>
        <span>Basic — lower [H₃O⁺]</span>
      </div>
    </div>
  );
}
