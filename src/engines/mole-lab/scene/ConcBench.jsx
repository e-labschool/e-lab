import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import LabCanvas from "./LabCanvas.jsx";
import Balance3D from "./Balance3D.jsx";
import { PacketNode, PourDirector, PointerController } from "./BenchScene.jsx";
import { GlassVesselObject, WATER } from "./glassObject.js";
import { labLayout } from "./labLayout.js";
import { fitDistance } from "./benchLayout.js";
import { atomColour } from "../engine/particles.js";
import { detectWebGL } from "../../shared-3d/webgl.js";

// The Concentration Laboratory bench: glassware, balance, tap, stirring rod and the packet, wired to the shared pour machinery.
// RULE (same as every Mole Lab scene): nothing in here writes chemistry.  Every object READS the store-derived props and animates a
// DISPLAY value towards them; the only writes are the dispatches made by useLabInteraction.
//
// Animation timeline helpers live on `bench.current`:
//   pour : the packet -> beaker solid pour (PourDirector from BenchScene.jsx)
//   flow : { from, to, phase: "in" | "pour" | "out", t, dur }  a liquid transfer between two vessels (source tilts over the destination)
//   stir : { t, dur }  the stirring rod circling
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const THETA = 1.15;
const FLOW_IN = 0.55; const FLOW_OUT = 0.5;
const _a = new THREE.Vector3(); const _b = new THREE.Vector3(); const _c = new THREE.Vector3();
const flowK = (f) => (f.phase === "in" ? ease(f.t / FLOW_IN) : f.phase === "pour" ? 1 : 1 - ease(f.t / FLOW_OUT));

/** Local clipping is what keeps a tilted vessel's liquid surface horizontal (see glassObject.js). */
function EnableClipping() {
  const { gl } = useThree();
  useEffect(() => { const prev = gl.localClippingEnabled; gl.localClippingEnabled = true; return () => { gl.localClippingEnabled = prev; }; }, [gl]);
  return null;
}

/** One vessel: reads its level from props, takes the pouring pose from bench.flow. */
function LabVessel({ id, kind, capacityMl, home, bench, level, label, dark, reduced, hideCard = false, children }) {
  const obj = useMemo(() => new GlassVesselObject({ kind, capacityMl, dark }), [kind, capacityMl, dark]); // eslint-disable-line react-hooks/exhaustive-deps
  const disp = useRef({ x: home.x, y: 0, z: home.z, level, tilt: 0, ring: 0, k: 0 });
  const live = useRef({}); live.current = { level, home, label, reduced, hideCard };
  useEffect(() => {
    bench.current.nodes.set(id, { obj, disp: disp.current, home: live.current.home, vessel: true });
    obj.group.position.set(disp.current.x, 0, disp.current.z); obj.setLevel(disp.current.level);
    return () => { bench.current.nodes.delete(id); obj.dispose(); };
  }, [obj, id, bench]);
  useEffect(() => { const n = bench.current.nodes.get(id); if (n) n.home = home; }, [home, id, bench]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05); const L = live.current; const d = disp.current; const b = bench.current; const f = b.flow;
    const role = f ? (f.from === id ? "src" : f.to === id ? "dst" : null) : null;
    const hold = Boolean(role && f.phase === "in");
    if (!hold) { if (L.reduced) d.level = L.level; else { d.level = damp(d.level, L.level, 3.2, dt); if (Math.abs(d.level - L.level) < 0.04) d.level = L.level; } }
    let tx = L.home.x; let ty = 0; let tz = L.home.z; let tilt = 0;
    if (role === "src") {
      const dn = b.nodes.get(f.to);
      if (dn) {
        const k = flowK(f); const lip = obj.lipLocal(_a); const c = Math.cos(THETA); const s = Math.sin(THETA);
        const lx = lip.x * c + lip.y * s; const ly = -lip.x * s + lip.y * c;
        dn.obj.mouthWorld(_b); const px = _b.x - lx; const py = _b.y + 0.3 - ly; const pz = dn.disp.z;
        tx = L.home.x + (px - L.home.x) * k; ty = py * k; tz = L.home.z + (pz - L.home.z) * k; tilt = THETA * k;
        d.x = tx; d.z = tz; d.y = ty;
      }
    } else if (L.reduced) { d.x = tx; d.z = tz; d.y = 0; } else { d.x = damp(d.x, tx, 7, dt); d.z = damp(d.z, tz, 7, dt); d.y = damp(d.y, 0, 9, dt); }
    d.tilt = tilt;
    if (Math.abs(obj.level - d.level) > 0.004 || obj.liquid.visible !== d.level > 0.001) obj.setLevel(d.level);
    obj.setPose(d.x, d.y, d.z, d.tilt);
    const isTarget = (b.drag && b.drag.targetId === id && b.drag.valid) || (b.pour && b.pour.dst === id) || role === "dst";
    d.ring = damp(d.ring, isTarget ? 0.9 : 0, 14, dt); obj.setRing("#2fb67a", d.ring);
    if (L.label) obj.setLabel(L.label.text, L.label.sub); obj.setCardVisible(!L.hideCard && Math.abs(tilt) < 0.2);
  });
  return <primitive object={obj.group}>{typeof children === "function" ? children({ obj, disp }) : children}</primitive>;
}

