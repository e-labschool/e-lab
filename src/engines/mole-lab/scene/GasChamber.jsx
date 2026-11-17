import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MoleculeBatch } from "./molBatch.js";
import { makeTexture } from "./textures.js";
import { entityTemplates, rng } from "../engine/rearrange.js";

// STAGE 4 -- the transparent gas chamber: a vertical syringe-like barrel with a free, weighted piston, a filling funnel, a graduated
// scale (dm3), a live T / P / V panel, and CONTINUOUSLY MOVING random molecules (no gravity: they never settle at the bottom).
//
// THE DRAWING NEVER DECIDES CHEMISTRY.  Everything it shows comes from `live.current` (filled from the engine's gasLabState):
//   volumeDm3 -> piston height,  n -> the number of drawn molecules (PER_MOL per mole, the same for every gas, so the number density
//   of the picture is constant at constant T and P),  T and the molar mass -> molecule speed (v ~ sqrt(T / M)),  pKPa -> weights.
// An interrupted animation changes nothing: the store already holds the amounts.

export const CH = Object.freeze({ R: 1.0, y0: 0.2, L: 4.6, perMol: 12, funnel: { x: -2.15, y: 3.05 }, port: { y: 0.62 } });
const GAS_SCALE = 0.72;
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const easeOut = (t) => 1 - (1 - t) ** 3;
const _q = new THREE.Quaternion(); const _v = new THREE.Vector3(); const _ax = new THREE.Vector3();

function lcdTexture(t) {
  return makeTexture(512, 512, (g, W, H) => {
    g.fillStyle = "#0b1a19"; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(120,255,220,0.08)"); gr.addColorStop(1, "rgba(0,0,0,0.3)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const mono = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
    g.fillStyle = "rgba(127,243,210,0.62)"; g.font = `600 30px ${mono}`; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(t.title, 28, 40);
    g.fillStyle = "rgba(127,243,210,0.4)"; g.fillRect(24, 68, W - 48, 2);
    g.fillStyle = "#7ff3d2"; g.font = `700 92px ${mono}`; g.textAlign = "right"; g.fillText(t.v, W - 28, 142); g.fillStyle = "rgba(127,243,210,0.62)"; g.font = `600 28px ${mono}`; g.textAlign = "left"; g.fillText("VOLUME", 28, 190);
    const row = (label, val, y) => { g.fillStyle = "rgba(127,243,210,0.62)"; g.font = `600 28px ${mono}`; g.textAlign = "left"; g.fillText(label, 28, y); g.fillStyle = "#7ff3d2"; g.font = `700 50px ${mono}`; g.textAlign = "right"; g.fillText(val, W - 28, y + 4); };
    row("TEMP", t.t, 262); row("PRESS", t.p, 336); row("AMOUNT", t.n, 410);
    g.fillStyle = "rgba(127,243,210,0.5)"; g.font = `600 24px ${mono}`; g.textAlign = "left"; g.fillText(t.note, 28, 474);
  });
}

