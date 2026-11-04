// Canvas 2D renderer for the Gas Laws Explorer chamber. Pure drawing: reads the
// physics sim and never mutates it. Same visual language as the Ideal Gas
// simulation (glass cylinder, steel piston, glossy blue particles), plus a
// litre scale beside the cylinder whose 0-50 L ticks map exactly to the piston
// (pistonHeight(V)), so the piston position can be read off as V.
import { CHAMBER, RANGES } from "./model.js";

const WALL_H = CHAMBER.maxHeight + 15;
export const BASE_H = 12;
const ROD_H = 44;
const PISTON_T = 11;
const TRAIL_LEN = 12;
const FLASH_LIFE = 0.22;
const SCALE_W = 50; // px reserved right of the cylinder for the litre scale
const PARTICLE_COLOURS = ["#2F6BFF", "#3A72FF", "#4A67F5", "#2A62F0"];

export function computeLayout(cssW, cssH) {
  const padX = 10;
  const padY = 10;
  const totalUnits = ROD_H + WALL_H + BASE_H + 8;
  const unitsW = CHAMBER.width + 14;
  const s = Math.max(0.2, Math.min((cssW - 2 * padX - SCALE_W) / unitsW, (cssH - 2 * padY) / totalUnits));
  const groupW = unitsW * s + SCALE_W;
  const left = (cssW - groupW) / 2 + 7 * s;
  const top = (cssH - totalUnits * s) / 2;
  const wallTop = top + ROD_H * s;
  const floorY = wallTop + WALL_H * s;
  return { s, top, wallTop, floorY, x0: left, x1: left + CHAMBER.width * s };
}