/** The pile of undissolved solid on the bottom of the beaker; shrinks as the solid dissolves; a faint plume rises while stirring. */
function SolidPile({ bench, solidMol, reduced, obj, colour }) {
  const N = 110; const PLUME = 36;
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []); const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f6f4ee", roughness: 0.55, metalness: 0, envMapIntensity: 0.7 }), []);
  const plumeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }), []);
  const pellets = useMemo(() => { const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; m.count = 0; return m; }, [geo, mat]);
  const plume = useMemo(() => { const m = new THREE.InstancedMesh(geo, plumeMat, PLUME); m.frustumCulled = false; m.count = 0; return m; }, [geo, plumeMat]);
  const pos = useMemo(() => Array.from({ length: N }, (_, i) => { const a = i * 2.399963; const rr = 0.052 * Math.sqrt(i + 1); const h = 0.16 * (1 - Math.min(1, rr / 0.56)) ** 1.3; return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: 0.17 + h + ((i * 37) % 7) * 0.004, s: 0.052 + ((i * 13) % 5) * 0.006, ry: a }; }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const st = useRef({ mol: solidMol, shown: -1 }); const live = useRef({}); live.current = { solidMol, reduced };
  useEffect(() => { obj.group.add(pellets, plume); return () => { obj.group.remove(pellets, plume); geo.dispose(); mat.dispose(); plumeMat.dispose(); pellets.dispose(); plume.dispose(); }; }, [obj, pellets, plume, geo, mat, plumeMat]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05); const L = live.current; const s = st.current; const target = L.solidMol;
    if (L.reduced) s.mol = target; else if (target > s.mol) s.mol = Math.min(target, s.mol + 0.45 * dt); else s.mol = damp(s.mol, target, 1.15, dt); if (Math.abs(s.mol - target) < 0.002) s.mol = target;
    const count = Math.min(N, Math.round(s.mol * N)); const visible = s.mol > 0.0005 ? Math.max(1, count) : 0;
    if (visible !== s.shown) {
      s.shown = visible;
      for (let i = 0; i < visible; i += 1) { const p = pos[i]; dummy.position.set(p.x, p.y, p.z); dummy.scale.set(p.s, p.s * 0.62, p.s); dummy.rotation.set(0, p.ry, 0); dummy.updateMatrix(); pellets.setMatrixAt(i, dummy.matrix); }
      pellets.count = visible; pellets.instanceMatrix.needsUpdate = true;
    }
    // plume: while the pile shrinks and the rod is stirring, faint motes rise from it and fade (they carry no concentration information)
    const stirring = bench.current.stir && !L.reduced; const shrinking = s.mol > target + 0.004;
    if ((stirring || shrinking) && s.mol > 0.003) {
      const T = performance.now() / 1000; let n = 0;
      for (let i = 0; i < PLUME; i += 1) { const life = ((T * 0.7 + i / PLUME) % 1); const a = i * 2.4; const rr = 0.1 + 0.3 * life; dummy.position.set(Math.cos(a + T) * rr, 0.25 + life * 1.0, Math.sin(a + T) * rr); dummy.scale.setScalar(0.028 * (1 - life)); dummy.updateMatrix(); plume.setMatrixAt(n, dummy.matrix); n += 1; }
      plume.count = n; plume.instanceMatrix.needsUpdate = true;
    } else plume.count = 0;
  });
  void colour; return null;
}

