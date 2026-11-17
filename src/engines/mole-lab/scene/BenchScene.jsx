import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PacketBagObject } from "./bagObject.js";
import { BAG } from "./bagSpec.js";
import { atomColour } from "../engine/particles.js";
import { getSubstance } from "../engine/substances.js";
import { fmtMol, fromQuanta } from "../engine/numeric.js";
import { clampToBench, nearestTarget } from "./benchLayout.js";

// The packet layer shared by every stage: PacketNode (one standard bag), GroupedStack (many full packets as one stack),
// PourStream (particles in flight), PourDirector (pour animation timeline) and PointerController (drag / click / touch).
//
// RULE: nothing in here writes chemistry.  Nodes READ the scene state (fill = q / 1e9) and animate a display value toward it;
// the only chemistry writes are the dispatches made by the interaction hook (usePacketInteraction), so an interrupted
// animation can never leave the amounts wrong.
//
// `bench` is a mutable ref shared with the interaction hook:
//   bench.nodes : Map id -> { obj: PacketBagObject, disp, home:{x,z} }
//   bench.drag  : { id, x, z, targetId } | null
//   bench.pour  : { src, dst, phase: "in"|"stream"|"out", t, dir, movedFraction } | null

const FILL_SPEED = 0.62; // moles of display fill per second
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const _mouth = new THREE.Vector3(); const _tmp = new THREE.Vector3();

export function PacketNode({ item, home, bench, detail, reduced, selected, subLabel, showCard = true, dim = false, tiltDir = 1 }) {
  const { invalidate } = useThree();
  const obj = useMemo(() => new PacketBagObject({ substanceId: item.substanceId, detail }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const disp = useRef({ fill: item.q / 1e9, open: item.open ? 1 : 0, x: home.x, z: home.z, y: 0, lift: 0, tilt: 0, ring: 0 });
  const live = useRef({}); live.current = { item, home, selected, subLabel, showCard, reduced };
  useEffect(() => {
    bench.current.nodes.set(item.id, { obj, disp: disp.current, home: live.current.home });
    obj.group.position.set(home.x, 0, home.z); obj.group.userData.packetId = item.id;
    return () => { bench.current.nodes.delete(item.id); obj.dispose(); };
  }, [obj, item.id, bench]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { obj.setSubstance(item.substanceId, detail); }, [obj, item.substanceId, detail]);
  useEffect(() => { const n = bench.current.nodes.get(item.id); if (n) n.home = home; }, [home, item.id, bench]);
  useEffect(() => { if (reduced) { disp.current.fill = item.q / 1e9; disp.current.open = item.open ? 1 : 0; } invalidate(); }, [reduced, item.q, item.open, invalidate]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05); const d = disp.current; const L = live.current; const b = bench.current;
    const tf = L.item.q / 1e9; const r = L.reduced;
    if (r) { d.fill = tf; d.open = L.item.open ? 1 : 0; } else {
      const step = FILL_SPEED * dt; d.fill += Math.max(-step, Math.min(step, tf - d.fill)); if (Math.abs(tf - d.fill) < 1e-4) d.fill = tf;
      d.open = damp(d.open, L.item.open ? 1 : 0, 9, dt);
    }
    // where should this bag be?
    let tx = L.home.x; let tz = L.home.z; let ty = 0; let tilt = 0; let lift = 0;
    const drag = b.drag; const pour = b.pour;
    if (drag && drag.id === L.item.id) { tx = drag.x; tz = drag.z; lift = 1; }
    if (pour && pour.src === L.item.id) {
      const dst = b.nodes.get(pour.dst); const dh = dst ? { x: dst.disp.x, z: dst.disp.z } : L.home;
      if (pour.phase !== "out") { tx = dh.x - pour.dir * 1.75; tz = dh.z + 0.15; ty = 2.15; tilt = pour.dir; lift = 0; }
    }
    if (r) { d.x = tx; d.z = tz; d.y = ty; d.lift = lift; d.tilt = tilt; } else {
      d.x = damp(d.x, tx, drag && drag.id === L.item.id ? 28 : 7, dt); d.z = damp(d.z, tz, drag && drag.id === L.item.id ? 28 : 7, dt); d.y = damp(d.y, ty, 6, dt);
      d.lift = damp(d.lift, lift, 12, dt); d.tilt = damp(d.tilt, tilt, 6.5, dt);
    }
    obj.group.position.set(d.x, d.y, d.z); obj.pivot.rotation.z = -d.tilt * 1.42;
    obj.group.visible = true;
    obj.setParams({ fill: d.fill, open: d.open }); obj.setLift(d.lift);
    obj.setLabel(`${fmtMol(fromQuanta(L.item.q))} mol`, L.subLabel ?? null); obj.setCardVisible(L.showCard && Math.abs(d.tilt) < 0.2);
    const isTarget = drag && drag.targetId === L.item.id && drag.valid || (pour && pour.dst === L.item.id);
    if (isTarget) { d.ring = damp(d.ring, 0.95, 14, dt); obj.setRing("#2fb67a", d.ring); }
    else if (L.selected) { d.ring = damp(d.ring, 0.85, 14, dt); obj.setRing("#4f8cff", d.ring); }
    else { d.ring = damp(d.ring, 0, 14, dt); obj.setRing("#4f8cff", d.ring); }
    obj.pivot.traverse?.(() => {});
  });
  return <primitive object={obj.group} />;
}

