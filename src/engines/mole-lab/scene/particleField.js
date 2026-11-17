// ParticleField: the instanced representative particles of ONE packet (plain three.js, framework-free, fully disposable).
//
//   const f = new ParticleField(THREE, { substanceId, detail });   f.group -> add to the scene
//   f.setFill(fraction)      fraction of the one-mole capacity (0..1); smooth growth of the newest entity
//   f.dispose()              frees every geometry / material it created (shared geometries are ref-counted by `shared`)
//
// Rendering rules: instanced meshes only (one per element + one for bonds), counts are bounded by FULL_ENTITIES[detail],
// slots are fixed (see slots.js) so the population never reshuffles.  The count shown is a pure function of the fill
// fraction (engine/particles.js entityCountFor); chemistry is never derived from anything in this file.
import * as THREE from "three";
import { particleModel, atomColour, FULL_ENTITIES } from "../engine/particles.js";
import { buildSlots } from "./slots.js";

const SEG = { low: { w: 8, h: 6, r: 6 }, medium: { w: 14, h: 10, r: 8 }, high: { w: 20, h: 14, r: 10 } };
const geoCache = new Map(); // key -> { geo, refs }
function acquireGeo(key, make) { let e = geoCache.get(key); if (!e) { e = { geo: make(), refs: 0 }; geoCache.set(key, e); } e.refs += 1; return e.geo; }
function releaseGeo(key) { const e = geoCache.get(key); if (!e) return; e.refs -= 1; if (e.refs <= 0) { e.geo.dispose(); geoCache.delete(key); } }

const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _v = new THREE.Vector3(); const _s = new THREE.Vector3(); const _a = new THREE.Vector3(); const _b = new THREE.Vector3(); const _up = new THREE.Vector3(0, 1, 0);

export const BOND_COLOUR = "#aab3c5";

/** Shared material parameters: glossy, slightly clear-coated, never emissive (no neon). */
export function atomMaterial(el, { highlight = false } = {}) {
  return new THREE.MeshPhysicalMaterial({ color: atomColour(el), roughness: 0.28, metalness: el === "Fe" || el === "Mg" || el === "Na" ? 0.25 : 0.0, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 0.9, emissive: highlight ? new THREE.Color(atomColour(el)) : new THREE.Color(0x000000), emissiveIntensity: highlight ? 0.18 : 0 });
}

export class ParticleField {
  constructor({ substanceId, detail = "medium" }) {
    this.substanceId = substanceId; this.detail = detail;
    this.model = particleModel(substanceId);
    this.layout = buildSlots(this.model.mode, detail);
    this.group = new THREE.Group(); this.group.name = `particles:${substanceId}`;
    this.meshes = new Map(); this.geoKeys = []; this.materials = [];
    this.visible = 0; this.partial = 0; this._partialSlot = -1;
    this._build();
  }

  _speciesOf(slot) { return this.model.mode === "ionic" ? (slot.i + slot.j + slot.k) % 2 : 0; }

  _build() {
    const { slots, radius } = this.layout; const seg = SEG[this.detail];
    const sphereKey = `sphere:${this.detail}`; const sphere = acquireGeo(sphereKey, () => new THREE.SphereGeometry(1, seg.w, seg.h)); this.geoKeys.push(sphereKey);
    const cylKey = `cyl:${this.detail}`; const cyl = acquireGeo(cylKey, () => { const g = new THREE.CylinderGeometry(1, 1, 1, seg.r, 1, true); return g; }); this.geoKeys.push(cylKey);
    // per-mesh instance lists, in slot order
    const lists = new Map(); const bondList = [];
    const prefix = new Map();
    const getList = (el) => { if (!lists.has(el)) { lists.set(el, []); prefix.set(el, new Uint32Array(slots.length + 1)); } return lists.get(el); };
    for (const e of this.model.entities) for (const a of e.atoms) getList(a.el);
    slots.forEach((slot, si) => {
      const sp = this._speciesOf(slot); const ent = this.model.entities[Math.min(sp, this.model.entities.length - 1)];
      _q.set(slot.qx, slot.qy, slot.qz, slot.qw).normalize();
      const sc = radius; // entity template has unit bounding radius
      const world = ent.atoms.map((a) => { _v.set(a.x * sc, a.y * sc, a.z * sc).applyQuaternion(_q); return { el: a.el, x: slot.x + _v.x, y: slot.y + _v.y, z: slot.z + _v.z, r: a.r * sc }; });
      for (const w of world) lists.get(w.el).push({ slot: si, ...w });
      for (const b of ent.bonds) bondList.push({ slot: si, a: world[b.a], b: world[b.b], order: b.order });
      for (const [el] of lists) prefix.get(el)[si + 1] = lists.get(el).length;
    });
    this.prefix = prefix; this.base = new Map();
    for (const [el, arr] of lists) {
      const mat = atomMaterial(el); this.materials.push(mat);
      const mesh = new THREE.InstancedMesh(sphere, mat, arr.length); mesh.frustumCulled = false; mesh.name = `atoms:${el}`;
      const base = new Float32Array(arr.length * 16);
      arr.forEach((p, i) => { _s.setScalar(p.r); _m.compose(_v.set(p.x, p.y, p.z), _q.identity(), _s); _m.toArray(base, i * 16); });
      mesh.instanceMatrix.array.set(base); mesh.instanceMatrix.needsUpdate = true; mesh.count = 0;
      mesh.userData = { el, slotOf: Int32Array.from(arr.map((p) => p.slot)), centres: arr.map((p) => [p.x, p.y, p.z, p.r]) };
      this.base.set(el, base); this.meshes.set(el, mesh); this.group.add(mesh);
    }
    if (bondList.length) {
      const mat = new THREE.MeshStandardMaterial({ color: BOND_COLOUR, roughness: 0.45, metalness: 0.0, envMapIntensity: 0.6 }); this.materials.push(mat);
      const bm = new THREE.InstancedMesh(cyl, mat, bondList.length * 3); bm.frustumCulled = false; bm.name = "bonds";
      const base = new Float32Array(bondList.length * 3 * 16); const slotOf = []; let n = 0; const bondPrefix = new Uint32Array(slots.length + 1);
      let bi = 0;
      for (let si = 0; si < slots.length; si += 1) {
        while (bi < bondList.length && bondList[bi].slot === si) {
          const bd = bondList[bi]; _a.set(bd.a.x, bd.a.y, bd.a.z); _b.set(bd.b.x, bd.b.y, bd.b.z); _v.subVectors(_b, _a); const len = _v.length();
          const rad = radius * 0.075; const spread = radius * 0.16; _q.setFromUnitVectors(_up, _v.clone().normalize());
          // order 2 / 3: parallel thin cylinders
          const perp = new THREE.Vector3(); perp.crossVectors(_v, new THREE.Vector3(0.3, 0.8, 0.5)).normalize();
          const offs = bd.order === 1 ? [0] : bd.order === 2 ? [-0.5, 0.5] : [-1, 0, 1];
          for (const o of offs) { _s.set(rad / (bd.order > 1 ? 1.4 : 1), len, rad / (bd.order > 1 ? 1.4 : 1)); _m.compose(_b.clone().add(_a).multiplyScalar(0.5).addScaledVector(perp, o * spread), _q, _s); _m.toArray(base, n * 16); slotOf.push(si); n += 1; }
          bi += 1;
        }
        bondPrefix[si + 1] = n;
      }
      bm.instanceMatrix.array.set(base); bm.instanceMatrix.needsUpdate = true; bm.count = 0; bm.userData = { slotOf: Int32Array.from(slotOf) };
      this.base.set("bonds", base.slice(0, n * 16)); this.bondPrefix = bondPrefix; this.bondMesh = bm; this.bondCount = n; this.group.add(bm);
    }
    this._slotCentres = slots.map((s) => [s.x, s.y, s.z]);
  }

