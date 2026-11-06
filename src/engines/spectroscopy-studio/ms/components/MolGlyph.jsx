import { ATOM_STYLE, project } from "../scene/glyphs.js";
import { GLYPH_SCALE } from "../scene/world.js";
import { M_COLOR } from "../data/molecules.js";
import { shapePath } from "./shapes.js";

/** Gradient definitions shared by all glyphs of one <svg> (ids are prefixed). */
export function GlyphGradients({ id }) {
  const g = (name, light, dark) => <radialGradient key={name} id={`${id}-${name}`} cx="35%" cy="30%" r="75%"><stop offset="0" stopColor={light} /><stop offset="1" stopColor={dark} /></radialGradient>;
  return <defs>{Object.entries(ATOM_STYLE).map(([el, s]) => g(el, s.light, s.dark))}</defs>;
}
const NEUTRAL_RING = "#aab6d6";
const isRadical = (cat, key) => Boolean(cat?.[key]?.label?.endsWith("•"));

/**
 * One molecule (or molecular ion, or its fragments) drawn as a ball-and-stick glyph in WORLD units, split into PARTS that can move apart.
 *   frame   {x, y, spin, tilt, opacity, flash, parts, bondFx}  from model/journey.js  (parts: role, ids (null = all remaining atoms), kind, ionKey, dx, dy, opacity, label)
 *   kind    neutral (grey "0" badge, no ring) | molion (solid orange ring, "+•") | fragion (ring in the ion's colour AND shape, "+") | neutralfrag (dashed grey ring, "0")
 *   hi      optional emphasis for the pathway view: { charged:Set, neutral:Set, breaks:[[a,b]] }
 */
