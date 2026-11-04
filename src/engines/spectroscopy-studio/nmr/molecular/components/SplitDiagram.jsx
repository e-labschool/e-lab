import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { lorentz, lorentzPeak, splittingTree, splitStage } from "../model/spectrum.js";

// The animated splitting diagram: a splitting tree (each neighbouring proton divides every line into two, separated by J), the resulting
// line shape (Lorentzian lines; total AREA stays 1 at every moment, only the height falls), the spin-state combinations of the
// neighbours under the final lines, and a frequency axis in Hz (the same at any spectrometer frequency) above a ppm axis (which is not).
const HS = 45; // half-span in Hz of the horizontal axis

export default function SplitDiagram({ spins, phase, centerPpm, freqMHz, partnerById, widthHz = 1.2, showCombos = true, label }) {
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 700, h: 360 });
  useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return undefined;
    const m = () => { const r = el.getBoundingClientRect(); if (r.width > 1 && r.height > 1) setBox((b) => (Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1 ? b : { w: r.width, h: r.height })); };
    m(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(m) : null; ro?.observe(el); return () => ro?.disconnect();
  }, []);
  const { w, h } = box; const L = 24; const R = 24;
  const n = spins.length;
  const topPad = 20; const axisH = 92;
  const treeH = Math.max(60, Math.min(h * 0.36, 40 + n * 22)); const yTree0 = topPad + 6;
  const yBase = h - axisH - 26; const specTop = yTree0 + treeH + 60; const specH = Math.max(40, yBase - specTop);
  const px = (w - L - R) / (2 * HS); const cx = L + (w - L - R) / 2;
  const X = (hz) => cx - hz * px; // left = higher frequency = higher delta
  const levels = useMemo(() => splittingTree(spins, phase), [spins, phase]);
  const stage = useMemo(() => splitStage(spins, phase), [spins, phase]);
  const rows = Math.max(1, n); const dy = treeH / (rows + 0.4); const stick = Math.min(15, dy * 0.6);
  const peak1 = lorentzPeak(1, widthHz); const Yv = (v) => yBase - (v / peak1) * specH * 0.92;
  const trace = useMemo(() => {
    const xs = []; const N = 360; for (let i = 0; i <= N; i += 1) xs.push(-HS + (2 * HS * i) / N);
    for (const l of stage) for (let k = 0; k < 28; k += 1) { const u = (k + 0.5) / 28; xs.push(l.offsetHz + (widthHz / 2) * Math.tan(Math.PI * (u - 0.5))); xs.push(l.offsetHz); }
    xs.sort((a, b) => b - a); // descending Hz = left to right
    let d = ""; let last = Infinity;
    for (const hz of xs) { if (hz > HS || hz < -HS || last - hz < 1e-6) continue; last = hz; let v = 0; for (const l of stage) v += lorentz(hz, l.offsetHz, widthHz, l.rel); d += `${d ? "L" : "M"}${X(hz).toFixed(1)} ${Yv(v).toFixed(1)}`; }
    return d;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, w, h, widthHz]);
  const complete = Math.abs(phase - n) < 1e-6;
  // merged final lines for the bracket and combos
  const finalLines = useMemo(() => { const m = new Map(); for (const l of splitStage(spins, n)) { const k = Math.round(l.offsetHz * 1e6); m.set(k, { offsetHz: l.offsetHz, rel: (m.get(k)?.rel ?? 0) + l.rel }); } return [...m.values()].sort((a, b) => b.offsetHz - a.offsetHz); }, [spins, n]);
  const combos = (idx) => { // idx = position from the left (high frequency); number of 'down' neighbours = idx (convention-free label)
    const ups = n - idx; return `${"↑".repeat(ups)}${"↓".repeat(idx)}`;
  };
  const Jval = spins[0]?.J;
  const hzTicks = []; for (let t = -40; t <= 40; t += 10) hzTicks.push(t);
  const ppmLabel = (hz) => (centerPpm + hz / freqMHz).toFixed(freqMHz >= 200 ? 3 : 2);
  const totalW = stage.reduce((s, l) => s + l.rel, 0);

  return (
    <div ref={boxRef} className="nm-split-svgbox" data-testid="split-diagram" data-phase={phase.toFixed(3)} data-lines={new Set(stage.map((l) => Math.round(l.offsetHz * 1e4))).size} data-n={n} data-area={totalW.toFixed(6)}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label ?? `Splitting diagram: ${n} neighbouring protons divide the signal into ${n + 1} lines separated by J`}>
        <text x={L} y={14} fontSize="11.5" fontWeight="800" fill="#a9bbe3" className="nm-svgtext">Splitting tree — each neighbouring H divides every line in two (separation = J)</text>
        {/* tree */}
        {levels.map((lv, j) => lv.map((nd, i) => {
          const y = yTree0 + 14 + j * dy; const x = X(nd.off); const col = j === 0 ? "#e8f0ff" : partnerById?.[nd.envId]?.color ?? "#22d3ee";
          const par = j > 0 ? levels[j - 1][nd.parent] : null; const py = yTree0 + 14 + (j - 1) * dy;
          return (
            <g key={`${j}-${i}`}>
              {par && <line x1={X(par.off)} y1={py + stick} x2={x} y2={y} stroke={col} strokeWidth="1.3" opacity="0.7" />}
              <line x1={x} y1={y} x2={x} y2={y + stick} stroke={col} strokeWidth={Math.max(1.5, Math.sqrt(nd.w) * 6)} strokeLinecap="round" />
            </g>
          );
        }))}
        {n === 0 && <text x={cx} y={yTree0 + 60} textAnchor="middle" fontSize="13" fill="#a9bbe3" className="nm-svgtext">No neighbouring H that couple: nothing divides the line.</text>}
        <text x={L} y={yTree0 + treeH + 22} fontSize="11.5" fontWeight="800" fill="#a9bbe3" className="nm-svgtext">Resulting signal (area under the signal stays constant)</text>
        {/* spectrum */}
        <line x1={L} x2={w - R} y1={yBase} y2={yBase} stroke="#cdd9f5" strokeWidth="1.5" />
        <path d={trace} fill="rgba(34,211,238,0.16)" stroke="#22d3ee" strokeWidth="2.4" strokeLinejoin="round" data-testid="split-trace" />
        {/* J bracket */}
        {complete && finalLines.length > 1 && (
          <g data-testid="j-bracket">
            <path d={`M${X(finalLines[0].offsetHz)} ${specTop - 2}V${specTop - 8}H${X(finalLines[1].offsetHz)}V${specTop - 2}`} fill="none" stroke="#fbbf24" strokeWidth="2" />
            <text x={(X(finalLines[0].offsetHz) + X(finalLines[1].offsetHz)) / 2} y={specTop - 12} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fcd34d" paintOrder="stroke" stroke="#0a1330" strokeWidth="3" className="nm-svgtext">J = {Jval} Hz</text>
          </g>
        )}
        {/* line intensity labels + spin combos */}
        {complete && showCombos && n <= 3 && finalLines.map((l, i) => (
          <g key={i}>
            <text x={X(l.offsetHz)} y={yBase + 15} textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#e8f0ff" className="nm-svgtext" data-testid={`combo-${i}`}>{combos(i)}</text>
            <text x={X(l.offsetHz)} y={Yv(lorentz(l.offsetHz, l.offsetHz, widthHz, l.rel)) - 6} textAnchor="middle" fontSize="11" fill="#7ce6d8" className="nm-svgtext">{Math.round(l.rel * 2 ** n)}</text>
          </g>
        ))}
        {/* axes: Hz (constant) above ppm (depends on the spectrometer frequency) */}
        <g aria-hidden="true">
          {hzTicks.map((t) => (<g key={t}><line x1={X(t)} x2={X(t)} y1={yBase} y2={yBase + 5} stroke="#cdd9f5" /><text x={X(t)} y={yBase + 32} textAnchor="middle" fontSize="11" fill="#dbe6ff" className="nm-svgtext" opacity={Math.abs(t) % 20 === 0 ? 1 : 0}>{t > 0 ? `+${t}` : t}</text></g>))}
          {hzTicks.filter((t) => Math.abs(t) % 20 === 0).map((t) => (<text key={`p${t}`} x={X(t)} y={yBase + 49} textAnchor="middle" fontSize="11" fill="#c4b5fd" className="nm-svgtext">{ppmLabel(t)}</text>))}
          <text x={L} y={yBase + 68} fontSize="11" fill="#dbe6ff" className="nm-svgtext">Upper row: Δν / Hz from the centre of the signal (higher frequency, higher δ, on the left).</text>
          <text x={L} y={yBase + 83} fontSize="11" fill="#c4b5fd" className="nm-svgtext">Lower row: δ / ppm at {freqMHz} MHz. The Hz row does not depend on the spectrometer; the ppm row does.</text>
        </g>
      </svg>
    </div>
  );
}
