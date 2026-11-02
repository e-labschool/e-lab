import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { THREE, THEME, createCloudGeometry, createCloudMaterial, makeLabelTexture, placeCylinder } from "./sceneAssets.js";
import { getCloud, applyShift, applyEspColors } from "./cloudGeometry.js";
import { buildMoleculeObject, makeMoleculeGeometry, worldGeometry, BOND_COLOR } from "./moleculeObject.js";
import { ELEM, MOLECULES } from "../model/molecules.js";
import { computeInteractions } from "../model/imf.js";
import { add, dist, len, norm, qRot, scale, sub } from "../model/vec.js";

// The r3f content of the Explore / Learn workspace. Poses live in `storeRef.current` (mutated while the user drags -- no React
// state per pointer move) and are read here once per frame. The interaction model (./model/imf.js) is evaluated per frame for the
// handful of molecules on screen; the cached electron-cloud meshes are only DISPLACED and RECOLOURED, never rebuilt.
//
// EVERY molecule is ONE group (moleculeObject.js): atoms + bonds are positioned once from the molecule geometry and only the group
// transform changes afterwards. Overlays (cloud, delta labels, dipole arrows, lone-pair lobes) are siblings in the molecule's frame.
export const MAX_MOLECULES = 6;
const DEFAULT_DIR = [0, 0.2, 0.98];
const MAX_BEADS = 140;