export default function MolGlyph({ gid, geo, frame, cat, scale = 1, showCharges = true, showLabels = true, mark = null, onSelect = null, ariaLabel, testId, hi = null, labelPx = 11, k = 1, labelParts = true, idx = 0 }) {
  const S = GLYPH_SCALE * scale; const { x, y, spin, tilt, parts, bondFx = [] } = frame;
  const part0 = parts[0];
  const idxOf = {}; parts.forEach((p, pi) => { if (p.ids) for (const id of p.ids) if (pi > 0 || p.role !== "charged") idxOf[id] = pi; });
  // atoms not claimed by a neutral part belong to part 0
  const pos = {};
  const pts = geo.atoms.map((a) => ({ a, q: project(a.p, spin, tilt) }));
  for (const { a, q } of pts) { const pi = idxOf[a.id] ?? 0; const pp = parts[pi]; pos[a.id] = { X: x + pp.dx + q.x * S, Y: y + pp.dy - q.y * S, z: q.z, pi }; }
  const r = (a, z) => ATOM_STYLE[a.el].r * S * 1.12 * (1 + z * 0.03);
  const order = pts.slice().sort((p, q) => pos[p.a.id].z - pos[q.a.id].z);
  const sameBond = (b, p, q) => (b.a === p && b.b === q) || (b.a === q && b.b === p);
  const stretching = parts.filter((p) => p.stretching);
  // ring per part
  const rings = [];
  parts.forEach((p, pi) => {
    if (p.stretching) return;
    const ids = geo.atoms.filter((a) => (pos[a.id].pi === pi) || (pi === 0 && stretching.length && stretching.some((s) => (idxOf[a.id] ?? 0) === parts.indexOf(s)))).map((a) => a.id);
    if (!ids.length) return;
    const cx = ids.reduce((s, id) => s + pos[id].X, 0) / ids.length; const cy = ids.reduce((s, id) => s + pos[id].Y, 0) / ids.length;
    const R = Math.max(...ids.map((id) => Math.hypot(pos[id].X - cx, pos[id].Y - cy) + r(geo.atoms.find((a) => a.id === id), 0))) + 4 * scale + 2;
    rings.push({ p, pi, cx, cy, R });
  });
  const opacityOf = (pi) => frame.opacity * (parts[pi].opacity ?? 1);
  const fs = labelPx / k; const bd = Math.max(7, 9 / k);
  return (
    <g data-testid={testId} data-i={frame.i} role={onSelect ? "button" : "img"} tabIndex={onSelect ? 0 : undefined} aria-label={ariaLabel} className={`ms-mol${onSelect ? " is-click" : ""}`}
      onClick={onSelect ? () => onSelect(frame.i) : undefined} onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(frame.i); } } : undefined}>
      {onSelect && <circle cx={rings[0]?.cx ?? x} cy={rings[0]?.cy ?? y} r={(rings[0]?.R ?? 26) + 6} fill="transparent" className="ms-hit-mol" />}
      {frame.flash > 0 && rings[0] && <circle cx={rings[0].cx} cy={rings[0].cy} r={rings[0].R * (1.1 + (1 - frame.flash) * 0.9)} fill="none" stroke="#fde68a" strokeWidth={3 / k} opacity={Math.min(1, frame.flash) * 0.85} />}
      {rings.map(({ p, pi, cx, cy, R }) => {
        const op = opacityOf(pi); const kind = p.kind; const key = p.ionKey; const ion = cat?.[key];
        if (kind === "neutral") return showCharges ? <g key={pi} opacity={op}><Badge cx={cx + R * 0.72} cy={cy - R * 0.72} text="0" fill="#475569" stroke={NEUTRAL_RING} bd={bd} k={k} /></g> : null;
        if (kind === "neutralfrag") {
          return (
            <g key={pi} opacity={op} data-part="neutral">
              <circle cx={cx} cy={cy} r={R} fill="rgba(148,163,184,0.08)" stroke={NEUTRAL_RING} strokeWidth={2 / k} strokeDasharray={`${6 / k} ${4 / k}`} />
              {showCharges && <Badge cx={cx + R * 0.72} cy={cy - R * 0.72} text="0" fill="#475569" stroke={NEUTRAL_RING} bd={bd} k={k} />}
              {showLabels && p.label && <text x={cx} y={cy + R + fs * 1.1} textAnchor="middle" className="ms-mol-label is-neutral" fontSize={fs}>{`${p.label} neutral`}</text>}
            </g>
          );
        }
        const colour = kind === "molion" ? M_COLOR : ion?.color ?? "#2dd4bf"; const shape = kind === "molion" ? "circle" : ion?.shape ?? "square";
        const rad = isRadical(cat, key);
        return (
          <g key={pi} opacity={op} data-part={kind} data-mz={key}>
            <path d={shapePath(shape, cx, cy, R * (shape === "circle" ? 1 : 1.12))} fill={`${colour}22`} stroke={colour} strokeWidth={(kind === "molion" ? 2.6 : 3) / k} strokeDasharray={ion?.dashed ? `${5 / k} ${3 / k}` : undefined} />
            {showCharges && <Badge cx={cx + R * 0.74} cy={cy - R * 0.74} text={rad ? "+•" : "+"} fill="#7c2d12" stroke={colour} bd={bd} k={k} />}
            {showLabels && ion && labelParts && <text x={cx} y={cy + R + fs * 1.15} textAnchor="middle" className="ms-mol-label" fontSize={fs} fill={colour}>{`${ion.label} ${ion.mz}`}</text>}
          </g>
        );
      })}
      {mark !== null && mark !== false && (rings.find((q) => q.pi === mark) ?? rings[0]) && (() => { const q = rings.find((z) => z.pi === mark) ?? rings[0]; return <circle cx={q.cx} cy={q.cy} r={q.R + 8} fill="none" stroke="#ffffff" strokeWidth={3.2 / k} strokeDasharray={`${9 / k} ${5 / k}`} className="ms-track-ring" data-testid={`track-ring-${frame.i}`} />; })()}
      {/* bonds */}
      {geo.bonds.map(([p, q, o], bi) => {
        const A = pos[p]; const Bp = pos[q]; if (!A || !Bp) return null;
        const fx = bondFx.find((b) => sameBond(b, p, q) && b.state === "stretch");
        const hot = hi?.breaks?.some((b) => sameBond({ a: b[0], b: b[1] }, p, q));
        if (A.pi !== Bp.pi && !fx) return null;
        const w = Math.max(2.2, S * 0.17) * (o === 2 ? 0.7 : 1);
        const common = { x1: A.X, y1: A.Y, x2: Bp.X, y2: Bp.Y, strokeLinecap: "round" };
        const op = Math.min(opacityOf(A.pi), opacityOf(Bp.pi));
        const col = fx || hot ? "#fbbf24" : "#aab6d6";
        const dash = fx ? `${4 / k} ${3 / k}` : undefined;
        const dx = Bp.X - A.X; const dy = Bp.Y - A.Y; const L = Math.hypot(dx, dy) || 1; const nx = (-dy / L) * (S * 0.1); const ny = (dx / L) * (S * 0.1);
        return (
          <g key={`b${bi}`} opacity={op * (fx ? 1 - 0.25 * fx.amt : 1)}>
            {hot && <line {...common} stroke="#fde68a" strokeWidth={w + 5 / k} opacity="0.5" />}
            {o === 2 ? (<><line {...common} x1={A.X + nx} y1={A.Y + ny} x2={Bp.X + nx} y2={Bp.Y + ny} stroke={col} strokeWidth={w} strokeDasharray={dash} /><line {...common} x1={A.X - nx} y1={A.Y - ny} x2={Bp.X - nx} y2={Bp.Y - ny} stroke={col} strokeWidth={w} strokeDasharray={dash} /></>) : <line {...common} stroke={col} strokeWidth={w} strokeDasharray={dash} />}
          </g>
        );
      })}
      {bondFx.filter((b) => b.state === "form").map((b, bi) => { const A = pos[b.a]; const Bp = pos[b.b]; return A && Bp ? <line key={`f${bi}`} x1={A.X} y1={A.Y} x2={Bp.X} y2={Bp.Y} stroke="#aab6d6" strokeWidth={Math.max(2.2, S * 0.17)} strokeLinecap="round" opacity={b.amt * parts[A.pi].opacity * frame.opacity} /> : null; })}
      {order.map(({ a }) => {
        const P = pos[a.id]; const em = hi && (hi.charged?.has(a.id) || hi.neutral?.has(a.id));
        return (
          <g key={a.id} opacity={opacityOf(P.pi)} data-atom={a.id}>
            {em && <circle cx={P.X} cy={P.Y} r={r(a, P.z) + 3.2} fill="none" stroke={hi.charged.has(a.id) ? hi.color : NEUTRAL_RING} strokeWidth={2.4 / k} strokeDasharray={hi.charged.has(a.id) ? undefined : `${4 / k} ${3 / k}`} />}
            <circle cx={P.X} cy={P.Y} r={r(a, P.z)} fill={`url(#${gid}-${a.el})`} stroke="#0a1330" strokeWidth={0.8 / k} />
          </g>
        );
      })}
      {void part0}
    </g>
  );
}
function Badge({ cx, cy, text, fill, stroke, bd, k }) {
  return (
    <g aria-hidden="true">
      <circle cx={cx} cy={cy} r={bd} fill={fill} stroke={stroke} strokeWidth={1.4 / k} />
      <text x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize={bd * 1.25} fontWeight="800" fill="#fff">{text}</text>
    </g>
  );
}
