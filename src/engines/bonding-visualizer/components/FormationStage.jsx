import { memo } from "react";
import { EXTRA_ELECTRON, SHARED_RING } from "../scene/formation.js";

const RING = "#9fb1d1";
const CORE_DOT = "#94a3b8";
const SUBS = "₀₁₂₃₄₅₆₇₈₉";
function parts(str) {
  const out = [];
  for (const ch of String(str)) { const k = SUBS.indexOf(ch); const sub = k >= 0; const t = sub ? String(k) : ch; if (out.length && !!out[out.length - 1].sub === sub) out[out.length - 1].t += t; else out.push({ t, sub }); }
  return out;
}
/** SVG text with real subscripts. */
export function SvgSubs({ text, size }) {
  const ps = parts(text);
  return ps.map((q, i) => (q.sub ? <tspan key={i} dy={size * 0.22} fontSize={size * 0.68}>{q.t}</tspan> : <tspan key={i} dy={i && ps[i - 1].sub ? -size * 0.22 : undefined}>{q.t}</tspan>));
}

const clip = (i) => `bv-fclip-${i}`;

/**
 * Draws one formation frame (see scene/formation.js). `dragFor(atomIndex)` returns pointer handlers or null (setup only).
 * outerOnly: no inner rings / electrons, atoms are labelled cores inside their valence shell.
 */
