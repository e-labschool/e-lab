// Three.js object for the chemistry dipole arrow (crossed tail on the delta-plus end, head towards delta-minus).
// Built from plain meshes so node tests can inspect world positions without WebGL.
import * as THREE from "three";
import { chemistryArrow } from "./dipoleArrow.js";

const Y = new THREE.Vector3(0, 1, 0);
export default class ChemDipoleArrow {
  constructor({ color = "#f08a00", radius = 0.065, headRadius = 0.17, crossHalf = 0.17, emissive = 0.15, onTop = false } = {}) {
    this.group = new THREE.Group(); this.group.name = "dipole-arrow";
    this.radius = radius; this.headRadius = headRadius; this.crossHalf = crossHalf;
    this.mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05, emissive: new THREE.Color(color), emissiveIntensity: emissive });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1), this.mat); this.shaft.name = "arrow-shaft";
    this.head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18, 1), this.mat); this.head.name = "arrow-head";
    this.cross = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1), this.mat); this.cross.name = "arrow-cross-tail";
    if (onTop) { this.mat.depthTest = false; for (const m of [this.shaft, this.head, this.cross]) m.renderOrder = 20; }
    this.group.add(this.shaft, this.head, this.cross);
    this.dir = new THREE.Vector3(1, 0, 0); this.tail = new THREE.Vector3(); this.tip = new THREE.Vector3(); this.visible = true;
  }
  /** Place the arrow between the delta-plus position and the delta-minus position (arrays or Vector3). */
  set(plusPos, minusPos, thickness = 1) {
    const P = Array.isArray(plusPos) ? plusPos : plusPos.toArray(); const M = Array.isArray(minusPos) ? minusPos : minusPos.toArray();
    const a = chemistryArrow(P, M, { headLength: 0.34 * thickness });
    this.dir.set(...a.dir); this.tail.set(...a.tail); this.tip.set(...a.head);
    const r = this.radius * thickness; const shaftLen = Math.max(1e-4, a.length - a.headLength);
    this.shaft.position.set(...a.tail).addScaledVector(this.dir, shaftLen / 2); this.shaft.quaternion.setFromUnitVectors(Y, this.dir); this.shaft.scale.set(r, shaftLen, r);
    this.head.position.set(...a.tail).addScaledVector(this.dir, shaftLen + a.headLength / 2); this.head.quaternion.setFromUnitVectors(Y, this.dir); this.head.scale.set(this.headRadius * thickness, a.headLength, this.headRadius * thickness);
    this.cross.position.copy(this.tail); this.crossThickness = r * 0.95; this.cross.scale.set(this.crossThickness, 2 * this.crossHalf * thickness, this.crossThickness);
    this.orientCross(null);
    return this;
  }
  /** Turn the tail bar so that it is perpendicular to the shaft AND to the line of sight: it always reads as a "+" together with the shaft. */
  orientCross(camera) {
    const view = new THREE.Vector3();
    if (camera) { camera.updateMatrixWorld?.(); view.copy(this.tail).applyMatrix4(this.group.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)).normalize(); view.transformDirection(new THREE.Matrix4().copy(this.group.matrixWorld).invert()); } else view.set(0, 0, -1);
    let bar = new THREE.Vector3().crossVectors(this.dir, view);
    if (bar.lengthSq() < 1e-8) bar = new THREE.Vector3().crossVectors(this.dir, new THREE.Vector3(0, 1, 0)); if (bar.lengthSq() < 1e-8) bar.set(1, 0, 0);
    bar.normalize(); this.barDir = bar.clone(); this.cross.quaternion.setFromUnitVectors(Y, bar);
  }
  setVisible(v) { this.group.visible = v; this.visible = v; }
  setColor(c) { this.mat.color.set(c); this.mat.emissive.set(c); }
  setOpacity(o) { this.mat.transparent = o < 1; this.mat.opacity = o; }
  /** Local-space summary: where the crossed tail and the arrowhead tip are (for tests). */
  info() { return { tail: this.tail.toArray(), tip: this.tip.toArray(), dir: this.dir.toArray(), crossPos: this.cross.position.toArray(), headPos: this.head.position.toArray() }; }
  dispose() { this.shaft.geometry.dispose(); this.head.geometry.dispose(); this.cross.geometry.dispose(); this.mat.dispose(); this.group.removeFromParent(); }
}