/** The glass stirring rod: leans on the rim at rest, circles in the liquid while bench.stir runs, and is lifted out while the beaker pours. */
function StirRod({ bench, obj, reduced }) {
  const geo = useMemo(() => new THREE.CylinderGeometry(0.03, 0.03, 1, 10), []); const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: 0xeaf5ff, transparent: true, opacity: 0.5, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.8, depthWrite: false }), []);
  const rod = useMemo(() => { const m = new THREE.Mesh(geo, mat); m.renderOrder = 12; return m; }, [geo, mat]);
  const rim = obj.v.height; const R = obj.v.rIn[obj.v.rIn.length - 1];
  useEffect(() => { obj.group.add(rod); return () => { obj.group.remove(rod); geo.dispose(); mat.dispose(); }; }, [obj, rod, geo, mat]);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []); const tip = useMemo(() => new THREE.Vector3(), []); const top = useMemo(() => new THREE.Vector3(), []); const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const b = bench.current; const f = b.flow; rod.visible = !(f && (f.from === "beakerA" || f.from === "beakerB"));
    let phi = 0; let amp = 0; const sr = b.stir;
    if (sr && !reduced) { sr.t += Math.min(dt, 0.05); const k = Math.min(ease(sr.t / 0.35), 1 - ease((sr.t - (sr.dur - 0.4)) / 0.4)); phi = (sr.t / 0.8) * Math.PI * 2; amp = k; if (sr.t >= sr.dur) { b.stir = null; b.onStirDone?.(); } }
    // rest pose: tip on the bottom near the wall, top leaning out over the rim; stirring: the tip circles, the top stays near the rim
    const restTip = [R * 0.62, 0.17, 0.05]; const orbit = [Math.cos(phi) * R * 0.45, 0.22, Math.sin(phi) * R * 0.45];
    tip.set(restTip[0] + (orbit[0] - restTip[0]) * amp, restTip[1] + (orbit[1] - restTip[1]) * amp, restTip[2] + (orbit[2] - restTip[2]) * amp);
    top.set(R * (0.95 - 0.55 * amp) + R * 0.2, rim + 0.38, 0.05 * (1 - amp) + Math.sin(phi) * 0.05 * amp);
    dir.subVectors(top, tip); const len = dir.length(); rod.scale.set(1, len, 1); rod.position.copy(tip).addScaledVector(dir, 0.5); rod.quaternion.setFromUnitVectors(up, dir.normalize());
  });
  return null;
}

/** Chrome tap on the back wall; remembers where its spout is so the stream can start there. */
function Tap({ bench, x, z, cylX, cylZ }) {
  const g = useMemo(() => new THREE.Group(), []);
  const mats = useMemo(() => ({ chrome: new THREE.MeshStandardMaterial({ color: 0xdfe5ef, metalness: 0.9, roughness: 0.22, envMapIntensity: 1.2 }), dark: new THREE.MeshStandardMaterial({ color: 0x4a5878, roughness: 0.5 }) }), []);
  useEffect(() => {
    const geos = []; const add = (geo, mat, pos, rot) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); g.add(m); return m; };
    add(new THREE.CylinderGeometry(0.34, 0.4, 0.14, 24), mats.dark, [0, 0.07, 0]);
    add(new THREE.CylinderGeometry(0.075, 0.075, 3.0, 16), mats.chrome, [0, 1.6, 0]);
    add(new THREE.SphereGeometry(0.1, 16, 12), mats.chrome, [0, 3.12, 0]);
    const arm = cylZ - z; add(new THREE.CylinderGeometry(0.065, 0.065, arm, 14), mats.chrome, [cylX - x, 3.12, arm / 2], [Math.PI / 2, 0, 0]);
    add(new THREE.SphereGeometry(0.09, 14, 10), mats.chrome, [cylX - x, 3.12, arm]);
    add(new THREE.CylinderGeometry(0.06, 0.05, 0.24, 12), mats.chrome, [cylX - x, 2.98, arm]);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), mats.dark, [0.12, 3.3, 0], [0, 0, Math.PI / 2]);
    return () => { geos.forEach((q) => q.dispose()); g.clear(); };
  }, [g, mats, x, z, cylX, cylZ]);
  useEffect(() => () => { mats.chrome.dispose(); mats.dark.dispose(); }, [mats]);
  useEffect(() => { bench.current.tapSpout = new THREE.Vector3(cylX, 2.86, cylZ); }, [bench, cylX, cylZ]);
  return <group position={[x, 0, z]}><primitive object={g} /></group>;
}

