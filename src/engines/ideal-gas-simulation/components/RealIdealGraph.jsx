import { useEffect, useId, useMemo, useRef, useState } from "react";
import { GAS, GASES, GAS_IDS, IB_UNITS, setActiveGas, Z_P_MAX, Z_P_MIN, fmtPressure, unitLabelP, generateZCurve, vdwCriticalConstants, vdwSaturationPressure, zAxisRange, zMarker } from "../model.js";

// "Real vs Ideal Gas Behaviour": compressibility factor Z = PV/(nRT) against pressure for the SAME gas
// (CO2) at the CURRENT temperature. Plain SVG drawn from model.generateZCurve() / model.zMarker();
// nothing is stored or hard-coded here. Log pressure axis (0.1-1000 atm = 10-10^5 kPa).
//   solid blue line  Ideal gas, Z = 1 (fixed)
//   orange curve     Real gas (van der Waals CO2), recomputed whenever T changes
//   dark dot         the live state (matches the live strip and the chamber)
//   hollow orange    in Ideal mode: the real gas at the same pressure (or volume), for comparison
const C_IDEAL = "#2F7BF5";
const C_REAL = "#E8590C";
const C_MARK = "#14226B";
const GAS_COLOURS = { he: "#0E8F6B", n2: "#6B7A99", co2: C_REAL, nh3: "#8B5CF6" };
const M0 = { l: 44, r: 12, t: 8, b: 34 };
const LOG_MIN = Math.log10(Z_P_MIN);
const LOG_SPAN = Math.log10(Z_P_MAX) - LOG_MIN;
// tick positions are in atm (the model unit); labels are the same pressures in the display unit
const X_TICKS_ATM = [0.1, 1, 10, 100, 1000];
const KPA_LABEL = { 100: "10\u00b2", 1000: "10\u00b3", 10000: "10\u2074", 100000: "10\u2075" };
const X_TICKS_KPA = [100, 1000, 10000, 100000]; // decades of kPa that fall inside 0.1-1000 atm

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


