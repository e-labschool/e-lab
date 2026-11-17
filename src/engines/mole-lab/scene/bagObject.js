// PacketBagObject: ONE standard one-mole zip-lock packet as a plain three.js object graph (framework-free, disposable).
//   - two transparent sheets deformed by bagSurfaceZ (folds, wrinkles, pillow bulge that follows the contents)
//   - heat-sealed seam, red (front) / blue (back) ribbed zipper rails, pull tab, lip sticker, glare streaks
//   - instanced particles (ParticleField) driven by the fill FRACTION only
//   - soft blob shadow on the bench, selection / target ring, quantity card standing in front
// The fixed reference geometry (bagSpec.js BAG) is never scaled: the bag is the same size at 0 mol and at 1 mol.
import * as THREE from "three";
import { BAG, BAG_SEGMENTS, bagSurfaceZ, uToX, vToY } from "./bagSpec.js";
import { ParticleField } from "./particleField.js";
import { stickerTexture, cardTexture, shadowTexture, zipTexture, streakTexture, ringTexture } from "./textures.js";
import { getSubstance } from "../engine/substances.js";
import { atomColour } from "../engine/particles.js";

const shared = {}; // textures shared by every bag (created once, disposed with the last bag)
let sharedRefs = 0;
function acquireShared() {
  if (sharedRefs === 0) Object.assign(shared, { shadow: shadowTexture(), zipRed: zipTexture("#c93a3f"), zipBlue: zipTexture("#2f6fd0"), streak: streakTexture(), ring: ringTexture() });
  sharedRefs += 1; return shared;
}
function releaseShared() { sharedRefs -= 1; if (sharedRefs <= 0) { for (const k of Object.keys(shared)) { shared[k].dispose(); delete shared[k]; } sharedRefs = 0; } }

