import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { THREE, THEME, createCloudGeometry, createCloudMaterial, disposeObject, makeLabelTexture, makeRingTexture, placeCylinder } from "./sceneAssets.js";
import { getCloud, applyShift, applyEspColors } from "./cloudGeometry.js";
import { ELEM, MOLECULES } from "../model/molecules.js";
import { computeInteractions, FORCE_LABEL, HB } from "../model/imf.js";
import { add, dist, len, norm, scale, sub } from "../model/vec.js";

// The r3f content of the Explore / Learn workspace. Poses live in `storeRef.current` (mutated while the user drags -- no React
// state per pointer move) and are read here once per frame. The interaction model (./model/imf.js) is evaluated per frame for the
// handful of molecules on screen; the cached electron-cloud meshes are only DISPLACED and RECOLOURED, never rebuilt.
export const MAX_MOLECULES = 6;
const BALL_SCALE = { ball: 1, cloud: 0.5 };

// ---- one molecule ---------------------------------------------------------------------------------------------------------
function MoleculeView({ entry, register, shared }) {
  const mol = MOLECULES[entry.id];
  const group = useRef(null); const cloudMesh = useRef(null); const atomRefs = useRef([]); const bondRefs = useRef([]); const permArrow = useRef(null); const indArrow = useRef(null);
  const sprites = useRef([]); const ringRef = useRef(null); const lobes = useRef([]);
  const cloud = useMemo(() => getCloud(entry.id), [entry.id]);
  const geo = useMemo(() => createCloudGeometry(cloud), [cloud]);
  const mat = useMemo(() => createCloudMaterial(0.64), []);
  const buf = useMemo(() => ({ pos: new Float32Array(cloud.count * 3), col: new Float32Array(cloud.count * 3), shift: [9, 9, 9], p: [9, 9, 9], viewMode: "" }), [cloud]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const bonds = useMemo(() => {
    const out = [];
    for (const [a, b, order] of mol.bonds) {
      const pa = mol.atoms[a].p; const pb = mol.atoms[b].p; const d = sub(pb, pa); const l = len(d); const u = norm(d);
      const side = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const perp = norm([u[1] * side[2] - u[2] * side[1], u[2] * side[0] - u[0] * side[2], u[0] * side[1] - u[1] * side[0]]);
      const offs = order === 3 ? [-1, 0, 1] : order === 2 ? [-0.5, 0.5] : [0];
      for (const o of offs) out.push({ a: add(pa, scale(perp, o * 0.2)), b: add(pb, scale(perp, o * 0.2)), r: order === 1 ? 0.1 : 0.065, l });
    }
    return out;
  }, [mol]);
  const permDir = useMemo(() => { // chemistry convention: from delta-plus to delta-minus; drawn between the centres of positive and negative charge
    let cp = [0, 0, 0]; let cn = [0, 0, 0]; let sp = 0; let sn = 0;
    mol.atoms.forEach((a) => { if (a.q > 0) { cp = add(cp, scale(a.p, a.q)); sp += a.q; } else if (a.q < 0) { cn = add(cn, scale(a.p, -a.q)); sn -= a.q; } });
    return sp > 0 && sn > 0 && mol.polar ? { from: scale(cp, 1 / sp), to: scale(cn, 1 / sn) } : null;
  }, [mol]);
  useEffect(() => { register(entry.uid, { update }); return () => register(entry.uid, null); });
  function update(e, st, L, it) {
    const g = group.current; if (!g) return;
    g.position.set(e.pos[0], e.pos[1], e.pos[2]); g.quaternion.set(e.quat[0], e.quat[1], e.quat[2], e.quat[3]);
    const cloudOn = L.view === "cloud"; const bs = BALL_SCALE[L.view] ?? 1;
    atomRefs.current.forEach((m, i) => { if (m) m.scale.setScalar(ELEM[mol.atoms[i].el].ball * bs); });
    bondRefs.current.forEach((m, i) => { if (m) { placeCylinder(m, bonds[i].a, bonds[i].b, bonds[i].r * (cloudOn ? 0.6 : 1)); } });
    const mesh = cloudMesh.current; if (mesh) mesh.visible = cloudOn;
    // cloud deformation (cheap displacement of the cached vertices) -- only when the dipole / shift changed
    if (cloudOn) {
      const sh = st.shift; const p = st.p;
      if (Math.abs(sh[0] - buf.shift[0]) + Math.abs(sh[1] - buf.shift[1]) + Math.abs(sh[2] - buf.shift[2]) > 2e-4 || buf.viewMode !== "cloud") {
        // shift is expressed in the WORLD frame; the mesh lives in the molecule's local frame
        const lq = new THREE.Quaternion(e.quat[0], e.quat[1], e.quat[2], e.quat[3]).invert(); const v = new THREE.Vector3(sh[0], sh[1], sh[2]).applyQuaternion(lq);
        applyShift(cloud, [v.x, v.y, v.z], buf.pos); geo.attributes.position.array.set(buf.pos); geo.attributes.position.needsUpdate = true; buf.shift = [sh[0], sh[1], sh[2]];
      }
      if (Math.abs(p[0] - buf.p[0]) + Math.abs(p[1] - buf.p[1]) + Math.abs(p[2] - buf.p[2]) > 2e-4 || buf.viewMode !== "cloud") {
        const lq = new THREE.Quaternion(e.quat[0], e.quat[1], e.quat[2], e.quat[3]).invert(); const v = new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(lq);
        applyEspColors(cloud, [v.x, v.y, v.z], buf.col); geo.attributes.color.array.set(buf.col); geo.attributes.color.needsUpdate = true; buf.p = [p[0], p[1], p[2]];
      }
    }
    buf.viewMode = cloudOn ? "cloud" : "ball";
    // delta labels on atoms (permanent partial charges)
    const showD = L.showDelta;
    sprites.current.forEach((s, i) => {
      if (!s) return; const a = mol.atoms[i]; const on = showD && Math.abs(a.q) > 0.04; s.visible = on; if (!on) return;
      const nrm = norm(a.p); const out = nrm[0] === 0 && nrm[1] === 0 && nrm[2] === 0 ? [0, 1, 0] : nrm;
      const sp = add(a.p, scale(out, ELEM[a.el].ball * bs + 0.6)); s.position.set(sp[0], sp[1], sp[2]);
    });
    if (ringRef.current) { ringRef.current.visible = L.selectedUid === entry.uid && L.interactive; const rr = mol.radius * 2.3; ringRef.current.scale.set(rr, rr, 1); }
    // arrows
    const placeArrow = (arrow, from, to, color, on, thick = 1) => {
      if (!arrow) return; arrow.visible = on; if (!on) return; const l = dist(from, to); if (l < 0.05) { arrow.visible = false; return; }
      const d = norm(sub(to, from)); const shaftL = Math.max(0.01, l - 0.38 * thick);
      const shaft = arrow.children[0]; const head = arrow.children[1]; const tail = arrow.children[2];
      placeCylinder(shaft, from, add(from, scale(d, shaftL)), 0.075 * thick); head.position.set(...add(from, scale(d, shaftL + 0.19 * thick))); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d)); head.scale.setScalar(thick);
      tail.position.set(...from); tail.scale.setScalar(thick); shaft.material.color.set(color); head.material.color.set(color); tail.material.color.set(color);
    };
    const showArrows = L.showDelta || cloudOn || L.lessonLabels;
    if (permDir) placeArrow(permArrow.current, permDir.from, permDir.to, THEME.perm, showArrows, 1.15);
    const pl = len(st.p);
    if (pl > 0.004) { // induced / instantaneous dipole arrow, local frame; points to the delta-minus end (opposite to p)
      const lq = new THREE.Quaternion(e.quat[0], e.quat[1], e.quat[2], e.quat[3]).invert(); const v = new THREE.Vector3(st.p[0], st.p[1], st.p[2]).applyQuaternion(lq).normalize();
      const half = Math.min(1.1, 0.5 + pl * 14) * (mol.radius * 0.5); const shift = new THREE.Vector3(st.shift[0], st.shift[1], st.shift[2]).applyQuaternion(lq);
      const c = [shift.x, shift.y, shift.z]; placeArrow(indArrow.current, add(c, scale([v.x, v.y, v.z], half)), add(c, scale([v.x, v.y, v.z], -half)), st.source ? THEME.instant : THEME.induced, showArrows && (st.showP !== false), 1);
    } else if (indArrow.current) indArrow.current.visible = false;
    // lone-pair lobes
    const lobeOn = L.force === "hbond" && mol.acceptors.length > 0;
    lobes.current.forEach((m, i) => { if (!m) return; m.visible = lobeOn; if (!lobeOn) return; const lp = mol.acceptors[0].lps[i]; if (!lp) { m.visible = false; return; } const base = mol.atoms[mol.acceptors[0].atom].p; const c = add(base, scale(lp, 0.8)); m.position.set(...c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...lp)); });
  }
  const lpCount = mol.acceptors[0]?.lps.length ?? 0;
  return (
    <group ref={group}>
      {mol.atoms.map((a, i) => (
        <mesh key={i} ref={(m) => { atomRefs.current[i] = m; }} geometry={shared.sphere} material={shared.atomMat[a.el]} scale={ELEM[a.el].ball} renderOrder={1} />
      ))}
      {bonds.map((b, i) => <mesh key={`b${i}`} ref={(m) => { bondRefs.current[i] = m; }} geometry={shared.cyl} material={shared.bondMat} renderOrder={1} />)}
      <mesh ref={cloudMesh} geometry={geo} material={mat} renderOrder={4} frustumCulled={false} visible={false} />
      {Array.from({ length: lpCount }, (_, i) => <mesh key={`lp${i}`} ref={(m) => { lobes.current[i] = m; }} geometry={shared.lobe} material={shared.lobeMat} visible={false} renderOrder={5} />)}
      <Arrow refHandle={permArrow} shared={shared} />
      <Arrow refHandle={indArrow} shared={shared} />
      <sprite ref={ringRef} material={shared.ringMat} visible={false} renderOrder={6} />
      {mol.atoms.map((a, i) => <sprite key={`s${i}`} ref={(s) => { sprites.current[i] = s; }} visible={false} renderOrder={9} scale={[0.85, 0.85, 1]} material={a.q > 0 ? shared.plusMat : shared.minusMat} />)}
    </group>
  );
}
function Arrow({ refHandle, shared }) {
  const mats = useMemo(() => [0, 1, 2].map(() => shared.arrowMat.clone()), [shared]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group ref={refHandle} visible={false} renderOrder={8}>
      <mesh geometry={shared.cyl} material={mats[0]} renderOrder={8} />
      <mesh geometry={shared.cone} material={mats[1]} renderOrder={8} />
      <mesh geometry={shared.tailGeo} material={mats[2]} renderOrder={8} />
    </group>
  );
}

