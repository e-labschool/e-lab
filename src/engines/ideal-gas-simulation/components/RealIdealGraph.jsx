import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CAUTION_TEXT, LIMITS, Z_P_MAX, Z_P_MIN, Z_TOLERANCE_PCT,
  generateZCurve, zAxisRange, zMarker,
} from "../model.js";

// "Real vs Ideal Gas Behaviour": compressibility factor Z = PV/(nRT) against
// pressure. Plain SVG drawn from model.generateZCurve() / model.zMarker();
// nothing is stored or hard-coded here. The pressure axis is logarithmic
// (0.01-100 atm) so the whole 0.2-5 atm control window and the high-pressure
// upturn are both visible. Ideal gas: solid blue line at Z = 1. Real gas:
// dashed orange curve. Current state: filled dot with a ring.
const C_IDEAL = "#2F7BF5";
const C_REAL = "#E8590C";
const C_MARK = "#14226B";
const M = { l: 44, r: 12, t: 8, b: 34 };
const LOG_MIN = Math.log10(Z_P_MIN);
const LOG_SPAN = Math.log10(Z_P_MAX) - LOG_MIN;

function yTicks(lo, hi) {
  const span = hi - lo;
  const step = span <= 0.6 ? 0.1 : span <= 1.4 ? 0.2 : span <= 3 ? 0.5 : 1;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(2));
  return out;
}
const X_TICKS = [0.01, 0.1, 1, 10, 100];
const fmtP = (v) => (v >= 1 ? String(v) : String(v));

function useSize(ref) {
  const [size, setSize] = useState({ w: 480, h: 200 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(200, Math.floor(r.width)), h: Math.max(120, Math.floor(r.height)) });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return size;
}

function LegendSwatch({ color, dash, children, dot, faint }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <svg width="24" height="10" aria-hidden="true">
        {dot ? (
          <>
            <circle cx="12" cy="5" r="4.6" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />
            <circle cx="12" cy="5" r="2.4" fill={color} />
          </>
        ) : (
          <line x1="1" y1="5" x2="23" y2="5" stroke={color} strokeWidth="2.2" strokeDasharray={dash} strokeLinecap="round" opacity={faint ? 0.5 : 1} />
        )}
      </svg>
      {children}
    </span>
  );
}

