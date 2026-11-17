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