/** Many full packets as one compact stack with an exact numerical label (spec D Stage 2 "grouped-packet representation"). */
export function GroupedStack({ substanceId, count, home, detail }) {
  const objs = useMemo(() => [0, 1, 2].map(() => new PacketBagObject({ substanceId, detail: "low" })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const root = useMemo(() => new THREE.Group(), []);
  useEffect(() => {
    objs.forEach((o, i) => { o.setSubstance(substanceId, "low"); o.setParams({ fill: 1, open: 0 }); o.setCardVisible(false); o.group.position.set((i - 1) * 0.5, 0, -i * 0.62); root.add(o.group); });
    objs[2].setCardVisible(false);
    return () => { objs.forEach((o) => { root.remove(o.group); o.dispose(); }); };
  }, [objs, root, substanceId]);
  useEffect(() => { objs[0].setLabel(`× ${count}`, `${count} mol (grouped)`); objs[0].setCardVisible(true); }, [objs, count]);
  void detail;
  return <group position={[home.x, 0, home.z]}><primitive object={root} /></group>;
}

/** Particles in flight from the source mouth to the destination while a pour is committed. */
export function PourStream({ bench, colourOf, reduced }) {
  const N = 28;
  const geo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3, metalness: 0 }), []);
  const mesh = useMemo(() => { const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; m.count = 0; return m; }, [geo, mat]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); mesh.dispose(); }, [geo, mat, mesh]);
  useFrame(() => {
    const b = bench.current; const p = b.pour;
    if (!p || p.phase !== "stream" || reduced) { mesh.count = 0; return; }
    const src = b.nodes.get(p.src); const dst = b.nodes.get(p.dst); if (!src || !dst) { mesh.count = 0; return; }
    const col = colourOf(p.src); mat.color.set(col);
    src.obj.mouthWorld(_mouth); const a = _mouth.clone(); dst.obj.mouthWorld(_tmp); const e = _tmp.clone().add(new THREE.Vector3(0, -0.5, 0));
    const T = Math.max(0.2, p.duration); const k = Math.max(3, Math.min(N, Math.ceil(p.movedFraction * N)));
    let n = 0;
    for (let i = 0; i < k; i += 1) {
      const start = (i / k) * T * 0.7; const life = T * 0.42; const s = (p.t - start) / life; if (s < 0 || s > 1) continue;
      const x = a.x + (e.x - a.x) * s + Math.sin(i * 12.9) * 0.12; const z = a.z + (e.z - a.z) * s + Math.cos(i * 7.7) * 0.1; const y = a.y + (e.y - a.y) * s * s - 0.0;
      dummy.position.set(x, y, z); dummy.scale.setScalar(0.07 + 0.015 * ((i * 7) % 3)); dummy.updateMatrix(); mesh.setMatrixAt(n, dummy.matrix); n += 1;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

/** Advances the pour timeline.  The chemistry commit happens through `onCommit` exactly once; `onDone` ends the interaction. */
export function PourDirector({ bench, onCommit, onDone }) {
  const cb = useRef({}); cb.current = { onCommit, onDone };
  useFrame((_, dtRaw) => {
    const p = bench.current.pour; if (!p) return; const dt = Math.min(dtRaw, 0.08); p.t += dt;
    if (p.phase === "in" && p.t >= 0.95) { p.phase = "stream"; p.t = 0; p.movedFraction = cb.current.onCommit?.(p) ?? 0; }
    else if (p.phase === "stream" && p.t >= p.duration) { p.phase = "out"; p.t = 0; }
    else if (p.phase === "out" && p.t >= 0.75) { bench.current.pour = null; cb.current.onDone?.(p); }
  });
  return null;
}

/**
 * Pointer interaction for bags: press on a bag = select (click) or drag (after 6 px).  Presses on empty bench fall through to
 * the orbit controls.  Everything is wired through `handlers` from usePacketInteraction; the controller owns only geometry:
 * picking, the ground-plane intersection, clamping to the bench, and target detection.
 */
export function PointerController({ bench, handlers, layoutPos }) {
  const { camera, gl } = useThree();
  const hRef = useRef(handlers); hRef.current = handlers; const posRef = useRef(layoutPos); posRef.current = layoutPos;
  useEffect(() => {
    const el = gl.domElement.closest("[data-s3d-stage]") ?? gl.domElement.parentElement;
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hit = new THREE.Vector3();
    let g = null;
    const setNdc = (e) => { const r = gl.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
    const ground = (e) => { setNdc(e); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null; };
    const pick = (e) => {
      setNdc(e); const meshes = []; for (const n of bench.current.nodes.values()) meshes.push(n.obj.hit);
      const hits = ray.intersectObjects(meshes, false); if (!hits.length) return null;
      for (const [id, n] of bench.current.nodes) if (n.obj.hit === hits[0].object) return id; return null;
    };
    const onDown = (e) => {
      if (e.button !== undefined && e.button > 0) return; if (e.target.closest?.("button, select, input, a, [data-ml-overlay]")) return;
      if (bench.current.pour) return; // busy: ignore presses while a pour is in progress (no repeated transfers)
      const id = pick(e); if (!id) { hRef.current.onBackground?.(e); return; }
      e.stopPropagation(); e.preventDefault?.(); try { el.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      const node = bench.current.nodes.get(id); const gp = ground(e) ?? { x: node.disp.x, z: node.disp.z };
      g = { pid: e.pointerId, id, x0: e.clientX, y0: e.clientY, started: false, dx: node.disp.x - gp.x, dz: node.disp.z - gp.z, startPos: { x: node.disp.x, z: node.disp.z } };
      hRef.current.onPress?.(id); el.focus?.({ preventScroll: true });
    };
    const onMove = (e) => {
      if (!g || e.pointerId !== g.pid) return;
      if (!g.started) { if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 6) return; g.started = true; hRef.current.onDragStart?.(g.id); }
      const gp = ground(e); if (!gp) return; const c = clampToBench(gp.x + g.dx, gp.z + g.dz);
      const pos = {}; for (const [k, p] of Object.entries(posRef.current)) pos[k] = bench.current.nodes.get(k) ? { x: bench.current.nodes.get(k).disp.x, z: bench.current.nodes.get(k).disp.z } : p;
      const target = nearestTarget(pos, c.x, c.z, g.id, 1.25); const info = hRef.current.onDragOver?.(g.id, target) ?? { valid: false };
      bench.current.drag = { id: g.id, x: c.x, z: c.z, targetId: target, valid: Boolean(info.valid), outside: Math.abs(gp.x) > 11 || Math.abs(gp.z) > 7 };
    };
    const end = (e, cancelled) => {
      if (!g || e.pointerId !== g.pid) return; const cur = g; g = null; try { el.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
      const d = bench.current.drag; bench.current.drag = null;
      if (!cur.started) { hRef.current.onClick?.(cur.id); return; }
      if (cancelled || d?.outside) { hRef.current.onDropFailed?.(cur.id, cancelled ? "Cancelled: the packet returned." : "Dropped outside the experiment area: the packet returned."); return; }
      hRef.current.onDrop?.(cur.id, d?.targetId ?? null, d ? { x: d.x, z: d.z } : cur.startPos);
    };
    const onUp = (e) => end(e, false); const onCancel = (e) => end(e, true);
    el.addEventListener("pointerdown", onDown, true); el.addEventListener("pointermove", onMove); el.addEventListener("pointerup", onUp); el.addEventListener("pointercancel", onCancel); el.addEventListener("lostpointercapture", onCancel);
    return () => { el.removeEventListener("pointerdown", onDown, true); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp); el.removeEventListener("pointercancel", onCancel); el.removeEventListener("lostpointercapture", onCancel); bench.current.drag = null; };
  }, [camera, gl, bench]);
  return null;
}

export const colourOfSubstance = (id) => { const s = getSubstance(id); const el = s.kind === "atom-entity" ? s.element : Object.keys(s.composition)[0]; return atomColour(el); };
export { BAG };
