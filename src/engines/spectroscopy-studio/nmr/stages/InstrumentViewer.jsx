import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../state/StudioContext.jsx";

// NMRInstrumentViewer: a layered cross-section of an ILLUSTRATIVE spectrometer. Proportions, colours and positions are schematic;
// real instruments differ (liquid-helium cryostat, shim coils, lock channel, quadrature detection, tuning circuits ...).
// Every component is a real button (click / Enter / Space): highlight, zoom, explanation (panel) and an animation of its process.

export const WHOLE_BOX = [0, 0, 800, 520];
export const COMPONENTS = {
  magnet: { label: "Superconducting magnet", short: "Magnet", color: "#38bdf8", box: [150, 20, 360, 400] },
  tube: { label: "Sample tube", short: "Sample tube", color: "#2dd4bf", box: [270, 60, 120, 270] },
  probe: { label: "Probe with RF coil", short: "Probe and RF coil", color: "#fb923c", box: [240, 170, 180, 280] },
  transmitter: { label: "RF transmitter", short: "RF transmitter", color: "#fbbf24", box: [0, 70, 280, 140] },
  receiver: { label: "RF receiver", short: "RF receiver", color: "#a78bfa", box: [520, 60, 280, 130] },
  processing: { label: "Signal processing", short: "Signal processing", color: "#f472b6", box: [520, 190, 280, 300] },
};

