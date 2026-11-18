import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { makeTexture, gaugeTexture, labelTexture, shadowTexture } from "./textures.js";
import { packetTemplates } from "../engine/packetModel.js";
import { FULL_ENTITIES } from "../engine/particles.js";
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

/** Deterministic RNG (mulberry32) so the picture is reproducible. */
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const HEAP_H = 1.3; // height of ONE mole's packed heap (jar units)

/** Densely packed, slightly jittered heap of n points at the bottom of a cylinder (radius Ra), layer by layer. */
function heapPoints(n, s, Ra, y0, rnd) {
  const pts = []; const dy = s * 0.82;
  for (let layer = 0; pts.length < n; layer += 1) {
    const off = (layer % 2) * s * 0.5; const row = [];
    for (let z = -Ra; z <= Ra; z += s * 0.87) for (let x = -Ra; x <= Ra; x += s) { const px = x + off + (Math.round(z / (s * 0.87)) % 2) * s * 0.25; if (Math.hypot(px, z) <= Ra) row.push([px + (rnd() - 0.5) * s * 0.18, y0 + layer * dy, z + (rnd() - 0.5) * s * 0.18]); }
    for (let i = row.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [row[i], row[j]] = [row[j], row[i]]; }
    for (const r of row) { if (pts.length < n) pts.push(r); }
  }
  return pts;
}

/**
 * The SAME molecules as the packed packet: n mol = n x (300/450/600) molecules (instanced).  `released` false: packed densely at the
 * bottom of the jar; true: they fly through the whole chamber.  Positions are updated directly in the instance matrices (no per-frame allocation).
 */
