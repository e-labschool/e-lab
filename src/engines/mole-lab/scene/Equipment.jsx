import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { makeTexture, gaugeTexture, labelTexture, shadowTexture } from "./textures.js";
import { packetTemplates } from "../engine/packetModel.js";
import { lookOf, BOND_COLOUR } from "./palette.js";

const steel = { color: "#c5cad3", metalness: 1, roughness: 0.28, envMapIntensity: 1.5 };
export const PAN_TOP_Y = 1.16;
export const panWidthFor = (packets) => Math.max(1, packets) * 2.75 + 0.6;

/** Realistic digital laboratory balance: stainless pan on a post, sloped housing with a dark glass display, TARE and power buttons. */
export function Balance({ packets = 1, text = "0.00", unit = "g", dark = false }) {
  const W = panWidthFor(packets);
  const bodyW = W + 0.9;
  const canvas = useMemo(() => { const c = document.createElement("canvas"); c.width = 768; c.height = 256; return c; }, []);
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }, [canvas]);
  useEffect(() => () => tex.dispose(), [tex]);
  useLayoutEffect(() => {
    const g = canvas.getContext("2d"); const w = 768, h = 256;
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#0b1624"); bg.addColorStop(1, "#04080f"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.shadowColor = "#6fe6ff"; g.shadowBlur = 26; g.fillStyle = "#c9f7ff"; g.textBaseline = "middle"; g.textAlign = "right"; g.font = "700 158px 'Courier New', ui-monospace, monospace"; g.fillText(text, w - 160, h * 0.52);
    g.font = "600 84px system-ui, sans-serif"; g.textAlign = "left"; g.fillText(unit, w - 142, h * 0.6); tex.needsUpdate = true;
  }, [canvas, tex, text, unit]);
  const profile = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(1.25, 0); s.lineTo(1.25, 0.22); s.lineTo(0.62, 0.8); s.lineTo(-1, 0.8); s.lineTo(-1, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: bodyW, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, steps: 1 });
    g.rotateY(-Math.PI / 2); g.translate(bodyW / 2, 0, 0); return g;
  }, [bodyW]);
  useEffect(() => () => profile.dispose(), [profile]);
  const sh = useMemo(() => shadowTexture(), []); useEffect(() => () => sh.dispose(), [sh]);
  const slope = Math.atan2(0.58, 0.63);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.1]}><planeGeometry args={[bodyW + 1.6, 4.2]} /><meshBasicMaterial map={sh} transparent opacity={0.65} depthWrite={false} /></mesh>
      <mesh geometry={profile} position={[0, 0.07, -0.25]}><meshStandardMaterial {...steel} color={dark ? "#9aa3b3" : "#d2d6de"} roughness={0.34} /></mesh>
      {[-1, 1].flatMap((sx) => [-0.55, 1.0].map((z) => <mesh key={sx + "" + z} position={[sx * (bodyW / 2 - 0.3), 0.035, z - 0.1]}><cylinderGeometry args={[0.15, 0.17, 0.08, 20]} /><meshStandardMaterial color="#20242c" roughness={0.6} /></mesh>))}
      {/* display (sloped front) */}
      <group position={[0, 0.07 + 0.5, 0.78]} rotation={[-slope, 0, 0]}>
        <RoundedBox args={[Math.min(3.4, bodyW * 0.62), 0.74, 0.04]} radius={0.06} smoothness={3}><meshStandardMaterial color="#05080e" roughness={0.12} metalness={0.4} /></RoundedBox>
        <mesh position={[0, 0, 0.026]}><planeGeometry args={[Math.min(3.25, bodyW * 0.6), 0.62]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
        <mesh position={[0, 0, 0.012]}><planeGeometry args={[Math.min(3.4, bodyW * 0.62) + 0.07, 0.81]} /><meshBasicMaterial color="#6fe6ff" transparent opacity={0.5} toneMapped={false} /></mesh>
        <mesh position={[-Math.min(3.4, bodyW * 0.62) / 2 - 0.45, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.14, 0.14, 0.05, 24]} /><meshStandardMaterial color="#2a2f3a" roughness={0.3} metalness={0.5} /></mesh>
        <mesh position={[Math.min(3.4, bodyW * 0.62) / 2 + 0.45, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.17, 0.17, 0.05, 24]} /><meshStandardMaterial color="#2a2f3a" roughness={0.3} metalness={0.5} /></mesh>
      </group>
      <mesh position={[0, PAN_TOP_Y - 0.24, -0.2]}><cylinderGeometry args={[0.28, 0.34, 0.3, 24]} /><meshStandardMaterial color="#8d949f" metalness={1} roughness={0.35} /></mesh>
      <RoundedBox args={[W, 0.09, 2.3]} radius={0.04} smoothness={3} position={[0, PAN_TOP_Y - 0.045, -0.2]}><meshStandardMaterial {...steel} color={dark ? "#aab2c0" : "#dfe3ea"} roughness={0.22} /></RoundedBox>
    </group>
  );
}