/** viewBox tween (immediate with reduced motion). */
export function useViewBox(target) {
  const reduced = useReducedMotion();
  const [vb, setVb] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reduced) { cur.current = target; setVb(target); return undefined; }
    const from = [...cur.current]; const t0 = performance.now(); let raf = 0; let alive = true;
    const tick = (now) => {
      if (!alive) return;
      const k = Math.min(1, (now - t0) / 650); const e = k * k * (3 - 2 * k);
      cur.current = from.map((v, i) => v + (target[i] - v) * e); setVb(cur.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [target[0], target[1], target[2], target[3], reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  return vb.map((v) => v.toFixed(1)).join(" ");
}

function burstPath(x0, x1, xa, xb, y, amp, ph) {
  const pts = [];
  for (let x = x0; x <= x1; x += 3) pts.push(`${pts.length ? "L" : "M"}${x},${(x >= xa && x <= xb ? y + amp * Math.sin((x - xa) * 0.55 - ph) : y).toFixed(1)}`);
  return pts.join("");
}
/** Spectrum drawn left to right (ppm descending); `ft` reveals it progressively. */
function specPath(fid, ft, rect) {
  const L = fid.ppm.length; const n = Math.max(2, Math.round(L * Math.min(1, ft))); const hi = fid.ppmWin[1]; const lo = fid.ppmWin[0]; const out = [];
  for (let i = 0; i < n; i += 1) { const px = rect.x + ((hi - fid.ppm[i]) / (hi - lo)) * rect.w; const py = rect.y + rect.h - ((fid.spec[i] + 0.05) / 1.2) * rect.h; out.push(`${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`); }
  return out.join("");
}
const NUCLEI = Array.from({ length: 16 }, (_, i) => ({ x: 324 + ((i * 37) % 13), y: 0 + ((i * 53) % 71), r: 1.6 }));

function miniPath(xs, ys, x0, x1, y0, y1, rect, n = 120) {
  const L = xs.length; const out = [];
  for (let k = 0; k < n; k += 1) {
    const i = Math.min(L - 1, Math.round((k / (n - 1)) * (L - 1)));
    const px = rect.x + ((xs[i] - x0) / (x1 - x0)) * rect.w; const py = rect.y + rect.h - ((ys[i] - y0) / (y1 - y0)) * rect.h;
    out.push(`${k ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return out.join("");
}

/**
 * props: view (state from instrumentModel), selected, onSelect, phase (display s), b0, nu0, fid: { t[] ms, y[], ppm[], spec[], window[2] }
 */
export default function InstrumentViewer({ view, selected, onSelect, phase, b0, nu0, fid, viewBox, dimOthers }) {
  const v = view;
  const tubeDy = -170 * (1 - v.insert);
  const fieldOp = 0.15 + 0.7 * v.field;
  const flow = -phase * 26;
  const comp = (id, children, extra = {}) => {
    const c = COMPONENTS[id]; const sel = selected === id;
    return (
      <g
        className={`ss-comp${sel ? " is-sel" : ""}${dimOthers && !sel ? " is-dim" : ""}`} role="button" tabIndex={0} aria-pressed={sel} aria-label={`${c.label}${sel ? " (selected)" : ""}`}
        data-testid={`comp-${id}`} onClick={() => onSelect(id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); } }} style={{ "--c": c.color }} {...extra}
      >
        {children}
      </g>
    );
  };
  const rfWave = (x0, x1, y, amp, ph) => { const pts = []; for (let x = x0; x <= x1; x += 3) pts.push(`${x},${(y + amp * Math.sin((x - x0) * 0.35 - ph)).toFixed(1)}`); return pts.join(" "); };
  const fidRect = { x: 566, y: 322, w: 214, h: 88 };
  const fidWin = fid ? fid.window : [0, 1];
  const nShow = fid ? Math.max(2, Math.round(fid.t.length * (v.display === "fid" ? Math.max(0.02, v.fid) : 1))) : 0;
  const rxWave = (x0, x1, y, amp, ph, decay) => { const pts = []; for (let x = x0; x <= x1; x += 3) pts.push(`${x},${(y + amp * Math.exp(-decay * ((x - x0) / (x1 - x0))) * Math.sin((x - x0) * 0.5 + ph)).toFixed(1)}`); return pts.join(" "); };
  return (
    <svg className="ss-instr" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Illustrative cross-section of an NMR spectrometer: magnet, sample tube, probe with RF coil, RF transmitter, RF receiver and signal-processing system" data-testid="instrument-svg">
      <defs>
        <linearGradient id="ss-g-magnet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1b3a78" /><stop offset="0.5" stopColor="#2a5aa8" /><stop offset="1" stopColor="#1b3a78" /></linearGradient>
        <pattern id="ss-p-wind" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="3.3" fill="none" stroke="#7dd3fc" strokeWidth="1.1" /></pattern>
        <marker id="ss-ar" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="context-stroke" /></marker>
      </defs>

      {/* wires first (behind) */}
      <g fill="none" strokeWidth="2.2" strokeLinecap="round">
        <path d="M90 170 V470 H322 V430" stroke="#fbbf24" strokeOpacity={v.tx ? 1 : 0.45} strokeDasharray={v.tx ? "7 7" : undefined} strokeDashoffset={v.tx ? -flow : undefined} data-testid="wire-tx" />
        <path d="M338 430 V492 H545 V128 H560" stroke="#a78bfa" strokeOpacity={v.rx ? 1 : 0.45} strokeDasharray={v.rx ? "7 7" : undefined} strokeDashoffset={v.rx ? flow : undefined} data-testid="wire-rx" />
        <path d="M670 160 V212" stroke="#f472b6" strokeOpacity={v.rx ? 1 : 0.45} strokeDasharray={v.rx ? "6 6" : undefined} strokeDashoffset={v.rx ? flow : undefined} />
      </g>

      {/* field lines around the magnet (return flux), drawn behind it */}
      <g fill="none" stroke="#38bdf8" strokeWidth="1.6" opacity={fieldOp * 0.8} strokeDasharray="7 7" strokeDashoffset={flow} data-testid="field-lines">
        {[0, 1, 2].map((i) => <path key={`l${i}`} d={`M330 52 C ${60 - i * 38} 0, ${60 - i * 38} 430, 330 380`} />)}
        {[0, 1, 2].map((i) => <path key={`r${i}`} d={`M330 52 C ${600 + i * 38} 0, ${600 + i * 38} 430, 330 380`} />)}
      </g>

      {comp("magnet", (
        <>
          <rect className="ss-comp-hit" x="196" y="46" width="268" height="340" rx="26" />
          <rect x="200" y="50" width="260" height="330" rx="24" fill="url(#ss-g-magnet)" stroke="#7dd3fc" strokeWidth="1.8" />
          <rect x="222" y="80" width="74" height="270" fill="url(#ss-p-wind)" opacity="0.9" /><rect x="364" y="80" width="74" height="270" fill="url(#ss-p-wind)" opacity="0.9" />
          <rect x="300" y="50" width="60" height="330" fill="#0a1a40" stroke="#38bdf8" strokeWidth="1.2" />
          <text x="231" y="68" className="ss-svgtext ss-svgtext--sm" fill="#bae6fd">superconducting coil</text>
          <text x="330" y="372" textAnchor="middle" className="ss-svgtext ss-svgtext--sm">bore</text>
          <line x1="330" y1="345" x2="330" y2="70" stroke="#38bdf8" strokeWidth={1.4 + 2.4 * v.field} markerEnd="url(#ss-ar)" opacity={0.35 + 0.65 * v.field} />
          <text x="236" y="96" className="ss-svgtext ss-svgtext--b" fill="#7dd3fc">B₀ = {b0.toFixed(1)} T</text>
          <text x="250" y="404" textAnchor="middle" className="ss-svgtext">Magnet</text>
        </>
      ))}

      {comp("probe", (
        <>
          <rect className="ss-comp-hit" x="306" y="205" width="48" height="235" rx="6" />
          <rect x="314" y="296" width="32" height="140" fill="#27406f" stroke="#fdba74" strokeWidth="1.4" />
          <rect x="304" y="426" width="52" height="22" rx="4" fill="#27406f" stroke="#fdba74" strokeWidth="1.4" />
          {[0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx="330" cy={218 + i * 17} rx="24" ry="6" fill="none" stroke={v.tx ? "#fb923c" : v.rx ? "#a78bfa" : "#fdba74"} strokeWidth={v.tx || v.rx ? 2.6 : 1.8} />)}
          <text x="330" y="464" textAnchor="middle" className="ss-svgtext">Probe + RF coil</text>
        </>
      ))}

      {comp("tube", (
        <g transform={`translate(0 ${tubeDy})`}>
          <rect className="ss-comp-hit" x="313" y="80" width="34" height="232" rx="6" />
          <rect x="321" y="80" width="18" height="232" rx="6" fill="rgba(186,230,253,0.14)" stroke="#bae6fd" strokeWidth="1.5" />
          <rect x="322.5" y="214" width="15" height="96" rx="4" fill="rgba(45,212,191,0.34)" />
          {NUCLEI.map((n, i) => <circle key={i} cx={n.x - 0.5 + 1.1 * Math.sin(phase * 3 + i)} cy={218 + n.y + 1.1 * Math.cos(phase * 2.6 + i * 1.3)} r={n.r} fill="#5eead4" />)}
          {v.mz > 0.03 && <line x1="330" y1={288} x2="330" y2={288 - 56 * v.mz} stroke="#fcd34d" strokeWidth="3" markerEnd="url(#ss-ar)" data-testid="m0-arrow" />}
          {v.mxy > 0.03 && <line x1="330" y1="262" x2={330 + 28 * v.mxy * Math.cos(v.az)} y2={262 - 12 * v.mxy * Math.sin(v.az)} stroke="#f472b6" strokeWidth="3" markerEnd="url(#ss-ar)" data-testid="mxy-arrow" />}
          <text x="404" y="150" className="ss-svgtext">Sample tube</text>
          <text x="404" y="164" className="ss-svgtext ss-svgtext--sm">solution of the compound</text>
        </g>
      ))}

      {/* RF field in the sample region during transmission, induced signal during detection */}
      {v.tx > 0 && <polyline points={rfWave(262, 398, 252, 9, phase * 18)} fill="none" stroke="#fb923c" strokeWidth="2.4" data-testid="rf-wave" />}
      {v.tx > 0 && <text x="268" y="236" className="ss-svgtext ss-svgtext--sm" fill="#fdba74">B₁ ⊥ B₀</text>}
      {v.rx > 0.5 && <text x="352" y="296" className="ss-svgtext ss-svgtext--sm" fill="#c4b5fd">induced voltage →</text>}

      {comp("transmitter", (
        <>
          <rect className="ss-comp-hit" x="6" y="100" width="170" height="74" rx="10" />
          <rect x="10" y="104" width="160" height="66" rx="9" className="ss-box ss-box--tx" />
          <text x="90" y="121" textAnchor="middle" className="ss-svgtext ss-svgtext--b">RF transmitter</text>
          <path d={burstPath(24, 156, 48, 100, 150, v.tx ? 9 : 0, phase * 18)} fill="none" stroke="#fbbf24" strokeWidth="1.8" data-testid="tx-burst" />
          <text x="90" y="166" textAnchor="middle" className="ss-svgtext ss-svgtext--sm">pulse of ν_rf ≈ {nu0.toFixed(1)} MHz</text>
        </>
      ))}
      {comp("receiver", (
        <>
          <rect className="ss-comp-hit" x="556" y="96" width="228" height="68" rx="10" />
          <rect x="560" y="100" width="220" height="60" rx="9" className="ss-box ss-box--rx" />
          <text x="670" y="118" textAnchor="middle" className="ss-svgtext ss-svgtext--b">RF receiver</text>
          <polyline points={rxWave(580, 760, 140, 12 * (v.rx > 0 ? 1 : 0.0), phase * 14, 1.6)} fill="none" stroke="#a78bfa" strokeWidth="1.8" data-testid="rx-wave" />
          <text x="670" y="156" textAnchor="middle" className="ss-svgtext ss-svgtext--sm">preamplifier + detector</text>
        </>
      ))}
      {comp("processing", (
        <>
          <rect className="ss-comp-hit" x="556" y="212" width="238" height="262" rx="10" />
          <rect x="560" y="216" width="230" height="46" rx="9" className="ss-box ss-box--pr" />
          <text x="675" y="234" textAnchor="middle" className="ss-svgtext ss-svgtext--b">Signal processing</text>
          <text x="675" y="251" textAnchor="middle" className="ss-svgtext ss-svgtext--sm">digitiser (ADC) + computer</text>
          <rect x="560" y="272" width="230" height="146" rx="9" className="ss-display" />
          <text x="568" y="287" className="ss-svgtext ss-svgtext--sm">{v.display === "spec" ? "computed spectrum (frequency domain)" : v.display === "fid" ? "digitised FID (time domain)" : "display: no signal yet"}</text>
          {v.display === "fid" && fid && <path d={miniPath(fid.t.slice(0, nShow), fid.y.slice(0, nShow), fidWin[0], fidWin[1], -1.3, 1.3, fidRect)} fill="none" stroke="#fcd34d" strokeWidth="1.4" data-testid="mini-fid" />}
          {v.display === "spec" && fid && (
            <g>
              <path d={miniPath(fid.t, fid.y, fidWin[0], fidWin[1], -1.3, 1.3, { x: 566, y: 292, w: 214, h: 40 }, 100)} fill="none" stroke="#fcd34d" strokeWidth="1" opacity={1 - 0.55 * v.ft} />
              <path d={specPath(fid, v.ft, { x: 566, y: 336, w: 214, h: 70 })} fill="none" stroke="#2dd4bf" strokeWidth="1.8" data-testid="mini-spec" />
              <text x="780" y="414" textAnchor="end" className="ss-svgtext ss-svgtext--sm">δ (ppm) ← higher δ left</text>
            </g>
          )}
          {v.display === "fid" && <g>{Array.from({ length: 14 }, (_, i) => <line key={i} x1={566 + (i / 13) * 214 * Math.max(0.02, v.fid)} x2={566 + (i / 13) * 214 * Math.max(0.02, v.fid)} y1="424" y2={432 - 6 * Math.abs(Math.sin(i * 1.7))} stroke="#f9a8d4" strokeWidth="1.5" />)}</g>}
        </>
      ))}
    </svg>
  );
}