// ---- the whole scene ----------------------------------------------------------------------------------------------------------
export default function ImfScene({ storeRef, optsRef, simRef, apiRef, onSummary, revision, resetViewToken, interactive }) {
  const { camera, gl, invalidate, size } = useThree();
  const controlsRef = useRef(null);
  const registry = useRef(new Map());
  const mols = storeRef.current; void revision;
  const shared = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 28, 20); const cyl = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false); const cone = new THREE.ConeGeometry(0.19, 0.38, 16); const lobe = new THREE.SphereGeometry(1, 16, 12); lobe.scale(0.34, 0.62, 0.34);
    const tailGeo = new THREE.SphereGeometry(0.15, 12, 8);
    const atomMat = {}; Object.keys(ELEM).forEach((k) => { atomMat[k] = new THREE.MeshStandardMaterial({ color: ELEM[k].color, roughness: 0.38, metalness: 0.04 }); });
    const bondMat = new THREE.MeshStandardMaterial({ color: "#c7cedd", roughness: 0.5 });
    const arrowMat = new THREE.MeshBasicMaterial({ color: THEME.perm, depthTest: false, transparent: true, opacity: 0.95 });
    const lobeMat = new THREE.MeshStandardMaterial({ color: THEME.lone, transparent: true, opacity: 0.55, roughness: 0.4, depthWrite: false });
    const texPlus = makeLabelTexture("δ⁺", THEME.plus); const texMinus = makeLabelTexture("δ⁻", THEME.minus);
    const plusMat = new THREE.SpriteMaterial({ map: texPlus, depthTest: false, transparent: true }); const minusMat = new THREE.SpriteMaterial({ map: texMinus, depthTest: false, transparent: true });
    const ringTex = makeRingTexture(); const ringMat = new THREE.SpriteMaterial({ map: ringTex, depthTest: false, transparent: true, opacity: 0.9 });
    return { sphere, cyl, cone, lobe, tailGeo, atomMat, bondMat, arrowMat, lobeMat, plusMat, minusMat, ringMat, textures: [texPlus, texMinus, ringTex] };
  }, []);
  useEffect(() => () => { shared.sphere.dispose(); shared.cyl.dispose(); shared.cone.dispose(); shared.lobe.dispose(); shared.tailGeo.dispose(); Object.values(shared.atomMat).forEach((m) => m.dispose()); [shared.bondMat, shared.arrowMat, shared.lobeMat, shared.plusMat, shared.minusMat, shared.ringMat].forEach((m) => m.dispose()); shared.textures.forEach((t) => t.dispose()); }, [shared]);
  // arrow heads share the cone geometry; replace the head child's geometry once (the Arrow component uses shared.cone via cylinder slot order)
  const indicators = useRef(null); const pool = useMemo(() => ({ arrows: Array.from({ length: 12 }, () => null), beads: null }), []);
  const dashRef = useRef(null); const dashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: THEME.hbond, transparent: true, opacity: 0.95, depthTest: false }), []);
  const dashGeo = useMemo(() => new THREE.SphereGeometry(0.075, 10, 8), []);
  const attrGroup = useRef(null); const attrMats = useMemo(() => ({ attract: new THREE.MeshBasicMaterial({ color: THEME.attract, transparent: true, opacity: 0.95, depthTest: false }), repel: new THREE.MeshBasicMaterial({ color: THEME.repel, transparent: true, opacity: 0.95, depthTest: false }) }), []);
  const attrCone = useMemo(() => new THREE.ConeGeometry(0.2, 0.46, 16), []); const attrShaft = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 10), []);
  useEffect(() => () => { dashMat.dispose(); dashGeo.dispose(); attrMats.attract.dispose(); attrMats.repel.dispose(); attrCone.dispose(); attrShaft.dispose(); }, [dashMat, dashGeo, attrMats, attrCone, attrShaft]);
  void indicators; void pool;
  const summaryLast = useRef(""); const lastEmit = useRef(0);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), o: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() }), []);

  // bridge for the DOM layer: picking, plane intersection, projection (also used by the headless tests)
  useEffect(() => {
    const ray = (cx, cy) => { const r = gl.domElement.getBoundingClientRect(); const nx = ((cx - r.left) / r.width) * 2 - 1; const ny = -((cy - r.top) / r.height) * 2 + 1; camera.updateMatrixWorld(); const o = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld); const d = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(o).normalize(); return { o, d, inside: Math.abs(nx) <= 1 && Math.abs(ny) <= 1 }; };
    apiRef.current = {
      ray,
      pick(cx, cy) {
        const { o, d } = ray(cx, cy); let best = null; let bt = Infinity;
        for (const m of storeRef.current) { const c = new THREE.Vector3(...m.pos); const rad = MOLECULES[m.id].radius * 0.92; const oc = o.clone().sub(c); const b = oc.dot(d); const cc = oc.dot(oc) - rad * rad; const disc = b * b - cc; if (disc < 0) continue; const t = -b - Math.sqrt(disc); const tt = t > 0 ? t : -b + Math.sqrt(disc); if (tt > 0 && tt < bt) { bt = tt; best = m; } }
        return best ? { uid: best.uid, t: bt } : null;
      },
      planePoint(cx, cy, through) { const { o, d } = ray(cx, cy); const n = new THREE.Vector3(); camera.getWorldDirection(n); const p0 = new THREE.Vector3(...through); const den = d.dot(n); if (Math.abs(den) < 1e-6) return through; const t = p0.clone().sub(o).dot(n) / den; const p = o.clone().addScaledVector(d, t); return [p.x, p.y, p.z]; },
      cameraAxes() { camera.updateMatrixWorld(); const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); const u = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1); const f = new THREE.Vector3(); camera.getWorldDirection(f); return { right: [r.x, r.y, r.z], up: [u.x, u.y, u.z], forward: [f.x, f.y, f.z] }; },
      project(x, y, z) { const r = gl.domElement.getBoundingClientRect(); camera.updateMatrixWorld(); const v = new THREE.Vector3(x, y, z).project(camera); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height]; },
      cameraDistance: () => camera.position.length(), invalidate,
      zoom(f) { const c = controlsRef.current; const dd = camera.position.length(); const nd = Math.min(c?.maxDistance ?? 40, Math.max(c?.minDistance ?? 8, dd * f)); camera.position.multiplyScalar(nd / dd); c?.update?.(); invalidate(); },
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, gl, invalidate, storeRef]);

  useEffect(() => { { const asp = size.width / Math.max(1, size.height); const d = Math.min(34, 15 * Math.max(1, 1.5 / Math.max(0.3, asp))); camera.position.set(0, d * 0.2, d * 0.98); } camera.lookAt(0, 0, 0); controlsRef.current?.update?.(); invalidate(); }, [resetViewToken, camera, invalidate, size.width, size.height]);
  useEffect(() => { invalidate(); }); // any React-driven change repaints once (frameloop is "demand")

  useFrame(() => {
    const L = optsRef.current; const S = simRef.current; const list = storeRef.current;
    const entries = list.map((m) => ({ uid: m.uid, mol: MOLECULES[m.id], pose: m }));
    const fx = S.fx ?? { gain: L.force === "ldf" ? 1 : 0, fixedDir: null, induced: true, attract: true, labels: false };
    const inter = computeInteractions(entries, { force: L.force, t: S.t, fluct: { gain: fx.gain, fixedDir: fx.fixedDir }, exaggeration: L.exaggeration });
    S.inter = inter;
    // lesson stage flags: hide the induced response / indicators until their step
    const showInduced = fx.induced !== false; const showAttract = fx.attract !== false;
    list.forEach((m, i) => {
      const api = registry.current.get(m.uid); if (!api) return; const st = inter.mols[i];
      const stv = showInduced ? st : { ...st, p: st.source ? st.p : [0, 0, 0], shift: st.source ? st.shift : [0, 0, 0], induced: [0, 0, 0] };
      api.update(m, stv, { ...L, lessonLabels: !!fx.labels, showDelta: L.showDelta || !!fx.labels }, i);
    });
    // induced / temporary delta labels at the ends of each dipole
    updateDynamicLabels(inter, list, L, fx, showInduced);
    // intermolecular indicators
    const att = attrGroup.current; const dash = dashRef.current;
    let arrowCount = 0; let beadCount = 0; const A = att?.children ?? [];
    for (const k of A) k.visible = false;
    const MAXB = 6 * 9;
    if (dash) dash.count = 0;
    const lines = [];
    for (const pr of inter.pairs) {
      const a = list[pr.i]; const b = list[pr.j]; if (!showAttract) continue;
      if (L.force === "hbond") {
        for (const h of pr.hbonds) { const s = h.strength; for (let k = 0; k < 9 && beadCount < MAXB; k += 1) { const u = (k + 0.5) / 9; const p = [h.H[0] + (h.A[0] - h.H[0]) * u, h.H[1] + (h.A[1] - h.H[1]) * u, h.H[2] + (h.A[2] - h.H[2]) * u]; tmp.m.makeScale(0.55 + 1.0 * s, 0.55 + 1.0 * s, 0.55 + 1.0 * s).setPosition(p[0], p[1], p[2]); if (dash) dash.setMatrixAt(beadCount, tmp.m); beadCount += 1; } lines.push(h); }
        continue;
      }
      if (pr.kind !== "attract" && pr.kind !== "repel") continue;
      if (pr.strength < 0.04) continue;
      const dir = norm(sub(b.pos, a.pos)); const ra = MOLECULES[a.id].radius * 0.78; const rb = MOLECULES[b.id].radius * 0.78; const gap = pr.r - ra - rb;
      const mid = scale(add(a.pos, b.pos), 0.5); const half = Math.max(0.25, Math.min(1.2, gap / 2 + 0.2));
      const len2 = 0.45 + 1.5 * pr.strength; const tone = pr.kind === "attract" ? attrMats.attract : attrMats.repel;
      for (let side = 0; side < 2 && arrowCount < 6; side += 1) {
        const g = A[arrowCount * 1]; if (!g) break; g.visible = true; const sg = side === 0 ? 1 : -1;
        // attract: arrows point towards each other across the gap; repel: away from each other
        const from = add(mid, scale(dir, sg * (pr.kind === "attract" ? half + len2 : half * 0.3)));
        const to = add(mid, scale(dir, sg * (pr.kind === "attract" ? half * 0.3 : half + len2)));
        const shaft = g.children[0]; const head = g.children[1]; const d = norm(sub(to, from)); const l = Math.max(0.1, dist(from, to) - 0.4);
        placeCylinder(shaft, from, add(from, scale(d, l)), 0.07 + 0.05 * pr.strength); shaft.material = tone; head.material = tone; head.position.set(...add(from, scale(d, l + 0.2))); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d));
        arrowCount += 1;
      }
    }
    if (dash) { dash.count = beadCount; dash.instanceMatrix.needsUpdate = true; }
    // summary for the DOM layer (throttled): the focus pair = the strongest pair
    const focus = inter.pairs.reduce((best, p) => (!best || p.r < best.r ? p : best), null);
    const sum = focus ? `${focus.i}|${focus.j}|${focus.r.toFixed(1)}|${focus.kind}|${Math.round(focus.strength * 100)}|${focus.applicable ? 1 : 0}|${Math.round(focus.hbStrength * 100)}|${list.length}` : `n${list.length}`;
    const now = performance.now();
    if (sum !== summaryLast.current && now - lastEmit.current > 90) { summaryLast.current = sum; lastEmit.current = now; onSummary?.({ focus, n: list.length, inter }); }
    if (S.keepAlive?.()) invalidate();
  });

  // dynamic delta labels (temporary / induced) -- two sprites per molecule, pooled
  const dynLabels = useRef([]); const dynMats = useMemo(() => ({ plus: shared.plusMat, minus: shared.minusMat }), [shared]);
  function updateDynamicLabels(inter, list, L, fx, showInduced) {
    const on = (L.showDelta || fx.labels) && true;
    for (let i = 0; i < MAX_MOLECULES * 2; i += 1) { const s = dynLabels.current[i]; if (s) s.visible = false; }
    if (!on) return;
    list.forEach((m, i) => {
      const st = inter.mols[i]; if (!showInduced && !st.source) return; const pm = len(st.p); const mol = MOLECULES[m.id]; if (pm < 0.006) return;
      if (mol.polar && len(st.induced) < 0.006 && !st.source) return;
      const u = norm(st.p); const R = mol.radius * 0.95; const c = add(m.pos, st.shift);
      const plus = dynLabels.current[2 * i]; const minus = dynLabels.current[2 * i + 1]; if (!plus || !minus) return;
      plus.visible = true; minus.visible = true; plus.position.set(...add(c, scale(u, R))); minus.position.set(...add(c, scale(u, -R)));
      const sz = 0.8 + Math.min(0.5, pm * 8); plus.scale.set(sz, sz, 1); minus.scale.set(sz, sz, 1);
    });
  }
  const camDist = 22; void size; void camDist;
  return (
    <>
      <ambientLight intensity={0.85} /><directionalLight position={[6, 9, 8]} intensity={1.5} /><directionalLight position={[-6, -3, -5]} intensity={0.35} />
      <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableDamping dampingFactor={0.12} minDistance={8} maxDistance={40} rotateSpeed={0.8} />
      {mols.map((m) => <MoleculeView key={m.uid} entry={m} register={(uid, api) => { if (api) registry.current.set(uid, api); else registry.current.delete(uid); }} shared={shared} />)}
      {Array.from({ length: MAX_MOLECULES * 2 }, (_, i) => <sprite key={`dl${i}`} ref={(s) => { dynLabels.current[i] = s; }} visible={false} renderOrder={10} material={i % 2 === 0 ? dynMats.plus : dynMats.minus} />)}
      <group ref={attrGroup}>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={`ar${i}`} visible={false} renderOrder={8}>
            <mesh geometry={attrShaft} material={attrMats.attract} renderOrder={8} /><mesh geometry={attrCone} material={attrMats.attract} renderOrder={8} />
          </group>
        ))}
      </group>
      <instancedMesh ref={dashRef} args={[dashGeo, dashMat, 54]} frustumCulled={false} renderOrder={7} />
    </>
  );
}
export { disposeObject, FORCE_LABEL, HB };