const glass = (dark) => ({ color: dark ? "#bcd4ff" : "#eef6ff", transparent: true, opacity: dark ? 0.14 : 0.12, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.3, side: THREE.DoubleSide, depthWrite: false });

/** Moving molecules inside a region (cylinder of radius R, from y0 to the live height).  n molecules, speed scaled by `speed`. */
function MovingMolecules({ substanceId, count, R, y0, heightRef, speed = 1, size = 0.27, maxCount = 60 }) {
  const T = useMemo(() => packetTemplates(substanceId).species[0], [substanceId]);
  const els = useMemo(() => [...new Set(T.atoms.map((a) => a.el))], [T]);
  const state = useMemo(() => Array.from({ length: maxCount }, (_, i) => { const r = (k) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { u: r(2), init: false, p: [(r(1) - 0.5) * 1.6 * R, y0 + 0.3, (r(3) - 0.5) * 1.6 * R], v: [r(4) - 0.5, r(5) - 0.5, r(6) - 0.5].map((x) => x * 2), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r(7) * 6, r(8) * 6, r(9) * 6)), w: [r(10) - 0.5, r(11) - 0.5, r(12) - 0.5] }; }), [maxCount, y0, R]);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []); const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1, false), []);
  const mats = useMemo(() => Object.fromEntries(els.map((el) => { const l = lookOf(el); return [el, new THREE.MeshPhysicalMaterial({ color: l.color, metalness: l.metal, roughness: l.rough, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3 })]; })), [els]);
  const bondMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: BOND_COLOUR, metalness: 0.6, roughness: 0.3 }), []);
  useEffect(() => () => { sphere.dispose(); cyl.dispose(); Object.values(mats).forEach((m) => m.dispose()); bondMat.dispose(); }, [sphere, cyl, mats, bondMat]);
  const refs = useRef({}); const bref = useRef();
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), dq: new THREE.Quaternion(), a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05); const top = heightRef.current;
    const idx = {}; els.forEach((el) => { idx[el] = 0; }); let bi = 0;
    for (let i = 0; i < Math.min(count, maxCount); i += 1) {
      const m = state[i]; if (!m.init) { m.init = true; m.p[1] = y0 + 0.3 + m.u * Math.max(0.5, top - y0 - 0.6); }
      for (let k = 0; k < 3; k += 1) m.p[k] += m.v[k] * dt * speed;
      const lim = R - size * 1.05; const rr = Math.hypot(m.p[0], m.p[2]);
      if (rr > lim) { const nx = m.p[0] / rr, nz = m.p[2] / rr; const d = m.v[0] * nx + m.v[2] * nz; if (d > 0) { m.v[0] -= 2 * d * nx; m.v[2] -= 2 * d * nz; } m.p[0] = nx * lim; m.p[2] = nz * lim; }
      if (m.p[1] < y0 + size * 1.1) { m.p[1] = y0 + size * 1.1; m.v[1] = Math.abs(m.v[1]); } if (m.p[1] > top - size * 1.1) { m.p[1] = top - size * 1.1; m.v[1] = -Math.abs(m.v[1]); }
      tmp.dq.setFromEuler(new THREE.Euler(m.w[0] * dt * speed * 3, m.w[1] * dt * speed * 3, m.w[2] * dt * speed * 3)); m.q.multiply(tmp.dq);
      const wp = T.atoms.map((a) => { tmp.a.set(a.x, a.y, a.z).applyQuaternion(m.q).multiplyScalar(size).add(tmp.b.set(m.p[0], m.p[1], m.p[2])); return { el: a.el, p: tmp.a.clone(), r: a.r * size }; });
      for (const a of wp) { const mesh = refs.current[a.el]; if (!mesh) continue; tmp.s.setScalar(a.r); tmp.m.compose(a.p, tmp.q.identity(), tmp.s); mesh.setMatrixAt(idx[a.el]++, tmp.m); }
      for (const b of T.bonds) { const A = wp[b.a].p, B = wp[b.b].p; tmp.p.copy(A).add(B).multiplyScalar(0.5); tmp.a.copy(B).sub(A); const len = tmp.a.length(); tmp.q.setFromUnitVectors(tmp.up, tmp.a.normalize()); tmp.s.set(Math.min(wp[b.a].r, wp[b.b].r) * 0.42, len, Math.min(wp[b.a].r, wp[b.b].r) * 0.42); tmp.m.compose(tmp.p, tmp.q, tmp.s); bref.current?.setMatrixAt(bi++, tmp.m); }
    }
    for (const el of els) { const mesh = refs.current[el]; if (mesh) { mesh.count = idx[el]; mesh.instanceMatrix.needsUpdate = true; } }
    if (bref.current) { bref.current.count = bi; bref.current.instanceMatrix.needsUpdate = true; }
  });
  return (
    <group>
      {els.map((el) => <instancedMesh key={el} ref={(m) => { refs.current[el] = m; }} args={[sphere, mats[el], maxCount * T.atoms.length]} frustumCulled={false} />)}
      {T.bonds.length > 0 && <instancedMesh ref={bref} args={[cyl, bondMat, maxCount * T.bonds.length]} frustumCulled={false} />}
    </group>
  );
}

