import { useEffect, useId, useMemo, useRef, useState } from "react";
import { GAS, Z_P_MAX, Z_P_MIN, generateZCurve, vdwCriticalConstants, vdwSaturationPressure, zAxisRange, zMarker } from "../model.js";

// "Real vs Ideal Gas Behaviour": compressibility factor Z = PV/(nRT) against pressure for the SAME gas
// (CO2) at the CURRENT temperature. Plain SVG drawn from model.generateZCurve() / model.zMarker();
// nothing is stored or hard-coded here. Log pressure axis (0.1-1000 atm).
//   solid blue line  Ideal gas, Z = 1 (fixed)
//   orange curve     Real gas (van der Waals CO2), recomputed whenever T changes
//   dark dot         the live state (matches the live strip and the chamber)
//   hollow orange    in Ideal mode: the real gas at the same pressure (or volume), for comparison
const C_IDEAL = "#2F7BF5";
const C_REAL = "#E8590C";
const C_MARK = "#14226B";
const M0 = { l: 44, r: 12, t: 8, b: 34 };
const LOG_MIN = Math.log10(Z_P_MIN);
const LOG_SPAN = Math.log10(Z_P_MAX) - LOG_MIN;
const X_TICKS = [0.1, 1, 10, 100, 1000];

function yTicks(lo, hi) {
  const span = hi - lo;
  const step = span <= 0.6 ? 0.1 : span <= 1.4 ? 0.2 : span <= 3 ? 0.5 : 1;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(2));
  return out;
}

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

function LegendSwatch({ color, dash, children, dot, hollow }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <svg width="22" height="10" aria-hidden="true">
        {dot ? (
          <circle cx="11" cy="5" r="3.6" fill={hollow ? "#fff" : color} stroke={hollow ? color : "#fff"} strokeWidth={hollow ? 1.8 : 1.2} />
        ) : (
          <line x1="1" y1="5" x2="21" y2="5" stroke={color} strokeWidth="2.2" strokeDasharray={dash} strokeLinecap="round" />
        )}
      </svg>
      {children}
    </span>
  );
}

const fmtP = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));

