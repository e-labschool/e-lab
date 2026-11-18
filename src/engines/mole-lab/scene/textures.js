// Small canvas-generated textures (sticker, quantity card, shadow blob, zipper ribs, glare streak).  Browser only.
// Every texture is created through `makeTexture` so a scene can dispose them all on unmount.
import * as THREE from "three";

const FONT = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";
export function makeTexture(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/** Sticker on the lip of the bag: substance formula + name + entity word, with a small colour key bar. */
export function stickerTexture({ formula, name, entity, colour }) {
  return makeTexture(512, 128, (g, w, h) => {
    g.fillStyle = "#f7f8fb"; roundRect(g, 4, 4, w - 8, h - 8, 14); g.fill();
    g.strokeStyle = "rgba(20,30,60,0.28)"; g.lineWidth = 3; g.stroke();
    g.fillStyle = colour; roundRect(g, 14, 14, 14, h - 28, 6); g.fill();
    g.fillStyle = "#14203f"; g.font = `700 64px ${FONT}`; g.textBaseline = "middle"; g.textAlign = "left";
    let fs = 64; while (g.measureText(formula).width > w * 0.46 && fs > 30) { fs -= 4; g.font = `700 ${fs}px ${FONT}`; }
    g.fillText(formula, 42, h * 0.5);
    g.fillStyle = "#33415f"; g.font = `600 27px ${FONT}`; g.textAlign = "right";
    g.fillText(name, w - 22, h * 0.36);
    g.fillStyle = "#5a6788"; g.font = `500 22px ${FONT}`; g.fillText(`1 mol = 1 packet of ${entity}`, w - 22, h * 0.68);
  });
}
/** Quantity card that stands in front of the packet. */
export function cardTexture({ amount, sub }) {
  return makeTexture(512, 160, (g, w, h) => {
    g.fillStyle = "rgba(16,24,48,0.92)"; roundRect(g, 4, 4, w - 8, h - 8, 22); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 ${sub ? 62 : 74}px ${FONT}`;
    g.fillText(amount, w / 2, sub ? h * 0.38 : h * 0.5);
    if (sub) { g.fillStyle = "#c8d3ef"; g.font = `500 34px ${FONT}`; g.fillText(sub, w / 2, h * 0.76); }
  });
}
export function shadowTexture() {
  return makeTexture(128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, "rgba(10,16,30,0.55)"); r.addColorStop(0.55, "rgba(10,16,30,0.22)"); r.addColorStop(1, "rgba(10,16,30,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h); });
}
/** Ribbed zipper rail. */
export function zipTexture(colour) {
  return makeTexture(256, 32, (g, w, h) => {
    g.fillStyle = colour; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.28)"; g.fillRect(0, 0, w, 6); g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(0, h - 7, w, 7);
    for (let x = 0; x < w; x += 8) { g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(x, 8, 3, h - 16); }
  });
}
/** Soft vertical glare streak (white, alpha falling off to the sides) for the plastic. */
export function streakTexture() {
  return makeTexture(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "destination-in"; const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(0.18, "rgba(0,0,0,1)"); v.addColorStop(0.7, "rgba(0,0,0,0.8)"); v.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}
/** Table surface: subtle speckle so the bench does not read as a flat colour. */
export function benchTexture(base, dark) {
  return makeTexture(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    let s = 7; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 2600; i += 1) { g.fillStyle = `rgba(${dark ? "255,255,255" : "20,30,60"},${(0.015 + r() * 0.03).toFixed(3)})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
  });
}
export function ringTexture() {
  return makeTexture(256, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w / 2); r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.62, "rgba(255,255,255,0.0)"); r.addColorStop(0.78, "rgba(255,255,255,0.95)"); r.addColorStop(0.9, "rgba(255,255,255,0.35)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h); });
}

/** Opacity map for the plastic: denser at the sealed edges and along a few creases, clear in the middle (reads as thin film). */
export function plasticAlpha() {
  return makeTexture(200, 248, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    const rr = 30; g.save(); roundRect(g, 0, 0, w, h, rr); g.clip();
    g.fillStyle = "#4a4a4a"; g.fillRect(0, 0, w, h);
    const lx = g.createLinearGradient(0, 0, w, 0); lx.addColorStop(0, "rgba(255,255,255,0.95)"); lx.addColorStop(0.05, "rgba(255,255,255,0.25)"); lx.addColorStop(0.95, "rgba(255,255,255,0.25)"); lx.addColorStop(1, "rgba(255,255,255,0.95)"); g.fillStyle = lx; g.fillRect(0, 0, w, h);
    const ly = g.createLinearGradient(0, 0, 0, h); ly.addColorStop(0, "rgba(255,255,255,0.8)"); ly.addColorStop(0.04, "rgba(255,255,255,0)"); ly.addColorStop(0.96, "rgba(255,255,255,0)"); ly.addColorStop(1, "rgba(255,255,255,0.95)"); g.fillStyle = ly; g.fillRect(0, 0, w, h);
    const sx = [[0.2, 0.04, 0.45], [0.33, 0.025, 0.3], [0.74, 0.05, 0.5], [0.87, 0.02, 0.35]];
    for (const [x, ww, al] of sx) { const gr = g.createLinearGradient((x - ww) * w, 0, (x + ww) * w, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(255,255,255,${al})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect((x - ww) * w, h * 0.15, ww * 2 * w, h * 0.75); }
    g.restore();
  });
}
/** Additive glare for the front panel: soft diagonal streaks and a bright bottom-left corner sheen. */
export function glareTexture() {
  return makeTexture(200, 248, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    const streak = (x0, x1, a, wid) => { g.save(); g.translate(0, 0); const gr = g.createLinearGradient(x0 - wid, 0, x0 + wid, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - wid, h * 0.1); g.lineTo(x0 + wid, h * 0.1); g.lineTo(x1 + wid, h * 0.92); g.lineTo(x1 - wid, h * 0.92); g.fill(); g.restore(); };
    streak(w * 0.16, w * 0.1, 0.55, 9); streak(w * 0.3, w * 0.22, 0.25, 5); streak(w * 0.78, w * 0.9, 0.5, 12); streak(w * 0.9, w * 0.93, 0.3, 4);
    const rg = g.createRadialGradient(w * 0.12, h * 0.95, 0, w * 0.12, h * 0.95, w * 0.5); rg.addColorStop(0, "rgba(255,255,255,0.5)"); rg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = rg; g.fillRect(0, 0, w, h);
  });
}
/** Soft crinkle normal map for the plastic: low-frequency folds + fine creases (deterministic). */
export function crinkleNormal() {
  const W = 256; const H = 256; const hgt = new Float32Array(W * H);
  let sd = 3; const r = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const waves = Array.from({ length: 14 }, () => ({ fx: (r() - 0.5) * 9, fy: (r() - 0.5) * 9, ph: r() * 6.28, a: 0.3 + r() * 0.7 }));
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { let v = 0; for (const w of waves) v += w.a * Math.sin(((x / W) * w.fx + (y / H) * w.fy) * 6.2832 + w.ph); hgt[y * W + x] = v; }
  const t = makeTexture(W, H, (g) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const i = y * W + x; const dx = hgt[y * W + ((x + 1) % W)] - hgt[y * W + ((x + W - 1) % W)]; const dy = hgt[((y + 1) % H) * W + x] - hgt[((y + H - 1) % H) * W + x];
      const k = 0.35; const nx = -dx * k, ny = -dy * k, nz = 1; const l = Math.hypot(nx, ny, nz);
      img.data[i * 4] = (nx / l * 0.5 + 0.5) * 255; img.data[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i * 4 + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** Sticker on the bag: formula large, optional second line (state / name).  Light card with a thin purple outline like the reference. */
export function labelTexture({ main, sub, dark = false }) {
  return makeTexture(512, 256, (g, w, h) => {
    g.fillStyle = "rgba(255,255,255,0.97)"; roundRect(g, 6, 6, w - 12, h - 12, 26); g.fill();
    g.strokeStyle = "#7d6bd0"; g.lineWidth = 5; g.stroke();
    g.fillStyle = "#101828"; g.textAlign = "center"; g.textBaseline = "middle";
    let fs = sub ? 118 : 138; g.font = `700 ${fs}px ${FONT}`; while (g.measureText(main).width > w * 0.84 && fs > 40) { fs -= 6; g.font = `700 ${fs}px ${FONT}`; }
    g.fillText(main, w / 2, sub ? h * 0.4 : h * 0.52);
    if (sub) { g.fillStyle = "#4a5578"; g.font = `500 44px ${FONT}`; g.fillText(sub, w / 2, h * 0.79); }
  });
}
/** Seven-segment style readout for the balance (rendered as bold monospace glow text). */
export function displayTexture(text, unit = "g") {
  return makeTexture(768, 256, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#0b1522"); bg.addColorStop(1, "#050a12"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.shadowColor = "#7be9ff"; g.shadowBlur = 24; g.fillStyle = "#c8f6ff"; g.textBaseline = "middle"; g.textAlign = "right";
    g.font = `700 150px 'Courier New', ui-monospace, monospace`; g.fillText(text, w - 170, h * 0.52);
    g.font = `600 78px ${FONT}`; g.textAlign = "left"; g.fillText(unit, w - 150, h * 0.62);
  });
}
/** Pressure-gauge face for the bell jar. */
export function gaugeTexture(label) {
  return makeTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#f6f8fb"; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fill();
    g.strokeStyle = "#9aa4b8"; g.lineWidth = 4; g.stroke();
    for (let i = 0; i <= 10; i += 1) { const a = Math.PI * (0.75 + 1.5 * (i / 10)); g.strokeStyle = i > 8 ? "#d33" : "#334"; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 92, h / 2 + Math.sin(a) * 92); g.lineTo(w / 2 + Math.cos(a) * 112, h / 2 + Math.sin(a) * 112); g.stroke(); }
    const a = Math.PI * (0.75 + 1.5 * 0.42); g.strokeStyle = "#c22"; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * 88, h / 2 + Math.sin(a) * 88); g.stroke();
    g.fillStyle = "#334"; g.font = `600 26px ${FONT}`; g.textAlign = "center"; g.fillText(label, w / 2, h * 0.78);
  });
}