/** Glass bell-jar gas chamber on a steel base with a pressure gauge.  Height is proportional to the gas volume (V / 24 dm3 x 2.6). */
export function BellJar({ gasId, volumeDm3, molecules, label, display, highlight, dark = false, reduced = false, position = [0, 0, 0], speedFactor = 1 }) {
  const R = 1.35; const base = 0.38;
  const hRef = useRef(null); const target = Math.max(0.7, 2.6 * (volumeDm3 / 24));
  if (hRef.current === null) hRef.current = target;
  const body = useRef(); const dome = useRef(); const topGrp = useRef(); const rim = useRef(); const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial(glass(dark)), [dark]);
  const liveTop = useRef(base + target); const gaugeTex = useMemo(() => gaugeTexture("atm"), []);
  const labelTex = useMemo(() => labelTexture({ main: label }), [label]);
  const dispTex = useMemo(() => makeTexture(512, 160, (g, w, h) => { g.fillStyle = "#0e3a44"; g.fillRect(0, 0, w, h); g.fillStyle = "#e8fbff"; g.font = "700 96px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(display, w / 2, h / 2); }), [display]);
  const sh = useMemo(() => shadowTexture(), []);
  useEffect(() => () => { glassMat.dispose(); gaugeTex.dispose(); labelTex.dispose(); dispTex.dispose(); sh.dispose(); }, [glassMat, gaugeTex, labelTex, dispTex, sh]);
  useFrame((_, dt) => {
    const h = hRef.current; const nh = reduced || Math.abs(target - h) < 0.004 ? target : h + (target - h) * Math.min(1, dt * 4); hRef.current = nh;
    if (body.current) { body.current.scale.y = nh; body.current.position.y = base + nh / 2; }
    if (dome.current) dome.current.position.y = base + nh; if (topGrp.current) topGrp.current.position.y = base + nh; liveTop.current = base + nh + R * 0.86;
  });
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}><planeGeometry args={[R * 3.6, 3.2]} /><meshBasicMaterial map={sh} transparent opacity={0.7} depthWrite={false} /></mesh>
      <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[R + 0.28, R + 0.36, 0.28, 48]} /><meshStandardMaterial {...steel} roughness={0.3} /></mesh>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[R + 0.12, R + 0.2, 0.06, 48]} /><meshStandardMaterial color="#9aa1ad" metalness={1} roughness={0.25} /></mesh>
      <mesh position={[0, 0.15, R + 0.36]} rotation={[-0.0, 0, 0]}><planeGeometry args={[1.65, 0.5]} /><meshBasicMaterial map={dispTex} toneMapped={false} /></mesh>
      <mesh ref={body} renderOrder={3}><cylinderGeometry args={[R, R, 1, 56, 1, true]} /><primitive object={glassMat} attach="material" /></mesh>
      <mesh ref={rim} position={[0, base + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[R + 0.02, 0.05, 12, 56]} /><meshStandardMaterial {...steel} /></mesh>
      <group ref={dome}><mesh renderOrder={3} scale={[1, 0.86, 1]}><sphereGeometry args={[R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><primitive object={glassMat} attach="material" /></mesh></group>
      <group ref={topGrp}>
        <mesh position={[0, R * 0.86 + 0.18, 0]}><cylinderGeometry args={[0.13, 0.18, 0.36, 20]} /><meshStandardMaterial {...steel} /></mesh>
        <mesh position={[0, R * 0.86 + 0.78, 0.04]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.4, 0.4, 0.12, 40]} /><meshStandardMaterial {...steel} /></mesh>
        <mesh position={[0, R * 0.86 + 0.78, 0.115]}><circleGeometry args={[0.36, 40]} /><meshBasicMaterial map={gaugeTex} toneMapped={false} /></mesh>
      </group>
      <mesh position={[0, 1.55, R * 0.97]} rotation={[0, 0, 0]} renderOrder={5}><planeGeometry args={[1.05, 0.52]} /><meshBasicMaterial map={labelTex} transparent toneMapped={false} depthWrite={false} /></mesh>
      {highlight && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[R + 0.5, R + 0.62, 56]} /><meshBasicMaterial color="#6d7dff" transparent opacity={0.6} depthWrite={false} /></mesh>}
      <MovingMolecules substanceId={gasId} count={molecules} R={R} y0={base} heightRef={liveTop} speed={speedFactor} />
    </group>
  );
}