function GasMolecules({ substanceId, mol, detail = "medium", R, y0, heightRef, speed = 1, released, reduced, domeInset = null, onHeap, finalTop = 0 }) {
  const T = useMemo(() => packetTemplates(substanceId).species[0], [substanceId]);
  const els = useMemo(() => [...new Set(T.atoms.map((a) => a.el))], [T]);
  const per = FULL_ENTITIES[detail] ?? 450; const count = Math.max(1, Math.round(per * mol));
  const Ra = R * 0.86; const d = Math.cbrt((Math.PI * Ra * Ra * HEAP_H) / per); const k = d * 0.5 * (T.atoms.length > 1 ? 1.48 : 1.04);
  const sim0 = { heapTop: 0 };
  const sim = useMemo(() => {
    const r = rng(7919 + count); const home = heapPoints(count, d * 0.98, Ra, y0 + k * 1.1, r);
    const pos = new Float32Array(count * 3); const vel = new Float32Array(count * 3); const hm = new Float32Array(count * 3);
    const q = new Float32Array(count * 4); const w = new Float32Array(count * 3); const delay = new Float32Array(count); const st = new Uint8Array(count);
    const topY = home.reduce((m, h) => Math.max(m, h[1]), 0); sim0.heapTop = topY + k * 1.3;
    for (let i = 0; i < count; i += 1) {
      for (let c = 0; c < 3; c += 1) { hm[i * 3 + c] = home[i][c]; pos[i * 3 + c] = home[i][c]; }
      const u = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28)); q.set([u.x, u.y, u.z, u.w], i * 4);
      for (let c = 0; c < 3; c += 1) w[i * 3 + c] = (r() - 0.5) * 3;
      delay[i] = (1 - home[i][1] / Math.max(0.1, topY)) * 0.9 + r() * 0.5; // top of the heap leaves first
    }
    return { pos, vel, hm, q, w, delay, st, r, t: 0, wasReleased: null, init: false, heapTop: sim0.heapTop };
  }, [count, d, Ra, y0, k]);
  useEffect(() => { onHeap?.(sim.heapTop); }, [sim]); // eslint-disable-line
  const sphere = useMemo(() => new THREE.SphereGeometry(1, detail === "low" ? 12 : 16, detail === "low" ? 8 : 12), [detail]);
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1, false), []);
  const mats = useMemo(() => Object.fromEntries(els.map((el) => { const l = lookOf(el); return [el, new THREE.MeshPhysicalMaterial({ color: l.color, metalness: l.metal, roughness: l.rough, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: l.pearl ? 0.9 : 1.3, iridescence: l.pearl ? 0.4 : 0 })]; })), [els]);
  const bondMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: BOND_COLOUR, metalness: 0.1, roughness: 0.35 }), []);
  useEffect(() => () => { sphere.dispose(); cyl.dispose(); Object.values(mats).forEach((m) => m.dispose()); bondMat.dispose(); }, [sphere, cyl, mats, bondMat]);
  const refs = useRef({}); const bref = useRef();
  const tpl = useMemo(() => {
    const ord = {}; const atoms = T.atoms.map((a) => { ord[a.el] = (ord[a.el] ?? 0) + 1; return { ...a, ord: ord[a.el] - 1 }; });
    const bonds = T.bonds.map((b) => { const A = T.atoms[b.a], B = T.atoms[b.b]; const v = new THREE.Vector3(B.x - A.x, B.y - A.y, B.z - A.z); const len = v.length();
      return { mid: new THREE.Vector3((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2), len, qb: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()), rad: Math.min(A.r, B.r) * 0.42 }; });
    return { atoms, bonds, perEl: ord };
  }, [T]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), dq: new THREE.Quaternion(), s: new THREE.Vector3(), a: new THREE.Vector3(), id: new THREE.Quaternion(), ax: new THREE.Vector3() }), []);
  useLayoutEffect(() => { for (const m of Object.values(refs.current)) if (m) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if (bref.current) bref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }, [sim, mats]);
  const scatter = (i, top0) => { const top = Math.max(top0, finalTop); const S = sim; const rr = Math.sqrt(S.r()) * (R * 0.86 - k * 1.6); const th = S.r() * 6.283; S.pos[i * 3] = Math.cos(th) * rr; S.pos[i * 3 + 2] = Math.sin(th) * rr; S.pos[i * 3 + 1] = y0 + k * 1.6 + S.r() * Math.max(0.3, top - y0 - k * 3.2); };
  const kick = (i) => { const S = sim; const th = S.r() * 6.283, ph = Math.acos(2 * S.r() - 1); const v = 1.5 * speed * (0.6 + 0.8 * S.r()) * (reduced ? 0.3 : 1); S.vel[i * 3] = Math.sin(ph) * Math.cos(th) * v; S.vel[i * 3 + 1] = Math.cos(ph) * v; S.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * v; };
  useFrame((_, dtRaw) => {
    const S = sim; const dt = Math.min(dtRaw, maxDt()); const top = (reduced && released ? Math.max(heightRef.current, finalTop) : heightRef.current) - (domeInset ?? R * 0.45) - k * 1.2; const bot = y0 + k * 1.2; const lim = R * 0.9 - k * 1.5; // reduced motion: the piston is already at its final height const bot = y0 + k * 1.2; const lim = R * 0.9 - k * 1.5;
    if (!S.init) { S.init = true; S.wasReleased = released; if (released) for (let i = 0; i < count; i += 1) { scatter(i, top); kick(i); S.st[i] = 1; } }
    if (S.wasReleased !== released) { S.wasReleased = released; S.t = 0; if (released && reduced) for (let i = 0; i < count; i += 1) { scatter(i, top); kick(i); S.st[i] = 1; } }
    S.t += dt; const pull = Math.min(1, dt * 4);
    for (let i = 0; i < count; i += 1) {
      const o = i * 3; let st = S.st[i];
      if (released) { if (st !== 1 && (st === 2 || S.t > S.delay[i])) { st = 1; S.st[i] = 1; kick(i); } } else if (st === 1) { st = 2; S.st[i] = 2; }
      if (st === 1) {
        S.pos[o] += S.vel[o] * dt; S.pos[o + 1] += S.vel[o + 1] * dt; S.pos[o + 2] += S.vel[o + 2] * dt;
        const rr = Math.hypot(S.pos[o], S.pos[o + 2]);
        if (rr > lim) { const nx = S.pos[o] / rr, nz = S.pos[o + 2] / rr; const dd = S.vel[o] * nx + S.vel[o + 2] * nz; if (dd > 0) { S.vel[o] -= 2 * dd * nx; S.vel[o + 2] -= 2 * dd * nz; } S.pos[o] = nx * lim; S.pos[o + 2] = nz * lim; }
        if (S.pos[o + 1] < bot) { S.pos[o + 1] = bot; S.vel[o + 1] = Math.abs(S.vel[o + 1]); } else if (S.pos[o + 1] > top) { S.pos[o + 1] = top; S.vel[o + 1] = -Math.abs(S.vel[o + 1]); }
        tmp.ax.set(S.w[o], S.w[o + 1], S.w[o + 2]); const ang = tmp.ax.length() * dt * speed; if (ang > 0) { tmp.dq.setFromAxisAngle(tmp.ax.normalize(), ang); tmp.q.set(S.q[i * 4], S.q[i * 4 + 1], S.q[i * 4 + 2], S.q[i * 4 + 3]).premultiply(tmp.dq); S.q[i * 4] = tmp.q.x; S.q[i * 4 + 1] = tmp.q.y; S.q[i * 4 + 2] = tmp.q.z; S.q[i * 4 + 3] = tmp.q.w; }
      } else if (st === 2) {
        const f = reduced ? 1 : pull; for (let c = 0; c < 3; c += 1) S.pos[o + c] += (S.hm[o + c] - S.pos[o + c]) * f; if (S.pos[o + 1] > top) S.pos[o + 1] = top;
        if (Math.abs(S.pos[o] - S.hm[o]) + Math.abs(S.pos[o + 1] - S.hm[o + 1]) + Math.abs(S.pos[o + 2] - S.hm[o + 2]) < 0.02) { S.st[i] = 0; for (let c = 0; c < 3; c += 1) S.pos[o + c] = S.hm[o + c]; }
      }
      tmp.q.set(S.q[i * 4], S.q[i * 4 + 1], S.q[i * 4 + 2], S.q[i * 4 + 3]);
      for (let j = 0; j < tpl.atoms.length; j += 1) {
        const a = tpl.atoms[j]; tmp.a.set(a.x, a.y, a.z).multiplyScalar(k).applyQuaternion(tmp.q); tmp.p.set(S.pos[o] + tmp.a.x, S.pos[o + 1] + tmp.a.y, S.pos[o + 2] + tmp.a.z); tmp.s.setScalar(a.r * k);
        tmp.m.compose(tmp.p, tmp.id, tmp.s); const mesh = refs.current[a.el]; if (mesh) mesh.setMatrixAt(i * tpl.perEl[a.el] + a.ord, tmp.m);
      }
      for (let j = 0; j < tpl.bonds.length; j += 1) {
        const b = tpl.bonds[j]; tmp.a.copy(b.mid).multiplyScalar(k).applyQuaternion(tmp.q); tmp.p.set(S.pos[o] + tmp.a.x, S.pos[o + 1] + tmp.a.y, S.pos[o + 2] + tmp.a.z);
        tmp.dq.copy(tmp.q).multiply(b.qb); tmp.s.set(b.rad * k, b.len * k, b.rad * k); tmp.m.compose(tmp.p, tmp.dq, tmp.s); if (bref.current) bref.current.setMatrixAt(i * tpl.bonds.length + j, tmp.m);
      }
    }
    for (const m of Object.values(refs.current)) if (m) m.instanceMatrix.needsUpdate = true; if (bref.current) bref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      {els.map((el) => <instancedMesh key={el + substanceId + count + detail} ref={(m) => { refs.current[el] = m; }} args={[sphere, mats[el], count * tpl.perEl[el]]} frustumCulled={false} />)}
      {tpl.bonds.length > 0 && <instancedMesh key={"b" + substanceId + count + detail} ref={bref} args={[cyl, bondMat, count * tpl.bonds.length]} frustumCulled={false} />}
    </group>
  );
}

