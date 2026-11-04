import { useImperativeHandle, useMemo, useRef, useState } from "react";
import { coordinatesFor, boundingRadius } from "../model/geometry.js";
import { visualsFor, project } from "./viewModel.js";
import { THEME } from "./palette.js";

// 2D (orthographic, rotatable) renderer of the same molecule model. It is the WebGL-less fallback of the 3D viewer, and it is
// fully interactive: drag to rotate, click atoms, keyboard focusable atoms. Atom colours/emphasis come from viewModel.js so it
// always agrees with the 3D scene.
const SCALE_Y = 1;

export default function MoleculeSVG({ molecule, ctx, showBonds = true, showLabels = true, onAtomClick, onBackgroundClick, width, height, apiRef, ariaLabel }) {
  const [rot, setRot] = useState({ yaw: 0.55, pitch: -0.35 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef(null);
  const xyz = useMemo(() => coordinatesFor(molecule), [molecule]);
  const R = useMemo(() => boundingRadius(xyz) + 0.9, [xyz]);
  const vis = useMemo(() => visualsFor(molecule, ctx), [molecule, ctx]);
  useImperativeHandle(apiRef, () => ({
    zoom: (f) => setZoom((z) => Math.min(3, Math.max(0.5, z / f))),
    reset: () => { setRot({ yaw: 0.55, pitch: -0.35 }); setZoom(1); },
    rotate: (dy, dp) => setRot((r) => ({ yaw: r.yaw + dy, pitch: Math.max(-1.4, Math.min(1.4, r.pitch + dp)) })),
  }), []);

  const w = Math.max(60, width); const h = Math.max(60, height);
  const scale = (Math.min(w, h) / (2 * R)) * zoom;
  const cx = w / 2; const cy = h / 2;
  const P = xyz.map((p) => { const q = project(p, rot.yaw, rot.pitch); return { sx: cx + q.x * scale, sy: cy - q.y * scale * SCALE_Y, z: q.z }; });

  const items = [];
  if (showBonds) for (const b of molecule.bonds) items.push({ t: "b", b, z: (P[b.a].z + P[b.b].z) / 2 - 0.01 });
  for (const v of vis) items.push({ t: "a", v, z: P[v.idx].z });
  items.sort((a, b) => a.z - b.z);

  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; };
  const onMove = (e) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true; d.x = e.clientX; d.y = e.clientY;
    setRot((r) => ({ yaw: r.yaw + dx * 0.012, pitch: Math.max(-1.4, Math.min(1.4, r.pitch + dy * 0.012)) }));
  };
  const onUp = (e) => {
    const d = drag.current; drag.current = null;
    if (d && !d.moved && e.target === e.currentTarget) onBackgroundClick?.();
  };
  const rad = (v) => Math.max(5, v.radius * scale * 1.0);

  return (
    <svg className="nm-svg3d" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="group" aria-label={ariaLabel ?? `Rotatable 2D projection of ${molecule.name}`} data-testid="mol-svg"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }} style={{ touchAction: "none", cursor: "grab" }}>
      {items.map((it) => {
        if (it.t === "b") {
          const { a, b, order } = it.b; const A = P[a]; const B = P[b];
          const dx = B.sx - A.sx; const dy = B.sy - A.sy; const len = Math.hypot(dx, dy) || 1; const nx = -dy / len; const ny = dx / len;
          const dimB = ctx.selectedEnvId && vis[a].dim && vis[b].dim;
          const sw = Math.max(2, 0.1 * scale * (ctx.style === "density" ? 0.6 : 1));
          const offs = order === 2 ? [-sw * 0.9, sw * 0.9] : [0];
          return (
            <g key={`b${a}-${b}`} opacity={dimB ? 0.4 : 1} pointerEvents="none">
              {offs.map((o, i) => <line key={i} x1={A.sx + nx * o} y1={A.sy + ny * o} x2={B.sx + nx * o} y2={B.sy + ny * o} stroke="#aab6d6" strokeWidth={order === 2 ? sw * 0.8 : sw} strokeLinecap="round" />)}
            </g>
          );
        }
        const { v } = it; const p = P[v.idx]; const a = molecule.atoms[v.idx]; const r = rad(v);
        const env = v.envId ? molecule.environments.find((e) => e.id === v.envId) : null;
        const name = a.isHydrogen ? `Hydrogen ${a.key}${v.known && env ? `, environment ${env.letter} (${env.label}), ${env.count} equivalent hydrogen${env.count > 1 ? "s" : ""}` : ""}` : `${a.el === "C" ? "Carbon" : "Oxygen"} ${a.key}`;
        return (
          <g key={`a${v.idx}`} transform={`translate(${p.sx} ${p.sy})`} role="button" tabIndex={0} aria-label={name} aria-pressed={v.selected || v.focus || v.carrier} data-testid={`atom-${v.idx}`} data-atom={v.idx} data-env={v.envId ?? ""} data-selected={v.selected ? "1" : "0"}
            onClick={(e) => { e.stopPropagation(); onAtomClick?.(v.idx); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAtomClick?.(v.idx); } }} style={{ cursor: "pointer", outline: "none" }}>
            {(v.selected || v.carrier) && <circle r={r + 6} fill="none" stroke={v.carrier ? THEME.ink : v.color} strokeWidth={3} opacity={v.carrier ? 0.55 : 0.95} strokeDasharray={v.carrier ? "3 3" : undefined} />}
            {v.coupled && <circle r={r + 6} fill="none" stroke={env?.color ?? THEME.ink} strokeWidth={2.5} strokeDasharray="5 4" />}
            {v.focus && <circle r={r + 10} fill="none" stroke="#ffffff" strokeWidth={2} />}
            <circle r={r} fill={v.color} fillOpacity={v.opacity} stroke="rgba(8,16,44,0.85)" strokeWidth={1.5} />
            <circle r={r * 0.38} cx={-r * 0.32} cy={-r * 0.34} fill="#ffffff" opacity={0.28} pointerEvents="none" />
            {showLabels && (
              <text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, r * 0.95)} fontWeight="700" fill={a.el === "H" || ctx.style === "density" ? "#0a1330" : "#ffffff"} pointerEvents="none">
                {v.label.main}{v.label.sub && <tspan fontSize={Math.max(8, r * 0.6)} dy={r * 0.22}>{v.label.sub}</tspan>}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
