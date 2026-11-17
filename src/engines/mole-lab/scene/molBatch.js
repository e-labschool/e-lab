// MoleculeBatch: IMMEDIATE-MODE instanced drawing of atoms (spheres, one InstancedMesh per element), bonds (cylinders) and a small
// pool of billboard labels (ion charges, scale numbers).  Used by the gas chamber and the reaction zone, where particles move every
// frame.  Plain three.js, framework-free, fully disposable.  It draws what it is told: it never decides amounts or chemistry.
import * as THREE from "three";
import { atomMaterial } from "./particleField.js";
import { makeTexture } from "./textures.js";

const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _p = new THREE.Vector3(); const _s = new THREE.Vector3(); const _d = new THREE.Vector3(); const _up = new THREE.Vector3(0, 1, 0);
const FONT = "'Inter','Segoe UI',system-ui,sans-serif";
const labelCache = new Map(); let labelRefs = 0;
export function labelTexture(text, { fg = "#ffffff", bg = "rgba(16,24,48,0.88)", size = 64 } = {}) {
  const key = `${text}|${fg}|${bg}`; let t = labelCache.get(key);
  if (!t) { t = makeTexture(size * 2, size, (g, w, h) => { g.fillStyle = bg; g.beginPath(); g.roundRect?.(w * 0.2, h * 0.1, w * 0.6, h * 0.8, h * 0.4); if (!g.roundRect) g.rect(w * 0.2, h * 0.1, w * 0.6, h * 0.8); g.fill(); g.fillStyle = fg; g.font = `700 ${h * 0.58}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h * 0.54); }); labelCache.set(key, t); }
  return t;
}
export function disposeLabelTextures() { for (const t of labelCache.values()) t.dispose(); labelCache.clear(); }

export class MoleculeBatch {
  constructor({ maxAtoms = 400, maxBonds = 360, maxLabels = 40 } = {}) {
    this.maxAtoms = maxAtoms; this.maxBonds = maxBonds; this.group = new THREE.Group(); this.group.name = "molecules";
    this.sphere = new THREE.SphereGeometry(1, 16, 12); this.cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    this.meshes = new Map(); this.bondMat = new THREE.MeshStandardMaterial({ color: "#aab3c5", roughness: 0.45, metalness: 0, envMapIntensity: 0.6 });
    this.bondMesh = new THREE.InstancedMesh(this.cyl, this.bondMat, maxBonds); this.bondMesh.frustumCulled = false; this.bondMesh.count = 0; this.group.add(this.bondMesh);
    this.labels = []; this.maxLabels = maxLabels; this._n = new Map(); this._bn = 0; this._ln = 0; labelRefs += 1;
  }
  _mesh(el) {
    let m = this.meshes.get(el); if (m) return m;
    const mat = atomMaterial(el); const mesh = new THREE.InstancedMesh(this.sphere, mat, this.maxAtoms); mesh.frustumCulled = false; mesh.count = 0; mesh.name = `atoms:${el}`;
    m = { mesh, mat }; this.meshes.set(el, m); this._n.set(el, 0); this.group.add(mesh); return m;
  }
  begin() { for (const k of this._n.keys()) this._n.set(k, 0); this._bn = 0; this._ln = 0; }
  atom(el, x, y, z, r) {
    const m = this._mesh(el); const n = this._n.get(el); if (n >= this.maxAtoms || r <= 0.0005) return;
    const a = m.mesh.instanceMatrix.array; const o = n * 16; a[o] = r; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = r; a[o + 6] = 0; a[o + 7] = 0; a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = r; a[o + 11] = 0; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
    this._n.set(el, n + 1);
  }
  bond(x1, y1, z1, x2, y2, z2, rad) {
    if (this._bn >= this.maxBonds || rad <= 0.0005) return; _d.set(x2 - x1, y2 - y1, z2 - z1); const len = _d.length(); if (len < 1e-5) return;
    _q.setFromUnitVectors(_up, _d.multiplyScalar(1 / len)); _p.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); _s.set(rad, len, rad); _m.compose(_p, _q, _s); _m.toArray(this.bondMesh.instanceMatrix.array, this._bn * 16); this._bn += 1;
  }
  /** Billboard label (charge, number) at a point; alpha 0..1, size in scene units (height). */
  label(text, x, y, z, size = 0.2, alpha = 1, style) {
    if (this._ln >= this.maxLabels || alpha <= 0.02) return;
    let s = this.labels[this._ln];
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); s.renderOrder = 20; s.frustumCulled = false; this.labels.push(s); this.group.add(s); }
    const tex = labelTexture(text, style); if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
    s.material.opacity = alpha; s.position.set(x, y, z); s.scale.set(size * 2, size, 1); s.visible = true; this._ln += 1;
  }
  end() {
    for (const [el, m] of this.meshes) { m.mesh.count = this._n.get(el); m.mesh.instanceMatrix.needsUpdate = true; }
    this.bondMesh.count = this._bn; this.bondMesh.instanceMatrix.needsUpdate = true;
    for (let i = this._ln; i < this.labels.length; i += 1) this.labels[i].visible = false;
  }
  dispose() {
    for (const { mesh, mat } of this.meshes.values()) { mat.dispose(); mesh.dispose?.(); }
    this.sphere.dispose(); this.cyl.dispose(); this.bondMat.dispose(); this.bondMesh.dispose?.();
    for (const s of this.labels) s.material.dispose();
    this.group.clear(); this.meshes.clear(); this.labels = []; labelRefs -= 1; if (labelRefs <= 0) { disposeLabelTextures(); labelRefs = 0; }
  }
}