function gradTexture(maxMl) {
  return makeTexture(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = "rgba(30,50,90,0.75)"; g.fillStyle = "rgba(30,50,90,0.85)"; g.font = "600 30px system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
    const steps = maxMl / 50; for (let i = 1; i <= steps; i += 1) { const y = h - (i / steps) * h * 0.94 - h * 0.03; const major = i % 2 === 0 || steps <= 5; g.lineWidth = major ? 4 : 3; g.beginPath(); g.moveTo(w * 0.1, y); g.lineTo(w * (major ? 0.45 : 0.32), y); g.stroke(); if (major) g.fillText(String(i * 50), w * 0.5, y); }
  });
}
export const BEAKER = Object.freeze({ R: 1.25, H: 3.0, maxMl: 500, floor: 0.12 });
export const levelY = (ml) => BEAKER.floor + (ml / BEAKER.maxMl) * (BEAKER.H * 0.9 - BEAKER.floor);

/** Graduated glass beaker with a liquid column (volume in mL sets the level; `levelRef` lets the scene animate it). */
export function Beaker({ volumeMl, liquidRef, dark = false, tint = "#4aa8ff", position = [0, 0, 0], label }) {
  const tex = useMemo(() => gradTexture(BEAKER.maxMl), []); useEffect(() => () => tex.dispose(), [tex]);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial(glass(dark)), [dark]); useEffect(() => () => mat.dispose(), [mat]);
  const sh = useMemo(() => shadowTexture(), []); useEffect(() => () => sh.dispose(), [sh]);
  const liq = useRef(); const surf = useRef(); const level = useRef(levelY(volumeMl)); const lab = useMemo(() => (label ? labelTexture({ main: label }) : null), [label]);
  useEffect(() => () => lab?.dispose(), [lab]);
  useFrame((_, dt) => {
    const t = liquidRef?.current != null ? liquidRef.current : levelY(volumeMl); level.current += (t - level.current) * Math.min(1, dt * 5);
    const y = Math.max(0.02, level.current - BEAKER.floor);
    if (liq.current) { liq.current.scale.y = y; liq.current.position.y = BEAKER.floor + y / 2; } if (surf.current) surf.current.position.y = level.current;
  });
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}><planeGeometry args={[4, 3.2]} /><meshBasicMaterial map={sh} transparent opacity={0.65} depthWrite={false} /></mesh>
      <mesh ref={liq} renderOrder={1}><cylinderGeometry args={[BEAKER.R - 0.04, BEAKER.R - 0.04, 1, 48]} /><meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.3} transparent opacity={0.62} roughness={0.25} depthWrite={false} /></mesh>
      <mesh ref={surf} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[BEAKER.R - 0.04, 48]} /><meshStandardMaterial color="#cfe8ff" emissive="#9fd0ff" emissiveIntensity={0.3} transparent opacity={0.55} roughness={0.1} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, BEAKER.H / 2, 0]} renderOrder={3}><cylinderGeometry args={[BEAKER.R, BEAKER.R, BEAKER.H, 56, 1, true]} /><primitive object={mat} attach="material" /></mesh>
      <mesh position={[0, 0.06, 0]} renderOrder={3}><cylinderGeometry args={[BEAKER.R, BEAKER.R, 0.12, 56]} /><primitive object={mat} attach="material" /></mesh>
      <mesh position={[0, BEAKER.H, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[BEAKER.R, 0.035, 10, 56]} /><meshPhysicalMaterial color="#eef6ff" transparent opacity={0.5} roughness={0.05} clearcoat={1} envMapIntensity={2} /></mesh>
      <mesh position={[0, BEAKER.floor + (BEAKER.H * 0.9 - BEAKER.floor) / 2, BEAKER.R + 0.012]} rotation={[0, 0, 0]} renderOrder={4}><planeGeometry args={[BEAKER.R * 1.6, (BEAKER.H * 0.9 - BEAKER.floor) * 1.0]} /><meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} opacity={0.9} /></mesh>
      {lab && <mesh position={[0, BEAKER.H + 0.42, 0]} renderOrder={5}><planeGeometry args={[1.5, 0.75]} /><meshBasicMaterial map={lab} transparent toneMapped={false} depthWrite={false} /></mesh>}
    </group>
  );
}

