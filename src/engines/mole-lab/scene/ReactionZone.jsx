import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MoleculeBatch } from "./molBatch.js";
import { rng } from "../engine/rearrange.js";
import { getReaction } from "../engine/reactions.js";
import { chargeText } from "../engine/formula.js";

// STAGES 5 and 6 -- the reaction zone: a glass tank holding representative molecules.  It draws a PLAN (engine/rearrange.js):
//   idle  : the molecules currently in the zone, resting and jostling (new ones drop in through the funnel);
//   run   : the same molecules travelling atom by atom from reactants to products: approach, bonds break, atoms move to NEW partners,
//           bonds form, products settle.  Atoms never appear or vanish: every drawn atom is one track of the plan.
// The picture reads `live.current`; it never decides amounts, and skipping or interrupting it changes nothing in the store.

export const ZN = Object.freeze({ half: 3.0, floor: 0.16, h: 2.5, deep: 0.82, funnel: { x: -2.2, y: 3.05 } });
export const RUN_SECONDS = 5.5;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - (1 - clamp01(t)) ** 3;
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const AMP = { g: [0.16, 1.1], l: [0.035, 1.6], aq: [0.05, 1.4], "s-metal": [0.012, 2.5], "s-ionic": [0.01, 2.5] };

export default function ReactionZone({ home, bench, live, zoneId = "zone", reduced, dark }) {
  const { invalidate } = useThree();
  const batch = useMemo(() => new MoleculeBatch({ maxAtoms: 520, maxBonds: 420, maxLabels: 40 }), []);
  const liquidRef = useRef(); const ringRef = useRef(); const flashRef = useRef();
  const S = useRef({ run: { phase: "idle", t: 0, hold: 0 }, runNonce: 0, skipNonce: 0, t: 0, seen: new Map(), init: false, wob: new Map(), liquid: 0, ring: 0, kind: null, rid: null, flash: [] }).current;
  useEffect(() => () => { batch.dispose(); }, [batch]);
  useEffect(() => {
    const node = { obj: { mouthWorld: (v) => v.set(home.x + ZN.funnel.x, ZN.funnel.y, home.z), hit: new THREE.Object3D(), field: null }, disp: { x: home.x + ZN.funnel.x, z: home.z }, home: { x: home.x + ZN.funnel.x, z: home.z } };
    bench.current.nodes.set(zoneId, node); return () => { bench.current.nodes.delete(zoneId); };
  }, [bench, home.x, home.z, zoneId]);
  const glowTex = useMemo(() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,238,190,1)"); r.addColorStop(0.4, "rgba(255,210,140,0.45)"); r.addColorStop(1, "rgba(255,200,120,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }, []);
  const flashes = useMemo(() => Array.from({ length: 6 }, () => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 })); m.renderOrder = 15; m.visible = false; m.frustumCulled = false; return m; }), [glowTex]);
  useEffect(() => () => { glowTex.dispose(); flashes.forEach((f) => f.material.dispose()); }, [glowTex, flashes]);

  const wobble = (key, kind, t) => {
    let w = S.wob.get(key); if (!w) { const r = rng(`w:${key}`); w = [r() * 6.28, r() * 6.28, r() * 6.28]; S.wob.set(key, w); }
    const [a, om] = AMP[kind] ?? AMP.g; return [a * Math.sin(om * t + w[0]), a * 0.8 * Math.sin(om * 1.3 * t + w[1]), a * 0.6 * Math.sin(om * 0.8 * t + w[2])];
  };

  useFrame((_, dtRaw) => {
    const L = live.current; if (!L || !L.idle) return; const dt = Math.min(dtRaw, 0.25); S.t += dt;
    const R = S.run; const prevPhase = R.phase;
    if (L.runNonce !== S.runNonce) { S.runNonce = L.runNonce; if (L.runPlan) { R.phase = reduced ? "hold" : "run"; R.t = reduced ? 1 : 0; R.hold = 0; } }
    if (L.skipNonce !== S.skipNonce) { S.skipNonce = L.skipNonce; if (R.phase === "run") R.t = 1; }
    if (R.phase === "run") { R.t += (dt * (L.speed ?? 1)) / RUN_SECONDS; if (R.t >= 1) { R.t = 1; R.phase = "hold"; R.hold = 0; } }
    else if (R.phase === "hold") { R.hold += dt; if (R.hold > (reduced ? 3 : 1.4)) { R.phase = "fade"; R.hold = 0; } }
    else if (R.phase === "fade") { R.hold += dt / 0.6; if (R.hold >= 1) { R.phase = "idle"; R.hold = 0; } }
    if (R.phase !== prevPhase) L.onPhase?.(R.phase);
    const run = R.phase !== "idle"; const plan = run ? L.runPlan : L.idle; if (!plan) return; const t = R.phase === "run" ? clamp01(R.t) : run ? 1 : 0;
    if (S.rid !== plan.reactionId) { S.rid = plan.reactionId; const r = getReaction(plan.reactionId); S.kind = Object.fromEntries(r.species.map((s) => [s.id, s.state === "g" ? "g" : s.state === "l" ? "l" : s.state === "aq" ? "aq" : (s.id === "MgO" ? "s-ionic" : "s-metal")])); S.seen.clear(); S.init = false; }
    const alpha = R.phase === "fade" ? 1 - R.hold : 1; const tracks = plan.tracks; const E = Math.max(1, plan.events); const span = 1 - 0.07 * (E - 1);
    const evT = (ev) => (ev < 0 ? 0 : clamp01((t - ev * 0.07) / span));
    // entity wobble (rigid jostle) at the current time
    const wob = new Map(); for (const e of plan.entities) wob.set(e.key, wobble(e.key, S.kind[e.sub], S.t));
    // arrival of new molecules through the funnel (idle only)
    const present = new Set(plan.entities.map((e) => e.key));
    for (const k of S.seen.keys()) if (!present.has(k)) S.seen.delete(k);
    if (!run) for (const e of plan.entities) if (!S.seen.has(e.key)) S.seen.set(e.key, S.init || reduced ? -100 : S.t);
    if (run) for (const e of plan.entities) S.seen.set(e.key, -100);
    S.init = true;
    const fun = [ZN.funnel.x, ZN.funnel.y - 0.6, 0.1];
    const pos = new Array(tracks.length); const scl = new Array(tracks.length).fill(1);
    tracks.forEach((trk, i) => {
      const w0 = wob.get(trk.ent0); const w1 = wob.get(trk.ent1);
      if (trk.ent0 === trk.ent1) {
        let p = [trk.p0[0] + w0[0], trk.p0[1] + w0[1], trk.p0[2] + w0[2]];
        const born = S.seen.get(trk.ent0) ?? -100; const a = (S.t - born) / 1.0;
        if (!run && a < 1) { const k = easeOut(a); p = [fun[0] + (p[0] - fun[0]) * k, fun[1] + (p[1] - fun[1]) * k + Math.sin(Math.PI * k) * 0.25, fun[2] + (p[2] - fun[2]) * k]; scl[i] = 0.4 + 0.6 * k; }
        pos[i] = p; return;
      }
      const tt = evT(trk.ev); const a0 = [trk.p0[0] + w0[0], trk.p0[1] + w0[1], trk.p0[2] + w0[2]]; const a3 = [trk.p3[0] + w1[0], trk.p3[1] + w1[1], trk.p3[2] + w1[2]];
      let p;
      if (tt < 0.28) { const s = ease(tt / 0.28); p = [0, 1, 2].map((k) => a0[k] + (trk.p1[k] - a0[k]) * s); }
      else if (tt < 0.72) { const s = ease((tt - 0.28) / 0.44); p = [0, 1, 2].map((k) => trk.p1[k] + (trk.p2[k] - trk.p1[k]) * s); p[2] += Math.sin(Math.PI * s) * 0.28; }
      else { const s = ease((tt - 0.72) / 0.28); p = [0, 1, 2].map((k) => trk.p2[k] + (a3[k] - trk.p2[k]) * s); }
      pos[i] = p;
    });
    // ---- draw atoms, bonds, charges
    batch.begin(); const gA = alpha;
    tracks.forEach((trk, i) => { const p = pos[i]; batch.atom(trk.el, p[0], p[1], p[2], trk.r * scl[i] * gA); });
    for (const b of plan.bonds) {
      const A = pos[b.a]; const B = pos[b.b]; if (!A || !B) continue; const tt = evT(tracks[b.a].ev);
      const f = b.set === 2 ? 1 : b.set === 0 ? 1 - ease((tt - 0.24) / 0.2) : ease((tt - 0.62) / 0.2); const rad = 0.036 * f * gA * Math.min(scl[b.a], scl[b.b]); if (rad < 0.004) continue;
      if (b.order === 1) batch.bond(A[0], A[1], A[2], B[0], B[1], B[2], rad);
      else { const dx = B[0] - A[0]; const dy = B[1] - A[1]; const dz = B[2] - A[2]; const px = dy * 0.5 - dz * 0.8; const py = dz * 0.3 - dx * 0.5; const pz = dx * 0.8 - dy * 0.3; const pl = Math.hypot(px, py, pz) || 1; const o = 0.045 / pl;
        for (let k = 0; k < b.order; k += 1) { const m = k - (b.order - 1) / 2; batch.bond(A[0] + px * o * m, A[1] + py * o * m, A[2] + pz * o * m, B[0] + px * o * m, B[1] + py * o * m, B[2] + pz * o * m, rad * 0.7); } }
    }
    if (gA > 0.3) tracks.forEach((trk, i) => {
      if (trk.c0 === 0 && trk.c1 === 0) return; const tt = evT(trk.ev); const ch = run && tt < 0.7 ? trk.c0 : trk.c1; if (!ch) return; const a = run ? ease((tt - 0.66) / 0.14) : 1; if (trk.c0 !== 0 && trk.c1 === trk.c0 && !run) return;
      const p = pos[i]; const txt = chargeText(ch).replace("⁺", "+").replace("⁻", "−").replace("²", "2").replace("³", "3"); batch.label(txt, p[0] + trk.r * 0.95, p[1] + trk.r * 1.0, p[2] + trk.r * 0.8, 0.2, a * gA, ch > 0 ? { fg: "#ffffff", bg: "rgba(176,58,46,0.92)" } : { fg: "#ffffff", bg: "rgba(36,84,190,0.92)" });
    });
    batch.end();
    // ---- collision flashes: one soft glow per event while its bonds are breaking (subtle, not neon)
    flashes.forEach((f, k) => { const ev = run && k < plan.events ? k : -1; if (ev < 0) { f.visible = false; return; } const tt = evT(ev); const a = Math.sin(Math.PI * clamp01((tt - 0.26) / 0.34)); f.visible = a > 0.02; f.material.opacity = 0.42 * a * gA; const c = plan.centres[ev]; f.position.set(c[0], c[1], c[2] + 0.1); f.scale.setScalar(0.9 + 0.5 * a); });
    // ---- liquid level follows the drawn liquid molecules
    let liq = 0; for (const e of plan.entities) { const kd = S.kind[e.sub]; if (kd !== "l" && kd !== "aq") continue; if (e.role === "leftover") liq += 1; else { const tt = e.event < 0 ? 0 : evT(e.event); const s = ease((tt - 0.3) / 0.4); liq += e.role === "consumed" ? 1 - s : s; } }
    const hasLiq = Object.values(S.kind).some((k) => k === "l" || k === "aq"); const target = hasLiq && liq > 0.01 ? Math.min(0.85, 0.12 + liq * 0.055) : 0; S.liquid = reduced ? target : damp(S.liquid, target, 4, dt);
    if (liquidRef.current) { liquidRef.current.visible = S.liquid > 0.02; liquidRef.current.scale.y = Math.max(0.001, S.liquid); liquidRef.current.position.y = ZN.floor + S.liquid / 2; }
    const dr = bench.current.drag; const pr = bench.current.pour; const hot = (dr && typeof dr.targetId === "string" && dr.targetId.startsWith(`${zoneId}#`) && dr.valid) || (pr && pr.dst === zoneId);
    S.ring = damp(S.ring, hot ? 0.9 : 0, 14, dt); if (ringRef.current) { ringRef.current.material.opacity = S.ring; ringRef.current.visible = S.ring > 0.02; }
    if (!reduced || S.t < 1 || run) invalidate();
  });

  const glass = dark ? "#cfe0ff" : "#e6eeff"; const tankGeo = useMemo(() => new THREE.BoxGeometry(ZN.half * 2 - 0.2, ZN.h, ZN.deep * 2), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(tankGeo), [tankGeo]);
  useEffect(() => () => { tankGeo.dispose(); edgeGeo.dispose(); }, [tankGeo, edgeGeo]);
  return (
    <group position={[home.x, 0, home.z]}>
      <mesh position={[0, ZN.floor / 2, 0]}><boxGeometry args={[ZN.half * 2 + 0.3, ZN.floor, ZN.deep * 2 + 0.3]} /><meshStandardMaterial color={dark ? "#3b4666" : "#59658a"} roughness={0.45} metalness={0.3} envMapIntensity={0.9} /></mesh>
      <mesh ref={ringRef} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[ZN.half + 0.35, ZN.half + 0.62, 4, 1, Math.PI / 4, Math.PI * 2]} /><meshBasicMaterial color="#2fb67a" transparent opacity={0} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[0, ZN.floor + ZN.h / 2, 0]} renderOrder={6}><primitive object={tankGeo} attach="geometry" /><meshPhysicalMaterial color={glass} transparent opacity={0.1} roughness={0.04} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={1.5} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <lineSegments position={[0, ZN.floor + ZN.h / 2, 0]} renderOrder={7}><primitive object={edgeGeo} attach="geometry" /><lineBasicMaterial color={dark ? "#d9e4ff" : "#7b8bb8"} transparent opacity={0.7} /></lineSegments>
      <mesh ref={liquidRef} position={[0, ZN.floor, 0]} renderOrder={5} visible={false}><boxGeometry args={[ZN.half * 2 - 0.26, 1, ZN.deep * 2 - 0.06]} /><meshPhysicalMaterial color="#6fb2ff" transparent opacity={0.32} roughness={0.15} clearcoat={0.6} envMapIntensity={1} depthWrite={false} /></mesh>
      <mesh position={[-ZN.half * 0.5, ZN.floor + ZN.h / 2, ZN.deep + 0.01]} renderOrder={8}><planeGeometry args={[0.06, ZN.h * 0.8]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.2} depthWrite={false} toneMapped={false} /></mesh>
      {/* funnel */}
      <group position={[ZN.funnel.x, 0, 0]}>
        <mesh position={[0, ZN.funnel.y - 0.25, 0]} renderOrder={6}><cylinderGeometry args={[0.52, 0.12, 0.5, 40, 1, true]} /><meshPhysicalMaterial color={glass} transparent opacity={0.28} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} envMapIntensity={1.4} /></mesh>
        <mesh position={[0, ZN.floor + ZN.h - 0.1 + (ZN.funnel.y - 0.5 - (ZN.floor + ZN.h - 0.1)) / 2, 0]} renderOrder={6}><cylinderGeometry args={[0.1, 0.1, ZN.funnel.y - 0.5 - (ZN.floor + ZN.h - 0.1), 20, 1, true]} /><meshPhysicalMaterial color={glass} transparent opacity={0.3} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      </group>
      <primitive object={batch.group} />
      {flashes.map((f, i) => <primitive key={i} object={f} />)}
      <mesh ref={flashRef} visible={false}><planeGeometry args={[0.01, 0.01]} /><meshBasicMaterial visible={false} /></mesh>
    </group>
  );
}