/** Test hook only: the longest simulated step per frame (s).  Software GL runs at ~1 fps; verification raises this to step the clock. */
const maxDt = () => globalThis.__ML_DT_MAX ?? 0.05;
export const PISTON_UNITS_PER_24 = 2.6; // piston travel for 24 dm3
export const gasHeight = (volumeDm3) => PISTON_UNITS_PER_24 * (volumeDm3 / 24);
const volumeTexture = (maxDm3, h) => makeTexture(160, 512, (g, w, H) => {
  g.clearRect(0, 0, w, H); g.fillStyle = "rgba(30,50,90,0.85)"; g.strokeStyle = "rgba(30,50,90,0.75)"; g.font = "600 34px system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
  for (let v = 6; v <= maxDm3 + 0.01; v += 6) { const y = H - (v / maxDm3) * H; const major = v % 12 === 0; g.lineWidth = major ? 5 : 3; g.beginPath(); g.moveTo(w * 0.05, y); g.lineTo(w * (major ? 0.42 : 0.28), y); g.stroke(); if (major) g.fillText(String(v), w * 0.48, y); }
  void h;
});

/**
 * Gas cylinder with a movable PISTON (constant external pressure, constant T): the gas starts packed under the piston at its low position;
 * "released", the same molecules spread out and the piston rises until the volume is the RTP volume of this amount, then stays there.
 * The live volume readout on the base counts up with the piston height (V = height / 2.6 x 24 dm3).
 */