/** Decorative volumetric flask (bench prop; the lab computes concentration from the FINAL volume, the flask is how that volume is made up). */
export function Flask({ position = [0, 0, 0], dark = false }) {
  const prof = useMemo(() => { const pts = []; const R = 0.7; for (let i = 0; i <= 20; i += 1) { const a = (i / 20) * Math.PI * 0.92; pts.push(new THREE.Vector2(Math.sin(a) * R, 0.72 - Math.cos(a) * 0.7)); } pts.push(new THREE.Vector2(0.16, 1.9)); pts.push(new THREE.Vector2(0.16, 2.9)); pts.push(new THREE.Vector2(0.2, 3.0)); return new THREE.LatheGeometry(pts, 40); }, []);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial(glass(dark)), [dark]); const sh = useMemo(() => shadowTexture(), []);
  useEffect(() => () => { prof.dispose(); mat.dispose(); sh.dispose(); }, [prof, mat, sh]);
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}><planeGeometry args={[2.8, 2.2]} /><meshBasicMaterial map={sh} transparent opacity={0.6} depthWrite={false} /></mesh>
      <mesh geometry={prof} renderOrder={3}><primitive object={mat} attach="material" /></mesh>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.62, 0.62, 0.8, 36]} /><meshStandardMaterial color="#4aa8ff" emissive="#4aa8ff" emissiveIntensity={0.3} transparent opacity={0.6} roughness={0.25} depthWrite={false} /></mesh>
      <mesh position={[0, 2.25, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.17, 0.012, 8, 24]} /><meshBasicMaterial color="#1f3a7a" /></mesh>
    </group>
  );
}
