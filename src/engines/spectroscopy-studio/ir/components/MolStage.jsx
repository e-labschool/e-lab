import { useMemo, useRef } from "react";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import { detectWebGL } from "../../components/webgl.js";
import { usePhase } from "../../components/useAnim.js";
import { useReducedMotion, useStudio } from "../../state/StudioContext.jsx";
import MoleculeVibScene from "../scene/MoleculeVibScene.jsx";
import { visualOf } from "../scene/visual.js";
import { displayHz, poseFactor } from "../scene/vibClock.js";

/**
 * The large animated molecule of the IR workspace: 3D (three.js, instanced geometry) when WebGL exists, otherwise an animated SVG projection of the SAME
 * displacement pattern. vib = { disp, wn, key } | null (null: a still molecule); gain scales the swing (a molecule that absorbs swings more), glow lights the atoms,
 * highlight = atom indices of the functional group being shown (others are dimmed).
 */
export default function MolStage({ molId, vib = null, gain = 1, glow = 0, highlight = null, arrows = true, labels = true, amp = 0.34, testId = "mol-stage", label, forceSvg = false }) {
  const vis = useMemo(() => visualOf(molId), [molId]);
  const paused = useStudio((s) => s.paused); const speed = useStudio((s) => s.speed); const reduced = useReducedMotion();
  const webgl = useMemo(() => !forceSvg && detectWebGL(), [forceSvg]);
  const live = useRef({});
  live.current = { disp: vib?.disp ?? null, hz: vib ? displayHz(vib.wn) : 0, amp, gain, glow, highlight, paused, reduced, speed, key: vib?.key ?? "" };
  const position = useMemo(() => { const d = vis.radius * 2.8; const v = [0.3, -1, 0.34]; const n = Math.hypot(...v); return v.map((x) => (x / n) * d); }, [vis]);
  const aria = label ?? `Animated ball-and-stick model of ${vis.name}`;
  return (
    <div className="ir-molstage" data-testid={testId} data-mol={molId} data-webgl={webgl ? "1" : "0"} data-mode={vib?.key ?? ""} data-highlight={highlight ? highlight.join(",") : ""}>
      {webgl ? (
        <ThreeCanvas position={position} label={aria} testId="mol-canvas" fallback="The 3D molecule needs WebGL. The controls and explanations still work.">
          <MoleculeVibScene vis={vis} live={live} arrows={arrows} labels={labels} />
        </ThreeCanvas>
      ) : <MolSvg vis={vis} live={live} arrows={arrows} label={aria} />}
    </div>
  );
}

const YAW = 0.42; const PITCH = 0.32;
function project(p, rotY) {
  const c = Math.cos(rotY); const s = Math.sin(rotY);
  const x = p[0] * c + p[2] * s; const z = -p[0] * s + p[2] * c; const y = p[1];
  const cy = Math.cos(YAW); const sy = Math.sin(YAW); const x1 = x * cy - y * sy; const y1 = x * sy + y * cy;
  return { x: x1, up: z * Math.cos(PITCH) + y1 * Math.sin(PITCH), depth: y1 * Math.cos(PITCH) - z * Math.sin(PITCH) };
}
/** WebGL-less fallback: the same atoms, bonds, arrows and the same motion, orthographic. */
function MolSvg({ vis, live, arrows, label }) {
  const phase = usePhase({ scale: 1 });
  const L = live.current; const W = 400; const H = 300;
  const pose = L.disp ? poseFactor({ t: phase }, L.hz, L.reduced) : 0; const amp = (L.amp ?? 0.34) * (L.gain ?? 1) * pose;
  const hl = L.highlight && L.highlight.length ? new Set(L.highlight) : null;
  const rest = vis.atoms.map((a) => project(a.pos, vis.rotY));
  const pts = vis.atoms.map((a, i) => { const d = L.disp ? L.disp[i] : [0, 0, 0]; return project([a.pos[0] + amp * d[0], a.pos[1] + amp * d[1], a.pos[2] + amp * d[2]], vis.rotY); });
  const sc = Math.min(W, H) / (2 * vis.radius) * 0.92;
  const X = (q) => W / 2 + q.x * sc; const Y = (q) => H / 2 - q.up * sc;
  const order = vis.atoms.map((_, i) => i).sort((a, b) => pts[a].depth - pts[b].depth);
  return (
    <svg className="ir-molsvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} data-testid="mol-svg" data-pose={pose.toFixed(3)} preserveAspectRatio="xMidYMid meet">
      <defs><marker id="ir-arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#fcd34d" /></marker></defs>
      {L.disp && vis.atoms.map((a, i) => <circle key={`g${i}`} cx={X(rest[i])} cy={Y(rest[i])} r={a.style.radius * sc} fill="none" stroke={a.style.color} strokeOpacity="0.35" strokeDasharray="3 3" />)}
      {vis.bonds.map((b, i) => <line key={`b${i}`} x1={X(pts[b.a])} y1={Y(pts[b.a])} x2={X(pts[b.b])} y2={Y(pts[b.b])} stroke="#aab6d6" strokeWidth={b.order > 1 ? 4 + b.order : 5} strokeOpacity={hl && !(hl.has(b.a) && hl.has(b.b)) ? 0.4 : 1} strokeLinecap="round" />)}
      {arrows && L.disp && vis.atoms.map((a, i) => { const d = L.disp[i]; const m = Math.hypot(...d); if (m < 0.08) return null; const q = project([a.pos[0] + 0.85 * d[0], a.pos[1] + 0.85 * d[1], a.pos[2] + 0.85 * d[2]], vis.rotY); return <line key={`a${i}`} x1={X(rest[i])} y1={Y(rest[i])} x2={X(q)} y2={Y(q)} stroke="#fcd34d" strokeWidth="2.5" markerEnd="url(#ir-arr)" />; })}
      {order.map((i) => { const a = vis.atoms[i]; const on = !hl || hl.has(i); return (
        <g key={`n${i}`} data-atom={i}>
          {hl && hl.has(i) && <circle cx={X(pts[i])} cy={Y(pts[i])} r={a.style.radius * sc * 1.5} fill="#7dd3fc" fillOpacity="0.3" />}
          <circle cx={X(pts[i])} cy={Y(pts[i])} r={a.style.radius * sc} fill={a.style.color} fillOpacity={on ? 1 : 0.4} stroke="#0a1330" strokeWidth="1" />
          {(vis.atoms.length <= 6 || a.el !== "H") && <text x={X(pts[i])} y={Y(pts[i]) + 5} textAnchor="middle" className={`ir-svglabel ir-svglabel--${a.el}`}>{a.el}</text>}
        </g>
      ); })}
    </svg>
  );
}