export function GasCylinder({ gasId, volumeDm3, mol = 1, detail = "medium", released = false, label, highlight, dark = false, reduced = false, position = [0, 0, 0], speedFactor = 1 }) {
  const R = 1.35; const base = 0.38; const finalH = gasHeight(volumeDm3); const tubeH = finalH + 0.4;
  const heapTop = useRef(base + 1.3 * mol + 0.25); const pist = useRef(base + 1.3 * mol + 0.25); const topRef = useRef(pist.current);
  const grp = useRef(); const sealRef = useRef(); const lastTxt = useRef("");
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial(glass(dark)), [dark]);
  const labelTex = useMemo(() => labelTexture({ main: label }), [label]); const atmTex = useMemo(() => labelTexture({ main: "1 atm" }), []);
  const scaleTex = useMemo(() => volumeTexture(Math.round(tubeH / PISTON_UNITS_PER_24 * 24), tubeH), [tubeH]);
  const canvas = useMemo(() => { const c = document.createElement("canvas"); c.width = 512; c.height = 160; return c; }, []);
  const dispTex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t; }, [canvas]);
  const sh = useMemo(() => shadowTexture(), []);
  useEffect(() => () => { glassMat.dispose(); labelTex.dispose(); atmTex.dispose(); scaleTex.dispose(); dispTex.dispose(); sh.dispose(); }, [glassMat, labelTex, atmTex, scaleTex, dispTex, sh]);
  const paint = (txt) => { const g = canvas.getContext("2d"); g.fillStyle = "#0e3a44"; g.fillRect(0, 0, 512, 160); g.fillStyle = "#e8fbff"; g.font = "700 92px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 256, 82); dispTex.needsUpdate = true; };
  useLayoutEffect(() => { lastTxt.current = ""; }, [dispTex]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, maxDt()); const target = released ? base + finalH : heapTop.current + 0.05; let h = pist.current;
    h = reduced || Math.abs(target - h) < 0.004 ? target : h + (target - h) * Math.min(1, dt * (released ? 1.25 : 2.4)); pist.current = h; topRef.current = h;
    if (grp.current) grp.current.position.y = h;
    const v = ((h - base) / PISTON_UNITS_PER_24) * 24; const txt = `${v.toFixed(1)} dm³`; if (txt !== lastTxt.current) { lastTxt.current = txt; paint(txt); }
  });
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}><planeGeometry args={[R * 3.6, 3.2]} /><meshBasicMaterial map={sh} transparent opacity={0.7} depthWrite={false} /></mesh>
      <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[R + 0.28, R + 0.36, 0.28, 48]} /><meshStandardMaterial {...steel} roughness={0.3} /></mesh>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[R + 0.12, R + 0.2, 0.06, 48]} /><meshStandardMaterial color="#9aa1ad" metalness={1} roughness={0.25} /></mesh>
      <mesh position={[0, 0.15, R + 0.36]}><planeGeometry args={[1.75, 0.54]} /><meshBasicMaterial map={dispTex} toneMapped={false} /></mesh>
      <mesh position={[0, base + tubeH / 2, 0]} renderOrder={3}><cylinderGeometry args={[R, R, tubeH, 56, 1, true]} /><primitive object={glassMat} attach="material" /></mesh>
      <mesh position={[0, base + tubeH, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[R + 0.015, 0.045, 12, 56]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[0, base + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[R + 0.02, 0.05, 12, 56]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[R * 0.7, base + tubeH / 2, Math.sqrt(R * R * 0.51) + 0.02]} rotation={[0, Math.asin(0.7), 0]} renderOrder={4}><planeGeometry args={[0.8, tubeH]} /><meshBasicMaterial map={scaleTex} transparent depthWrite={false} toneMapped={false} /></mesh>
      <group ref={grp} position={[0, pist.current, 0]}>
        <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[R - 0.03, R - 0.03, 0.24, 56]} /><meshStandardMaterial {...steel} /></mesh>
        <mesh ref={sealRef} position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[R - 0.03, 0.055, 10, 56]} /><meshStandardMaterial color="#20242c" roughness={0.6} /></mesh>
        <mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.085, 0.085, 0.9, 16]} /><meshStandardMaterial {...steel} /></mesh>
        <mesh position={[0, 1.15, 0]}><sphereGeometry args={[0.2, 24, 16]} /><meshStandardMaterial color="#2b2f38" roughness={0.45} metalness={0.3} /></mesh>
        <mesh position={[0, 0.13, R + 0.07]} renderOrder={5}><planeGeometry args={[0.8, 0.4]} /><meshBasicMaterial map={atmTex} transparent toneMapped={false} depthWrite={false} /></mesh>
        <mesh position={[0, 1.7, R + 0.2]} renderOrder={5}><planeGeometry args={[1.1, 0.55]} /><meshBasicMaterial map={labelTex} transparent toneMapped={false} depthWrite={false} /></mesh>
      </group>
      {highlight && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[R + 0.5, R + 0.62, 56]} /><meshBasicMaterial color="#6d7dff" transparent opacity={0.6} depthWrite={false} /></mesh>}
      <GasMolecules substanceId={gasId} mol={mol} detail={detail} released={released} reduced={reduced} R={R} y0={base} heightRef={topRef} domeInset={0} speed={speedFactor} onHeap={(y) => { heapTop.current = y; }} finalTop={base + finalH} />
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
      <mesh ref={liq} renderOrder={1}><cylinderGeometry args={[BEAKER.R - 0.04, BEAKER.R - 0.04, 1, 48]} /><meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.25} transparent opacity={0.3} roughness={0.25} depthWrite={false} /></mesh>
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
