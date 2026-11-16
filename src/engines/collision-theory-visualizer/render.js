// Canvas drawing of the vessel. Pure drawing: reads the engine, never changes it. No per-frame object allocation except the
// small gradient-free path calls the canvas needs.
import { WORLD, R, TILE_R, effectiveEa } from "./lib/collisionEngine.js";
import { SPECIES, SITE_COLOR, ENERGETIC } from "./theme.js";

export function fitView(cssW, cssH) {
  const pad = 6;
  const s = Math.max(0.2, Math.min((cssW - 2 * pad) / WORLD.w, (cssH - 2 * pad) / WORLD.h));
  return { s, ox: (cssW - WORLD.w * s) / 2, oy: (cssH - WORLD.h * s) / 2 };
}

export function draw(ctx, engine, view, opts) {
  const { cssW, cssH, dpr } = view;
  const { s, ox, oy } = fitView(cssW, cssH);
  const p = engine.p; const eaEff = effectiveEa(p);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  // vessel
  ctx.fillStyle = "#f7faff"; ctx.strokeStyle = "#3b4d7a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(ox, oy, WORLD.w * s, WORLD.h * s); ctx.fill(); ctx.stroke();
  const half = (Math.min(360, p.site) * Math.PI) / 360; const showSites = opts.showSites && p.site < 360;
  // solid sites
  if (p.system === "solid") {
    for (let k = 0; k < engine.tn; k++) {
      const cx = ox + engine.tx[k] * s; const cy = oy + engine.ty[k] * s; const r = TILE_R * s;
      if (engine.tstate[k] !== 0) {
        if (engine.tflash[k] > 0) { ctx.strokeStyle = SPECIES[2].color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * (1 + (0.6 - engine.tflash[k]) * 3), 0, 6.2832); ctx.stroke(); }
        continue;
      }
      ctx.fillStyle = SPECIES[0].color; ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, 0, 6.2832); ctx.fill();
      if (showSites) { ctx.strokeStyle = SITE_COLOR; ctx.lineWidth = Math.max(1, 1.3 * s); ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, engine.tphi[k] - half, engine.tphi[k] + half); ctx.stroke(); }
    }
  }
  const letters = R * s >= 6.5;
  if (letters) { ctx.font = `700 ${Math.round(R * s * 1.15)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; }
  for (let i = 0; i < engine.n; i++) {
    const cx = ox + engine.x[i] * s; const cy = oy + engine.y[i] * s; const r = R * s; const sp = SPECIES[engine.sp[i]];
    ctx.fillStyle = sp.color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
    if (opts.showEnergetic && engine.ke(i) >= eaEff) { ctx.strokeStyle = ENERGETIC; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, 6.2832); ctx.stroke(); }
    if (showSites && engine.sp[i] < 2) { ctx.strokeStyle = SITE_COLOR; ctx.lineWidth = Math.max(2, 2.2 * s); ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, engine.phi[i] - half, engine.phi[i] + half); ctx.stroke(); }
    if (letters) { ctx.fillStyle = sp.ink; ctx.fillText(sp.id, cx, cy + 0.5); }
    if (engine.flash[i] > 0) { ctx.strokeStyle = SPECIES[2].color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r * (1.25 + (0.6 - engine.flash[i]) * 1.6), 0, 6.2832); ctx.stroke(); }
  }
  // marker on the collision currently shown in the magnifier
  const m = opts.marker;
  if (m) {
    ctx.strokeStyle = "#14226b"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(ox + m.x * s, oy + m.y * s, (R + 7) * s, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
  }
}
