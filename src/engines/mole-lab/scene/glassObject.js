// GlassVesselObject: ONE piece of laboratory glassware (beaker, measuring cylinder, volumetric flask) as a plain three.js object
// graph, framework-free and fully disposable.  The glass body, the liquid and the graduations all come from the SAME profile
// (glassware.js), so the drawn level is the calibrated level.  Nothing here holds chemistry: `setLevel(ml)` is a display value.
//
// The liquid is the vessel's whole interior, CLIPPED by a horizontal world-space plane at the liquid surface: when the vessel tilts to
// pour, the liquid surface stays horizontal like real liquid.  (Needs renderer.localClippingEnabled; see LabCanvasExtras.)
import * as THREE from "three";
import { makeVessel, glassProfile, graduations } from "./glassware.js";
import { makeTexture, shadowTexture, ringTexture, streakTexture } from "./textures.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const SEG = 40;
export const WATER = "#2f86d6";

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const labelTexture = ({ text, sub }) => makeTexture(512, 160, (g, w, h) => {
  g.fillStyle = "rgba(16,24,48,0.92)"; roundRect(g, 4, 4, w - 8, h - 8, 22); g.fill(); g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 ${sub ? 54 : 64}px ${FONT}`; g.fillText(text, w / 2, sub ? h * 0.38 : h * 0.5);
  if (sub) { g.fillStyle = "#c8d3ef"; g.font = `500 34px ${FONT}`; g.fillText(sub, w / 2, h * 0.76); }
});
function gradTexture(v, dark) {
  const grads = graduations(v); const W = 128; const Hpx = 1024;
  return makeTexture(W, Hpx, (g) => {
    g.clearRect(0, 0, W, Hpx); g.strokeStyle = dark ? "rgba(235,242,255,0.85)" : "rgba(20,32,70,0.8)"; g.fillStyle = g.strokeStyle; g.font = `600 30px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle";
    for (const gr of grads) { const y = (1 - gr.y / v.height) * Hpx; g.lineWidth = gr.major ? 5 : 3; g.beginPath(); g.moveTo(W * 0.1, y); g.lineTo(W * (gr.major ? 0.62 : 0.4), y); g.stroke(); if (gr.major) g.fillText(String(gr.ml), W * 0.66, y); }
  });
}
function flaskTagTexture(ml, dark) {
  return makeTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = dark ? "rgba(235,242,255,0.92)" : "rgba(20,32,70,0.9)"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `800 64px ${FONT}`; g.fillText(`${ml} mL`, w / 2, h * 0.38); g.font = `600 30px ${FONT}`; g.fillText("volumetric flask", w / 2, h * 0.58); g.fillText("20 °C · to the mark", w / 2, h * 0.74);
  });
}