/** A grid mesh whose vertices follow a bag sheet (used for the sheets themselves and every patch drawn on them). */
class SheetPatch {
  constructor({ side, uMin, uMax, vMin, vMax, nu, nv, lift = 0, material, flat = false }) {
    this.side = side; this.uMin = uMin; this.uMax = uMax; this.vMin = vMin; this.vMax = vMax; this.nu = nu; this.nv = nv; this.lift = lift; this.flat = flat;
    const verts = (nu + 1) * (nv + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    const uv = new Float32Array(verts * 2); const idx = [];
    for (let j = 0; j <= nv; j += 1) for (let i = 0; i <= nu; i += 1) { const k = j * (nu + 1) + i; uv[k * 2] = i / nu; uv[k * 2 + 1] = j / nv; }
    for (let j = 0; j < nv; j += 1) for (let i = 0; i < nu; i += 1) { const a = j * (nu + 1) + i; const b = a + 1; const c = a + nu + 1; const d = c + 1; if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.geometry = g; this.mesh = new THREE.Mesh(g, material); this.mesh.frustumCulled = false;
  }
  update(p) {
    const pos = this.geometry.attributes.position; const { nu, nv } = this;
    for (let j = 0; j <= nv; j += 1) { const v = this.vMin + (this.vMax - this.vMin) * (j / nv);
      for (let i = 0; i <= nu; i += 1) {
        const u = this.uMin + (this.uMax - this.uMin) * (i / nu); const k = j * (nu + 1) + i;
        const pinch = 1 - 0.11 * Math.pow(1 - Math.min(1, v / 0.14), 2) * (v < 0.14 ? 1 : 0); // rounded sealed bottom corners
        pos.setXYZ(k, uToX(u) * pinch, vToY(v), bagSurfaceZ(u, v, this.side, p) + this.side * this.lift * (1 + (p.open ?? 0) * 0.4));
      } }
    pos.needsUpdate = true; if (!this.flat) this.geometry.computeVertexNormals();
  }
  dispose() { this.geometry.dispose(); }
}

export class PacketBagObject {
  constructor({ substanceId, detail = "medium" }) {
    this.tex = acquireShared(); this.disposables = []; this.params = { fill: 0, open: 0 }; this._dirty = true;
    this.group = new THREE.Group(); this.group.name = "packet";
    this.pivot = new THREE.Group(); this.group.add(this.pivot); // tilting happens on the pivot
    this.detail = detail; this.substanceId = null; this.field = null;
    this._buildShell(); this.setSubstance(substanceId, detail);
  }

  _buildShell() {
    const sheetMat = (side) => new THREE.MeshPhysicalMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0.17, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.25, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: side > 0 ? -1 : 1, polygonOffsetUnits: side > 0 ? -1 : 1 });
    this.matFront = sheetMat(1); this.matBack = sheetMat(-1); this.disposables.push(this.matFront, this.matBack);
    const { u: nu, v: nv } = BAG_SEGMENTS;
    this.back = new SheetPatch({ side: -1, uMin: -1, uMax: 1, vMin: 0, vMax: 1, nu, nv, material: this.matBack }); this.back.mesh.renderOrder = 2;
    this.front = new SheetPatch({ side: 1, uMin: -1, uMax: 1, vMin: 0, vMax: 1, nu, nv, material: this.matFront }); this.front.mesh.renderOrder = 4;
    // zipper rails
    const rail = (tex, side, v) => {
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0, envMapIntensity: 0.7, side: THREE.DoubleSide }); this.disposables.push(m);
      const p = new SheetPatch({ side, uMin: -0.96, uMax: 0.96, vMin: v - 0.013, vMax: v + 0.013, nu: 24, nv: 1, lift: 0.012, material: m }); p.mesh.renderOrder = side > 0 ? 5 : 3; return p;
    };
    this.zipFront = rail(this.tex.zipRed, 1, BAG.zipV + 0.018); this.zipBack = rail(this.tex.zipBlue, -1, BAG.zipV - 0.012);
    // sticker on the (flat) lip above the zipper
    const m = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }); this.stickerMat = m; this.disposables.push(m);
    this.sticker = new SheetPatch({ side: 1, uMin: -0.82, uMax: 0.82, vMin: 0.872, vMax: 0.988, nu: 12, nv: 2, lift: 0.006, material: m, flat: true }); this.sticker.mesh.renderOrder = 6;
    // two soft glare streaks
    const streakMat = new THREE.MeshBasicMaterial({ map: this.tex.streak, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }); this.disposables.push(streakMat);
    this.streakA = new SheetPatch({ side: 1, uMin: -0.74, uMax: -0.58, vMin: 0.1, vMax: 0.78, nu: 2, nv: 14, lift: 0.014, material: streakMat, flat: true }); this.streakA.mesh.renderOrder = 7;
    this.streakB = new SheetPatch({ side: 1, uMin: 0.5, uMax: 0.56, vMin: 0.2, vMax: 0.6, nu: 2, nv: 10, lift: 0.014, material: streakMat, flat: true }); this.streakB.mesh.renderOrder = 7;
    this.patches = [this.back, this.front, this.zipFront, this.zipBack, this.sticker, this.streakA, this.streakB];
    for (const p of this.patches) this.pivot.add(p.mesh);
    // pull tab on the zipper
    const tabMat = new THREE.MeshStandardMaterial({ color: 0xd9dee8, roughness: 0.35, metalness: 0.1 }); this.disposables.push(tabMat);
    this.tabGeo = new THREE.BoxGeometry(0.14, 0.09, 0.05); this.tab = new THREE.Mesh(this.tabGeo, tabMat); this.tab.renderOrder = 6; this.pivot.add(this.tab);
    // heat-sealed seam along the sides and bottom (thin tube hugging the pinched edge)
    const pts = []; const R = 0.1; const x = BAG.width / 2;
    pts.push(new THREE.Vector3(-x, BAG.height * BAG.zipV, 0), new THREE.Vector3(-x, R * 1.4, 0)); for (let a = 0; a <= 8; a += 1) { const t = (a / 8) * Math.PI / 2; pts.push(new THREE.Vector3(-x + R - Math.cos(t) * R + 0.0, R - Math.sin(t) * R * 1.0 + 0.01, 0)); }
    for (let a = 8; a >= 0; a -= 1) { const t = (a / 8) * Math.PI / 2; pts.push(new THREE.Vector3(x - R + Math.cos(t) * R, R - Math.sin(t) * R + 0.01, 0)); } pts.push(new THREE.Vector3(x, R * 1.4, 0), new THREE.Vector3(x, BAG.height * BAG.zipV, 0));
    const seamMat = new THREE.MeshStandardMaterial({ color: 0xe9eef8, roughness: 0.3, transparent: true, opacity: 0.3, envMapIntensity: 1 }); this.disposables.push(seamMat);
    this.seamGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone()), false, "centripetal"), 60, 0.011, 6, false); this.seam = new THREE.Mesh(this.seamGeo, seamMat); this.seam.renderOrder = 5; this.pivot.add(this.seam);
    // hit proxy for picking (invisible, generous)
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(BAG.width * 1.02, BAG.height * 0.92, BAG.depth * 0.9), new THREE.MeshBasicMaterial({ visible: false })); this.hit.position.set(0, BAG.height * 0.46, 0); this.hit.userData.bagHit = true; this.group.add(this.hit);
    this.disposables.push(this.hit.geometry, this.hit.material);
    // bench contact: blob shadow and selection ring
    const shMat = new THREE.MeshBasicMaterial({ map: this.tex.shadow, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 }); this.disposables.push(shMat);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shMat); this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.004; this.shadow.renderOrder = 0; this.group.add(this.shadow); this.disposables.push(this.shadow.geometry);
    const ringMat = new THREE.MeshBasicMaterial({ map: this.tex.ring, transparent: true, depthWrite: false, toneMapped: false, color: 0x4f8cff, opacity: 0 }); this.ringMat = ringMat; this.disposables.push(ringMat);
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.008; this.ring.renderOrder = 1; this.group.add(this.ring); this.disposables.push(this.ring.geometry);
    this.shadow.scale.set(BAG.width * 1.35, BAG.depth * 1.9, 1); this.ring.scale.set(BAG.width * 1.25, BAG.width * 1.25, 1);
    // quantity card (stands in front, leaning back)
    this.cardMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }); this.disposables.push(this.cardMat);
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.36), this.cardMat); this.card.position.set(0, 0.2, BAG.depth * 0.5 + 0.42); this.card.rotation.x = -0.42; this.card.renderOrder = 8; this.group.add(this.card); this.disposables.push(this.card.geometry);
  }

  setSubstance(substanceId, detail = this.detail) {
    if (this.substanceId === substanceId && this.detail === detail && this.field) return;
    this.substanceId = substanceId; this.detail = detail;
    if (this.field) { this.pivot.remove(this.field.group); this.field.dispose(); }
    this.field = new ParticleField({ substanceId, detail }); this.field.group.renderOrder = 3; this.pivot.add(this.field.group);
    const s = getSubstance(substanceId);
    const mainEl = Object.keys(s.composition)[0]; const key = s.kind === "atom-entity" ? s.element : mainEl;
    this.stickerMat.map?.dispose(); this.stickerMat.map = stickerTexture({ formula: s.formulaDisplay + (s.state && s.state !== "ion" ? `(${s.state})` : ""), name: s.name.length > 16 ? s.name.replace(" solution", "") : s.name, entity: s.entity.plural, colour: atomColour(key) }); this.stickerMat.needsUpdate = true;
    this._dirty = true; this.field.setFill(this.params.fill);
  }
  setLabel(amount, sub) {
    const k = `${amount}|${sub ?? ""}`; if (k === this._labelKey) return; this._labelKey = k;
    this.cardMat.map?.dispose(); this.cardMat.map = cardTexture({ amount, sub }); this.cardMat.needsUpdate = true;
  }
  setCardVisible(v) { this.card.visible = v; }
  /** fill (0..1 of one mole, display value) and open (0..1).  Returns true when the geometry was rebuilt. */
  setParams({ fill, open }) {
    const f = Math.min(1, Math.max(0, fill)); const o = Math.min(1, Math.max(0, open));
    const changed = Math.abs(f - this.params.fill) > 2e-4 || Math.abs(o - this.params.open) > 2e-4 || this._dirty;
    if (!changed) return false;
    this.params = { fill: f, open: o }; this._dirty = false;
    for (const p of this.patches) p.update(this.params);
    this.field.setFill(f);
    // the pull tab rides on the zipper line, on the front rail
    const u = 0.82; const v = BAG.zipV + 0.018;
    this.tab.position.set(uToX(u), vToY(v), bagSurfaceZ(u, v, 1, this.params) + 0.035); this.tab.rotation.set(0, 0, 0);
    return true;
  }
  /** lift (0..1) while dragged: raises the bag a little and softens / enlarges the shadow. */
  setLift(l) { this.pivot.position.y = 0.32 * l; const k = 1 + 0.35 * l; this.shadow.scale.set(BAG.width * 1.35 * k, BAG.depth * 1.9 * k, 1); this.shadow.material.opacity = 0.9 - 0.35 * l; }
  /** ring: 0 none, otherwise colour + opacity (selected / target). */
  setRing(colour, opacity) { this.ringMat.color.set(colour); this.ringMat.opacity = opacity; }
  /** Mouth position in group space (for the pour stream). */
  mouthWorld(target) { return this.pivot.localToWorld(target.set(0, BAG.height * BAG.zipV + 0.12, 0.05)); }
  dispose() {
    for (const p of this.patches) p.dispose();
    this.field?.dispose();
    this.stickerMat.map?.dispose(); this.cardMat.map?.dispose();
    this.tabGeo.dispose(); this.seamGeo.dispose();
    for (const d of this.disposables) d.dispose?.();
    this.group.clear(); releaseShared();
  }
}
