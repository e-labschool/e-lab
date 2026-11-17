import React from "react";
import { COMPARE_COLOURS } from "../lib/graphModel.js";

const C = { grid: "#2b3a50", axis: "#9aa8bd", text: "#d3dcea", curve: "#9db8e8", student: "#ffd166", eq: "#5eead4", half: "#d8b4fe", buffer: "#f59e0b", steep: "#fda4af", ind: "#e2e8f0" };

function Axes({ m, xTitle }) {
  const { plot } = m;
  return (
    <g>
      {m.yTicks.map((t) => (
        <g key={t.pH}>
          <line x1={plot.x} x2={plot.x + plot.w} y1={t.y} y2={t.y} stroke={t.pH === 7 ? "#7b8aa3" : C.grid} strokeDasharray={t.pH === 7 ? "5 4" : ""} />
          <text x={plot.x - 7} y={t.y + 4} textAnchor="end" fontSize="11" fill={C.text}>{t.pH}</text>
        </g>
      ))}
      {m.xTicks.map((t) => (
        <g key={t.v}>
          <line x1={t.x} x2={t.x} y1={plot.y} y2={plot.y + plot.h} stroke={C.grid} />
          <text x={t.x} y={plot.y + plot.h + 15} textAnchor="middle" fontSize="11" fill={C.text}>{t.v}</text>
        </g>
      ))}
      <line x1={plot.x} y1={plot.y} x2={plot.x} y2={plot.y + plot.h} stroke={C.axis} />
      <line x1={plot.x} y1={plot.y + plot.h} x2={plot.x + plot.w} y2={plot.y + plot.h} stroke={C.axis} />
      <text x={12} y={plot.y + plot.h / 2} transform={`rotate(-90 12 ${plot.y + plot.h / 2})`} textAnchor="middle" fontSize="12" fill={C.text} fontWeight="600">pH</text>
      <text x={plot.x + plot.w / 2} y={m.H - 4} textAnchor="middle" fontSize="12" fill={C.text} fontWeight="600">{xTitle}</text>
    </g>
  );
}

function Labels({ labels, colours = {} }) {
  return labels.map((l) => (
    <g key={l.id}>
      {l.leader && <line x1={l.leader.x1} y1={l.leader.y1} x2={l.leader.x2} y2={l.leader.y2} stroke="#cbd5e1" strokeWidth="1" />}
      <rect x={l.box.x} y={l.box.y} width={l.box.w} height={l.box.h} rx="3" fill="#0e1520" fillOpacity="0.82" stroke={colours[l.id] ?? "#53627a"} strokeWidth="0.8" />
      {l.lines.map((line, i) => (
        <text key={i} x={l.textX} y={l.textY + i * 13} fontSize="11" fill="#f1f5f9" fontWeight={i === 0 ? 600 : 400}>{line}</text>
      ))}
    </g>
  ));
}

