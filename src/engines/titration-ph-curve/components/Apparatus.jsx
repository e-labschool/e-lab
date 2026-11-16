import React from "react";
import { indicatorColourCss } from "../../../lib/acidbase/indicators.js";
import { formatPH } from "../../../lib/acidbase/format.js";

/** Burette + conical flask + pH meter, drawn as one scalable SVG. The burette shows the CURRENT FILL (refilled every 50 cm3, like a real one). */
export default function Apparatus({ t, v, pH, indicatorId, dropKey }) {
  const fill = Math.floor(Math.max(0, v - 1e-9) / 50); const used = v - fill * 50; // cm3 dispensed from the current fill
  const top = 34, bottom = 224; const yOf = (reading) => top + (reading / 50) * (bottom - top);
  const flaskCol = indicatorId ? indicatorColourCss(indicatorId, pH) : t.flaskIsAcid ? "rgba(214,120,110,0.4)" : "rgba(90,140,210,0.4)";
  const buretteCol = t.burette.kind === "acid" ? "rgba(214,120,110,0.7)" : "rgba(90,140,210,0.75)";
  return (
    <svg className="ab-svg tit-app" viewBox="0 0 200 330" role="img" aria-label={`Burette of ${t.burette.label}, ${used.toFixed(1)} cm3 used from this fill, above a flask of ${t.flask.label}`}>
      <text x="100" y="14" textAnchor="middle" fontSize="12" fontWeight="700" fill="#f1f5f9">{t.burette.label}</text>
      <text x="100" y="27" textAnchor="middle" fontSize="11" fill="#b9c4d4">{t.cBurette.toFixed(3)} mol dm{"⁻³"}</text>
      <rect x="84" y={top} width="32" height={bottom - top} rx="3" fill="rgba(200,220,245,0.08)" stroke="#9aa8bd" />
      <rect x="85" y={yOf(used)} width="30" height={Math.max(0, bottom - yOf(used))} fill={buretteCol} />
      {[0, 10, 20, 30, 40, 50].map((r) => (
        <g key={r}><line x1="84" x2="94" y1={yOf(r)} y2={yOf(r)} stroke="#cbd5e1" /><text x="80" y={yOf(r) + 4} textAnchor="end" fontSize="10" fill="#d3dcea">{r}</text></g>
      ))}
      <rect x="92" y={bottom} width="16" height="10" fill="#6b7a92" /><rect x="88" y={bottom + 4} width="24" height="4" rx="2" fill="#8a97ad" />
      <path d={`M96 ${bottom + 10} h8 v14 l-4 6 l-4 -6 z`} fill="rgba(200,220,245,0.25)" stroke="#9aa8bd" />
      {dropKey > 0 && <circle key={dropKey} className="tit-drop" cx="100" cy={bottom + 32} r="3" fill={buretteCol} />}
      <path d="M86 262 L86 280 L52 322 Q48 328 56 328 L144 328 Q152 328 148 322 L114 280 L114 262 Z" fill="rgba(200,220,245,0.07)" stroke="#9aa8bd" />
      <path d="M78.6 300 L121.4 300 L148 322 Q152 328 144 328 L56 328 Q48 322 52 322 Z" fill={flaskCol} />
      <path d="M62 300 H138 L150 320 Q152 328 144 328 H56 Q48 328 50 320 Z" fill={flaskCol} />
      <text x="170" y={bottom - 4} textAnchor="end" fontSize="10" fill="#b9c4d4">{fill > 0 ? `refill ×${fill}` : ""}</text>
      <text x="100" y="258" textAnchor="middle" fontSize="11" fill="#f1f5f9" fontWeight="600">{t.flask.label} {t.vFlask.toFixed(1)} cm{"³"}</text>
    </svg>
  );
}
export function PHMeter({ pH }) {
  return <div className="tit-meter" aria-hidden="true"><span>pH meter</span><strong>{formatPH(pH)}</strong></div>;
}