function makeSprite(colour, rPx, dpr) {
  const size = Math.max(4, Math.ceil(2 * rPx * dpr) + 2);
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d");
  const r = size / 2 - 1;
  const grad = g.createRadialGradient(size * 0.38, size * 0.34, r * 0.1, size / 2, size / 2, r);
  grad.addColorStop(0, "rgba(255,255,255,0.98)");
  grad.addColorStop(0.22, colour);
  grad.addColorStop(1, "rgba(20,50,170,0.95)");
  g.fillStyle = grad;
  g.beginPath(); g.arc(size / 2, size / 2, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(20,40,110,0.35)";
  g.lineWidth = Math.max(0.5, dpr * 0.6);
  g.stroke();
  return c;
}

export function createRenderer() {
  let spriteKey = "";
  let sprites = [];
  const trails = new Map();
  let lastTime = 0;

  function getSprites(rPx, dpr) {
    const q = Math.round(rPx * dpr * 2) / 2;
    const key = `${q}@${dpr}`;
    if (key !== spriteKey) { spriteKey = key; sprites = PARTICLE_COLOURS.map((c) => makeSprite(c, q / dpr, dpr)); }
    return sprites;
  }
  const metal = (ctx, x0, x1, stops) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  };
  function drum(ctx, xl, xr, yTop, yBottom, ery, stops, topFill) {
    const cx = (xl + xr) / 2;
    const rx = (xr - xl) / 2;
    ctx.beginPath();
    ctx.moveTo(xl, yTop);
    ctx.lineTo(xl, yBottom);
    ctx.ellipse(cx, yBottom, rx, ery, 0, Math.PI, 0, true);
    ctx.lineTo(xr, yTop);
    ctx.closePath();
    ctx.fillStyle = metal(ctx, xl, xr, stops);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, yTop, rx, ery, 0, 0, Math.PI * 2);
    ctx.fillStyle = topFill;
    ctx.fill();
    ctx.strokeStyle = "rgba(60,72,95,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawScale(ctx, L, sim) {
    const { s, floorY, x1 } = L;
    const ax = x1 + 14 * s * 0.5 + 12; // scale axis x (px)
    const yOf = (V) => floorY - (CHAMBER.maxHeight * V) / RANGES.V.max * s;
    ctx.save();
    ctx.strokeStyle = "#33415F";
    ctx.fillStyle = "#33415F";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, yOf(0));
    ctx.lineTo(ax, yOf(50));
    ctx.stroke();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (let V = 0; V <= 50; V += 5) {
      const y = yOf(V);
      const major = V % 10 === 0;
      ctx.beginPath();
      ctx.moveTo(ax, y);
      ctx.lineTo(ax + (major ? 7 : 4), y);
      ctx.stroke();
      if (major) ctx.fillText(`${V} L`, ax + 10, y);
    }
    // pointer on the scale at the actual piston underside
    const py = floorY - sim.pistonH * s;
    ctx.fillStyle = "#14226B";
    ctx.beginPath();
    ctx.moveTo(ax - 1, py);
    ctx.lineTo(ax - 9, py - 4.5);
    ctx.lineTo(ax - 9, py + 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw(ctx, sim, { cssW, cssH, dpr, reducedMotion }) {
    const L = computeLayout(cssW, cssH);
    const { s, wallTop, floorY, x0, x1 } = L;
    const widthPx = x1 - x0;
    const cx = (x0 + x1) / 2;
    const ery = Math.max(4, widthPx * 0.045);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (sim.time < lastTime || !sim.display.trails) trails.clear();
    lastTime = sim.time;

    const pistonY = floorY - sim.pistonH * s;
    const pistonTop = pistonY - PISTON_T * s;
    const baseTop = floorY;

    const sh = ctx.createRadialGradient(cx, baseTop + BASE_H * s, 2, cx, baseTop + BASE_H * s, widthPx * 0.75);
    sh.addColorStop(0, "rgba(90,110,150,0.22)");
    sh.addColorStop(1, "rgba(90,110,150,0)");
    ctx.save();
    ctx.translate(0, baseTop + BASE_H * s);
    ctx.scale(1, 0.14);
    ctx.translate(0, -(baseTop + BASE_H * s));
    ctx.fillStyle = sh;
    ctx.fillRect(cx - widthPx, baseTop + BASE_H * s - widthPx, widthPx * 2, widthPx * 2);
    ctx.restore();

    drum(ctx, x0 - 7 * s, x1 + 7 * s, baseTop - 1, baseTop + (BASE_H - 3) * s, ery, [[0, "#6B7585"], [0.18, "#D9DEE6"], [0.45, "#9AA3B1"], [0.8, "#CBD1DA"], [1, "#5F6979"]], "#AEB7C4");

    ctx.fillStyle = "rgba(196,222,250,0.30)";
    ctx.fillRect(x0, wallTop, widthPx, floorY - wallTop);
    ctx.beginPath();
    ctx.ellipse(cx, floorY, widthPx / 2, ery, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120,160,205,0.55)";
    ctx.fill();
    const tint = ctx.createLinearGradient(0, pistonY, 0, floorY);
    tint.addColorStop(0, "rgba(165,205,245,0.55)");
    tint.addColorStop(1, "rgba(140,185,235,0.5)");
    ctx.fillStyle = tint;
    ctx.fillRect(x0, pistonY, widthPx, floorY - pistonY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, pistonY, widthPx, floorY - pistonY);
    ctx.clip();
    const rPx = sim.radius * s;
    const sp = getSprites(rPx, dpr);
    const parts = sim.particles;

    if (sim.display.trails && !reducedMotion) {
      const live = new Set();
      for (const p of parts) {
        live.add(p.id);
        let t = trails.get(p.id);
        if (!t) { t = []; trails.set(p.id, t); }
        if (!sim.paused) { t.push(p.x, p.y); if (t.length > TRAIL_LEN * 2) t.splice(0, 2); }
      }
      for (const id of trails.keys()) if (!live.has(id)) trails.delete(id);
      ctx.lineCap = "round";
      for (const p of parts) {
        const t = trails.get(p.id);
        if (!t || t.length < 4) continue;
        const n = t.length / 2;
        for (let i = 1; i < n; i++) {
          const k = i / n;
          ctx.lineWidth = Math.max(1, rPx * (0.35 + 0.9 * k));
          ctx.strokeStyle = `rgba(80,120,255,${(k * 0.32 * p.alpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(x0 + t[2 * i - 2] * s, floorY - t[2 * i - 1] * s);
          ctx.lineTo(x0 + t[2 * i] * s, floorY - t[2 * i + 1] * s);
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.drawImage(sp[p.id % sp.length], x0 + p.x * s - rPx - 1, floorY - p.y * s - rPx - 1, 2 * rPx + 2, 2 * rPx + 2);
    }
    ctx.globalAlpha = 1;
    if (sim.display.collisions && !reducedMotion) {
      for (const e of sim.events) {
        const age = sim.time - e.t;
        if (age < 0 || age > FLASH_LIFE) continue;
        const k = age / FLASH_LIFE;
        ctx.strokeStyle = e.kind === "wall" ? `rgba(234,160,20,${(0.8 * (1 - k)).toFixed(3)})` : `rgba(16,185,129,${(0.8 * (1 - k)).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2.5]);
        ctx.beginPath();
        ctx.arc(x0 + e.x * s, floorY - e.y * s, rPx * (1.1 + 1.6 * k), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(90,125,175,0.85)";
    ctx.lineWidth = Math.max(1.5, s * 1.1);
    ctx.beginPath();
    ctx.moveTo(x0, wallTop);
    ctx.lineTo(x0, floorY);
    ctx.ellipse(cx, floorY, widthPx / 2, ery, 0, Math.PI, 0, true);
    ctx.lineTo(x1, wallTop);
    ctx.stroke();
    const hl = ctx.createLinearGradient(x0, 0, x0 + widthPx * 0.22, 0);
    hl.addColorStop(0, "rgba(255,255,255,0)");
    hl.addColorStop(0.3, "rgba(255,255,255,0.6)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fillRect(x0, wallTop, widthPx * 0.22, floorY - wallTop);
    const hr = ctx.createLinearGradient(x1 - widthPx * 0.09, 0, x1, 0);
    hr.addColorStop(0, "rgba(255,255,255,0)");
    hr.addColorStop(0.7, "rgba(255,255,255,0.35)");
    hr.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hr;
    ctx.fillRect(x1 - widthPx * 0.09, wallTop, widthPx * 0.09, floorY - wallTop);
    ctx.strokeStyle = "rgba(90,125,175,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, wallTop, widthPx / 2, ery, 0, 0, Math.PI * 2);
    ctx.stroke();

    const rodW = Math.max(6, 11 * s);
    const rodTop = pistonTop - (ROD_H - 6) * s;
    const rodStops = [[0, "#6B7585"], [0.3, "#F0F3F7"], [0.7, "#A2ABB8"], [1, "#5F6979"]];
    drum(ctx, cx - rodW / 2, cx + rodW / 2, rodTop, pistonTop, rodW * 0.18, rodStops, "#C9D0DA");
    drum(ctx, x0 + 1, x1 - 1, pistonTop, pistonY, ery, [[0, "#6F7989"], [0.14, "#E4E8EE"], [0.4, "#AEB7C4"], [0.72, "#D6DBE3"], [1, "#667082"]], "#CBD2DC");
    drum(ctx, cx - rodW / 2, cx + rodW / 2, pistonTop - 2 * s, pistonTop, rodW * 0.18, rodStops, "#C9D0DA");

    drawScale(ctx, L, sim);
  }
  return { draw };
}
