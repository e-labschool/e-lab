// delta-plus / delta-minus badges (canvas sprites). Colour convention: delta-plus BLUE, delta-minus RED; the sign is always printed as
// well, so colour is never the only cue. These colours mean PARTIAL CHARGE only; electron DENSITY is teal (see densityModel.js).
import * as THREE from "three";

export const CHARGE_COLORS = Object.freeze({ plus: "#2563eb", minus: "#e11d48" });
export function makeChargeTexture(sign, size = 128) {
  const c = document.createElement("canvas"); c.width = size; c.height = size; const g = c.getContext("2d");
  if (g) {
    const col = sign > 0 ? CHARGE_COLORS.plus : CHARGE_COLORS.minus;
    g.shadowColor = "rgba(15,23,42,0.28)"; g.shadowBlur = size * 0.06; g.shadowOffsetY = size * 0.025;
    g.fillStyle = col; g.beginPath(); g.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2); g.fill();
    g.shadowColor = "transparent"; g.lineWidth = size * 0.04; g.strokeStyle = "rgba(255,255,255,0.9)"; g.stroke();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${Math.round(size * 0.46)}px system-ui, -apple-system, "Segoe UI", sans-serif`; g.fillText("δ", size * 0.4, size * 0.52);
    g.font = `800 ${Math.round(size * 0.34)}px system-ui, sans-serif`; g.fillText(sign > 0 ? "+" : "−", size * 0.69, size * 0.38);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}
/** A pair of reusable sprite materials { plus, minus, dispose }. */
export function createChargeMaterials() {
  const tp = makeChargeTexture(1); const tm = makeChargeTexture(-1);
  const plus = new THREE.SpriteMaterial({ map: tp, depthTest: false, transparent: true }); const minus = new THREE.SpriteMaterial({ map: tm, depthTest: false, transparent: true });
  return { plus, minus, dispose() { tp.dispose(); tm.dispose(); plus.dispose(); minus.dispose(); } };
}