// ---- one molecule ---------------------------------------------------------------------------------------------------------
function MoleculeView({ entry, register, shared }) {
  const mol = MOLECULES[entry.id];
  const outer = useRef(null); const cloudMesh = useRef(null); const permArrow = useRef(null); const indArrow = useRef(null);
  const sprites = useRef([]); const lobes = useRef([]);
  const cloud = useMemo(() => getCloud(entry.id), [entry.id]);
  const geo = useMemo(() => createCloudGeometry(cloud), [cloud]);
  const mat = useMemo(() => createCloudMaterial(0.64), []);
  const atomMats = useMemo(() => { const o = {}; Object.keys(ELEM).forEach((k) => { o[k] = new THREE.MeshStandardMaterial({ color: ELEM[k].color, roughness: 0.38, metalness: 0.04, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0 }); }); return o; }, []);
  const obj = useMemo(() => buildMoleculeObject({ ...mol, id: entry.id }, shared.geo, atomMats, shared.bondMat), [mol, entry.id, shared, atomMats]);
  const buf = useMemo(() => ({ pos: new Float32Array(cloud.count * 3), col: new Float32Array(cloud.count * 3), shift: [9, 9, 9], p: [9, 9, 9], on: false, amt: -1 }), [cloud]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); Object.values(atomMats).forEach((m) => m.dispose()); }, [geo, mat, atomMats]);
  const permDir = useMemo(() => { // chemistry convention: from delta-plus to delta-minus; drawn between the centres of positive and negative charge
    let cp = [0, 0, 0]; let cn = [0, 0, 0]; let sp = 0; let sn = 0;
    mol.atoms.forEach((a) => { if (a.q > 0) { cp = add(cp, scale(a.p, a.q)); sp += a.q; } else if (a.q < 0) { cn = add(cn, scale(a.p, -a.q)); sn -= a.q; } });
    return sp > 0 && sn > 0 && mol.polar ? { from: scale(cp, 1 / sp), to: scale(cn, 1 / sn) } : null;
  }, [mol]);
  useEffect(() => { register(entry.uid, { update, obj, outer }); return () => register(entry.uid, null); });
  function update(e, st, L, amt) {
    const g = outer.current; if (!g) return;
    g.position.set(e.pos[0], e.pos[1], e.pos[2]); g.quaternion.set(e.quat[0], e.quat[1], e.quat[2], e.quat[3]);
    if (Math.abs(amt - buf.amt) > 1e-3) { obj.setStyle(amt); mat.uniforms.uOpacity.value = 0.64 * amt; buf.amt = amt; }
    const sel = L.selectedUid === entry.uid && L.interactive; Object.values(atomMats).forEach((m) => { m.emissiveIntensity = sel ? 0.16 : 0; });
    const cloudOn = amt > 0.02; const mesh = cloudMesh.current; if (mesh) mesh.visible = cloudOn;
    // cloud deformation (cheap displacement of the cached vertices) -- only when the dipole / shift changed
    if (cloudOn) {
      const lq = new THREE.Quaternion(e.quat[0], e.quat[1], e.quat[2], e.quat[3]).invert(); const sh = st.shift; const p = st.p;
      if (Math.abs(sh[0] - buf.shift[0]) + Math.abs(sh[1] - buf.shift[1]) + Math.abs(sh[2] - buf.shift[2]) > 2e-4 || !buf.on) {
        const v = new THREE.Vector3(sh[0], sh[1], sh[2]).applyQuaternion(lq); // shift is a WORLD vector; the mesh lives in the molecule frame
        applyShift(cloud, [v.x, v.y, v.z], buf.pos); geo.attributes.position.array.set(buf.pos); geo.attributes.position.needsUpdate = true; buf.shift = [sh[0], sh[1], sh[2]];
      }
      if (Math.abs(p[0] - buf.p[0]) + Math.abs(p[1] - buf.p[1]) + Math.abs(p[2] - buf.p[2]) > 2e-4 || !buf.on) {
        const v = new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(lq);
        applyEspColors(cloud, [v.x, v.y, v.z], buf.col); geo.attributes.color.array.set(buf.col); geo.attributes.color.needsUpdate = true; buf.p = [p[0], p[1], p[2]];
      }
    }
    buf.on = cloudOn;
    // permanent partial-charge labels on the atoms (only when relevant: atoms that really carry charge)
    const showD = L.showPerm; const bs = 1 - 0.38 * amt;
    sprites.current.forEach((s, i) => {
      if (!s) return; const a = mol.atoms[i]; const on = showD && Math.abs(a.q) > 0.04; s.visible = on; if (!on) return;
      const nrm = norm(a.p); const out = nrm[0] === 0 && nrm[1] === 0 && nrm[2] === 0 ? [0, 1, 0] : nrm;
      const sp = add(a.p, scale(out, ELEM[a.el].ball * bs + 0.5)); s.position.set(sp[0], sp[1], sp[2]);
    });
    // small dipole arrows, only when the Dipole switch is on (a vector, NOT a force)
    const placeArrow = (arrow, from, to, color, on, thick) => {
      if (!arrow) return; arrow.visible = on; if (!on) return; const l = dist(from, to); if (l < 0.05) { arrow.visible = false; return; }
      const d = norm(sub(to, from)); const shaftL = Math.max(0.01, l - 0.38 * thick);
      const shaft = arrow.children[0]; const head = arrow.children[1]; const tail = arrow.children[2];
      placeCylinder(shaft, from, add(from, scale(d, shaftL)), 0.075 * thick); head.position.set(...add(from, scale(d, shaftL + 0.19 * thick))); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d)); head.scale.setScalar(thick);
      tail.position.set(...from); tail.scale.setScalar(thick); shaft.material.color.set(color); head.material.color.set(color); tail.material.color.set(color);
    };
    const showArrows = !!L.showDipole;
    if (permDir) { const off = [0, mol.radius * 0.62, 0]; placeArrow(permArrow.current, add(permDir.from, off), add(permDir.to, off), THEME.perm, showArrows, 0.55); }
    const pl = len(st.p);
    if (pl > 0.0008) { // induced / instantaneous dipole arrow (points to the delta-minus end, opposite to p)
      const lq = new THREE.Quaternion(e.quat[0], e.quat[1], e.quat[2], e.quat[3]).invert(); const v = new THREE.Vector3(st.p[0], st.p[1], st.p[2]).applyQuaternion(lq).normalize();
      const half = Math.min(0.9, 0.4 + pl * 10) * (mol.radius * 0.5); const shift = new THREE.Vector3(st.shift[0], st.shift[1], st.shift[2]).applyQuaternion(lq);
      const c = [shift.x, shift.y - mol.radius * 0.62, shift.z]; placeArrow(indArrow.current, add(c, scale([v.x, v.y, v.z], half)), add(c, scale([v.x, v.y, v.z], -half)), st.source ? THEME.instant : THEME.induced, showArrows, 0.55);
    } else if (indArrow.current) indArrow.current.visible = false;
    // lone-pair lobes (hydrogen-bond scenarios only)
    const lobeOn = L.showLobes && mol.acceptors.length > 0;
    lobes.current.forEach((m, i) => { if (!m) return; m.visible = lobeOn; if (!lobeOn) return; const lp = mol.acceptors[0].lps[i]; if (!lp) { m.visible = false; return; } const base = mol.atoms[mol.acceptors[0].atom].p; const c = add(base, scale(lp, 0.8)); m.position.set(...c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...lp)); });
  }
  const lpCount = mol.acceptors[0]?.lps.length ?? 0;
  return (
    <group ref={outer}>
      <primitive object={obj.group} />
      <mesh ref={cloudMesh} geometry={geo} material={mat} renderOrder={4} frustumCulled={false} visible={false} />
      {Array.from({ length: lpCount }, (_, i) => <mesh key={`lp${i}`} ref={(m) => { lobes.current[i] = m; }} geometry={shared.lobe} material={shared.lobeMat} visible={false} renderOrder={5} />)}
      <Arrow refHandle={permArrow} shared={shared} />
      <Arrow refHandle={indArrow} shared={shared} />
      {mol.atoms.map((a, i) => <sprite key={`s${i}`} ref={(s) => { sprites.current[i] = s; }} visible={false} renderOrder={9} scale={[0.62, 0.62, 1]} material={a.q > 0 ? shared.plusMat : shared.minusMat} />)}
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

// ---- charge poles used to anchor the thin dashed attraction lines --------------------------------------------------------------
/** World positions of the delta+ and delta- centres of a molecule: permanent charges for polar molecules, else the ends of the induced / instantaneous dipole. */
function poles(m, st) {
  const mol = MOLECULES[m.id]; const out = [];
  if (mol.polar) {
    let cp = [0, 0, 0]; let cn = [0, 0, 0]; let sp = 0; let sn = 0;
    mol.atoms.forEach((a) => { const w = add(m.pos, qRot(m.quat, a.p)); if (a.q > 0.02) { cp = add(cp, scale(w, a.q)); sp += a.q; } else if (a.q < -0.02) { cn = add(cn, scale(w, -a.q)); sn -= a.q; } });
    if (sp > 0 && sn > 0) { out.push({ p: scale(cp, 1 / sp), sign: 1 }); out.push({ p: scale(cn, 1 / sn), sign: -1 }); }
    return out;
  }
  const pl = len(st.p); if (pl < 0.004) return out;
  const u = norm(st.p); const c = add(m.pos, st.shift); const R = mol.radius * 0.55;
  out.push({ p: add(c, scale(u, R)), sign: 1 }); out.push({ p: add(c, scale(u, -R)), sign: -1 });
  return out;
}

// ---- the whole scene ----------------------------------------------------------------------------------------------------------
export default function ImfScene({ storeRef, optsRef, simRef, apiRef, onSummary, revision, resetViewToken }) {
  const { camera, gl, scene, invalidate, size } = useThree();
  const controlsRef = useRef(null);
  const registry = useRef(new Map());
  const mols = storeRef.current; void revision;
  const shared = useMemo(() => {
    const geo = makeMoleculeGeometry(); const cyl = geo.cyl; const cone = new THREE.ConeGeometry(0.19, 0.38, 16); const lobe = new THREE.SphereGeometry(1, 16, 12); lobe.scale(0.3, 0.55, 0.3);
    const tailGeo = new THREE.SphereGeometry(0.15, 12, 8);
    const bondMat = new THREE.MeshStandardMaterial({ color: BOND_COLOR, roughness: 0.5 });
    const arrowMat = new THREE.MeshBasicMaterial({ color: THEME.perm, depthTest: false, transparent: true, opacity: 0.95 });
    const lobeMat = new THREE.MeshStandardMaterial({ color: THEME.lone, transparent: true, opacity: 0.45, roughness: 0.4, depthWrite: false });
    const texPlus = makeLabelTexture("δ⁺", THEME.plus); const texMinus = makeLabelTexture("δ⁻", THEME.minus);
    const plusMat = new THREE.SpriteMaterial({ map: texPlus, depthTest: false, transparent: true }); const minusMat = new THREE.SpriteMaterial({ map: texMinus, depthTest: false, transparent: true });
    return { geo, cyl, cone, lobe, tailGeo, bondMat, arrowMat, lobeMat, plusMat, minusMat, textures: [texPlus, texMinus] };
  }, []);
  useEffect(() => () => { shared.geo.sphere.dispose(); shared.cyl.dispose(); shared.cone.dispose(); shared.lobe.dispose(); shared.tailGeo.dispose(); [shared.bondMat, shared.arrowMat, shared.lobeMat, shared.plusMat, shared.minusMat].forEach((m) => m.dispose()); shared.textures.forEach((t) => t.dispose()); }, [shared]);
  // thin dashed attraction / repulsion / hydrogen-bond lines: small beads along the line (one instanced mesh, per-instance colour)
  const dashRef = useRef(null); const dashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.92, depthTest: false }), []);
  const dashGeo = useMemo(() => new THREE.SphereGeometry(0.04, 8, 6), []);
  useEffect(() => () => { dashMat.dispose(); dashGeo.dispose(); }, [dashMat, dashGeo]);
  const summaryLast = useRef(""); const lastEmit = useRef(0);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), cAttract: new THREE.Color(THEME.attract), cRepel: new THREE.Color(THEME.repel), cHb: new THREE.Color(THEME.hbond) }), []);

  // bridge for the DOM layer: picking, plane intersection, projection (also used by the headless tests)
  useEffect(() => {
    const ray = (cx, cy) => { const r = gl.domElement.getBoundingClientRect(); const nx = ((cx - r.left) / r.width) * 2 - 1; const ny = -((cy - r.top) / r.height) * 2 + 1; camera.updateMatrixWorld(); const o = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld); const d = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(o).normalize(); return { o, d, inside: Math.abs(nx) <= 1 && Math.abs(ny) <= 1 }; };
    const project = (x, y, z) => { const r = gl.domElement.getBoundingClientRect(); camera.updateMatrixWorld(); const v = new THREE.Vector3(x, y, z).project(camera); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height]; };
    apiRef.current = {
      ray, project,
      pick(cx, cy) {
        const { o, d } = ray(cx, cy); let best = null; let bt = Infinity;
        for (const m of storeRef.current) { const c = new THREE.Vector3(...m.pos); const rad = MOLECULES[m.id].radius * 0.92; const oc = o.clone().sub(c); const b = oc.dot(d); const cc = oc.dot(oc) - rad * rad; const disc = b * b - cc; if (disc < 0) continue; const t = -b - Math.sqrt(disc); const tt = t > 0 ? t : -b + Math.sqrt(disc); if (tt > 0 && tt < bt) { bt = tt; best = m; } }
        return best ? { uid: best.uid, t: bt } : null;
      },
      planePoint(cx, cy, through) { const { o, d } = ray(cx, cy); const n = new THREE.Vector3(); camera.getWorldDirection(n); const p0 = new THREE.Vector3(...through); const den = d.dot(n); if (Math.abs(den) < 1e-6) return through; const t = p0.clone().sub(o).dot(n) / den; const p = o.clone().addScaledVector(d, t); return [p.x, p.y, p.z]; },
      cameraAxes() { camera.updateMatrixWorld(); const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); const u = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1); const f = new THREE.Vector3(); camera.getWorldDirection(f); return { right: [r.x, r.y, r.z], up: [u.x, u.y, u.z], forward: [f.x, f.y, f.z] }; },
      /** Screen-space picture of every molecule as it is ACTUALLY in the scene graph: atom centres + bond end points (client px), and the group each belongs to. */
      screenGeometry() {
        scene.updateMatrixWorld(true);
        return [...registry.current.entries()].map(([uid, v]) => { const w = worldGeometry(v.obj); const px = (p) => project(p.x, p.y, p.z);
          return { uid, id: v.id, groupChildren: v.obj.group.children.length, sameParent: v.obj.atoms.concat(v.obj.bonds).every((m) => m.parent === v.obj.group), atoms: w.atoms.map((p, i) => ({ screen: px(p), world: [p.x, p.y, p.z], el: v.obj.atoms[i].userData.el })), bonds: w.bonds.map((b) => ({ atoms: b.atoms, order: b.order, a: px(b.a), b: px(b.b) })) }; });
      },
      /** First scene object under a client point: {uid, kind, index} for an atom or bond, else null. */
      hit(cx, cy) {
        scene.updateMatrixWorld(true); const { o, d } = ray(cx, cy); const rc = new THREE.Raycaster(o, d); const targets = []; registry.current.forEach((v) => { targets.push(...v.obj.atoms, ...v.obj.bonds); });
        const h = rc.intersectObjects(targets, false)[0]; if (!h) return null; const uid = [...registry.current.entries()].find(([, v]) => v.obj.group === h.object.parent)?.[0];
        return { uid, kind: h.object.userData.kind, index: h.object.userData.index ?? h.object.userData.atoms };
      },
      cameraDistance: () => camera.position.length(), invalidate,
      zoom(f) { const c = controlsRef.current; const dd = camera.position.length(); const nd = Math.min(c?.maxDistance ?? 60, Math.max(c?.minDistance ?? 5, dd * f)); camera.position.multiplyScalar(nd / dd); c?.update?.(); invalidate(); },
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, gl, scene, invalidate, storeRef]);

  // camera auto-framing: fit the relevant molecules (or the Learn lesson's whole range of motion) into view; keep the orbit direction unless Reset View
  const lastReset = useRef(-1);
  useEffect(() => {
    const L = optsRef.current; let hw = 3; let hh = 2.5;
    if (L.frame) { hw = L.frame.hw; hh = L.frame.hh; } else {
      for (const m of storeRef.current) { const r = MOLECULES[m.id].radius; hw = Math.max(hw, Math.abs(m.pos[0]) + r); hh = Math.max(hh, Math.abs(m.pos[1]) + r, Math.abs(m.pos[2]) * 0.6 + r); }
    }
    const t = Math.tan((camera.fov * Math.PI) / 360); const asp = size.width / Math.max(1, size.height);
    const d = Math.min(52, Math.max(7.5, Math.max(hh / t, hw / (t * asp)) * 1.12 + 1.2));
    let dir = norm([camera.position.x, camera.position.y, camera.position.z]); if (lastReset.current !== resetViewToken || len(dir) < 0.5) dir = norm(DEFAULT_DIR); lastReset.current = resetViewToken;
    camera.position.set(dir[0] * d, dir[1] * d, dir[2] * d); camera.lookAt(0, 0, 0); controlsRef.current?.update?.(); invalidate();
  }, [resetViewToken, optsRef.current.frameKey, size.width, size.height, camera, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { invalidate(); }); // any React-driven change repaints once (frameloop is "demand")

  useFrame(() => {
    const L = optsRef.current; const S = simRef.current; const list = storeRef.current;
    const entries = list.map((m) => ({ uid: m.uid, mol: MOLECULES[m.id], pose: m }));
    const fx = S.fx ?? { gain: L.force === "ldf" ? 1 : 0, fixedDir: null, induced: true, attract: true, perm: false, dyn: false, cloud: 0, lobes: false };
    const inter = computeInteractions(entries, { force: L.force, t: S.t, fluct: { gain: fx.gain, fixedDir: fx.fixedDir }, exaggeration: L.exaggeration });
    S.inter = inter;
    // lesson stage flags: hide the induced response / indicators until their step
    const showInduced = fx.induced !== false; const showAttract = fx.attract !== false; const inLesson = !!S.fx;
    const amt = L.view === "cloud" ? 1 : L.view === "ball" ? 0 : Math.max(0, Math.min(1, fx.cloud ?? 0));
    const Lx = { ...L, showPerm: inLesson ? !!fx.perm : L.showDelta, showLobes: inLesson ? !!fx.lobes : L.force === "hbond" };
    list.forEach((m, i) => {
      const api = registry.current.get(m.uid); if (!api) return; const st = inter.mols[i];
      const stv = showInduced ? st : { ...st, p: st.source ? st.p : [0, 0, 0], shift: st.source ? st.shift : [0, 0, 0], induced: [0, 0, 0] };
      api.update(m, stv, Lx, amt);
    });
    updateDynamicLabels(inter, list, inLesson ? !!fx.dyn : L.showDelta, showInduced);
    // thin dashed intermolecular lines
    const dash = dashRef.current; let nb = 0;
    const bead = (a, b, n, color, s) => { for (let k = 0; k < n && nb < MAX_BEADS; k += 1) { const u = (k + 0.5) / n; tmp.m.makeScale(s, s, s).setPosition(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u); dash.setMatrixAt(nb, tmp.m); dash.setColorAt(nb, color); nb += 1; } };
    if (dash && showAttract) {
      for (const pr of inter.pairs) {
        const a = list[pr.i]; const b = list[pr.j];
        if (L.force === "hbond") { for (const h of pr.hbonds) bead(h.H, h.A, Math.max(5, Math.round(dist(h.H, h.A) * 4)), tmp.cHb, 0.8 + 0.8 * h.strength); continue; }
        if ((pr.kind !== "attract" && pr.kind !== "repel") || pr.strength < 0.04) continue;
        const pa = poles(a, inter.mols[pr.i]); const pb = poles(b, inter.mols[pr.j]); let best = null;
        for (const x of pa) for (const y of pb) { const same = x.sign === y.sign; if ((pr.kind === "attract") === same) continue; const dd = dist(x.p, y.p); if (!best || dd < best.d) best = { d: dd, a: x.p, b: y.p }; }
        if (best && best.d > 0.6) bead(best.a, best.b, Math.max(5, Math.round(best.d * 4)), pr.kind === "attract" ? tmp.cAttract : tmp.cRepel, 0.75 + 0.9 * pr.strength);
      }
    }
    if (dash) { dash.count = nb; dash.instanceMatrix.needsUpdate = true; if (dash.instanceColor) dash.instanceColor.needsUpdate = true; }
    // summary for the DOM layer (throttled): the focus pair = the closest pair
    const focus = inter.pairs.reduce((best, p) => (!best || p.r < best.r ? p : best), null);
    const sum = focus ? `${focus.i}|${focus.j}|${focus.r.toFixed(1)}|${focus.kind}|${Math.round(focus.strength * 100)}|${focus.applicable ? 1 : 0}|${Math.round(focus.hbStrength * 100)}|${list.length}` : `n${list.length}`;
    const now = performance.now();
    if (sum !== summaryLast.current && now - lastEmit.current > 90) { summaryLast.current = sum; lastEmit.current = now; onSummary?.({ focus, n: list.length, inter }); }
    // click-to-first-visual-change latency of Next / Previous / Play (measured in the frame that draws the change)
    if (S.mark) { const ms = performance.now() - S.mark.t0; const el = gl.domElement.closest?.('[data-testid="imf-stage"]'); if (el) { el.dataset[S.mark.key] = ms.toFixed(1); } S.mark = null; }
    if (S.keepAlive?.()) invalidate();
  });

  // dynamic delta labels (temporary / induced) -- two sprites per molecule, pooled
  const dynLabels = useRef([]); const dynMats = useMemo(() => ({ plus: shared.plusMat, minus: shared.minusMat }), [shared]);
  function updateDynamicLabels(inter, list, on, showInduced) {
    for (let i = 0; i < MAX_MOLECULES * 2; i += 1) { const s = dynLabels.current[i]; if (s) s.visible = false; }
    if (!on) return;
    list.forEach((m, i) => {
      const st = inter.mols[i]; if (!showInduced && !st.source) return; const pm = len(st.p); const mol = MOLECULES[m.id]; if (pm < 0.0008) return;
      if (mol.polar && len(st.induced) < 0.0008 && !st.source) return;
      const u = norm(st.p); const R = mol.radius * 0.95; const c = add(m.pos, st.shift);
      const plus = dynLabels.current[2 * i]; const minus = dynLabels.current[2 * i + 1]; if (!plus || !minus) return;
      plus.visible = true; minus.visible = true; plus.position.set(...add(c, scale(u, R))); minus.position.set(...add(c, scale(u, -R)));
      const sz = 0.6; plus.scale.set(sz, sz, 1); minus.scale.set(sz, sz, 1);
    });
  }
  return (
    <>
      <ambientLight intensity={0.7} /><directionalLight position={[6, 9, 8]} intensity={1.3} /><directionalLight position={[-6, -3, -5]} intensity={0.35} />
      <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableDamping dampingFactor={0.12} minDistance={5} maxDistance={60} rotateSpeed={0.8} />
      {mols.map((m) => <MoleculeView key={m.uid} entry={m} register={(uid, api) => { if (api) registry.current.set(uid, { ...api, id: m.id }); else registry.current.delete(uid); }} shared={shared} />)}
      {Array.from({ length: MAX_MOLECULES * 2 }, (_, i) => <sprite key={`dl${i}`} ref={(s) => { dynLabels.current[i] = s; }} visible={false} renderOrder={10} material={i % 2 === 0 ? dynMats.plus : dynMats.minus} />)}
      <instancedMesh ref={dashRef} args={[dashGeo, dashMat, MAX_BEADS]} frustumCulled={false} renderOrder={7} />
    </>
  );
}
