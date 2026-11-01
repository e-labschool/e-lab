// Shared three.js assets for the IMF scenes: label textures, the electron-cloud shader material and small helpers.
// Everything created here is owned by the component that calls create*/dispose* (no module-level GPU state), so leaving the
// simulation always frees it.
import * as THREE from "three";

export function makeLabelTexture(text, color, { size = 128, font = 700, stroke = true } = {}) {
  const c = document.createElement("canvas"); c.width = size; c.height = size; const g = c.getContext("2d");
  if (g) {
    g.font = `${font} ${Math.round(size * 0.62)}px system-ui, -apple-system, "Segoe UI", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    if (stroke) { g.lineWidth = size * 0.14; g.strokeStyle = "rgba(6,14,38,0.92)"; g.lineJoin = "round"; g.strokeText(text, size / 2, size / 2 + size * 0.03); }
    g.fillStyle = color; g.fillText(text, size / 2, size / 2 + size * 0.03);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}
export function makeRingTexture(color = "#ffd166") {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d");
  if (g) { g.strokeStyle = color; g.lineWidth = 5; g.setLineDash([9, 7]); g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const CLOUD_VERT = `
attribute vec3 color; varying vec3 vCol; varying vec3 vN; varying vec3 vV;
void main(){ vCol = color; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const CLOUD_FRAG = `
uniform float uOpacity; varying vec3 vCol; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN); vec3 v = normalize(vV); float ndv = abs(dot(n, v)); float rim = pow(1.0 - ndv, 1.5);
  float light = 0.72 + 0.28 * dot(n, normalize(vec3(0.35, 0.8, 0.5)));
  vec3 c = vCol * light + vec3(0.30) * rim;
  float a = uOpacity * (0.30 + 0.70 * rim) + 0.10 * (1.0 - rim) * uOpacity;
  gl_FragColor = vec4(c, clamp(a, 0.0, 0.92));
}`;
/** Translucent glass-like electron-cloud material: vertex colour = electrostatic potential colour; edges are denser (limb brightening). */
export function createCloudMaterial(opacity = 0.62) {
  return new THREE.ShaderMaterial({ vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, uniforms: { uOpacity: { value: opacity } }, transparent: true, depthWrite: false, side: THREE.FrontSide });
}
/** BufferGeometry over a cached cloud: positions/colors are mutable copies (the cache stays untouched). */
export function createCloudGeometry(cloud) {
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(cloud.positions), 3); pos.setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.BufferAttribute(new Float32Array(cloud.count * 3).fill(0.85), 3); col.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", pos); geo.setAttribute("color", col); geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(cloud.normals), 3));
  geo.setIndex(new THREE.BufferAttribute(cloud.index, 1)); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), cloud.rMax * 2.2);
  return geo;
}
export const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(); const _b = new THREE.Vector3(); const _q = new THREE.Quaternion();
/** Orient/scale a unit cylinder (height 1 along +Y, centred) so it spans from a to b with the given radius. */
export function placeCylinder(mesh, a, b, radius) {
  _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); const d = _b.clone().sub(_a); const l = d.length() || 1e-6;
  mesh.position.copy(_a).addScaledVector(d, 0.5); _q.setFromUnitVectors(Y_AXIS, d.multiplyScalar(1 / l)); mesh.quaternion.copy(_q); mesh.scale.set(radius, l, radius);
}
export function disposeObject(root) {
  root.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
}
export const THEME = {
  perm: "#ffb02e", induced: "#38d6c8", instant: "#ff7ad9", attract: "#5be49b", repel: "#ff6b5e", hbond: "#ffe066", lone: "#ff8f9c", plus: "#6fa3ff", minus: "#ff6b6b",
};
export { THREE };
