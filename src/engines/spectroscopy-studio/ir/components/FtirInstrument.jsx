import { useSize } from "../../components/useSize.js";
import { ftirDemo } from "../physics/ftirDemo.js";
import { AXIS, axisFraction } from "../physics/spectrum.js";

// Illustrative FTIR spectrometer (SVG, one picture): source -> Michelson interferometer (beamsplitter, fixed mirror, moving mirror) -> sample -> detector -> computer ->
// spectrum. `op` (0..5) says how far the story has got, `scan` (0..1) is the progress of the moving mirror through one scan, `ft` (0..1) of the transform.
const C = { beam: "#fb923c", dim: "#6b4a2a", box: "rgba(30,52,108,0.8)", line: "#7da2e6", on: "#2dd4bf", amber: "#fbbf24" };
const pathLen = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
function along(pts, t) { const L = pathLen(pts); let d = t * L; for (let i = 1; i < pts.length; i += 1) { const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= seg) { const k = d / seg; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; } d -= seg; } return pts[pts.length - 1]; }
const poly = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("");

// Narrow containers (phones): the drawing is too small to read as a whole, so the view follows the story and zooms to the part being explained.
const NARROW_VIEW = ["0 0 500 230", "0 0 500 230", "440 170 460 160", "20 190 500 320", "440 300 460 200", "440 300 460 200"];

export default function FtirInstrument(props) {
  const [ref, size] = useSize();
  const narrow = size.width > 0 && size.width < 640;
  return <div ref={ref} className="ir-ftirwrap" data-narrow={narrow ? "1" : "0"}><FtirDrawing {...props} viewBox={narrow ? NARROW_VIEW[props.op] : "0 0 900 500"} /></div>;
}