  /** Fraction (0..1) of one mole.  Smoothly grows the newest entity so the fill is progressive rather than popping. */
  setFill(fraction) {
    const N = this.layout.N; const f = Math.min(1, Math.max(0, fraction));
    const exact = f * N; const whole = Math.floor(exact); const part = exact - whole;
    const full = f >= 1 ? N : whole; const grow = f >= 1 ? 0 : part;
    this._apply(full, grow);
  }
  /** Show exactly `full` entities plus entity `full` scaled to `grow` (0..1). */
  _apply(full, grow) {
    const N = this.layout.N;
    // restore a previously scaled entity
    if (this._partialSlot >= 0 && this._partialSlot !== full) this._writeSlot(this._partialSlot, 1);
    for (const [el, mesh] of this.meshes) { const pre = this.prefix.get(el); const shown = Math.min(N, full + (grow > 0.02 && full < N ? 1 : 0)); mesh.count = pre[shown]; }
    if (this.bondMesh) { const shown = Math.min(N, full + (grow > 0.02 && full < N ? 1 : 0)); this.bondMesh.count = this.bondPrefix[shown]; }
    if (grow > 0.02 && full < N) { this._writeSlot(full, grow * grow * (3 - 2 * grow)); this._partialSlot = full; } else if (this._partialSlot >= 0 && this._partialSlot === full) { this._writeSlot(full, 1); this._partialSlot = -1; } else this._partialSlot = -1;
    this.visible = full; this.partial = grow;
  }
  _writeSlot(si, k) {
    const c = this._slotCentres[si]; if (!c) return;
    for (const [el, mesh] of this.meshes) {
      const pre = this.prefix.get(el); const base = this.base.get(el); const arr = mesh.instanceMatrix.array;
      for (let i = pre[si]; i < pre[si + 1]; i += 1) this._scaleInto(base, arr, i, c, k);
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.bondMesh) { const base = this.base.get("bonds"); const arr = this.bondMesh.instanceMatrix.array; for (let i = this.bondPrefix[si]; i < this.bondPrefix[si + 1]; i += 1) this._scaleInto(base, arr, i, c, k); this.bondMesh.instanceMatrix.needsUpdate = true; }
  }
  _scaleInto(base, out, i, c, k) {
    _m.fromArray(base, i * 16); _m.decompose(_v, _q, _s);
    _v.set(c[0] + (_v.x - c[0]) * k, c[1] + (_v.y - c[1]) * k, c[2] + (_v.z - c[2]) * k); _s.multiplyScalar(k); _m.compose(_v, _q, _s); _m.toArray(out, i * 16);
  }

  /** Map a raycast hit (mesh + instanceId) to the visible entity's slot index (or -1). */
  slotOfHit(object, instanceId) { const so = object?.userData?.slotOf; return so && instanceId != null && instanceId < so.length ? so[instanceId] : -1; }
  slotCentre(si) { return this._slotCentres[si] ?? null; }
  slotInfo(si) { const s = this.layout.slots[si]; return { slot: s, species: s ? this._speciesOf(s) : 0 }; }
  get radius() { return this.layout.radius; }

  dispose() {
    for (const m of this.materials) m.dispose();
    for (const k of this.geoKeys) releaseGeo(k);
    for (const mesh of this.meshes.values()) mesh.dispose?.();
    this.bondMesh?.dispose?.();
    this.group.clear(); this.meshes.clear(); this.materials = []; this.geoKeys = [];
  }
}
export { FULL_ENTITIES };