export default function RealIdealGraph({ state, units = IB_UNITS }) {
  const fmtP = (v) => fmtPressure(v, units); const uP = unitLabelP(units);
  const ticks = units.pressure === "kPa" ? X_TICKS_KPA.map((k) => ({ at: k / 101.325, label: KPA_LABEL[k] })) : X_TICKS_ATM.map((v) => ({ at: v, label: String(v) }));
  const plotRef = useRef(null);
  const clipId = useId();
  const { w, h } = useSize(plotRef);
  const [hoverP, setHoverP] = useState(null);
  const real = state.mode === "real";
  const { n, T } = state;
  // The curve depends only on n, T and the gas model: moving V or P just moves the marker.
  const curve = useMemo(() => generateZCurve(n, T, state.mode, undefined, state.gasId), [n, T, state.mode, state.gasId]);
  // Compare-gases overlay: the real Z(P) curve of every gas at this T (the ideal gas is the same line for all of them).
  const [compare, setCompare] = useState(false);
  const others = useMemo(() => (compare ? GAS_IDS.map((id) => ({ id, curve: generateZCurve(n, T, "real", undefined, id) })) : []), [compare, n, T]);
  const marker = useMemo(() => zMarker(state), [state]);
  const gas = GASES[state.gasId] ?? GAS;
  const axis = useMemo(() => {
    const a = zAxisRange(curve, marker);
    if (!others.length) return a;
    let lo = a.yMin, hi = a.yMax;
    for (const o of others) for (const p of o.curve.points) { lo = Math.min(lo, p.Z); hi = Math.max(hi, p.Z); }
    return { ...a, yMin: Math.max(0, Math.floor((lo - 0.02) * 10) / 10), yMax: Math.min(2.4, Math.max(a.yMax, Math.ceil((hi + 0.02) * 10) / 10)) };
  }, [curve, marker, others]);
  setActiveGas(state.gasId); // the overlay loop above leaves the last gas active
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
    `Real vs Ideal Gas Behaviour: compressibility factor Z against pressure in ${uP} (log scale) for ${gas.name} at ${Math.round(T)} kelvin. ` +
    `Ideal gas reference line at Z equals 1. Real gas curve. ` +
    (marker.status === "limit" ? `Current state is outside the model: ${marker.text}` : `Current state: P ${fmtP(marker.P)} ${uP}, Z ${zText}.` + (marker.real ? ` Real gas at the same conditions: Z ${marker.real.Z.toFixed(3)}.` : ""));

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
    ? `T < Tᶜ (${Tc.toFixed(0)} K): ${gas.tag} condenses above ${psat ? fmtP(psat) : "P_sat"} ${uP} (van der Waals, qualitative)`
    : `T > Tᶜ (${Tc.toFixed(0)} K): supercritical, no condensation`;
  const notes = [
    curve.end ? `Curve ends at ${fmtP(curve.end.P)} ${uP}: ${curve.end.text}` : null,
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
          <LegendSwatch color={C_REAL} dash="7 4">Real {gas.tag}</LegendSwatch>
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
          {ticks.map((t) => (
            <g key={"x" + t.at}>
              <line x1={sx(t.at)} x2={sx(t.at)} y1={M.t} y2={M.t + ph} stroke="#EEF2F9" strokeWidth="1" />
              <text x={sx(t.at)} y={M.t + ph + 14 * k} textAnchor="middle" fontSize={10.5 * k} fill="#33415F">{t.label}</text>
            </g>
          ))}
          <line x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} stroke="#6B7A99" strokeWidth="1.2" />
          <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + ph} stroke="#6B7A99" strokeWidth="1.2" />
          <text x={M.l + pw / 2} y={h - 4} textAnchor="middle" fontSize={11.5 * k} fontWeight="600" fill="#14226B">Pressure, P ({uP}, log scale)</text>
          <text transform={`translate(${11 * k} ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5 * k} fontWeight="600" fill="#14226B">Compressibility factor, Z</text>

          <g clipPath={`url(#${clipId})`}>
            <line x1={sx(Z_P_MIN)} x2={sx(Z_P_MAX)} y1={sy(1)} y2={sy(1)} stroke={C_IDEAL} strokeWidth="2.6" data-testid="graph-ideal" />
            {others.filter((o) => o.id !== state.gasId && o.curve.points.length > 1).map((o) => (
              <path key={o.id} d={path(o.curve.points)} fill="none" stroke={GAS_COLOURS[o.id]} strokeWidth="1.8" opacity="0.9" strokeLinejoin="round" data-testid={`graph-gas-${o.id}`} />
            ))}
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
            P = {fmtP(hover.P)} {uP}; Z = {hover.Z.toFixed(3)}
          </div>
        )}
      </div>

      <p className="shrink-0 truncate text-[length:var(--sd-fs-sm)] text-[#4a5a82]" data-testid="graph-subtitle" title={`${gas.name}, van der Waals a = ${gas.a} L\u00b2 atm mol\u207b\u00b2, b = ${gas.b} L mol\u207b\u00b9. Z = PV/nRT is exactly 1 for an ideal gas.`}>
        {gas.name} at {Math.round(T)} K &middot; {regime}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0 text-[length:var(--sd-fs-sm)] text-[#33415F]">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} data-testid="graph-compare-gases" />
          Compare gases at this temperature
        </label>
        {compare && GAS_IDS.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 whitespace-nowrap" data-testid={`compare-key-${id}`}>
            <svg width="16" height="8" aria-hidden="true"><line x1="0" y1="4" x2="16" y2="4" stroke={id === state.gasId ? C_REAL : GAS_COLOURS[id]} strokeWidth="2.4" strokeDasharray={id === state.gasId ? "5 3" : undefined} /></svg>
            {GASES[id].tag}
          </span>
        ))}
      </div>
      {compare && <p className="shrink-0 text-[length:var(--sd-fs-sm)] leading-snug text-[#4a5a82]" data-testid="compare-note">Z = PV/nRT = 1 for an ideal gas. {GASES.nh3.tag} ({GASES.nh3.imf}) falls furthest below 1; {GASES.he.tag} ({GASES.he.imf}) stays closest to the ideal line.</p>}
      {notes.length > 0 && (
        <p className="shrink-0 text-[length:var(--sd-fs-sm)] font-medium leading-snug text-[#8a5300]" data-testid="graph-note">{notes.join(" ")}</p>
      )}
      <p className="sr-only" aria-live="polite" data-testid="graph-live">{announce}</p>
    </div>
  );
}
