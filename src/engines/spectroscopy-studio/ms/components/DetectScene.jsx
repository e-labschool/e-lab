import { PALETTE } from "./ui.jsx";

const colorOf = (mz, mzs) => PALETTE[mzs.indexOf(mz) % PALETTE.length];
/** Stage 8 (left): ions stream towards the detector; each arrival becomes a pulse in the signal trace. seq = arrival sequence (m/z per ion), k = number detected so far, f = fraction of the next ion's flight. */
export default function DetectScene({ w, h, seq, k, f, mzs }) {
  const pad = 12; const detX = w * 0.42; const y1 = h * 0.30; const sigTop = h * 0.60; const sigH = h * 0.30;
  const next = seq[k]; const flying = next !== undefined;
  const ix = pad + 40 + f * (detX - pad - 40 - 14);
  const win = 24; const recent = seq.slice(Math.max(0, k - win), k);
  const tx0 = pad + 4; const tx1 = w - pad; const dx = (tx1 - tx0) / win;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-detect" role="img" data-testid="detect-svg" data-k={k}
      aria-label="Ions reach the detector one at a time; each arrival is recorded as an electrical pulse, and the spectrum grows.">
      <rect x={pad} y={y1 - 26} width="34" height="52" rx="6" className="ms-partbox" /><text x={pad + 17} y={y1 + 42} textAnchor="middle" className="ms-scenelabel is-sm">analyser</text>
      <line x1={pad + 36} y1={y1} x2={detX} y2={y1} stroke="#31446f" strokeDasharray="3 6" />
      <rect x={detX} y={y1 - 28} width="22" height="56" rx="5" fill="#16a34a" opacity="0.88" />
      <text x={detX + 11} y={y1 - 34} textAnchor="middle" className="ms-scenelabel is-ok">detector</text>
      {flying && <g data-testid="detect-ion"><circle cx={ix} cy={y1} r="9" fill={colorOf(next, mzs)} stroke="#0a1330" strokeWidth="1.4" /><text x={ix} y={y1} textAnchor="middle" dy="0.35em" fontSize="11" fontWeight="900" fill="#0a1330">+</text></g>}
      {flying && <text x={ix} y={y1 - 16} textAnchor="middle" className="ms-scenelabel is-sm" fill={colorOf(next, mzs)}>m/z {next}</text>}
      <path d={`M ${detX + 22} ${y1} H ${detX + 46} V ${sigTop - 14}`} fill="none" stroke="#fde047" strokeWidth="2" strokeDasharray="4 4" />
      <text x={detX + 52} y={y1 + 4} className="ms-scenelabel is-sm">ion → electrical signal</text>
      <text x={pad + 4} y={sigTop - 4} className="ms-scenelabel">Signal recorded (one pulse per ion)</text>
      <line x1={tx0} y1={sigTop + sigH} x2={tx1} y2={sigTop + sigH} stroke="#64748b" />
      {recent.map((mz, i) => { const hh = sigH * (0.55 + 0.4 * (((mz * 7) % 5) / 5)); const x = tx0 + (i + 0.5) * dx; return <line key={i} x1={x} x2={x} y1={sigTop + sigH} y2={sigTop + sigH - hh} stroke={colorOf(mz, mzs)} strokeWidth="3.5" strokeLinecap="round" opacity={0.35 + 0.65 * ((i + 1) / recent.length)} />; })}
      <text x={w - pad} y={h - 4} textAnchor="end" className="ms-scenelabel is-sm">time →</text>
    </svg>
  );
}