export function ExperimentGraph({ m, showExpected, xTitle, description }) {
  const { plot } = m;
  return (
    <svg className="ab-svg tit-svg" width={m.W} height={m.H} viewBox={`0 0 ${m.W} ${m.H}`} role="img" aria-label={description} data-testid="titration-graph">
      <Axes m={m} xTitle={xTitle} />
      {m.indicator && (
        <g>
          <rect x={plot.x} y={m.indicator.y1} width={plot.w} height={m.indicator.y2 - m.indicator.y1} fill={C.ind} fillOpacity="0.09" />
          <text x={plot.x + plot.w + 6} y={m.indicator.mid + 4} fontSize="11" fill={C.text} fontWeight="700">{m.indicator.short}</text>
        </g>
      )}
      {m.buffer && (
        <g data-testid="buffer-region">
          <rect x={m.buffer.x1} y={plot.y} width={m.buffer.x2 - m.buffer.x1} height={plot.h} fill={C.buffer} fillOpacity="0.2" />
          <line x1={m.buffer.x1} x2={m.buffer.x1} y1={plot.y} y2={plot.y + plot.h} stroke={C.buffer} strokeDasharray="4 3" />
          <line x1={m.buffer.x2} x2={m.buffer.x2} y1={plot.y} y2={plot.y + plot.h} stroke={C.buffer} strokeDasharray="4 3" />
          <text x={m.bufferLabel.x} y={m.bufferLabel.y} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fcd9a0">Buffer region</text>
        </g>
      )}
      {m.buffers && m.buffers.map((b) => (
        <g key={`pb${b.index}`} data-testid="buffer-region">
          <rect x={b.x1} y={plot.y} width={b.x2 - b.x1} height={plot.h} fill={C.buffer} fillOpacity="0.2" />
          <line x1={b.x1} x2={b.x1} y1={plot.y} y2={plot.y + plot.h} stroke={C.buffer} strokeDasharray="4 3" />
          <line x1={b.x2} x2={b.x2} y1={plot.y} y2={plot.y + plot.h} stroke={C.buffer} strokeDasharray="4 3" />
          <text x={(b.x1 + b.x2) / 2} y={plot.y + 15} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fcd9a0">Buffer {b.index}</text>
        </g>
      ))}
      {m.steep && <rect x={m.steep.x1} y={plot.y} width={m.steep.x2 - m.steep.x1} height={plot.h} fill={C.steep} fillOpacity="0.25" />}
      {m.eq && (
        <g stroke={C.eq} strokeDasharray="4 3" strokeWidth="1">
          <line x1={m.eq.x} x2={m.eq.x} y1={m.eq.y} y2={plot.y + plot.h} />
          <line x1={plot.x} x2={m.eq.x} y1={m.eq.y} y2={m.eq.y} />
        </g>
      )}
      {m.halfEq && (
        <g stroke={C.half} strokeDasharray="3 3" strokeWidth="1">
          <line x1={m.halfEq.x} x2={m.halfEq.x} y1={m.halfEq.y} y2={plot.y + plot.h} />
          <line x1={plot.x} x2={m.halfEq.x} y1={m.halfEq.y} y2={m.halfEq.y} />
        </g>
      )}
      {showExpected && <path d={m.curvePath} fill="none" stroke={C.curve} strokeOpacity="0.6" strokeWidth="3" strokeLinejoin="round" data-testid="expected-curve" />}
      {m.studentPts.length > 1 && <path d={m.studentPath} fill="none" stroke={C.student} strokeWidth="1.5" strokeOpacity="0.8" />}
      {m.studentPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === m.studentPts.length - 1 ? 5.5 : 3} fill={C.student} stroke="#0e1520" strokeWidth="1" />)}
      {m.markers && m.markers.filter((k) => !(k.kind === "eq" && k.index === 1)).map((k) => (
        <g key={`${k.kind}${k.index}`} data-testid="poly-marker">
          <line x1={k.x} x2={k.x} y1={k.y} y2={plot.y + plot.h} stroke={k.kind === "eq" ? C.eq : C.half} strokeDasharray="3 3" strokeOpacity="0.7" />
          {k.kind === "eq" ? <path d={`M${k.x} ${k.y - 7} l7 7 l-7 7 l-7 -7 z`} fill={C.eq} stroke="#0e1520" /> : <circle cx={k.x} cy={k.y} r="5" fill={C.half} stroke="#0e1520" />}
        </g>
      ))}
      {m.eq && <path d={`M${m.eq.x} ${m.eq.y - 7} l7 7 l-7 7 l-7 -7 z`} fill={C.eq} stroke="#0e1520" />}
      {m.halfEq && <circle cx={m.halfEq.x} cy={m.halfEq.y} r="5" fill={C.half} stroke="#0e1520" />}
      {m.endpoint && <rect x={m.endpoint.x - 4} y={m.endpoint.y - 4} width="8" height="8" fill="#e2e8f0" stroke="#0e1520" />}
      {m.tags.x.map((t) => <text key={`x${t.id}`} x={t.pos} y={plot.y + plot.h + 29} textAnchor="middle" fontSize="11" fontWeight="700" fill={t.id === "eq" ? C.eq : C.half}>{t.text}</text>)}
      {m.tags.y.map((t) => <text key={`y${t.id}`} x={plot.x - 7} y={t.pos + 4} textAnchor="end" fontSize="11" fontWeight="700" fill={t.id === "eq" ? C.eq : C.half}>{t.text}</text>)}
      <Labels labels={m.labels} />
    </svg>
  );
}

export function CompareGraph({ m, description, xTitle }) {
  const { plot } = m;
  return (
    <svg className="ab-svg tit-svg" width={m.W} height={m.H} viewBox={`0 0 ${m.W} ${m.H}`} role="img" aria-label={description} data-testid="compare-graph">
      <Axes m={m} xTitle={xTitle} />
      {m.bands.map((b) => (
        <g key={b.id}>
          <rect x={plot.x} y={b.y1} width={plot.w} height={b.y2 - b.y1} fill={C.ind} fillOpacity="0.09" />
          <text x={plot.x + plot.w + 6} y={b.mid + 4} fontSize="11" fontWeight="700" fill={C.text}>{b.short}</text>
        </g>
      ))}
      {m.curves.map((c) => c.buffer && <rect key={`b${c.id}`} x={c.buffer.x1} y={plot.y} width={c.buffer.x2 - c.buffer.x1} height={plot.h} fill="#f59e0b" fillOpacity="0.2" data-testid="buffer-region" />)}
      {m.curves.map((c) => <path key={c.id} d={c.path} fill="none" stroke={c.colour} strokeWidth="3" strokeDasharray={c.dash} strokeLinejoin="round" />)}
      {m.curves.map((c) => (
        <g key={`m${c.id}`}>
          <circle cx={c.initial.x} cy={c.initial.y} r="4.5" fill={c.colour} stroke="#0e1520" />
          <path d={`M${c.eq.x} ${c.eq.y - 7} l7 7 l-7 7 l-7 -7 z`} fill={c.colour} stroke="#0e1520" />
        </g>
      ))}
      <Labels labels={m.labels} colours={Object.fromEntries(m.curves.flatMap((c) => [[`${c.id}-init`, c.colour], [`${c.id}-eq`, c.colour], [`${c.id}-name`, c.colour]]))} />
    </svg>
  );
}
export { COMPARE_COLOURS };