function FormationStageBase({ frame, outerOnly, dragFor, selectedIndex, world, svgRef, onBackgroundDown, label, showCharges = true }) {
  const showShells = frame.t.approach > 0 || frame.stage === "setup";
  return (
    <svg ref={svgRef} className="bv-svg" viewBox={`0 0 ${world.W} ${world.H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} onPointerDown={(e) => { if (e.target === e.currentTarget) onBackgroundDown?.(); }} data-testid="formation-svg" data-outer={outerOnly ? "1" : "0"}>
      <defs>
        {frame.lenses.map((l, i) => (
          <g key={`d${i}`}>
            <clipPath id={clip(`a${i}`)}><circle cx={l.ax} cy={l.ay} r={l.ar} /></clipPath>
            <clipPath id={clip(`b${i}`)}><circle cx={l.bx} cy={l.by} r={l.br} /></clipPath>
            <linearGradient id={clip(`g${i}`)} gradientUnits="userSpaceOnUse" x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by}><stop offset="0" stopColor={l.ca} /><stop offset="1" stopColor={l.cb} /></linearGradient>
          </g>
        ))}
      </defs>

      {/* valence clouds, rings, inner shells */}
      {frame.atoms.map((a) => {
        const drag = dragFor?.(a.i);
        return (
          <g key={`atom${a.i}`} data-testid={`atom-${a.symbol}`} data-symbol={a.symbol} data-index={a.i} className={"bv-atom" + (drag ? " bv-atom--drag" : "")} {...(drag ?? {})}>
            <circle cx={a.x} cy={a.y} r={Math.max(a.r, 30)} fill="transparent" />
            {showShells && <circle cx={a.x} cy={a.y} r={a.r} fill={a.tint} fillOpacity={outerOnly ? 0.09 : 0.07} />}
            {frame.rings.filter((r) => r.atom === a.i).map((r) => (
              <circle key={`r${r.k}`} cx={r.x} cy={r.y} r={r.r} fill="none" stroke={RING} strokeWidth="1.2" strokeOpacity="0.9" strokeDasharray={r.kernel ? "3 3" : undefined} data-ring={r.k} />
            ))}
            <circle cx={a.x} cy={a.y} r={a.r} fill="none" stroke={outerOnly ? a.tint : RING} strokeWidth={outerOnly ? 2.2 : 1.6} strokeOpacity={outerOnly ? 0.85 : 1} data-valence-ring="1" />
            {selectedIndex === a.i && <circle cx={a.x} cy={a.y} r={a.r + 7} fill="none" stroke="#2f7bf5" strokeWidth="1.8" strokeDasharray="5 4" />}
          </g>
        );
      })}

      {/* overlap of the two valence shells: outlined and tinted */}
      {frame.lenses.map((l, i) => l.opacity > 0.01 && (
        <g key={`lens${i}`} pointerEvents="none" data-testid="overlap" opacity={l.opacity}>
          <circle cx={l.bx} cy={l.by} r={l.br} fill={SHARED_RING} fillOpacity="0.26" clipPath={`url(#${clip(`a${i}`)})`} />
          <circle cx={l.bx} cy={l.by} r={l.br} fill="none" stroke={SHARED_RING} strokeWidth="2.6" clipPath={`url(#${clip(`a${i}`)})`} />
          <circle cx={l.ax} cy={l.ay} r={l.ar} fill="none" stroke={SHARED_RING} strokeWidth="2.6" clipPath={`url(#${clip(`b${i}`)})`} />
        </g>
      ))}

      {/* shared-pair capsules */}
      {frame.pairCapsules.map((c) => c.opacity > 0.01 && (
        <rect key={`cap${c.k}`} x={c.x - c.w / 2} y={c.y - c.h / 2} width={c.w} height={c.h} rx={c.h / 2} transform={`rotate(${(c.ang * 180) / Math.PI} ${c.x} ${c.y})`} fill={c.dative ? "#f59e0b" : SHARED_RING} fillOpacity={0.3 * c.opacity} stroke={c.dative ? "#d97706" : SHARED_RING} strokeOpacity={0.9 * c.opacity} strokeWidth="1.4" pointerEvents="none" data-testid="pair-capsule" />
      ))}

      {/* bonds */}
      {frame.bonds.map((b) => b.opacity > 0.01 && (
        <g key={`bond${b.bond}`} pointerEvents="none" data-testid="bond-line" data-order={b.order}>
          {b.lines.map((l, q) => <line key={q} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.dative ? "#d97706" : "#334155"} strokeWidth={Math.max(2.4, frame.S * 2.6)} strokeLinecap="round" strokeOpacity="0.9" />)}
        </g>
      ))}
      {frame.dative.map((d, i) => {
        const dx = d.to.x - d.from.x; const dy = d.to.y - d.from.y; const l = Math.hypot(dx, dy) || 1; const ux = dx / l; const uy = dy / l;
        const x1 = d.from.x + ux * l * 0.22; const y1 = d.from.y + uy * l * 0.22; const x2 = d.from.x + ux * l * 0.62; const y2 = d.from.y + uy * l * 0.62;
        return (
          <g key={`dat${i}`} pointerEvents="none" opacity={d.opacity} data-testid="dative-arrow">
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
            <polygon points={`${x2},${y2} ${x2 - ux * 12 - uy * 7},${y2 - uy * 12 + ux * 7} ${x2 - ux * 12 + uy * 7},${y2 - uy * 12 - ux * 7}`} fill="#d97706" />
          </g>
        );
      })}

      {/* cores: nucleus (+ inner electrons in the full view) */}
      {frame.atoms.map((a) => (
        <g key={`core${a.i}`} pointerEvents="none" data-testid="core" data-symbol={a.symbol}>
          <circle cx={a.x} cy={a.y} r={a.coreR} fill={a.color} stroke={a.edge ?? "#fff"} strokeWidth="1.6" />
          <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, a.coreR * 0.95)} fontWeight="800" fill={a.text ?? "#1e2a44"}>{a.symbol}</text>
          {outerOnly && frame.p < 0.99 && <text x={a.x} y={a.y + a.coreR + 11} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#475569" data-testid="core-charge">core {a.charge}+</text>}
        </g>
      ))}
      {frame.coreDots.map((c) => <circle key={c.id} cx={c.x} cy={c.y} r={c.r} fill={CORE_DOT} stroke="#fff" strokeWidth="0.8" pointerEvents="none" data-core="1" />)}

      {/* electrons */}
      <g data-testid="electrons" pointerEvents="none">
        {frame.electrons.map((e) => (
          <g key={e.id} opacity={e.opacity}>
            {e.state === "shared" && <circle cx={e.x} cy={e.y} r={frame.dotR + 2.6} fill="none" stroke={SHARED_RING} strokeWidth="2.2" />}
            <circle cx={e.x} cy={e.y} r={frame.dotR} fill={e.color} stroke="#fff" strokeWidth="1" data-state={e.state} data-kind={e.kind} data-atom={e.atom} />
          </g>
        ))}
      </g>

      {/* formal charges */}
      {showCharges && frame.badges.map((b) => {
        const pos = b.value > 0; const mag = Math.abs(b.value); const txt = `${mag > 1 ? mag : ""}${pos ? "+" : "−"}`;
        return (
          <g key={`bd${b.i}`} opacity={b.opacity} pointerEvents="none" data-testid="formal-charge" data-charge={b.value}>
            <circle cx={b.x} cy={b.y} r="12.5" fill={pos ? "#fde4e1" : "#dbe9ff"} stroke={pos ? "#c2362f" : "#1c4fb8"} strokeWidth="1.6" />
            <text x={b.x} y={b.y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill={pos ? "#8f1d18" : "#173f91"}>{txt}</text>
          </g>
        );
      })}
    </svg>
  );
}
export default memo(FormationStageBase);
