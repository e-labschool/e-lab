import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { stepSim, angleBetween, nearestIdealAngle } from "../model/geometry.js";
import { ELEMENTS } from "../model/elements.js";

// The r3f content of the VSEPR viewer. Everything that changes per frame is written straight into three objects and
// pooled typed arrays (no per-frame allocation). Interaction is handled OUTSIDE the canvas (see ViewerStage.jsx) through
// the `apiRef` bridge below, so a domain drag can never start an orbit-camera rotation.
import { BOND_LEN, MAX_SLOTS } from "./sceneMath.js";
const MAX_ARCS = 5; const ARC_SEG = 20; const MAX_PAIRS = 15;

const STRAND_OFFSETS = { 1: [0], 2: [-0.085, 0.085], 3: [-0.135, 0, 0.135] };
const STRAND_RADIUS = { 1: 0.085, 2: 0.058, 3: 0.046 };
function inSync(domains, sim) { if (domains.length !== sim.n) return false; for (let i = 0; i < domains.length; i += 1) if (domains[i].id !== sim.ids[i]) return false; return true; }
const lerpK = (dt, rate) => 1 - Math.exp(-dt * rate);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function labelTexture(symbol, color, textColor, cache) {
  const key = `${symbol}|${color}`; if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d");
  if (g) {
    g.font = `700 ${symbol.length > 1 ? 74 : 88}px system-ui, -apple-system, Segoe UI, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 8; g.strokeStyle = color === "#f2f4f8" ? "rgba(255,255,255,0)" : "rgba(0,0,0,0.0)"; g.fillStyle = textColor; g.fillText(symbol, 64, 70);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cache.set(key, t); return t;
}

/** Teardrop profile (pointed at the nucleus, rounded at the far end), revolved about +Y, length 1. */
function teardropPoints(maxR, steps = 28) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) { const t = i / steps; const r = maxR * Math.sin(Math.PI * Math.pow(t, 0.82)) * (0.28 + 0.72 * Math.pow(t, 0.6)); pts.push(new THREE.Vector2(Math.max(r, 0), t)); }
  return pts;
}

/** Bridge for the DOM overlay: screen -> ray, picking, sphere projection, camera helpers. */
function Bridge({ apiRef, live, controlsRef }) {
  const { camera, gl, size } = useThree();
  const t = useMemo(() => ({ ro: new THREE.Vector3(), rd: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Vector3() }), []);
  useEffect(() => {
    const ray = (cx, cy) => {
      const r = gl.domElement.getBoundingClientRect();
      const nx = ((cx - r.left) / r.width) * 2 - 1; const ny = -((cy - r.top) / r.height) * 2 + 1;
      camera.updateMatrixWorld(); t.ro.setFromMatrixPosition(camera.matrixWorld);
      t.rd.set(nx, ny, 0.5).unproject(camera).sub(t.ro).normalize();
      return { inside: nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1 };
    };
    // distance along the current ray to the sphere (c, r): returns t of the nearest hit or -1
    const raySphere = (cx, cy, cz, rad) => {
      const ox = t.ro.x - cx, oy = t.ro.y - cy, oz = t.ro.z - cz; const b = ox * t.rd.x + oy * t.rd.y + oz * t.rd.z; const c = ox * ox + oy * oy + oz * oz - rad * rad; const disc = b * b - c;
      if (disc < 0) return -1; const s = Math.sqrt(disc); const t0 = -b - s; return t0 > 0 ? t0 : -b + s > 0 ? -b + s : -1;
    };
    // distance from the ray to segment p0-p1 (returns {d, t})
    const raySegment = (p0x, p0y, p0z, p1x, p1y, p1z) => {
      const ux = p1x - p0x, uy = p1y - p0y, uz = p1z - p0z; const wx = t.ro.x - p0x, wy = t.ro.y - p0y, wz = t.ro.z - p0z;
      const a = ux * ux + uy * uy + uz * uz; const b = ux * t.rd.x + uy * t.rd.y + uz * t.rd.z; const c = t.rd.x * t.rd.x + t.rd.y * t.rd.y + t.rd.z * t.rd.z;
      const d = ux * wx + uy * wy + uz * wz; const e = t.rd.x * wx + t.rd.y * wy + t.rd.z * wz; const den = a * c - b * b;
      let s = den > 1e-9 ? (b * e - c * d) / den : 0; s = Math.min(1, Math.max(0, s)); let tt = (b * s + e) / c; if (tt < 0) tt = 0;
      const dx = p0x + ux * s - (t.ro.x + t.rd.x * tt), dy = p0y + uy * s - (t.ro.y + t.rd.y * tt), dz = p0z + uz * s - (t.ro.z + t.rd.z * tt);
      return { d: Math.hypot(dx, dy, dz), t: tt };
    };
    apiRef.current = {
      /** Nearest pickable thing under the pointer: { kind: "central" | "bond" | "lp", index, id, point:[x,y,z], radius } or null. */
      pick(cx, cy) {
        const L = live.current; const sim = L.sim; ray(cx, cy);
        let best = null; let bestT = Infinity;
        const consider = (kind, index, tt, px, py, pz) => { if (tt >= 0 && tt < bestT) { bestT = tt; best = { kind, index, id: sim.ids[index] ?? "central", point: [px, py, pz] }; } };
        if (L.central) { const tc = raySphere(0, 0, 0, L.centralRadius); if (tc >= 0) consider("central", -1, tc, t.ro.x + t.rd.x * tc, t.ro.y + t.rd.y * tc, t.ro.z + t.rd.z * tc); }
        for (let i = 0; i < sim.n; i += 1) {
          const dx = sim.dir[i * 3], dy = sim.dir[i * 3 + 1], dz = sim.dir[i * 3 + 2]; const dom = L.domains[i]; if (!dom || dom.id !== sim.ids[i]) continue;
          if (dom.kind === "bond") {
            const rad = (dom.symbol ? ELEMENTS[dom.symbol].r : 0.3) * 1.18;
            const ts = raySphere(dx * BOND_LEN, dy * BOND_LEN, dz * BOND_LEN, rad);
            if (ts >= 0) consider("bond", i, ts - 0.2, dx * BOND_LEN, dy * BOND_LEN, dz * BOND_LEN);
            const seg = raySegment(dx * L.centralRadius * 0.9, dy * L.centralRadius * 0.9, dz * L.centralRadius * 0.9, dx * (BOND_LEN - rad * 0.8), dy * (BOND_LEN - rad * 0.8), dz * (BOND_LEN - rad * 0.8));
            if (seg.d < 0.17) consider("bond", i, seg.t - 0.1, dx * BOND_LEN * 0.6, dy * BOND_LEN * 0.6, dz * BOND_LEN * 0.6);
          } else if (L.lpVisible) {
            const tl = raySphere(dx * 0.95, dy * 0.95, dz * 0.95, 0.5);
            if (tl >= 0) consider("lp", i, tl - 0.15, dx * 0.95, dy * 0.95, dz * 0.95);
          }
        }
        return best;
      },
      /** Direction on a sphere of radius `rad` around the central atom for the pointer; `prev` picks the near/far side. null when outside the canvas. */
      sphereDir(cx, cy, rad, prev) {
        const o = ray(cx, cy); if (!o.inside) return null;
        const b = t.ro.x * t.rd.x + t.ro.y * t.rd.y + t.ro.z * t.rd.z; const c = t.ro.x * t.ro.x + t.ro.y * t.ro.y + t.ro.z * t.ro.z - rad * rad; const disc = b * b - c;
        let px; let py; let pz;
        if (disc < 0) { const tt = -b; px = t.ro.x + t.rd.x * tt; py = t.ro.y + t.rd.y * tt; pz = t.ro.z + t.rd.z * tt; } // closest approach (silhouette)
        else {
          const s = Math.sqrt(disc); const t1 = -b - s; const t2 = -b + s;
          const a1 = [t.ro.x + t.rd.x * t1, t.ro.y + t.rd.y * t1, t.ro.z + t.rd.z * t1]; const a2 = [t.ro.x + t.rd.x * t2, t.ro.y + t.rd.y * t2, t.ro.z + t.rd.z * t2];
          let use = a1;
          if (prev) { const d1 = a1[0] * prev[0] + a1[1] * prev[1] + a1[2] * prev[2]; const d2 = a2[0] * prev[0] + a2[1] * prev[1] + a2[2] * prev[2]; use = d2 > d1 ? a2 : a1; }
          [px, py, pz] = use;
        }
        const len = Math.hypot(px, py, pz) || 1; return [px / len, py / len, pz / len];
      },
      /** Client (screen) position of a point in scene space: used by the DOM layer and the headless tests. */
      project(x, y, z) {
        const r = gl.domElement.getBoundingClientRect(); camera.updateMatrixWorld(); t.q.set(x, y, z).project(camera);
        return [r.left + (t.q.x * 0.5 + 0.5) * r.width, r.top + (-t.q.y * 0.5 + 0.5) * r.height];
      },
      cameraDistance() { return camera.position.length(); },
      cameraPosition() { return [camera.position.x, camera.position.y, camera.position.z]; },
      zoom(f) { const c = controlsRef.current; const d = camera.position.length(); const nd = Math.min(c?.maxDistance ?? 30, Math.max(c?.minDistance ?? 2, d * f)); camera.position.multiplyScalar(nd / d); c?.update?.(); },
      resetView(dist, dir) { camera.position.set(dir[0], dir[1], dir[2]).normalize().multiplyScalar(dist); camera.lookAt(0, 0, 0); controlsRef.current?.update?.(); },
      size: () => ({ w: size.width, h: size.height }),
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, gl, size, live, t, controlsRef]);
  return null;
}

/**
 * props.live (ref): { sim, domains, central, centralRadius, mode, showDomains, showLP, showRepulsion, showAngles, selectedId, hoverId,
 *                     preview, angleEntries, lpVisible, interactive }
 */
export default function SceneContent({ live, apiRef, labelRefs, mini = false, autoRotate = false, camDistance, resetToken = 0, onFrame }) {
  const { camera, size, invalidate } = useThree();
  const controlsRef = useRef(null);
  const texCache = useMemo(() => new Map(), []);
  useEffect(() => () => { texCache.forEach((tx) => tx.dispose()); texCache.clear(); }, [texCache]);

  const atomRefs = useRef([]); const spriteRefs = useRef([]); const stubRefs = useRef([]); const bondLobeRefs = useRef([]); const lpLobeRefs = useRef([]); const dotRefs = useRef([]);
  const state = useMemo(() => ({
    mg: 0, ed: 1, lp: 1, dom: 1, selK: 0, symbols: Array(MAX_SLOTS).fill(""), labelSymbols: Array(MAX_SLOTS).fill(""), arcTexts: Array(MAX_ARCS).fill(""), arcKinds: Array(MAX_ARCS).fill(""),
    prevN: -1, pairs: new Int8Array(MAX_PAIRS * 2),
    tmp: {
      p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), m: new THREE.Matrix4(), d: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), w: new THREE.Vector3(),
      camR: new THREE.Vector3(), camU: new THREE.Vector3(), color: new THREE.Color(), v2: new THREE.Vector3(),
    },
  }), []);

  const bondGeo = useMemo(() => teardropPoints(0.62), []);
  const lpGeo = useMemo(() => teardropPoints(0.5), []);
  const strandsRef = useRef(null); const arcsRef = useRef(null); const shaftsRef = useRef(null); const headsRef = useRef(null);
  const outlineRef = useRef(null); const centralRef = useRef(null); const centralSprite = useRef(null); const haloSel = useRef(null); const haloHover = useRef(null);
  const ghostAtom = useRef(null); const ghostBond = useRef(null); const ghostLobe = useRef(null); const attachDot = useRef(null); const attachRing = useRef(null);
  const outlinePos = useMemo(() => new Float32Array(MAX_PAIRS * 2 * 3), []);
  const outlineGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(outlinePos, 3)); g.setDrawRange(0, 0); return g; }, [outlinePos]);
  const mats = useMemo(() => ({
    bond: new THREE.MeshStandardMaterial({ color: "#5b9bff", roughness: 0.4, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    lp: new THREE.MeshStandardMaterial({ color: "#8ec1ff", emissive: "#3a78d8", emissiveIntensity: 0.35, roughness: 0.35, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide }),
    dot: new THREE.MeshStandardMaterial({ color: "#1b3fb5", emissive: "#2d5cff", emissiveIntensity: 0.6, roughness: 0.2, transparent: true }),
  }), []);
  useEffect(() => () => { mats.bond.dispose(); mats.lp.dispose(); mats.dot.dispose(); }, [mats]);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 32, 20), []);
  const lowSphere = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []);
  const cylGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 14, 1, false), []);
  const coneGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 12), []);
  useEffect(() => () => { outlineGeo.dispose(); sphereGeo.dispose(); lowSphere.dispose(); cylGeo.dispose(); coneGeo.dispose(); }, [outlineGeo, sphereGeo, lowSphere, cylGeo, coneGeo]);

  // camera framing
  useEffect(() => {
    const c = controlsRef.current; if (c) { c.minDistance = camDistance * 0.55; c.maxDistance = camDistance * 2.2; }
  }, [camDistance]);
  useEffect(() => { // new view (Reset view / first mount): default direction at the fitted distance
    camera.position.set(0.55, 0.42, 1).normalize().multiplyScalar(camDistance); camera.lookAt(0, 0, 0); controlsRef.current?.update?.();
    invalidate();
  }, [resetToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // keep the current direction, only re-fit the distance when the canvas shape changes
    const d = camera.position.length(); if (d > 0) { camera.position.multiplyScalar(camDistance / d); controlsRef.current?.update?.(); }
  }, [camDistance]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05); const L = live.current; const sim = L.sim; const T = state.tmp; if (!sim) return;
    if (!mini || L.animate) stepSim(sim, dt);
    camera.updateMatrixWorld(); T.camR.setFromMatrixColumn(camera.matrixWorld, 0); T.camU.setFromMatrixColumn(camera.matrixWorld, 1);
    const kMode = lerpK(dt, 7);
    const ed = L.mode === "ed"; const edTarget = ed ? 1 : 0;
    state.mg += ((1 - edTarget) - state.mg) * kMode; state.ed += (edTarget - state.ed) * kMode;
    const lpTarget = L.lpVisible ? 1 : 0; state.lp += (lpTarget - state.lp) * kMode;
    const domTarget = ed && L.showDomains ? 1 : 0; state.dom += (domTarget - state.dom) * kMode;
    const selTarget = 1; state.selK += (selTarget - state.selK) * kMode;
    const n = inSync(L.domains, sim) ? sim.n : 0;
    const cr = L.centralRadius;
    // ----- central atom
    const cEl = L.central ? ELEMENTS[L.central] : null;
    const central = centralRef.current; const cs = centralSprite.current;
    if (central) {
      central.visible = !!cEl;
      if (cEl) { central.scale.setScalar(cr * (0.86 + 0.14 * state.mg)); central.material.color.set(cEl.color); }
    }
    if (cs) {
      cs.visible = !!cEl;
      if (cEl) {
        if (state.centralLabel !== cEl.symbol) { state.centralLabel = cEl.symbol; cs.material.map = labelTexture(cEl.symbol, cEl.color, cEl.text, texCache); cs.material.needsUpdate = true; }
        T.d.copy(camera.position).normalize().multiplyScalar(cr * 1.02 * (0.86 + 0.14 * state.mg)); cs.position.copy(T.d); cs.scale.setScalar(cr * 1.25 * (0.86 + 0.14 * state.mg));
      }
    }
    let bondStrand = 0;
    const bondMesh = strandsRef.current;
    // ----- domains
    for (let i = 0; i < MAX_SLOTS; i += 1) {
      const atom = atomRefs.current[i]; const sprite = spriteRefs.current[i]; const stub = stubRefs.current[i]; const bl = bondLobeRefs.current[i]; const ll = lpLobeRefs.current[i]; const dots = dotRefs.current[i];
      const on = i < n; const dom = on ? L.domains[i] : null;
      const isBond = on && dom.kind === "bond"; const isLp = on && dom.kind === "lp";
      const dx = on ? sim.dir[i * 3] : 0, dy = on ? sim.dir[i * 3 + 1] : 0, dz = on ? sim.dir[i * 3 + 2] : 0;
      const hasAtom = isBond && !!dom.symbol; const el = hasAtom ? ELEMENTS[dom.symbol] : null;
      if (atom) atom.visible = hasAtom; if (sprite) sprite.visible = hasAtom; if (stub) stub.visible = isBond && !dom.symbol;
      if (bl) bl.visible = isBond && state.dom > 0.02; if (ll) ll.visible = isLp && (L.lpVisible ? state.lp > 0.02 : state.lp > 0.02); if (dots) dots.visible = isLp && state.lp > 0.05;
      if (!on) continue;
      T.q.setFromUnitVectors(Y_AXIS, T.d.set(dx, dy, dz));
      if (isBond) {
        const r = (el ? el.r : 0.3);
        T.p.set(dx * BOND_LEN, dy * BOND_LEN, dz * BOND_LEN);
        if (hasAtom && atom) {
          atom.position.copy(T.p); atom.scale.setScalar(r * (0.82 + 0.18 * state.mg)); atom.material.color.set(el.color);
          if (state.symbols[i] !== el.symbol) { state.symbols[i] = el.symbol; sprite.material.map = labelTexture(el.symbol, el.color, el.text, texCache); sprite.material.needsUpdate = true; }
          T.u.copy(camera.position).sub(T.p).normalize().multiplyScalar(r * 1.02 * (0.82 + 0.18 * state.mg)); sprite.position.copy(T.p).add(T.u); sprite.scale.setScalar(r * 1.3 * (0.82 + 0.18 * state.mg));
        } else if (stub) { stub.position.copy(T.p); stub.scale.setScalar(0.3); }
        // bond lobe (electron-domain region): teardrop from the nucleus, wide near the surrounding atom
        if (bl) { bl.quaternion.copy(T.q); bl.scale.set(1, BOND_LEN * 1.12, 1); bl.position.set(0, 0, 0); }
        // bond strands (1-3 parallel cylinders, always visible side by side from the camera)
        const order = dom.order; const len = BOND_LEN - cr * 0.4;
        T.u.set(dx, dy, dz); T.w.copy(T.camR); T.w.addScaledVector(T.u, -T.camR.dot(T.u)); if (T.w.lengthSq() < 0.02) { T.w.copy(T.camU); T.w.addScaledVector(T.u, -T.camU.dot(T.u)); } T.w.normalize();
        const rad = STRAND_RADIUS[order]; const off = STRAND_OFFSETS[order];
        const mid = cr * 0.4 + len / 2;
        for (let k = 0; k < off.length; k += 1) {
          T.r.set(dx * mid + T.w.x * off[k], dy * mid + T.w.y * off[k], dz * mid + T.w.z * off[k]); T.s.set(rad, len, rad);
          T.m.compose(T.r, T.q, T.s); bondMesh.setMatrixAt(bondStrand, T.m); bondStrand += 1;
        }
      } else {
        // lone pair: lobe + two electron dots side by side from the camera
        if (ll) { ll.quaternion.copy(T.q); ll.scale.set(1, 1.5, 1); ll.position.set(0, 0, 0); }
        if (dots) {
          T.u.set(dx, dy, dz); T.w.copy(T.camR); T.w.addScaledVector(T.u, -T.camR.dot(T.u)); if (T.w.lengthSq() < 0.02) { T.w.copy(T.camU); T.w.addScaledVector(T.u, -T.camU.dot(T.u)); } T.w.normalize();
          const dm = 0.98; const sep = 0.13;
          dots.children[0].position.set(dx * dm + T.w.x * sep, dy * dm + T.w.y * sep, dz * dm + T.w.z * sep);
          dots.children[1].position.set(dx * dm - T.w.x * sep, dy * dm - T.w.y * sep, dz * dm - T.w.z * sep);
        }
      }
    }
    if (bondMesh) { bondMesh.count = bondStrand; bondMesh.instanceMatrix.needsUpdate = true; }
    // lobe materials follow the mode blend
    const lpOpTarget = ed ? (L.showDomains ? 0.34 : 0.1) : 0.22;
    state.lpOp = (state.lpOp ?? lpOpTarget) + (lpOpTarget - (state.lpOp ?? lpOpTarget)) * kMode;
    mats.bond.opacity = 0.2 * state.dom; mats.lp.opacity = state.lpOp * state.lp; mats.dot.opacity = Math.min(1, state.lp * 1.2);
    // ----- molecular-shape outline (MG): edges between neighbouring atoms
    let segs = 0;
    if (outlineRef.current) {
      for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
        if (L.domains[i].kind !== "bond" || L.domains[j].kind !== "bond" || !L.domains[i].symbol || !L.domains[j].symbol) continue;
        if (angleBetween(sim, i, j) > 2.28) continue; // > ~130 degrees: not neighbours
        const o = segs * 6; outlinePos[o] = sim.dir[i * 3] * BOND_LEN; outlinePos[o + 1] = sim.dir[i * 3 + 1] * BOND_LEN; outlinePos[o + 2] = sim.dir[i * 3 + 2] * BOND_LEN;
        outlinePos[o + 3] = sim.dir[j * 3] * BOND_LEN; outlinePos[o + 4] = sim.dir[j * 3 + 1] * BOND_LEN; outlinePos[o + 5] = sim.dir[j * 3 + 2] * BOND_LEN; segs += 1;
      }
      outlineGeo.setDrawRange(0, segs * 2); outlineGeo.attributes.position.needsUpdate = true;
      outlineRef.current.visible = segs > 0 && state.mg > 0.05 && n > 2; outlineRef.current.material.opacity = 0.55 * state.mg;
    }
    // ----- highlights
    const setHalo = (mesh, id, boost) => {
      if (!mesh) return; const idx = id ? sim.ids.indexOf(id) : -1;
      if (id === "central" && L.central) { mesh.visible = true; mesh.position.set(0, 0, 0); mesh.scale.setScalar(cr * 1.28); return; }
      if (idx < 0 || idx >= n) { mesh.visible = false; return; }
      const dom = L.domains[idx]; const dx = sim.dir[idx * 3], dy = sim.dir[idx * 3 + 1], dz = sim.dir[idx * 3 + 2]; mesh.visible = true;
      if (dom.kind === "bond") { const r = (dom.symbol ? ELEMENTS[dom.symbol].r : 0.3) * boost; mesh.position.set(dx * BOND_LEN, dy * BOND_LEN, dz * BOND_LEN); mesh.scale.setScalar(r); }
      else { mesh.visible = state.lp > 0.1; mesh.position.set(dx * 0.95, dy * 0.95, dz * 0.95); mesh.scale.setScalar(0.62); }
    };
    setHalo(haloSel.current, L.selectedId, 1.32); setHalo(haloHover.current, L.hoverId && L.hoverId !== L.selectedId ? L.hoverId : null, 1.2);
    // ----- toolbox drag preview (attachment point + bond preview)
    const pv = L.preview; const showPv = !!(pv && pv.dir && L.central);
    for (const m of [ghostAtom.current, ghostBond.current, ghostLobe.current, attachDot.current, attachRing.current]) if (m) m.visible = false;
    if (showPv) {
      const [px, py, pz] = pv.dir; const pulse = 0.5 + 0.5 * Math.sin(sim.time * 7);
      T.q.setFromUnitVectors(Y_AXIS, T.d.set(px, py, pz));
      const ad = attachDot.current; const ar = attachRing.current;
      if (ad) { ad.visible = true; ad.position.set(px * cr * 1.04, py * cr * 1.04, pz * cr * 1.04); ad.scale.setScalar(0.1 + 0.03 * pulse); }
      if (ar) { ar.visible = true; ar.position.set(px * cr * 1.02, py * cr * 1.02, pz * cr * 1.02); ar.quaternion.copy(T.q); ar.scale.setScalar(0.2 + 0.05 * pulse); }
      if (pv.kind === "bond") {
        const gEl = pv.symbol ? ELEMENTS[pv.symbol] : null; const ga = ghostAtom.current; const gb = ghostBond.current;
        if (ga) { ga.visible = true; ga.position.set(px * BOND_LEN, py * BOND_LEN, pz * BOND_LEN); ga.scale.setScalar(gEl ? gEl.r : 0.3); ga.material.color.set(gEl ? gEl.color : "#9fb3d9"); }
        if (gb) { gb.visible = true; gb.quaternion.copy(T.q); gb.position.set(px * BOND_LEN * 0.55, py * BOND_LEN * 0.55, pz * BOND_LEN * 0.55); gb.scale.set(0.07 * (pv.order || 1), BOND_LEN * 0.9 - cr * 0.3, 0.07 * (pv.order || 1)); }
      } else if (pv.kind === "lp") {
        const gl = ghostLobe.current; if (gl) { gl.visible = true; gl.quaternion.copy(T.q); gl.position.set(0, 0, 0); gl.scale.set(1, 1.5, 1); }
      }
    }
    // ----- angle arcs, repulsion arrows and DOM labels
    updateOverlays(L, sim, n, T, state, { arcsRef, shaftsRef, headsRef, camera, size, labelRefs, cr });
    onFrame?.(sim, state);
    if (mini) { const settling = state.mg > 0.002 && state.mg < 0.998 || state.dom > 0.002 && state.dom < 0.998 || state.lp > 0.002 && state.lp < 0.998; if (settling || L.animate) invalidate(); }
  });

  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#dbe8ff", "#1a2a55", 0.55]} />
      <directionalLight position={[4, 6, 5]} intensity={1.35} />
      <directionalLight position={[-5, -2, -3]} intensity={0.35} color="#9db8ff" />
      <Bridge apiRef={apiRef} live={live} controlsRef={controlsRef} />
      {/* central atom */}
      <mesh ref={centralRef} geometry={sphereGeo} visible={false}><meshStandardMaterial roughness={0.28} metalness={0.05} /></mesh>
      <sprite ref={centralSprite} visible={false} renderOrder={5}><spriteMaterial transparent depthWrite={false} /></sprite>
      {/* surrounding atoms */}
      {Array.from({ length: MAX_SLOTS }, (_, i) => (
        <group key={i}>
          <mesh ref={(m) => { atomRefs.current[i] = m; }} geometry={sphereGeo} visible={false}><meshStandardMaterial roughness={0.3} metalness={0.04} /></mesh>
          <sprite ref={(m) => { spriteRefs.current[i] = m; }} visible={false} renderOrder={5}><spriteMaterial transparent depthWrite={false} /></sprite>
          <mesh ref={(m) => { stubRefs.current[i] = m; }} geometry={lowSphere} visible={false}><meshBasicMaterial color="#9fb3d9" wireframe transparent opacity={0.8} /></mesh>
          <mesh ref={(m) => { bondLobeRefs.current[i] = m; }} visible={false} renderOrder={2}>
            <latheGeometry args={[bondGeo, 40]} />
            <primitive object={mats.bond} attach="material" dispose={null} />
          </mesh>
          <mesh ref={(m) => { lpLobeRefs.current[i] = m; }} visible={false} renderOrder={3}>
            <latheGeometry args={[lpGeo, 40]} />
            <primitive object={mats.lp} attach="material" dispose={null} />
          </mesh>
          <group ref={(m) => { dotRefs.current[i] = m; }} visible={false}>
            {[0, 1].map((k) => (
              <mesh key={k} geometry={lowSphere} material={mats.dot} scale={0.062} renderOrder={4} />
            ))}
          </group>
        </group>
      ))}
      <instancedMesh ref={strandsRef} args={[null, null, 18]} frustumCulled={false} geometry={cylGeo}><meshStandardMaterial color="#d3d9e6" roughness={0.35} metalness={0.15} /></instancedMesh>
      <lineSegments ref={outlineRef} geometry={outlineGeo} frustumCulled={false} visible={false}><lineBasicMaterial color="#bcd2ff" transparent opacity={0.5} depthWrite={false} /></lineSegments>
      {/* angle arcs (thin segments), repulsion arrows (shafts + heads) */}
      <instancedMesh ref={arcsRef} args={[null, null, MAX_ARCS * ARC_SEG]} frustumCulled={false} geometry={cylGeo} renderOrder={6}><meshBasicMaterial transparent opacity={0.95} depthTest={false} /></instancedMesh>
      <instancedMesh ref={shaftsRef} args={[null, null, MAX_PAIRS * 2]} frustumCulled={false} geometry={cylGeo} renderOrder={6}><meshBasicMaterial transparent opacity={0.9} depthTest={false} /></instancedMesh>
      <instancedMesh ref={headsRef} args={[null, null, MAX_PAIRS * 2]} frustumCulled={false} geometry={coneGeo} renderOrder={6}><meshBasicMaterial transparent opacity={0.95} depthTest={false} /></instancedMesh>
      {/* highlights and previews */}
      <mesh ref={haloSel} geometry={lowSphere} visible={false} renderOrder={7}><meshBasicMaterial color="#ffd166" transparent opacity={0.3} depthWrite={false} /></mesh>
      <mesh ref={haloHover} geometry={lowSphere} visible={false} renderOrder={7}><meshBasicMaterial color="#9ad0ff" transparent opacity={0.22} depthWrite={false} /></mesh>
      <mesh ref={ghostAtom} geometry={lowSphere} visible={false}><meshStandardMaterial transparent opacity={0.55} roughness={0.4} /></mesh>
      <mesh ref={ghostBond} geometry={cylGeo} visible={false}><meshBasicMaterial color="#ffd166" transparent opacity={0.6} /></mesh>
      <mesh ref={ghostLobe} visible={false} renderOrder={3}><latheGeometry args={[lpGeo, 40]} /><meshBasicMaterial color="#ffd166" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh ref={attachDot} geometry={lowSphere} visible={false} renderOrder={8}><meshBasicMaterial color="#ffd166" depthTest={false} /></mesh>
      <mesh ref={attachRing} visible={false} renderOrder={8}><ringGeometry args={[0.8, 1, 28]} /><meshBasicMaterial color="#ffd166" transparent opacity={0.85} side={THREE.DoubleSide} depthTest={false} /></mesh>
      {!mini && <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableDamping dampingFactor={0.1} rotateSpeed={0.8} zoomSpeed={0.7} autoRotate={autoRotate} autoRotateSpeed={1.4} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
const PAIR_COLORS = { ll: "#ff6f7d", lb: "#ffb347", bb: "#ffe0a8" };
const ARC_COLORS = { ideal: "#e6efff", approx: "#ffd166", lessthan: "#ffd166", live: "#7ee0ff" };

function writeSegment(mesh, k, ax, ay, az, bx, by, bz, rad, T) {
  const dx = bx - ax, dy = by - ay, dz = bz - az; const len = Math.hypot(dx, dy, dz) || 1e-6;
  T.d.set(dx / len, dy / len, dz / len); T.q.setFromUnitVectors(Y_AXIS, T.d); T.r.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); T.s.set(rad, len, rad);
  T.m.compose(T.r, T.q, T.s); mesh.setMatrixAt(k, T.m);
}

function updateOverlays(L, sim, n, T, state, { arcsRef, shaftsRef, headsRef, camera, size, labelRefs, cr }) {
  // ---------- arrows
  const shafts = shaftsRef.current; const heads = headsRef.current; let pairsOn = 0;
  if (shafts && heads) {
    if (L.showRepulsion && n >= 2) {
      const pulse = sim.pulse; const dragging = sim.pin >= 0;
      let minAll = Math.PI; for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) minAll = Math.min(minAll, angleBetween(sim, i, j));
      for (let i = 0; i < n && pairsOn < MAX_PAIRS; i += 1) for (let j = i + 1; j < n && pairsOn < MAX_PAIRS; j += 1) {
        const ang = angleBetween(sim, i, j); if (n > 2 && ang > minAll * 1.4) continue;
        const ki = L.domains[i].kind; const kj = L.domains[j].kind; const type = ki === "lp" && kj === "lp" ? "ll" : ki === "lp" || kj === "lp" ? "lb" : "bb";
        if ((ki === "lp" || kj === "lp") && L.lpVisible === false && !(L.mode === "ed")) continue;
        const base = type === "ll" ? 1.0 : type === "lb" ? 0.8 : 0.55;
        const strength = base * (1 + (dragging ? 0.35 : 0) + 0.9 * pulse);
        const thick = type === "ll" ? 0.034 : type === "lb" ? 0.028 : 0.02; const length = 0.2 + 0.18 * strength;
        const rr = Math.max(1.1, cr + 0.55);
        for (let side = 0; side < 2; side += 1) {
          const a = side === 0 ? i : j; const b = side === 0 ? j : i;
          // point 30% of the way from a toward b, pushing back toward a (away from b)
          T.u.set(sim.dir[a * 3], sim.dir[a * 3 + 1], sim.dir[a * 3 + 2]); T.w.set(sim.dir[b * 3], sim.dir[b * 3 + 1], sim.dir[b * 3 + 2]);
          T.p.copy(T.u).multiplyScalar(0.62).addScaledVector(T.w, 0.38).normalize().multiplyScalar(rr);
          T.d.copy(T.u).sub(T.w); const dl = T.d.length() || 1; T.d.divideScalar(dl); // direction away from b
          const k = pairsOn * 2 + side;
          // shaft ends at tip; head cone sits at the tip
          T.r.copy(T.p).addScaledVector(T.d, -length * 0.5 + length * 0.05);
          T.q.setFromUnitVectors(Y_AXIS, T.d); T.s.set(thick, length * 0.8, thick); T.m.compose(T.r, T.q, T.s); shafts.setMatrixAt(k, T.m);
          T.r.copy(T.p).addScaledVector(T.d, length * 0.5 - length * 0.1); T.s.set(thick * 3.2, length * 0.3, thick * 3.2); T.m.compose(T.r, T.q, T.s); heads.setMatrixAt(k, T.m);
          T.color.set(PAIR_COLORS[type]); shafts.setColorAt(k, T.color); heads.setColorAt(k, T.color);
        }
        pairsOn += 1;
      }
    }
    shafts.count = pairsOn * 2; heads.count = pairsOn * 2; shafts.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    if (shafts.instanceColor) { shafts.instanceColor.needsUpdate = true; heads.instanceColor.needsUpdate = true; }
  }
  // ---------- angle arcs + labels
  const arcs = arcsRef.current; const labels = labelRefs?.current; let arcCount = 0; let seg = 0;
  const hideFrom = (k) => { for (let q = k; q < MAX_ARCS; q += 1) { const el = labels?.[q]; if (el && el.dataset.on !== "0") { el.dataset.on = "0"; el.style.opacity = "0"; } } };
  if (!arcs) return;
  if (!L.showAngles || n < 2) { arcs.count = 0; arcs.instanceMatrix.needsUpdate = true; hideFrom(0); return; }
  const dragging = sim.pin >= 0; const settling = dragging || sim.pulse > 0.02 || L.live;
  const bonds = []; for (let i = 0; i < n; i += 1) if (L.domains[i].kind === "bond" && L.domains[i].symbol !== undefined) bonds.push(i);
  const picks = []; // [i, j, deg]
  if (dragging && L.domains[sim.pin]?.kind === "bond") {
    const near = bonds.filter((j) => j !== sim.pin).map((j) => [j, angleBetween(sim, sim.pin, j)]).sort((a, b) => a[1] - b[1]).slice(0, 2);
    for (const [j, a] of near) picks.push([sim.pin, j, (a * 180) / Math.PI]);
  } else {
    for (let a = 0; a < bonds.length; a += 1) for (let b = a + 1; b < bonds.length; b += 1) {
      const deg = (angleBetween(sim, bonds[a], bonds[b]) * 180) / Math.PI;
      if (!picks.some((p) => Math.abs(p[2] - deg) < 3)) picks.push([bonds[a], bonds[b], deg]);
    }
    picks.sort((x, y) => x[2] - y[2]);
  }
  const rho = Math.max(0.7, cr + 0.26); const placed = [];
  for (const [i, j, deg] of picks.slice(0, MAX_ARCS)) {
    // arc between directions i and j in their common plane (semicircle in a stable plane when they are (anti)parallel)
    T.u.set(sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2]); T.w.set(sim.dir[j * 3], sim.dir[j * 3 + 1], sim.dir[j * 3 + 2]);
    T.v2.crossVectors(T.u, T.w);
    let total = (angleBetween(sim, i, j));
    if (T.v2.lengthSq() < 1e-6) { T.v2.crossVectors(T.u, Math.abs(T.u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)); total = Math.PI; }
    T.v2.normalize(); // rotation axis
    let px = 0, py = 0, pz = 0; let mx = 0, my = 0, mz = 0;
    for (let s = 0; s <= ARC_SEG; s += 1) {
      const a = (total * s) / ARC_SEG; const c = Math.cos(a); const sn = Math.sin(a);
      // Rodrigues: u rotated about axis by a
      const kx = T.v2.x, ky = T.v2.y, kz = T.v2.z; const ux = T.u.x, uy = T.u.y, uz = T.u.z; const kd = kx * ux + ky * uy + kz * uz;
      const x = (ux * c + (ky * uz - kz * uy) * sn + kx * kd * (1 - c)) * rho; const y = (uy * c + (kz * ux - kx * uz) * sn + ky * kd * (1 - c)) * rho; const z = (uz * c + (kx * uy - ky * ux) * sn + kz * kd * (1 - c)) * rho;
      if (s > 0 && seg < MAX_ARCS * ARC_SEG) { writeSegment(arcs, seg, px, py, pz, x, y, z, 0.02, T); T.color.set(settling ? ARC_COLORS.live : ARC_COLORS.ideal); arcs.setColorAt(seg, T.color); seg += 1; }
      px = x; py = y; pz = z; if (s === Math.floor(ARC_SEG / 2)) { mx = x; my = y; mz = z; }
    }
    // label
    const el = labels?.[arcCount]; if (el) {
      let text; let kind;
      const entry = (L.angleEntries ?? []).reduce((best, e) => (Math.abs(e.value - deg) < Math.abs((best?.value ?? 1e9) - deg) ? e : best), null);
      if (settling || !entry || Math.abs(entry.value - deg) > 8) { text = `${Math.round(deg)}°`; kind = "live"; }
      else { text = entry.text.replace("≈ ", "≈"); kind = entry.kind; }
      T.p.set(mx, my, mz).multiplyScalar(1.28).project(camera);
      const sx = (T.p.x * 0.5 + 0.5) * size.width; const sy = (-T.p.y * 0.5 + 0.5) * size.height;
      let yy = sy; for (const q of placed) if (Math.abs(q.x - sx) < 52 && Math.abs(q.y - yy) < 24) yy = q.y + 26; placed.push({ x: sx, y: yy });
      if (el.textContent !== text) el.textContent = text; if (el.dataset.kind !== kind) el.dataset.kind = kind;
      el.style.transform = `translate(${sx.toFixed(1)}px, ${yy.toFixed(1)}px) translate(-50%, -50%)`; if (el.dataset.on !== "1") { el.dataset.on = "1"; el.style.opacity = "1"; }
      arcCount += 1;
    }
  }
  hideFrom(arcCount);
  arcs.count = seg; arcs.instanceMatrix.needsUpdate = true; if (arcs.instanceColor) arcs.instanceColor.needsUpdate = true;
  void state; void nearestIdealAngle;
}