export default function RealIdealGraph({ state, fillHeight = false }) {
  const plotRef = useRef(null);
  const clipId = useId();
  const { w, h } = useSize(plotRef);
  const [hoverP, setHoverP] = useState(null);
  const real = state.mode === "real";
  const { n, T } = state;
  // The curve depends only on n, T and the gas model: moving V or P just moves the marker.
  const curve = useMemo(() => generateZCurve(n, T, state.mode), [n, T, state.mode]);
  const marker = useMemo(() => zMarker(state), [state]);
  const axis = useMemo(() => zAxisRange(curve, marker), [curve, marker]);

  const pw = Math.max(40, w - M.l - M.r);
  const ph = Math.max(40, h - M.t - M.b);
  const sx = (P) => M.l + ((Math.log10(P) - LOG_MIN) / LOG_SPAN) * pw;
  const sy = (Z) => M.t + ph - ((Z - axis.yMin) / (axis.yMax - axis.yMin)) * ph;
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.P).toFixed(1)} ${sy(p.Z).toFixed(1)}`).join("");
  const yt = yTicks(axis.yMin, axis.yMax);
  const endPt = curve.end && curve.points.length ? curve.points[curve.points.length - 1] : null;

  const zText = marker.status === "ok" ? marker.Z.toFixed(3) : null;
  const label =
    `Real vs Ideal Gas Behaviour: compressibility factor Z against pressure in atmospheres at ${Math.round(T)} kelvin and ${n.toFixed(2)} moles. ` +
    `Ideal gas reference line at Z equals 1. ${real ? "Real gas curve. " : "Faint real gas curve for comparison. "}` +
    (zText ? `Current state: P ${marker.P.toFixed(2)} atm, Z ${zText}, ${marker.deviationPct.toFixed(1)} percent from 1. ${marker.text}` : "Current state: the simplified model is unreliable here.");

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const lg = LOG_MIN + ((e.clientX - r.left - M.l) / pw) * LOG_SPAN;
    setHoverP(lg >= LOG_MIN && lg <= LOG_MIN + LOG_SPAN ? Math.pow(10, lg) : null);
  };
  let hover = null;
  if (hoverP != null && curve.points.length > 1 && hoverP >= curve.points[0].P && hoverP <= curve.points[curve.points.length - 1].P) {
    const pts = curve.points;
    let i = 1;
    while (i < pts.length - 1 && pts[i].P < hoverP) i++;
    const a = pts[i - 1], b = pts[i];
    const t = (Math.log(hoverP) - Math.log(a.P)) / (Math.log(b.P) - Math.log(a.P));
    hover = { P: hoverP, Z: a.Z + t * (b.Z - a.Z) };
  }

  // Debounced copy for the screen-reader live region (the visible text updates continuously).
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounce(zText ? `Z equals ${zText}, ${marker.deviationPct.toFixed(1)} percent from 1. ${marker.text}` : marker.text);
    }, 600);
    return () => clearTimeout(t);
  }, [zText, marker.deviationPct, marker.text]);

  const note = marker.outside
    ? "The current state is outside the plotted pressure range."
    : marker.caution ? CAUTION_TEXT[marker.caution] : null;

  const mx = sx(marker.plotP);
  const my = marker.status === "ok" ? sy(Math.min(axis.yMax, Math.max(axis.yMin, marker.Z))) : sy(1);
  const ghostDash = "4 4";

  return (
    <div className={"flex min-h-0 flex-col gap-1.5 " + (fillHeight ? "h-full" : "")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h4 className="text-[14px] font-bold text-[#14226B]" data-testid="graph-title">Real vs Ideal Gas Behaviour</h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#33415F]" data-testid="graph-legend">
          <LegendSwatch color={C_IDEAL}>Ideal gas (Z = 1)</LegendSwatch>
          <LegendSwatch color={C_REAL} dash="7 4" faint={!real}>{real ? "Real gas (van der Waals)" : "Real gas, for comparison"}</LegendSwatch>
          <LegendSwatch color={C_MARK} dot>Current state</LegendSwatch>
        </div>
      </div>
      <p className="text-[11px] text-[#6B7A99]" data-testid="graph-subtitle">
        Curve at constant T = {Math.round(T)} K and n = {n.toFixed(2)} mol. Z = PV/(nRT).
      </p>

      <div ref={plotRef} className={"relative min-h-[130px] min-w-0 " + (fillHeight ? "flex-1" : "h-[230px]")}>
        <svg
          width={w}
          height={h}
          role="img"
          aria-label={label}
          data-testid="graph-svg"
          className="absolute inset-0 block touch-pan-y select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverP(null)}
        >
          <defs>
            <clipPath id={clipId}><rect x={M.l} y={M.t} width={pw} height={ph} /></clipPath>
          </defs>
          {/* control window shading (0.2-5.0 atm) */}
          <rect x={sx(LIMITS.P.min)} y={M.t} width={sx(LIMITS.P.max) - sx(LIMITS.P.min)} height={ph} fill="#EAF2FE" opacity="0.8" data-testid="graph-control-band" />
          <text x={(sx(LIMITS.P.min) + sx(LIMITS.P.max)) / 2} y={M.t + 10} textAnchor="middle" fontSize="9.5" fill="#6B7A99">control range 0.2-5 atm</text>
          {yt.map((v) => (
            <g key={"y" + v}>
              <line x1={M.l} x2={M.l + pw} y1={sy(v)} y2={sy(v)} stroke="#E3EAF6" strokeWidth="1" />
              <text x={M.l - 6} y={sy(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#33415F">{v.toFixed(v * 10 === Math.round(v * 10) ? 1 : 2)}</text>
            </g>
          ))}
          {X_TICKS.map((v) => (
            <g key={"x" + v}>
              <line x1={sx(v)} x2={sx(v)} y1={M.t} y2={M.t + ph} stroke="#EEF2F9" strokeWidth="1" />
              <text x={sx(v)} y={M.t + ph + 14} textAnchor="middle" fontSize="10.5" fill="#33415F">{fmtP(v)}</text>
            </g>
          ))}
          <line x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} stroke="#6B7A99" strokeWidth="1.2" />
          <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + ph} stroke="#6B7A99" strokeWidth="1.2" />
          <text x={M.l + pw / 2} y={h - 4} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#14226B">Pressure, P (atm, log scale)</text>
          <text transform={`translate(11 ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#14226B">Compressibility factor, Z</text>

          <g clipPath={`url(#${clipId})`}>
            <line x1={sx(Z_P_MIN)} x2={sx(Z_P_MAX)} y1={sy(1)} y2={sy(1)} stroke={C_IDEAL} strokeWidth="2.4" data-testid="graph-ideal" />
            {curve.points.length > 1 && (
              <path
                d={path(curve.points)}
                fill="none"
                stroke={C_REAL}
                strokeWidth="2.4"
                strokeDasharray={real ? "7 4" : ghostDash}
                opacity={real ? 1 : 0.45}
                strokeLinejoin="round"
                data-testid={real ? "graph-real" : "graph-real-ghost"}
              />
            )}
          </g>
          {endPt && (
            <g data-testid="graph-curve-end" opacity={real ? 1 : 0.5}>
              <line x1={sx(endPt.P)} x2={sx(endPt.P)} y1={sy(Math.min(axis.yMax, endPt.Z)) - 6} y2={sy(Math.min(axis.yMax, endPt.Z)) + 6} stroke={C_REAL} strokeWidth="2" />
            </g>
          )}

          {hover && (
            <g pointerEvents="none">
              <line x1={sx(hover.P)} x2={sx(hover.P)} y1={M.t} y2={M.t + ph} stroke="#9AA7C2" strokeDasharray="3 3" />
              <circle cx={sx(hover.P)} cy={sy(Math.min(axis.yMax, hover.Z))} r="3.2" fill="#fff" stroke={C_REAL} strokeWidth="1.6" />
            </g>
          )}

          {marker.status === "ok" && (
            <g data-testid="graph-marker" data-p={marker.P} data-z={marker.Z} data-on-curve={marker.onCurve ? "1" : "0"} data-outside={marker.outside ? "1" : "0"}>
              <circle cx={mx} cy={my} r="9" fill="none" stroke={C_MARK} strokeWidth="1.5" opacity="0.5" />
              <circle cx={mx} cy={my} r="5" fill={marker.onCurve ? C_MARK : "#fff"} stroke={marker.onCurve ? "#fff" : C_MARK} strokeWidth={marker.onCurve ? 1.5 : 2} />
            </g>
          )}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute right-2 top-1 rounded-md bg-white/90 px-2 py-0.5 text-[11px] tabular-nums text-[#14226B] shadow-sm" data-testid="graph-hover">
            P = {hover.P >= 10 ? hover.P.toFixed(1) : hover.P.toFixed(2)} atm; Z = {hover.Z.toFixed(3)}
          </div>
        )}
      </div>

      {(curve.end || note || axis.clipped) && (
        <p className="text-[11px] font-medium leading-snug text-[#9A5B00]" data-testid="graph-note">
          {[
            curve.end ? `Curve ends at ${curve.end.P >= 10 ? curve.end.P.toFixed(1) : curve.end.P.toFixed(2)} atm. ${curve.end.text}` : null,
            note,
            axis.clipped ? "The curve continues above the plotted Z range." : null,
          ].filter(Boolean).join(" ")}
        </p>
      )}
      <div className="rounded-lg bg-[#EAF2FE] px-3 py-1.5 text-[12.5px] leading-snug text-[#1E2A44]" data-testid="graph-explanation">
        {marker.status === "ok" ? (
          <>
            <p className="font-semibold tabular-nums text-[#14226B]">
              <span data-testid="graph-z">Z = {zText}</span>
              {" "}
              <span className="font-normal text-[#33415F]" title={`Within ${Z_TOLERANCE_PCT}% of Z = 1 counts as approximately ideal.`}>
                (deviation from 1: <span data-testid="graph-dev">{marker.deviationPct.toFixed(1)}</span>%)
              </span>
            </p>
            <p data-testid="graph-sentence">{marker.text}</p>
          </>
        ) : (
          <p data-testid="graph-sentence">{marker.text}</p>
        )}
      </div>
      <p className="sr-only" aria-live="polite" data-testid="graph-live">{announce}</p>
    </div>
  );
}
