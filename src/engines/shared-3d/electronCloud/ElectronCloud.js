// The reusable electron-density renderer (three only; no React, no WebGL needed to BUILD it, so node tests can inspect it).
//
//   const cloud = new ElectronCloud({ opacity: 0.55 });
//   scene.add(cloud.group);
//   cloud.update(buildRegions(molecule, { progress, bias }));      // cheap: displaces 642 vertices per region, no rebuild
//   cloud.dispose();
//
// One translucent mesh per atomic region (a deformable icosphere). Because the meshes are separate and translucent, their overlap
// is visibly denser: the Venn-style shared bonding region. Per-vertex density (densityModel.vertexDensity) deepens the colour on
// concentrated regions and on the part of each shell that lies inside another region, so the overlap reads as a continuous lens.
// Colour = ONE hue (teal), deeper = more concentrated. It never encodes charge. See densityModel.js.
import * as THREE from "three";
import { icosphere } from "./icosphere.js";
import { regionRadiusAt, regionCentre, vertexDensity } from "./densityModel.js";

export const CLOUD_COLORS = Object.freeze({ light: "#7ddccd", deep: "#0a7f86" });
const VERT = `
attribute float aDens; varying float vDens; varying vec3 vN; varying vec3 vV;
void main(){ vDens = aDens; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const FRAG = `
uniform float uOpacity; uniform vec3 uLight; uniform vec3 uDeep; varying float vDens; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN); vec3 v = normalize(vV); if (!gl_FrontFacing) n = -n;
  float ndv = clamp(dot(n, v), 0.0, 1.0); float rim = pow(1.0 - ndv, 2.2);
  float k = clamp((vDens - 0.35) / 1.9, 0.0, 1.0);
  vec3 col = mix(uLight, uDeep, k);
  float lit = 0.82 + 0.18 * dot(n, normalize(vec3(0.35, 0.8, 0.5)));
  float a = uOpacity * (0.20 + 0.62 * k) + uOpacity * 0.55 * rim * (0.45 + 0.55 * k);
  gl_FragColor = vec4(col * lit, clamp(a, 0.0, 0.88));
}`;

export default class ElectronCloud {
  constructor({ subdiv = 3, opacity = 0.55, light = CLOUD_COLORS.light, deep = CLOUD_COLORS.deep } = {}) {
    this.group = new THREE.Group(); this.group.name = "electron-cloud";
    this.ico = icosphere(subdiv); this.meshes = []; this.lastKey = null;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: opacity }, uLight: { value: new THREE.Color(light) }, uDeep: { value: new THREE.Color(deep) } },
    });
    this.indexAttr = new THREE.BufferAttribute(this.ico.index, 1);
  }
  get vertexCount() { return this.ico.count; }
  setOpacity(o) { this.material.uniforms.uOpacity.value = o; }
  _make() {
    const g = new THREE.BufferGeometry(); const n = this.ico.count;
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3); pos.setUsage(THREE.DynamicDrawUsage);
    const dens = new THREE.BufferAttribute(new Float32Array(n).fill(1), 1); dens.setUsage(THREE.DynamicDrawUsage);
    const nor = new THREE.BufferAttribute(new Float32Array(n * 3), 3); nor.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", pos); g.setAttribute("normal", nor); g.setAttribute("aDens", dens); g.setIndex(this.indexAttr);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    const m = new THREE.Mesh(g, this.material); m.frustumCulled = false; m.renderOrder = 4; m.userData.kind = "density-region";
    this.group.add(m); this.meshes.push(m); return m;
  }
  /** Fill the region meshes from a spec (densityModel.buildRegions). `key` (optional) skips the work when nothing changed. */
  update(spec, key = null) {
    if (key !== null && key === this.lastKey) return; this.lastKey = null;
    while (this.meshes.length < spec.regions.length) this._make();
    const D = this.ico.dirs; const n = this.ico.count; const d = [0, 0, 0];
    this.meshes.forEach((m, ri) => {
      const r = spec.regions[ri]; m.visible = !!r; if (!r) return;
      const c = regionCentre(r); const pos = m.geometry.attributes.position.array; const dens = m.geometry.attributes.aDens.array;
      for (let v = 0; v < n; v += 1) {
        d[0] = D[3 * v]; d[1] = D[3 * v + 1]; d[2] = D[3 * v + 2];
        const rr = regionRadiusAt(r, d, spec.bias);
        const x = c[0] + d[0] * rr; const y = c[1] + d[1] * rr; const z = c[2] + d[2] * rr;
        pos[3 * v] = x; pos[3 * v + 1] = y; pos[3 * v + 2] = z;
        dens[v] = vertexDensity(spec, ri, d, [x, y, z]);
      }
      m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.aDens.needsUpdate = true; m.geometry.computeVertexNormals(); m.userData.region = ri; m.name = `density-region-${ri}-${r.el}`;
    });
    this.lastKey = key;
  }
  /** World-space summary used by the tests: for every region the bounding box of its mesh and its mean density attribute. */
  summary() {
    return this.meshes.filter((m) => m.visible).map((m) => {
      const p = m.geometry.attributes.position.array; const a = m.geometry.attributes.aDens.array; const lo = [1e9, 1e9, 1e9]; const hi = [-1e9, -1e9, -1e9]; let ds = 0;
      for (let i = 0; i < a.length; i += 1) { ds += a[i]; for (let k = 0; k < 3; k += 1) { lo[k] = Math.min(lo[k], p[3 * i + k]); hi[k] = Math.max(hi[k], p[3 * i + k]); } }
      return { lo, hi, meanDensity: ds / a.length, name: m.name };
    });
  }
  /** Frees GPU resources. Safe to call more than once and safe if the component is used again afterwards (React strict-mode / prop changes): the next update() rebuilds the meshes. */
  dispose() { this.meshes.forEach((m) => { m.geometry.dispose(); this.group.remove(m); }); this.material.dispose(); this.meshes = []; this.lastKey = null; }
}