export default function RealIdealGraph({ state }) {
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
  const { Tc } = vdwCriticalConstants();
  const psat = vdwSaturationPressure(T);

  const k = Math.min(1.3, Math.max(1, w / 480)); // text scale on large plots
  const M = { l: M0.l * k, r: M0.r * k, t: M0.t * k, b: M0.b * k };
  const pw = Math.max(40, w - M.l - M.r);
  const ph = Math.max(40, h - M.t - M.b);
  const sx = (P) => M.l + ((Math.log10(P) - LOG_MIN) / LOG_SPAN) * pw;
  const sy = (Z) => M.t + ph - ((Z - axis.yMin) / (axis.yMax - axis.yMin)) * ph;
  const clampY = (Z) => sy(Math.min(axis.yMax, Math.max(axis.yMin, Z)));
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.P).toFixed(1)} ${sy(p.Z).toFixed(1)}`).join("");
  const yt = yTicks(axis.yMin, axis.yMax);
  const endPt = curve.end && curve.points.length ? curve.points[curve.points.length - 1] : null;

  const zText = marker.status === "ok" || marker.status === "limit" ? marker.Z.toFixed(3) : null;
  const label =
    `Real vs Ideal Gas Behaviour: compressibility factor Z against pressure in atmospheres for ${GAS.name} at ${Math.round(T)} kelvin. ` +
    `Ideal gas reference line at Z equals 1. Real gas curve. ` +
    (marker.status === "limit" ? `Current state is outside the model: ${marker.text}` : `Current state: P ${fmtP(marker.P)} atm, Z ${zText}.` + (marker.real ? ` Real gas at the same conditions: Z ${marker.real.Z.toFixed(3)}.` : ""));

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
      setAnnounce(zText ? `Z equals ${zText}.` : "");
    }, 600);
    return () => clearTimeout(t);
  }, [zText]);

  const mx = sx(marker.plotP);
  const my = clampY(marker.Z);
  const rm = marker.real;
  const rx = rm ? sx(rm.plotP) : null;
  const ry = rm ? clampY(rm.Z) : null;

  const regime = T < Tc
    ? `T < Tᶜ (${Tc.toFixed(0)} K): CO₂ condenses above ${psat ? psat.toFixed(psat >= 100 ? 0 : 1) : "P_sat"} atm`
    : `T > Tᶜ (${Tc.toFixed(0)} K): supercritical, no condensation`;
  const notes = [
    curve.end ? `Curve ends at ${fmtP(curve.end.P)} atm: ${curve.end.text}` : null,
    marker.status === "limit" ? marker.text : null,
    marker.outside ? "The current state is outside the plotted pressure range." : null,
    axis.clipped ? "The curve continues above the plotted Z range." : null,
  ].filter(Boolean);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-1" data-testid="graph-root">
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0">
        <h4 className="text-[length:calc(var(--sd-fs)_+_1.5px)] font-bold text-[#14226B]" data-testid="graph-title">Z = PV/nRT vs pressure</h4>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0 text-[length:var(--sd-fs-sm)] text-[#33415F]" data-testid="graph-legend">
          <LegendSwatch color={C_IDEAL}>Ideal (Z = 1)</LegendSwatch>
          <LegendSwatch color={C_REAL} dash="7 4">Real CO{"₂"}</LegendSwatch>
          <LegendSwatch color={C_MARK} dot>Now</LegendSwatch>
          {!real && rm && <LegendSwatch color={C_REAL} dot hollow>Real, same {state.control === "pressure" ? "P" : "V"}</LegendSwatch>}
        </div>
      </div>

      <div ref={plotRef} className="sd-graph-plot min-h-[120px]">
        <svg
          width={w}
          height={h}
          role="img"
          aria-label={label}
          data-testid="graph-svg"
          className="touch-pan-y select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverP(null)}
        >
          <defs>
            <clipPath id={clipId}><rect x={M.l} y={M.t} width={pw} height={ph} /></clipPath>
          </defs>
          {yt.map((v) => (
            <g key={"y" + v}>
              <line x1={M.l} x2={M.l + pw} y1={sy(v)} y2={sy(v)} stroke="#E3EAF6" strokeWidth="1" />
              <text x={M.l - 6} y={sy(v) + 3.5} textAnchor="end" fontSize={10.5 * k} fill="#33415F">{v.toFixed(v * 10 === Math.round(v * 10) ? 1 : 2)}</text>
            </g>
          ))}
          {X_TICKS.map((v) => (
            <g key={"x" + v}>
              <line x1={sx(v)} x2={sx(v)} y1={M.t} y2={M.t + ph} stroke="#EEF2F9" strokeWidth="1" />
              <text x={sx(v)} y={M.t + ph + 14 * k} textAnchor="middle" fontSize={10.5 * k} fill="#33415F">{v}</text>
            </g>
          ))}
          <line x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} stroke="#6B7A99" strokeWidth="1.2" />
          <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + ph} stroke="#6B7A99" strokeWidth="1.2" />
          <text x={M.l + pw / 2} y={h - 4} textAnchor="middle" fontSize={11.5 * k} fontWeight="600" fill="#14226B">Pressure, P (atm, log scale)</text>
          <text transform={`translate(${11 * k} ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5 * k} fontWeight="600" fill="#14226B">Compressibility factor, Z</text>

          <g clipPath={`url(#${clipId})`}>
            <line x1={sx(Z_P_MIN)} x2={sx(Z_P_MAX)} y1={sy(1)} y2={sy(1)} stroke={C_IDEAL} strokeWidth="2.6" data-testid="graph-ideal" />
            {curve.points.length > 1 && (
              <path d={path(curve.points)} fill="none" stroke={C_REAL} strokeWidth="2.6" strokeDasharray="7 4" strokeLinejoin="round" data-testid="graph-real" />
            )}
          </g>
          {endPt && (
            <g data-testid="graph-curve-end">
              <line x1={sx(endPt.P)} x2={sx(endPt.P)} y1={clampY(endPt.Z) - 7} y2={clampY(endPt.Z) + 7} stroke={C_REAL} strokeWidth="2.4" />
            </g>
          )}

          {hover && (
            <g pointerEvents="none">
              <line x1={sx(hover.P)} x2={sx(hover.P)} y1={M.t} y2={M.t + ph} stroke="#9AA7C2" strokeDasharray="3 3" />
              <circle cx={sx(hover.P)} cy={clampY(hover.Z)} r="3.2" fill="#fff" stroke={C_REAL} strokeWidth="1.6" />
            </g>
          )}

          {rm && !real && (
            <g data-testid="graph-real-marker" data-p={rm.P} data-z={rm.Z}>
              <line x1={mx} y1={my} x2={rx} y2={ry} stroke={C_REAL} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.8" />
              <circle cx={rx} cy={ry} r="6" fill="#fff" stroke={C_REAL} strokeWidth="2.2" />
            </g>
          )}
          {(marker.status === "ok" || marker.status === "limit") && (
            <g data-testid="graph-marker" data-p={marker.P} data-z={marker.Z} data-on-curve={marker.onCurve ? "1" : "0"} data-outside={marker.outside ? "1" : "0"} data-status={marker.status}>
              <circle cx={mx} cy={my} r="9" fill="none" stroke={C_MARK} strokeWidth="1.5" opacity="0.5" />
              <circle cx={mx} cy={my} r="5" fill={marker.status === "ok" ? C_MARK : "#fff"} stroke={marker.status === "ok" ? "#fff" : C_MARK} strokeWidth={marker.status === "ok" ? 1.5 : 2} />
              <text x={Math.min(mx + 12, M.l + pw - 70)} y={Math.max(M.t + 12, my - 11)} fontSize={11.5 * k} fontWeight="700" fill={C_MARK} stroke="#fff" strokeWidth="3" paintOrder="stroke" data-testid="graph-z">Z = {zText}</text>
            </g>
          )}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute right-2 top-1 rounded-md bg-white/90 px-2 py-0.5 text-[11px] tabular-nums text-[#14226B] shadow-sm" data-testid="graph-hover">
            P = {fmtP(hover.P)} atm; Z = {hover.Z.toFixed(3)}
          </div>
        )}
      </div>

      <p className="shrink-0 truncate text-[length:var(--sd-fs-sm)] text-[#4a5a82]" data-testid="graph-subtitle" title={`${GAS.name}, van der Waals a = ${GAS.a}, b = ${GAS.b}`}>
        {GAS.name} at {Math.round(T)} K &middot; {regime}
      </p>
      {notes.length > 0 && (
        <p className="shrink-0 text-[length:var(--sd-fs-sm)] font-medium leading-snug text-[#8a5300]" data-testid="graph-note">{notes.join(" ")}</p>
      )}
      <p className="sr-only" aria-live="polite" data-testid="graph-live">{announce}</p>
    </div>
  );
}