export default function GasChamber({ home, bench, live, zoneId = "chamber", reduced, dark }) {
  const { invalidate } = useThree();
  const batch = useMemo(() => new MoleculeBatch({ maxAtoms: 480, maxBonds: 300, maxLabels: 16 }), []);
  const pistonRef = useRef(); const weightsRef = useRef(); const ringRef = useRef(); const heatRef = useRef(); const lcdRef = useRef(); const lcdMat = useRef();
  const sim = useRef({ parts: [], init: false, spawnT: 0, dispV: 0, dispScale: 100, vs: 1, gas: null, tpl: null, lcdKey: "", t: 0, ring: 0 });
  useEffect(() => () => { batch.dispose(); }, [batch]);
  useEffect(() => { // pseudo-node: the funnel is where a packet pours
    const node = { obj: { mouthWorld: (v) => v.set(home.x + CH.funnel.x, CH.funnel.y, home.z), hit: new THREE.Object3D(), field: null }, disp: { x: home.x + CH.funnel.x, z: home.z }, home: { x: home.x + CH.funnel.x, z: home.z } };
    bench.current.nodes.set(zoneId, node); return () => { bench.current.nodes.delete(zoneId); };
  }, [bench, home.x, home.z, zoneId]);
  useEffect(() => () => { lcdMat.current?.map?.dispose(); }, []);

  useFrame((state, dtRaw) => {
    const S = sim.current; const L = live.current; if (!L) return; const dt = Math.min(dtRaw, 0.3); S.t += dt; const slow = reduced ? 0.35 : 1;
    // ---- template for the current gas (molecule shape from the substance table)
    if (S.gas !== L.gasId) { S.gas = L.gasId; S.tpl = entityTemplates(L.gasId)[0]; S.parts = []; S.init = false; }
    // ---- piston (volume) and scale: damped display values toward the engine's numbers
    if (!S.init) { S.dispV = L.volumeDm3; S.dispScale = L.scale; } else if (reduced) { S.dispV = L.volumeDm3; S.dispScale = L.scale; } else { S.dispV = damp(S.dispV, L.volumeDm3, 3.2, dt); S.dispScale = damp(S.dispScale, L.scale, 3.2, dt); }
    const frac = Math.min(0.99, S.dispV / S.dispScale); const yp = CH.y0 + 0.14 + frac * CH.L;
    if (pistonRef.current) pistonRef.current.position.y = yp;
    // ---- number of drawn molecules: PER_MOL per mole, the same for every gas
    const target = L.n > 0 ? Math.max(1, Math.round(L.n * CH.perMol)) : 0;
    const alive = S.parts.filter((p) => !p.dying);
    const speed0 = 0.3 * Math.sqrt(L.tK / L.molarMass) * slow; S.vs = S.init ? damp(S.vs, speed0, 2.5, dt) : speed0;
    const rIn = CH.R - 0.1; const lo = CH.y0 + 0.14; let idCounter = S.parts.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const mk = (i, atInlet) => {
      const r = rng(`gas:${i}`); const u = 0.55 + 0.9 * r(); const th = r() * Math.PI * 2; const rr = Math.sqrt(r()) * (rIn - 0.2);
      const dirv = [r() - 0.5, r() - 0.5, r() - 0.5]; const dl = Math.hypot(...dirv) || 1;
      const p = { id: i, u, x: Math.cos(th) * rr, y: lo + 0.15 + r() * Math.max(0.2, yp - lo - 0.35), z: Math.sin(th) * rr, vx: dirv[0] / dl, vy: dirv[1] / dl, vz: dirv[2] / dl, axis: [r() - 0.5, r() - 0.5, r() - 0.5], ang: r() * 6.28, w: (r() - 0.5) * 4, born: S.t, dying: false, dieAt: 0 };
      if (atInlet) { p.x = -rIn + 0.18; p.y = CH.port.y; p.z = 0; p.vx = 1; p.vy = (r() - 0.5) * 0.5; p.vz = (r() - 0.5) * 0.5; }
      return p;
    };
    if (!S.init) { for (let i = 0; i < target; i += 1) S.parts.push(mk(idCounter++, false)); S.init = true; }
    else if (alive.length < target) { // new gas enters through the funnel, one molecule at a time (instantly with reduced motion)
      S.spawnT -= dt; const need = target - alive.length;
      if (reduced) for (let i = 0; i < need; i += 1) S.parts.push(mk(idCounter++, false));
      else { let left = need; while (S.spawnT <= 0 && left > 0) { S.parts.push(mk(idCounter++, true)); left -= 1; S.spawnT += Math.max(0.035, 0.7 / Math.max(need, 8)); } if (S.spawnT < -1) S.spawnT = 0; }
    } else if (alive.length > target) { for (let k = 0; k < alive.length - target; k += 1) { const p = alive[alive.length - 1 - k]; p.dying = true; p.dieAt = S.t; } }
    S.parts = S.parts.filter((p) => !(p.dying && S.t - p.dieAt > 0.45));
    // ---- motion: straight flights, elastic collisions with the wall and the piston, no gravity, constant speed per molecule
    const nsub = Math.max(1, Math.ceil(dt / 0.04)); const h = dt / nsub;
    for (let sub = 0; sub < nsub; sub += 1) for (const p of S.parts) {
      const sp = S.vs * p.u; p.x += p.vx * sp * h; p.y += p.vy * sp * h; p.z += p.vz * sp * h; p.ang += p.w * h * (0.4 + S.vs * 0.25);
      const rad = Math.hypot(p.x, p.z); const lim = rIn - 0.12;
      if (rad > lim) { const nx = p.x / rad; const nz = p.z / rad; const dn = p.vx * nx + p.vz * nz; if (dn > 0) { p.vx -= 2 * dn * nx; p.vz -= 2 * dn * nz; } p.x = nx * lim; p.z = nz * lim; }
      const top = yp - 0.14; if (p.y > top) { p.y = Math.max(lo + 0.12, top); if (p.vy > 0) p.vy = -p.vy; }
      if (p.y < lo + 0.12) { p.y = lo + 0.12; if (p.vy < 0) p.vy = -p.vy; }
    }
    // ---- draw
    batch.begin(); const T = S.tpl;
    for (const p of S.parts) {
      const grow = p.dying ? 1 - easeOut(Math.min(1, (S.t - p.dieAt) / 0.45)) : Math.min(1, 0.2 + (S.t - p.born) * 3);
      _ax.set(p.axis[0], p.axis[1], p.axis[2]).normalize(); _q.setFromAxisAngle(_ax, p.ang);
      const pts = T.atoms.map((a) => { _v.set(a.x * GAS_SCALE, a.y * GAS_SCALE, a.z * GAS_SCALE).applyQuaternion(_q); return [p.x + _v.x, p.y + _v.y, p.z + _v.z]; });
      T.atoms.forEach((a, i) => batch.atom(a.el, pts[i][0], pts[i][1], pts[i][2], a.r * GAS_SCALE * grow));
      for (const b of T.bonds) { const A = pts[b.a]; const B = pts[b.b]; const n = b.order; const rad = 0.032 * grow; if (n === 1) batch.bond(A[0], A[1], A[2], B[0], B[1], B[2], rad); else { _v.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]); const off = _v.clone().cross(_ax.set(0.3, 0.8, 0.5)).normalize().multiplyScalar(0.05); for (let k = 0; k < n; k += 1) { const o = (k - (n - 1) / 2) * 1; batch.bond(A[0] + off.x * o, A[1] + off.y * o, A[2] + off.z * o, B[0] + off.x * o, B[1] + off.y * o, B[2] + off.z * o, rad * 0.7); } } }
    }
    // graduated scale on the right of the barrel: tick values come from the engine's scale, positions follow the displayed scale
    const sc = L.scale; for (let k = 0; k <= 10; k += 1) {
      const val = (sc / 10) * k; const y = CH.y0 + 0.14 + (val / S.dispScale) * CH.L; if (y > CH.y0 + 0.14 + CH.L + 0.05) continue; const major = k % 2 === 0;
      batch.bond(CH.R + 0.06, y, 0, CH.R + (major ? 0.26 : 0.17), y, 0, 0.012);
      if (major) batch.label(String(Math.round(val)), CH.R + 0.5, y, 0, 0.17, 0.95, { fg: "#e8f0ff", bg: "rgba(20,30,60,0.85)" });
    }
    batch.label("dm³", CH.R + 0.5, CH.y0 + 0.14 + CH.L + 0.32, 0, 0.18, 0.95, { fg: "#9fb3d9", bg: "rgba(20,30,60,0.0)" });
    batch.end();
    // weights on the piston: more weight = more pressure (the piston is free to move at constant pressure)
    if (weightsRef.current) { const nW = Math.max(1, Math.min(6, Math.round(L.pKPa / 50))); weightsRef.current.children.forEach((c, i) => { c.visible = i < nW; }); }
    // temperature strip: cool blue to warm orange (display only)
    if (heatRef.current) { const k = Math.min(1, Math.max(0, (L.tK - 220) / 280)); heatRef.current.material.color.setRGB(0.25 + 0.7 * k, 0.55 - 0.1 * k + 0.0, 0.95 - 0.8 * k); }
    // drop-target glow
    const dr = bench.current.drag; const pr = bench.current.pour; const hot = (dr && typeof dr.targetId === "string" && dr.targetId.startsWith(`${zoneId}#`) && dr.valid) || (pr && pr.dst === zoneId);
    S.ring = damp(S.ring, hot ? 0.9 : 0, 14, dt); if (ringRef.current) { ringRef.current.material.opacity = S.ring; ringRef.current.visible = S.ring > 0.02; }
    // LCD panel
    const key = `${L.lcd.v}|${L.lcd.t}|${L.lcd.p}|${L.lcd.n}|${L.lcd.note}`;
    if (key !== S.lcdKey && lcdMat.current) { S.lcdKey = key; lcdMat.current.map?.dispose(); lcdMat.current.map = lcdTexture({ title: L.lcd.title, ...L.lcd }); lcdMat.current.needsUpdate = true; }
    if (!reduced || S.t < 1) invalidate();
  });

  const glass = dark ? "#cfe0ff" : "#e6eeff";
  return (
    <group position={[home.x, 0, home.z]}>
      {/* base plate with a temperature strip */}
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[CH.R + 0.3, CH.R + 0.36, 0.2, 56]} /><meshStandardMaterial color={dark ? "#3b4666" : "#59658a"} roughness={0.45} metalness={0.3} envMapIntensity={0.9} /></mesh>
      <mesh ref={heatRef} position={[0, 0.215, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[CH.R + 0.05, 0.028, 8, 56]} /><meshBasicMaterial color="#6fb0ff" toneMapped={false} /></mesh>
      <mesh ref={ringRef} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[CH.R + 0.5, CH.R + 0.72, 56]} /><meshBasicMaterial color="#2fb67a" transparent opacity={0} depthWrite={false} toneMapped={false} /></mesh>
      {/* the barrel (glass) */}
      <mesh position={[0, CH.y0 + 0.14 + CH.L / 2 + 0.1, 0]} renderOrder={6}><cylinderGeometry args={[CH.R, CH.R, CH.L + 0.2, 64, 1, true]} /><meshPhysicalMaterial color={glass} transparent opacity={0.13} roughness={0.04} metalness={0} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={1.6} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh position={[0, CH.y0 + 0.14 + CH.L + 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[CH.R + 0.015, 0.03, 8, 64]} /><meshStandardMaterial color={dark ? "#b9c4e6" : "#8d9ac0"} roughness={0.3} metalness={0.4} /></mesh>
      <mesh position={[0, CH.y0 + 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[CH.R + 0.015, 0.035, 8, 64]} /><meshStandardMaterial color={dark ? "#b9c4e6" : "#8d9ac0"} roughness={0.3} metalness={0.4} /></mesh>
      <mesh position={[-CH.R * 0.62, CH.y0 + 0.14 + CH.L / 2, CH.R * 0.74]} renderOrder={7}><planeGeometry args={[0.07, CH.L * 0.86]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[CH.R * 0.5, CH.y0 + 0.14 + CH.L / 2, CH.R * 0.86]} renderOrder={7}><planeGeometry args={[0.035, CH.L * 0.6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} toneMapped={false} /></mesh>
      {/* piston + weights */}
      <group ref={pistonRef} position={[0, CH.y0 + 0.14, 0]}>
        <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[CH.R - 0.03, CH.R - 0.03, 0.14, 48]} /><meshStandardMaterial color="#38466a" roughness={0.5} metalness={0.25} /></mesh>
        <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[CH.R - 0.04, 0.035, 8, 48]} /><meshStandardMaterial color="#1e2742" roughness={0.7} /></mesh>
        <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[CH.R - 0.12, CH.R - 0.12, 0.03, 48]} /><meshStandardMaterial color="#9aa6c9" roughness={0.3} metalness={0.5} envMapIntensity={1} /></mesh>
        <group ref={weightsRef}>{[0, 1, 2, 3, 4, 5].map((i) => (<mesh key={i} position={[0, 0.25 + i * 0.13, 0]}><cylinderGeometry args={[0.62 - i * 0.01, 0.62 - i * 0.01, 0.12, 36]} /><meshStandardMaterial color={i % 2 ? "#7d89ad" : "#97a3c4"} roughness={0.35} metalness={0.55} envMapIntensity={1} /></mesh>))}</group>
      </group>
      {/* funnel and filling tube to the port at the bottom of the barrel */}
      <group position={[CH.funnel.x, 0, 0]}>
        <mesh position={[0, CH.funnel.y - 0.25, 0]} renderOrder={6}><cylinderGeometry args={[0.52, 0.12, 0.5, 40, 1, true]} /><meshPhysicalMaterial color={glass} transparent opacity={0.28} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} envMapIntensity={1.4} /></mesh>
        <mesh position={[0, (CH.funnel.y - 0.5 + CH.port.y) / 2, 0]} renderOrder={6}><cylinderGeometry args={[0.1, 0.1, CH.funnel.y - 0.5 - CH.port.y, 20, 1, true]} /><meshPhysicalMaterial color={glass} transparent opacity={0.3} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[(-CH.funnel.x - CH.R) / 2 + 0.0, CH.port.y, 0]} rotation={[0, 0, Math.PI / 2]} renderOrder={6}><cylinderGeometry args={[0.1, 0.1, -CH.funnel.x - CH.R, 20, 1, true]} /><meshPhysicalMaterial color={glass} transparent opacity={0.3} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, CH.port.y, 0]}><sphereGeometry args={[0.13, 16, 12]} /><meshStandardMaterial color="#8793b5" roughness={0.35} metalness={0.5} /></mesh>
        <mesh position={[0.9, CH.port.y + 0.14, 0]}><cylinderGeometry args={[0.07, 0.07, 0.26, 14]} /><meshStandardMaterial color="#c93a3f" roughness={0.4} /></mesh>
        <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.32, 0.38, 0.12, 24]} /><meshStandardMaterial color={dark ? "#3b4666" : "#59658a"} roughness={0.5} metalness={0.3} /></mesh>
      </group>
      {/* instrument panel */}
      <group position={[CH.R + 2.35, 0, 0.2]} rotation={[0, -0.1, 0]}>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[2.3, 2.3, 0.3]} /><meshStandardMaterial color="#2b3246" roughness={0.45} metalness={0.2} /></mesh>
        <mesh ref={lcdRef} position={[0, 1.2, 0.16]}><planeGeometry args={[2.1, 2.1]} /><meshBasicMaterial ref={lcdMat} toneMapped={false} /></mesh>
        <mesh position={[0, 0.06, 0.04]}><boxGeometry args={[2.5, 0.12, 0.7]} /><meshStandardMaterial color="#2b3246" roughness={0.55} /></mesh>
      </group>
      <primitive object={batch.group} />
    </group>
  );
}