function FtirDrawing({ op, scan, ft, phase, viewBox }) {
  const D = ftirDemo();
  const mirror = 400 + 26 * (-1 + 2 * scan); // moving-mirror x
  const delta = D.igSample.x[Math.min(D.igSample.N - 1, Math.round(scan * (D.igSample.N - 1)))] * 1e4; // retardation in micrometres
  const dTrace = (a, on) => ({ stroke: on ? C.beam : C.dim, strokeWidth: on ? 4 : 2.5, fill: "none", strokeDasharray: on ? "11 8" : "3 7", strokeDashoffset: on ? -phase * 70 : 0, opacity: on ? 1 : 0.35 });
  const P = {
    src: [[106, 132], [262, 132]], fixed: [[270, 124], [270, 40]], mov: [[278, 132], [mirror - 6, 132]],
    out: [[270, 142], [270, 235], [516, 235]], thr: [[590, 235], [656, 235]],
  };
  const lit = (k) => op >= k;
  const hot = (k) => op === k;
  const packet = (pts, off, color = "#fff") => <circle cx={along(pts, ((phase * 0.42 + off) % 1 + 1) % 1)[0]} cy={along(pts, ((phase * 0.42 + off) % 1 + 1) % 1)[1]} r="5" fill={color} opacity="0.95" />;
  const label = (x, y, t, anchor = "middle", cls = "") => <text x={x} y={y} textAnchor={anchor} className={`ss-svgtext ${cls}`}>{t}</text>;
  const comp = (k, active) => ({ stroke: active ? C.on : C.line, strokeWidth: active ? 3.2 : 1.8, fill: C.box });
  // interferogram trace
  const ig = D.igSample; const N = ig.N; const lastIdx = Math.max(2, Math.round(scan * (N - 1)));
  const px = { l: 28, r: 442, t: 322, b: 478 }; const gx = (n) => px.l + (n / (N - 1)) * (px.r - px.l); const gy = (v) => (px.t + px.b) / 2 - (v / D.igMax) * ((px.b - px.t) / 2) * 0.92;
  const step = Math.max(1, Math.floor(N / 700)); let igPath = ""; for (let n = 0; n <= lastIdx; n += step) igPath += `${n ? "L" : "M"}${gx(n).toFixed(1)},${gy(ig.y[n]).toFixed(1)}`;
  const showIg = op >= 3;
  // spectrum panel
  const rp = { l: 520, r: 880, t: 322, b: 458 }; const sx = (nu) => rp.l + axisFraction(nu) * (rp.r - rp.l);
  const gridStep = 4; let spPath = ""; let spBg = "";
  if (op === 4) {
    const sy = (v) => rp.b - (v / (D.sMax * 1.08)) * (rp.b - rp.t - 6);
    for (let nu = AXIS.nuLeft; nu >= AXIS.nuRight; nu -= gridStep) { const f = (AXIS.nuLeft - nu) / (AXIS.nuLeft - AXIS.nuRight); if (f > ft) break; spPath += `${spPath ? "L" : "M"}${sx(nu).toFixed(1)},${sy(D.at(D.sb.S, nu)).toFixed(1)}`; spBg += `${spBg ? "L" : "M"}${sx(nu).toFixed(1)},${sy(D.at(D.bg.S, nu)).toFixed(1)}`; }
  }
  if (op >= 5) {
    const sy = (T) => rp.t + ((100 - T) / 100) * (rp.b - rp.t);
    const n = Math.round(((AXIS.nuLeft - AXIS.nuRight) / 2) * Math.min(1, ft)); for (let i = 0; i <= n; i += 1) spPath += `${i ? "L" : "M"}${sx(D.grid[i]).toFixed(1)},${sy(D.Tout[i]).toFixed(1)}`;
  }
  return (
    <svg className="ir-ftir" viewBox={viewBox} role="img" aria-label="Illustrative FTIR spectrometer: infrared source, Michelson interferometer with beamsplitter, fixed mirror and moving mirror, sample, detector, computer and the resulting infrared spectrum" data-testid="ftir-svg" data-op={op} data-scan={scan.toFixed(3)} data-ft={ft.toFixed(3)} data-mirror={mirror.toFixed(2)}>
      {/* interferometer */}
      <rect x="196" y="8" width="296" height="196" rx="12" fill="none" stroke={lit(1) ? C.on : C.line} strokeWidth={hot(1) ? 2.5 : 1.4} strokeDasharray="6 6" opacity={lit(1) ? 1 : 0.5} data-testid="part-interferometer" />
      {label(344, 24, "Michelson interferometer", "middle", "ss-svgtext--b")}
      {/* beams */}
      <path d={poly(P.src)} {...dTrace(0, lit(0))} data-testid="beam-source" />
      <path d={poly(P.fixed)} {...dTrace(1, lit(1))} />
      <path d={poly(P.mov)} {...dTrace(1, lit(1))} />
      <path d={poly(P.out)} {...dTrace(1, lit(1))} />
      <path d={poly([[516, 235], [530, 235]])} {...dTrace(2, lit(2))} />
      <path d={poly(P.thr)} {...dTrace(3, lit(3))} opacity={lit(3) ? 0.8 : 0.3} />
      {lit(0) && packet(P.src, 0)}
      {lit(1) && <>{packet(P.fixed, 0.1)}{packet(P.mov, 0.3)}{packet(P.out, 0.5)}</>}
      {lit(3) && packet(P.thr, 0.6)}
      {/* source */}
      <g data-testid="part-source"><rect x="14" y="96" width="92" height="72" rx="8" {...comp(0, hot(0))} />
        <path d="M30,132 l8,-14 l10,28 l10,-28 l10,28 l8,-14" fill="none" stroke={C.amber} strokeWidth="3" strokeLinejoin="round" />
        {label(60, 190, "IR source", "middle", "ss-svgtext--b")}{label(60, 207, "all wavenumbers", "middle", "ss-svgtext--sm")}</g>
      {/* beamsplitter, fixed, moving mirrors */}
      <rect x="-4" y="-30" width="8" height="60" transform="translate(270 132) rotate(45)" fill="#bae6fd" fillOpacity="0.35" stroke="#7dd3fc" strokeWidth="1.6" data-testid="part-beamsplitter" />
      {label(240, 176, "Beamsplitter", "end", "ss-svgtext--sm")}
      <g data-testid="part-fixed"><rect x="242" y="28" width="56" height="9" fill="#cbd5e1" stroke="#475569" />{label(318, 36, "Fixed mirror", "start", "ss-svgtext--sm")}</g>
      <g data-testid="part-moving"><rect x={mirror - 4} y="102" width="9" height="60" fill="#cbd5e1" stroke="#475569" />
        <path d={`M${mirror - 28},178 h56 m-9,-5 l9,5 l-9,5 m-38,-10 l-9,5 l9,5`} fill="none" stroke={C.amber} strokeWidth="2" />
        {label(400, 197, "Moving mirror", "middle", "ss-svgtext--sm")}</g>
      {lit(1) && <text x="346" y="52" textAnchor="middle" className="ss-svgtext ir-ftir-delta" data-testid="path-difference">path difference δ = {delta >= 0 ? "+" : "−"}{Math.abs(Math.round(delta)).toLocaleString("en-US")} µm</text>}
      {/* sample, detector, computer */}
      <g data-testid="part-sample"><rect x="516" y="203" width="74" height="64" rx="6" {...comp(2, hot(2))} fillOpacity={lit(2) ? 1 : 0.7} />
        <rect x="528" y="214" width="50" height="42" rx="4" fill="#fb923c" fillOpacity="0.14" stroke="#fb923c" strokeOpacity="0.5" />
        {label(553, 291, "Sample", "middle", "ss-svgtext--b")}{lit(2) && label(553, 308, "absorbs some wavenumbers", "middle", "ss-svgtext--sm")}</g>
      <g data-testid="part-detector"><rect x="656" y="203" width="74" height="64" rx="6" {...comp(3, hot(3))} /><path d="M672,250 l14,-30 l14,30 z" fill="none" stroke={C.amber} strokeWidth="2.4" />{label(693, 291, "Detector", "middle", "ss-svgtext--b")}</g>
      <path d="M730,235 H776" fill="none" stroke={lit(4) ? C.on : C.line} strokeWidth="2.4" strokeDasharray={lit(4) ? "5 5" : "2 6"} strokeDashoffset={lit(4) ? -phase * 40 : 0} opacity={lit(3) ? 1 : 0.4} />
      <g data-testid="part-computer"><rect x="776" y="186" width="110" height="82" rx="8" {...comp(4, op === 4 || op === 5)} />
        <rect x="788" y="196" width="86" height="46" rx="3" fill="#081a3f" stroke="#7da2e6" />
        {op >= 4 ? <path d="M794,236 L806,226 L814,232 L826,204 L838,230 L850,222 L864,234" fill="none" stroke={C.on} strokeWidth="2" /> : <text x="831" y="224" textAnchor="middle" className="ss-svgtext ss-svgtext--sm">FFT</text>}
        {label(831, 291, "Computer", "middle", "ss-svgtext--b")}{label(831, 308, "Fourier transform", "middle", "ss-svgtext--sm")}</g>
      {/* signal panels */}
      <g data-testid="panel-interferogram" opacity={showIg ? 1 : 0.42}>
        <rect x={px.l} y={px.t - 20} width={px.r - px.l} height={px.b - px.t + 36} rx="8" fill="rgba(8,20,50,0.55)" stroke="#2b4780" />
        {label(px.l + 8, px.t - 5, "Interferogram: signal vs mirror position", "start", "ss-svgtext--b")}
        <line x1={px.l} x2={px.r} y1={(px.t + px.b) / 2} y2={(px.t + px.b) / 2} stroke="#2b4780" strokeDasharray="3 4" />
        {showIg ? <><path d={igPath} fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinejoin="round" data-testid="interferogram-trace" /><circle cx={gx(lastIdx)} cy={gy(ig.y[lastIdx])} r="4.5" fill="#fff" />
          {label((px.l + px.r) / 2, px.b + 13, "← mirror position (path difference) →", "middle", "ss-svgtext--sm")}{scan > 0.52 && label((px.l + px.r) / 2 + 8, px.t + 12, "zero path difference: all wavenumbers in step", "start", "ss-svgtext--sm")}</>
          : label((px.l + px.r) / 2, (px.t + px.b) / 2 + 4, "the detector will record it here", "middle", "ss-svgtext--sm")}
      </g>
      <g data-testid="ft-arrow" opacity={op >= 4 ? 1 : 0.35}><path d="M448,398 h58 m-10,-8 l10,8 l-10,8" fill="none" stroke={C.on} strokeWidth="3" />{label(477, 384, "FFT", "middle", "ss-svgtext--b")}</g>
      <g data-testid="panel-spectrum" opacity={op >= 4 ? 1 : 0.42}>
        <rect x="512" y={rp.t - 20} width="376" height={rp.b - rp.t + 62} rx="8" fill="rgba(8,20,50,0.55)" stroke="#2b4780" />
        {label(522, rp.t - 5, op >= 5 ? "Infrared spectrum (transmittance)" : op === 4 ? "Fourier transform: intensity at each wavenumber" : "spectrum", "start", "ss-svgtext--b")}
        {op >= 4 ? <>
          <rect x={rp.l} y={rp.t} width={rp.r - rp.l} height={rp.b - rp.t} fill="none" className="ss-axis" />
          {[4000, 3000, 2000, 1000].map((v) => <g key={v}><line x1={sx(v)} x2={sx(v)} y1={rp.b} y2={rp.b + 4} className="ss-axis" />{label(sx(v), rp.b + 17, String(v), "middle", "ss-svgtext--sm")}</g>)}
          <g><line x1={sx(400)} x2={sx(400)} y1={rp.b} y2={rp.b + 4} className="ss-axis" />{label(sx(400), rp.b + 17, "400", "middle", "ss-svgtext--sm")}</g>
          {label((rp.l + rp.r) / 2, rp.b + 33, "Wavenumber (cm⁻¹)", "middle", "ss-svgtext--sm")}
          {op === 4 && <><path d={spBg} fill="none" stroke="#8da4d8" strokeWidth="1.6" strokeDasharray="5 4" /><path d={spPath} fill="none" stroke={C.on} strokeWidth="2.2" data-testid="ft-trace" />{label(rp.r - 4, rp.t + 14, "dashed: without sample", "end", "ss-svgtext--sm")}</>}
          {op >= 5 && <><path d={spPath} fill="none" stroke="#7dd3fc" strokeWidth="2.2" strokeLinejoin="round" data-testid="spectrum-trace" />
            {label(rp.l - 6, rp.t + 4, "100", "end", "ss-svgtext--sm")}{label(rp.l - 6, rp.b + 4, "0", "end", "ss-svgtext--sm")}
            <text transform={`translate(${rp.l - 28} ${(rp.t + rp.b) / 2}) rotate(-90)`} textAnchor="middle" className="ss-svgtext ss-svgtext--sm">Transmittance (%)</text></>}
        </> : label((rp.l + rp.r) / 2 - 10, (rp.t + rp.b) / 2 + 4, "calculated by the computer", "middle", "ss-svgtext--sm")}
      </g>
    </svg>
  );
}