/** A thin stream of liquid from the source (lip / tap / wash-bottle nozzle) into the destination while a flow is in its "pour" phase. */
function LiquidStreams({ bench }) {
  const geo = useMemo(() => new THREE.CylinderGeometry(0.034, 0.026, 1, 10, 1, true), []);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: WATER, transparent: true, opacity: 0.62, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }), []);
  const mesh = useMemo(() => { const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 13; return m; }, [geo, mat]);
  const nozzleG = useMemo(() => new THREE.CylinderGeometry(0.05, 0.1, 0.5, 12), []); const nozzleM = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xf2f5fb, roughness: 0.35 }), []);
  const nozzle = useMemo(() => { const m = new THREE.Mesh(nozzleG, nozzleM); m.visible = false; return m; }, [nozzleG, nozzleM]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); nozzleG.dispose(); nozzleM.dispose(); }, [geo, mat, nozzleG, nozzleM]);
  useFrame(() => {
    const b = bench.current; const f = b.flow; mesh.visible = false; nozzle.visible = false;
    if (!f) return; const dn = b.nodes.get(f.to); if (!dn) return;
    let src = null;
    if (f.from === "tap") src = b.tapSpout ?? null;
    else if (f.from === "wash") { dn.obj.mouthWorld(_c); src = _c.clone().add(new THREE.Vector3(0.5, 0.95, 0)); nozzle.visible = f.phase !== "out" || f.t < 0.2; nozzle.position.set(src.x + 0.33, src.y + 0.2, src.z); nozzle.rotation.set(0, 0, 0.8); }
    else { const sn = b.nodes.get(f.from); if (sn) { sn.obj.lipWorld(_b); src = _b.clone(); } }
    if (!src || f.phase !== "pour") return;
    dn.obj.mouthWorld(_a); const surf = dn.obj.level > 0.001 ? dn.obj.surfaceWorld(_c).y : dn.obj.v.base + dn.disp.y; const yEnd = Math.max(0.05, Math.min(surf, _a.y - 0.05));
    const grow = Math.min(1, f.t / 0.18) * Math.min(1, (f.dur - f.t) / 0.15 + 0.0); const len = Math.max(0.001, (src.y - yEnd) * Math.max(0.05, grow));
    mesh.visible = len > 0.02; mesh.scale.set(1 + Math.sin(f.t * 30) * 0.12, len, 1 + Math.cos(f.t * 27) * 0.12); mesh.position.set(_a.x, src.y - len / 2, _a.z);
  });
  return <><primitive object={mesh} /><primitive object={nozzle} /></>;
}