export class GlassVesselObject {
  constructor({ kind, capacityMl, dark = false, label = null }) {
    this.kind = kind; this.capacityMl = capacityMl; this.dark = dark; this.v = makeVessel(kind, capacityMl); this.disposables = []; this.textures = [];
    this.group = new THREE.Group(); this.group.name = `glass:${kind}`; this.pivot = new THREE.Group(); this.group.add(this.pivot);
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100); this.level = 0; this.tilt = 0;
    this._build(); if (label) this.setLabel(label.text, label.sub);
  }
  _track(x) { this.disposables.push(x); return x; }
  _build() {
    const v = this.v; const dark = this.dark;
    const prof = glassProfile(v).map(([r, y]) => new THREE.Vector2(r, y));
    this.glassGeo = this._track(new THREE.LatheGeometry(prof, SEG));
    this.glassMat = this._track(new THREE.MeshPhysicalMaterial({ color: dark ? 0xcfe3ff : 0xeaf5ff, transparent: true, opacity: dark ? 0.2 : 0.22, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.0, side: THREE.DoubleSide, depthWrite: false }));
    this.glass = new THREE.Mesh(this.glassGeo, this.glassMat); this.glass.renderOrder = 6; this.pivot.add(this.glass);
    // soft silhouette (inverted hull) so thin glass still reads against the bench
    this.edgeMat = this._track(new THREE.MeshBasicMaterial({ color: dark ? 0xbdd4f5 : 0x2a3f78, transparent: true, opacity: dark ? 0.2 : 0.17, side: THREE.BackSide, depthWrite: false, toneMapped: false }));
    this.edge = new THREE.Mesh(this.glassGeo, this.edgeMat); this.edge.scale.set(1.018, 1, 1.018); this.edge.renderOrder = 5; this.pivot.add(this.edge);
    // bright rim
    const rimR = (v.rIn[v.rIn.length - 1] + v.rOut[v.rOut.length - 1]) / 2;
    this.rimGeo = this._track(new THREE.TorusGeometry(rimR, Math.max(0.012, v.wall * 0.34), 8, SEG)); this.rimMat = this._track(new THREE.MeshStandardMaterial({ color: 0xf4f9ff, transparent: true, opacity: 0.75, roughness: 0.1, envMapIntensity: 1.8 }));
    this.rim = new THREE.Mesh(this.rimGeo, this.rimMat); this.rim.rotation.x = Math.PI / 2; this.rim.position.y = v.height + 0.004; this.rim.renderOrder = 7; this.pivot.add(this.rim);
    // liquid: the whole interior, clipped at the surface
    const inner = []; inner.push(new THREE.Vector2(0, v.base)); for (let i = 0; i < v.ys.length; i += 2) { if (v.ys[i] >= v.base && v.rIn[i] > 0.001) inner.push(new THREE.Vector2(Math.max(0.0001, v.rIn[i] - 0.006), v.ys[i])); }
    inner.push(new THREE.Vector2(Math.max(0.0001, v.rIn[v.rIn.length - 1] - 0.006), v.height)); inner.push(new THREE.Vector2(0, v.height));
    this.liqGeo = this._track(new THREE.LatheGeometry(inner, SEG));
    this.liqMat = this._track(new THREE.MeshPhysicalMaterial({ color: WATER, transparent: true, opacity: 0.82, emissive: 0x1d5fae, emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.3, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: [this.clip] }));
    this.liquid = new THREE.Mesh(this.liqGeo, this.liqMat); this.liquid.renderOrder = 3; this.liquid.frustumCulled = false; this.pivot.add(this.liquid);
    this.capGeo = this._track(new THREE.CircleGeometry(1, SEG)); this.capMat = this._track(new THREE.MeshBasicMaterial({ color: dark ? 0xa8d8ff : 0xcfeaff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.cap = new THREE.Mesh(this.capGeo, this.capMat); this.cap.rotation.x = -Math.PI / 2; this.cap.renderOrder = 4; this.cap.visible = false; this.pivot.add(this.cap);
    this.mensGeo = this._track(new THREE.TorusGeometry(1, 0.02, 6, SEG)); this.mensMat = this._track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }));
    this.mens = new THREE.Mesh(this.mensGeo, this.mensMat); this.mens.rotation.x = Math.PI / 2; this.mens.renderOrder = 8; this.mens.visible = false; this.pivot.add(this.mens);
    // graduations (beaker, cylinder): a decal strip on the front
    if (v.kind !== "flask") {
      const tex = gradTexture(v, dark); this.textures.push(tex); const r = v.outerR(v.height * 0.5) + 0.006;
      this.gradMat = this._track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      this.gradGeo = this._track(new THREE.CylinderGeometry(r, r, v.height, 24, 1, true, -0.62, 0.95)); this.grad = new THREE.Mesh(this.gradGeo, this.gradMat); this.grad.position.y = v.height / 2; this.grad.renderOrder = 9; this.pivot.add(this.grad);
    } else {
      // the single calibration ring on the neck and the printed tag on the bulb
      const rr = v.outerR(v.markY) + 0.004; this.markGeo = this._track(new THREE.TorusGeometry(rr, 0.014 * v.scale, 8, SEG)); this.markMat = this._track(new THREE.MeshBasicMaterial({ color: dark ? 0xffd166 : 0xb3261e, toneMapped: false, transparent: true, opacity: 0.95 }));
      this.mark = new THREE.Mesh(this.markGeo, this.markMat); this.mark.rotation.x = Math.PI / 2; this.mark.position.y = v.markY; this.mark.renderOrder = 9; this.pivot.add(this.mark);
      const tex = flaskTagTexture(this.capacityMl, dark); this.textures.push(tex); const R = v.outerR(0.62 * v.scale) + 0.006;
      this.tagMat = this._track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      this.tagGeo = this._track(new THREE.CylinderGeometry(R, R, 0.5 * v.scale, 20, 1, true, -0.5, 1.0)); this.tag = new THREE.Mesh(this.tagGeo, this.tagMat); this.tag.position.y = 0.66 * v.scale; this.tag.renderOrder = 9; this.pivot.add(this.tag);
    }
    // glare streaks
    this.streakTex = streakTexture(); this.textures.push(this.streakTex);
    this.streakMat = this._track(new THREE.MeshBasicMaterial({ map: this.streakTex, transparent: true, opacity: dark ? 0.2 : 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    const sr = v.outerR(v.height * (v.kind === "flask" ? 0.3 : 0.5)) + 0.01; const sh = v.kind === "flask" ? v.height * 0.42 : v.height * 0.8;
    this.streakGeo = this._track(new THREE.CylinderGeometry(sr, sr, sh, 8, 1, true, 0.42, 0.22)); this.streak = new THREE.Mesh(this.streakGeo, this.streakMat); this.streak.position.y = v.kind === "flask" ? v.height * 0.28 : v.height * 0.5; this.streak.renderOrder = 10; this.pivot.add(this.streak);
    // hit proxy, blob shadow, selection / target ring, standing label card
    this.hit = new THREE.Object3D(); this.hit.userData.vesselHit = true; this.group.add(this.hit);
    this.shadowTex = shadowTexture(); this.ringTex = ringTexture(); this.textures.push(this.shadowTex, this.ringTex);
    const R = Math.max(v.outerR(v.height * 0.5), v.outerR(v.base * 2)); this.radius = R;
    this.shadowMat = this._track(new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 }));
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shadowMat); this._track(this.shadow.geometry); this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.004; this.shadow.scale.set(R * 3.0, R * 2.6, 1); this.group.add(this.shadow);
    this.ringMat = this._track(new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, toneMapped: false, color: 0x2fb67a, opacity: 0 }));
    this.ringMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.ringMat); this._track(this.ringMesh.geometry); this.ringMesh.rotation.x = -Math.PI / 2; this.ringMesh.position.y = 0.008; this.ringMesh.scale.set(R * 3.0, R * 3.0, 1); this.group.add(this.ringMesh);
    this.cardMat = this._track(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })); this.cardGeo = this._track(new THREE.PlaneGeometry(1.2, 0.375));
    this.card = new THREE.Mesh(this.cardGeo, this.cardMat); this.card.position.set(0, 0.2, R + 0.5); this.card.rotation.x = -0.42; this.card.renderOrder = 11; this.group.add(this.card);
    this.setLevel(0);
  }
  setLabel(text, sub = null) { const k = `${text}|${sub ?? ""}`; if (k === this._lk) return; this._lk = k; this.cardMat.map?.dispose(); this.cardMat.map = labelTexture({ text, sub }); this.cardMat.needsUpdate = true; }
  setCardVisible(b) { this.card.visible = b; }
  setRing(colour, opacity) { this.ringMat.color.set(colour); this.ringMat.opacity = opacity; }
  /** Display level in mL (0 hides the liquid). */
  setLevel(ml) {
    this.level = ml; const v = this.v; const empty = ml <= 0.001;
    this.liquid.visible = !empty; this.cap.visible = !empty && Math.abs(this.tilt) < 0.1; this.mens.visible = this.cap.visible;
    if (empty) return; const h = Math.min(v.height, v.heightAt(ml)); const r = Math.max(0.001, v.innerR(h) - 0.006);
    this.cap.position.y = h; this.cap.scale.set(r, r, 1); this.mens.position.y = h; this.mens.scale.set(r, r, 1);
    this.surfaceH = h;
  }
  /** Position the vessel (group at the base centre) and tilt it about z (positive = towards +x).  Updates the world clip plane. */
  setPose(x, y, z, tilt) {
    this.tilt = tilt; this.group.position.set(x, y, z); this.pivot.rotation.z = -tilt;
    const h = this.level > 0 ? this.surfaceH ?? 0 : 0; this.clip.constant = y + h * Math.cos(tilt);
    this.cap.visible = this.level > 0.001 && Math.abs(tilt) < 0.1; this.mens.visible = this.cap.visible;
  }
  /** Local lip (pouring spout) and mouth positions; `world` variants include the current pose. */
  lipLocal(out) { return out.set(this.v.outerR(this.v.height) + 0.02, this.v.height, 0); }
  lipWorld(out) { return this.pivot.localToWorld(this.lipLocal(out)); }
  mouthWorld(out) { return this.pivot.localToWorld(out.set(0, this.v.height + 0.05, 0)); }
  surfaceWorld(out) { return this.pivot.localToWorld(out.set(0, this.surfaceH ?? this.v.base, 0)); }
  dispose() {
    for (const t of this.textures) t.dispose(); this.cardMat.map?.dispose();
    for (const d of this.disposables) d.dispose?.(); this.group.clear();
  }
}
