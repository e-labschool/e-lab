import { memo, useEffect, useMemo, useRef } from "react";
import { GEOMETRY, ATOM_STYLE, REACTIONS } from "../model/reactions.js";
import { visualCounts } from "../model/visual.js";
import { createSystem, reconcile, processEvents, update, tintFor } from "./particles.js";
import { useElementSize } from "./hooks.js";

// 2D canvas picture of the reaction vessel: smooth lit spheres for atoms (genuine 3D geometry, slowly tumbling, projected), bonds,
// a piston that really moves when the volume changes, a qualitative tint, and animated reaction events.  It READS the model through
// `trRef` every frame and never writes anything.
const sprites = new Map();
function sprite(el, d, dpr) {
  const key = `${el}|${d}|${dpr}`; let c = sprites.get(key); if (c) return c;
  const st = ATOM_STYLE[el] ?? { color: "#888", label: el }; const px = Math.max(8, Math.round(d * dpr));
  c = typeof document !== "undefined" ? document.createElement("canvas") : null; if (!c) return null; c.width = px; c.height = px; const g = c.getContext("2d"); if (!g) return null;
  const r = px / 2; const grad = g.createRadialGradient(r * 0.62, r * 0.55, r * 0.08, r, r, r);
  grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.28, st.color); grad.addColorStop(1, shade(st.color, -0.42));
  g.fillStyle = grad; g.beginPath(); g.arc(r, r, r - 0.8 * dpr, 0, Math.PI * 2); g.fill();
  g.lineWidth = Math.max(1, dpr); g.strokeStyle = "rgba(20,24,40,.65)"; g.stroke();
  if (px >= 17 * dpr) { g.fillStyle = st.dark ? "#1f2937" : "#fff"; g.font = `700 ${Math.round(px * 0.42)}px Inter, system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(st.label, r, r + px * 0.03); }
  sprites.set(key, c); return c;
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt))); const r = f(n >> 16); const g = f((n >> 8) & 255); const b = f(n & 255); return `rgb(${r},${g},${b})`; }

const hFracFor = (V, V0) => Math.min(1, 0.62 * Math.cbrt(V / V0));

function VesselCanvas({ trRef, rid, running, reduced, dark }) {
  const wrap = useRef(null); const cv = useRef(null); const { width, height } = useElementSize(wrap);
  const sys = useRef(createSystem(11)); const view = useRef({ h: null, last: null, dirty: true, key: "" });
  const rx = REACTIONS[rid];
  const runRef = useRef(running); runRef.current = running;
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const darkRef = useRef(dark); darkRef.current = dark;
  const size = useMemo(() => ({ w: Math.max(200, Math.round(width)), h: Math.max(180, Math.round(height)) }), [width, height]);

  useEffect(() => {
    const canvas = cv.current; if (!canvas) return undefined; const ctx = canvas.getContext?.("2d"); if (!ctx) return undefined;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1); canvas.width = Math.round(size.w * dpr); canvas.height = Math.round(size.h * dpr);
    let raf = 0; let cancelled = false; view.current.dirty = true;
    const draw = (now) => {
      if (cancelled) return; raf = requestAnimationFrame(draw);
      const tr = trRef.current; if (!tr) return; const v = view.current; const run = runRef.current; const red = reducedRef.current;
      const dtRaw = v.last == null ? 0 : (now - v.last) / 1000; v.last = now; const dt = Math.min(dtRaw, globalThis.__EQ_DT_MAX ?? 0.05);
      const ch = tr.s; const counts = visualCounts(tr.vis); const key = `${ch.rid}|${ch.V}|${ch.T}|${ch.cat}|${JSON.stringify(counts)}|${tr.vis.seq}`;
      const targetH = rx.gas ? hFracFor(ch.V, ch.V0) : 0.74;
      if (v.h == null) v.h = targetH; const moving = Math.abs(v.h - targetH) > 0.001;
      if (moving) v.h = red ? targetH : v.h + (targetH - v.h) * Math.min(1, dt * 5); 
      const events = tr.vis.recent;
      if (tr.vis.seq < sys.current.lastSeq) sys.current.shownRid = null; // the run was reset: rebuild the picture
      if (sys.current.shownRid !== ch.rid) sys.current.lastSeq = tr.vis.seq;
      reconcile(sys.current, counts, ch.rid); // composition first (disturbances, resets) ...
      const had = processEvents(sys.current, events, ch.rid, now / 1000, red || !run); // ... then animate new events
      if (had) reconcile(sys.current, counts, ch.rid);
      const changed = key !== v.key || had || moving || v.dirty; v.key = key;
      const animating = run && !red; if (!animating && !changed && sys.current.flashes.length === 0 && sys.current.pending.length === 0 && !sys.current.parts.some((p) => p.dying || p.alpha < 1)) return;
      update(sys.current, run ? dt : 0.016, now / 1000, { heat: Math.sqrt(ch.T / rx.run.T), slow: rx.aqueous ? 0.4 : 1, still: red || !run });
      v.dirty = false; render(ctx, dpr, size, sys.current, ch, rx, v.h, darkRef.current, now / 1000);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [size, rx, trRef]);

  const t = trRef.current; const cnt = t ? visualCounts(t.vis) : {};
  const desc = rx.species.map((s) => `${cnt[s.id] ?? 0} ${s.text}`).join(", ");
  return (
    <div ref={wrap} className="eq-vessel" data-testid="vessel" data-rid={rid}>
      <canvas ref={cv} style={{ width: size.w, height: size.h }} role="img" aria-label={`Reaction vessel showing ${desc} molecules. One drawn molecule stands for ${rx.run.unit} mol.`} />
    </div>
  );
}

function render(ctx, dpr, size, sys, ch, rx, hFrac, dark, now) {
  const { w, h } = size; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const margin = Math.max(14, w * 0.1); const x0 = margin; const x1 = w - margin; const yBottom = h - 24; const yTopMax = 30; const full = yBottom - yTopMax;
  const aq = rx.aqueous; const interior = full * hFrac; const yTop = yBottom - interior;
  const ink = dark ? "#e6e9ff" : "#26305a"; const glass = dark ? "rgba(200,210,255,.55)" : "rgba(60,70,140,.5)";
  // heat / cool strip under the vessel
  const hot = ch.T - rx.run.T; const heat = Math.max(-1, Math.min(1, hot / 100));
  const gr = ctx.createLinearGradient(x0, 0, x1, 0); const hc = heat >= 0 ? `rgba(234,88,12,${0.12 + 0.55 * heat})` : `rgba(37,99,235,${0.12 + 0.55 * -heat})`;
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, hc); gr.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = gr; ctx.fillRect(x0 - 10, yBottom + 4, x1 - x0 + 20, 12);
  // tint of the contents
  const tn = tintFor(rx.id, ch.c); ctx.fillStyle = `rgba(${tn.r},${tn.g},${tn.b},${tn.a})`; roundRect(ctx, x0 + 2, yTop, x1 - x0 - 4, interior, 6); ctx.fill();
  // vessel walls (open at the top for the piston / beaker)
  ctx.lineWidth = 3.5; ctx.strokeStyle = glass; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(x0, yTopMax - 6); ctx.lineTo(x0, yBottom); ctx.lineTo(x1, yBottom); ctx.lineTo(x1, yTopMax - 6); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = dark ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.moveTo(x0 + 6, yTopMax + 4); ctx.lineTo(x0 + 6, yBottom - 8); ctx.stroke();
  if (rx.gas) { // piston
    ctx.fillStyle = dark ? "#6f79c9" : "#8b93d9"; ctx.strokeStyle = dark ? "#c7ccff" : "#3b448f"; ctx.lineWidth = 2; roundRect(ctx, x0 + 3, yTop - 12, x1 - x0 - 6, 12, 4); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, yTop - 12); ctx.lineTo((x0 + x1) / 2, Math.max(6, yTop - 30)); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc((x0 + x1) / 2, Math.max(6, yTop - 30), 6, 0, Math.PI * 2); ctx.fill();
  } else { // liquid surface
    ctx.strokeStyle = dark ? "rgba(190,215,255,.6)" : "rgba(40,90,170,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 3, yTop); ctx.lineTo(x1 - 3, yTop); ctx.stroke();
  }
  // molecules
  const bw = x1 - x0 - 12; const bh = interior - 14; const S = Math.max(6, Math.min(11, Math.min((x1 - x0) * 0.62, full * 0.62) / 15));
  const items = [];
  for (const p of sys.parts) {
    const geom = GEOMETRY[rx.species.find((s) => s.id === p.sp)?.geom]; if (!geom) continue;
    const cx = x0 + 6 + p.x * bw; const cy = yTop + 7 + p.y * bh; const cy1 = Math.cos(p.yaw); const sy = Math.sin(p.yaw); const cp = Math.cos(p.pitch); const sp = Math.sin(p.pitch);
    const pts = geom.atoms.map((a) => { const xr = a.x * cy1 + a.z * sy; const z1 = -a.x * sy + a.z * cy1; const yr = a.y * cp - z1 * sp; const z2 = a.y * sp + z1 * cp; return { el: a.el, x: cx + xr * S, y: cy + yr * S, z: z2, r: (ATOM_STYLE[a.el]?.r ?? 0.6) }; });
    items.push({ p, geom, pts, cx, cy });
  }
  ctx.globalAlpha = 1;
  for (const it of items) {
    ctx.globalAlpha = it.p.alpha; ctx.lineCap = "round";
    for (const [i, j, order] of it.geom.bonds) {
      const a = it.pts[i]; const b = it.pts[j]; const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1; const nx = -dy / len; const ny = dx / len; const lines = order >= 3 ? 3 : order >= 1.5 ? 2 : 1; const off = S * 0.2;
      ctx.strokeStyle = dark ? "rgba(235,238,255,.85)" : "rgba(35,40,70,.8)"; ctx.lineWidth = Math.max(1.4, S * (lines === 1 ? 0.3 : 0.15));
      for (let k = 0; k < lines; k += 1) { const o = (k - (lines - 1) / 2) * off; ctx.beginPath(); ctx.moveTo(a.x + nx * o, a.y + ny * o); ctx.lineTo(b.x + nx * o, b.y + ny * o); ctx.stroke(); }
    }
    const order = [...it.pts].sort((a, b) => a.z - b.z);
    for (const a of order) { const d = a.r * S * 2.05; const sp = sprite(a.el, Math.round(d), dpr); if (sp) ctx.drawImage(sp, a.x - d / 2, a.y - d / 2, d, d); }
    const spc = rx.species.find((s) => s.id === it.p.sp);
    if (spc?.charge) { ctx.fillStyle = dark ? "#fff" : "#111827"; ctx.font = "700 11px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText(spc.charge > 0 ? `${spc.charge > 1 ? spc.charge : ""}+` : "−", it.cx + S * 1.9, it.cy - S * 1.5); }
  }
  ctx.globalAlpha = 1;
  for (const f of sys.flashes) { const px = x0 + 6 + f.x * bw; const py = yTop + 7 + f.y * bh; const k = f.t / 0.55; ctx.strokeStyle = f.forward ? `rgba(37,99,235,${0.8 * (1 - k)})` : `rgba(234,88,12,${0.8 * (1 - k)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 6 + k * 26, 0, Math.PI * 2); ctx.stroke(); }
  // readout of volume under the vessel
  ctx.fillStyle = ink; ctx.font = "600 12px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
  void now;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

export default memo(VesselCanvas);