/** Falling solid during a packet -> beaker pour: pellets from the bag's mouth into the water (the chemistry commit is in the hook). */
function SolidStream({ bench, reduced }) {
  const N = 40; const geo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []); const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f6f4ee", roughness: 0.5 }), []);
  const mesh = useMemo(() => { const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; m.count = 0; return m; }, [geo, mat]); const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); mesh.dispose(); }, [geo, mat, mesh]);
  useFrame(() => {
    const b = bench.current; const p = b.pour; if (!p || p.phase !== "stream" || reduced) { mesh.count = 0; return; }
    const src = b.nodes.get(p.src); const dst = b.nodes.get(p.dst); if (!src || !dst) { mesh.count = 0; return; }
    src.obj.mouthWorld(_a); const x0 = _a.x; const y0 = _a.y; const z0 = _a.z; dst.obj.mouthWorld(_b); const x1 = _b.x; const z1 = _b.z; const yEnd = 0.3;
    const T = Math.max(0.2, p.duration); const k = Math.max(6, Math.min(N, Math.ceil(p.movedFraction * N * 1.4))); let n = 0;
    for (let i = 0; i < k; i += 1) {
      const start = (i / k) * T * 0.72; const fall = 0.55; const s = (p.t - start) / fall; if (s < 0 || s > 1) continue;
      const x = x0 + (x1 - x0) * Math.min(1, s * 1.4) + Math.sin(i * 12.9) * 0.1 * s; const z = z0 + (z1 - z0) * s + Math.cos(i * 7.7) * 0.08 * s; const y = y0 + (yEnd - y0) * s * s;
      dummy.position.set(x, y, z); dummy.scale.setScalar(0.05 + 0.012 * ((i * 7) % 3)); dummy.updateMatrix(); mesh.setMatrixAt(n, dummy.matrix); n += 1;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

/** Advances bench.flow through in / pour / out and reports completion. */
function FlowDirector({ bench, onDone }) {
  const cb = useRef(onDone); cb.current = onDone;
  useFrame((_, dtRaw) => {
    const f = bench.current.flow; if (!f) return; const dt = Math.min(dtRaw, 0.08); f.t += dt;
    if (f.phase === "in" && f.t >= FLOW_IN) { f.phase = "pour"; f.t = 0; } else if (f.phase === "pour" && f.t >= f.dur) { f.phase = "out"; f.t = 0; } else if (f.phase === "out" && f.t >= FLOW_OUT) { bench.current.flow = null; cb.current?.(f); }
  });
  return null;
}
function StirWatcher({ bench, onDone }) { useEffect(() => { bench.current.onStirDone = onDone; return () => { bench.current.onStirDone = null; }; }, [bench, onDone]); return null; }

/**
 * props: view (stage3View), scene (the Stage 3 scene), ix (useLabInteraction), detail, aspect, reduced, dark, onSlow, overlay, labels, ariaLabel, testId, fallback
 */
export default function ConcBench({ view, scene, ix, detail, aspect, reduced, dark, onSlow, overlay, labels, ariaLabel, testId, fallback, reserve = false }) {
  const kind = view.kind;
  const flaskMl = useMemo(() => ({ A: scene.data.stations.A.flaskMl, B: scene.data.stations.B?.flaskMl ?? 100 }), [scene.data.stations]);
  const lay = useMemo(() => labLayout({ kind, aspect, flaskMl }), [kind, aspect, flaskMl.A, flaskMl.B]); // eslint-disable-line react-hooks/exhaustive-deps
  const webgl = useMemo(() => detectWebGL(), []);
  const dist = fitDistance(lay.extent, aspect, 32, { height: lay.height + (reserve ? 1.3 : 0.4) });
  const focus = useMemo(() => ({ target: [(lay.extent.minX + lay.extent.maxX) / 2, lay.height * 0.33 - (reserve ? 1.3 : 0), (lay.extent.minZ + lay.extent.maxZ) / 2 * 0.5], distance: dist, nonce: 0 }), [lay, dist]);
  const posFor = (key) => ix.placement[key] ?? lay.pos[key] ?? { x: 0, z: 0 };
  const B = ix.bench;
  const layoutPos = useMemo(() => { const o = {}; for (const st of view.stations) { o[st.packet.id] = posFor(st.packet.id === scene.data.stations.A.packetId ? "balanceA" : "balanceB"); } if (kind === "single") o.beakerA = lay.pos.beaker; return o; }, [view.stations, lay, ix.placement, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!webgl) return <div className="ml-stage" data-testid={testId} data-webgl="0" aria-label={ariaLabel}>{fallback}{overlay}</div>;
  const L = (k) => labels?.[k];
  const A = view.stations[0]; const Bst = view.stations[1];
  const packetHome = (st, balId) => ix.placement[st.packet.id] ?? lay.pos[balId];
  return (
    <LabCanvas dark={dark} focus={focus} reduced={reduced} ariaLabel={ariaLabel} testId={testId} onSlow={onSlow} fallback="The apparatus is shown in 2D instead." onKeyDownCapture={(e) => { if (e.key === "Escape") ix.cancel("Cancelled."); }} overlay={overlay}>
      <EnableClipping />
      <FlowDirector bench={B} onDone={ix.flowDone} /><StirWatcher bench={B} onDone={ix.stirDone} />
      {kind !== "dilution" && view.stations.map((st, i) => {
        const balId = i === 0 ? "balanceA" : "balanceB"; const bp = lay.pos[balId];
        return (
          <group key={st.id}>
            <Balance3D minX={bp.x - 0.8} maxX={bp.x + 0.8} z={bp.z + 0.1} reading={st.text.balance} subtitle={st.text.balanceNote} dark={dark} />
            <PacketNode item={st.packet} home={packetHome(st, balId)} bench={B} detail={detail} reduced={reduced} selected={ix.selectedId === st.packet.id} subLabel={st.text.massPan} showCard />
          </group>
        );
      })}
      {(kind === "single" || kind === "dilution") && <Tap bench={B} x={lay.pos.tap.x} z={lay.pos.tap.z} cylX={lay.pos.cylinder.x} cylZ={lay.pos.cylinder.z} />}
      {(kind === "single" || kind === "dilution") && <LabVessel id="cylinder" kind="cylinder" capacityMl={100} home={lay.pos.cylinder} bench={B} level={kind === "single" ? A.exact.cylMl : view.dil.exact.cylMl} label={L("cylinder")} dark={dark} reduced={reduced} />}
      {kind === "single" && (
        <LabVessel id="beakerA" kind="beaker" capacityMl={250} home={lay.pos.beaker} bench={B} level={A.exact.waterMl} label={L("beaker")} dark={dark} reduced={reduced}>
          {({ obj }) => <><SolidPile bench={B} solidMol={A.exact.solidQ / 1e9} reduced={reduced} obj={obj} colour={atomColour("Na")} /><StirRod bench={B} obj={obj} reduced={reduced} /></>}
        </LabVessel>
      )}
      {kind === "dilution" && <LabVessel id="stock" kind="flask" capacityMl={250} home={lay.pos.stock} bench={B} level={view.dil.exact.stockVolMl} label={L("stock")} dark={dark} reduced={reduced} />}
      {kind === "single" && <LabVessel id="flaskA" kind="flask" capacityMl={flaskMl.A} home={lay.pos.flaskA} bench={B} level={A.exact.liquidMl} label={L("flaskA")} dark={dark} reduced={reduced} />}
      {kind === "dilution" && <LabVessel id="flaskA" kind="flask" capacityMl={flaskMl.A} home={lay.pos.flaskA} bench={B} level={scene.data.stations.A.liquidMl} label={L("flaskA")} dark={dark} reduced={reduced} />}
      {kind === "compare" && <>
        <LabVessel id="flaskA" kind="flask" capacityMl={flaskMl.A} home={lay.pos.flaskA} bench={B} level={A.exact.liquidMl} label={L("flaskA")} dark={dark} reduced={reduced} />
        <LabVessel id="flaskB" kind="flask" capacityMl={flaskMl.B} home={lay.pos.flaskB} bench={B} level={Bst.exact.liquidMl} label={L("flaskB")} dark={dark} reduced={reduced} />
      </>}
      <LiquidStreams bench={B} /><SolidStream bench={B} reduced={reduced} />
      <PourDirector bench={B} onCommit={ix.onCommit} onDone={ix.finishPour} />
      <PointerController bench={B} handlers={ix.handlers} layoutPos={layoutPos} />
    </LabCanvas>
  );
}
