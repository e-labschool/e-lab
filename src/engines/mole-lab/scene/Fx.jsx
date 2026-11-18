import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lookOf } from "./palette.js";
import { packetTemplates } from "../engine/packetModel.js";

const rnd = (i, k) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

const smooth01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
/** Display size (scene units) per ion: a design convention (cations are smaller than anions); atoms and bonds come from the engine's ion templates. */
const ION_SIZE = { Na: 0.1, Cl: 0.15, OH: 0.3 };

/**
 * Dissolved ions in a cylinder of liquid, drawn from the ENGINE's ion templates (so OH- is an O sphere with its H bonded to it, Na+ a separate sphere).
 * The NUMBER of ions never depends on the volume: a bigger liquid volume only spreads the same ions out (dilution).
 *   revealRef 0..1   ions appear (at the entry point, where the solid went in)
 *   diffuseRef 0..1  0 = all ions still bunched at the entry point, 1 = uniformly spread through the whole liquid (randomised arrival times)
 * Ions then keep moving with a gentle Ornstein-Uhlenbeck random walk (Brownian-looking, bounded).  `reduced`: no random motion.
 */
export function IonCloud({ soluteId = "NaOH", perSpecies, R, y0, heightRef, revealRef, diffuseRef, entry = [-0.1, 0, 0.2], reduced = false }) {
  const max = 460; const n = Math.min(max, perSpecies);
  const T = useMemo(() => packetTemplates(soluteId), [soluteId]);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []); const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1, false), []);
  const sp = useMemo(() => T.species.slice(0, 2).map((spc, si) => {
    const size = ION_SIZE[spc.atoms.length > 1 ? "OH" : spc.atoms[0].el] ?? 0.12; const ord = {};
    const atoms = spc.atoms.map((a) => { ord[a.el] = (ord[a.el] ?? 0) + 1; return { ...a, ord: ord[a.el] - 1 }; });
    const bonds = spc.bonds.map((b) => { const A = spc.atoms[b.a], B = spc.atoms[b.b]; const v = new THREE.Vector3(B.x - A.x, B.y - A.y, B.z - A.z); const len = v.length(); return { mid: new THREE.Vector3((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2), len, qb: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()), rad: Math.min(A.r, B.r) * 0.42 }; });
    return { si, size, atoms, bonds, per: ord };
  }), [T]);
  const mats = useMemo(() => { const o = {}; for (const s of sp) for (const el of Object.keys(s.per)) { const l = lookOf(el); o[`${s.si}-${el}`] = new THREE.MeshPhysicalMaterial({ color: l.color, metalness: l.metal, roughness: l.rough, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: l.pearl ? 0.9 : 1.2, iridescence: l.pearl ? 0.4 : 0 }); } o.bond = new THREE.MeshPhysicalMaterial({ color: "#b9bfcb", roughness: 0.35 }); return o; }, [sp]);
  useEffect(() => () => { sphere.dispose(); cyl.dispose(); Object.values(mats).forEach((m) => m.dispose()); }, [sphere, cyl, mats]);
  const st = useMemo(() => {
    const N = max * 2; const c = new Float32Array(N * 3); const a = new Float32Array(N * 3); const ou = new Float32Array(N * 3); const lag = new Float32Array(N); const q = new Float32Array(N * 4); let sd = 4242;
    const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
    for (let i = 0; i < N; i += 1) { for (let k = 0; k < 3; k += 1) { c[i * 3 + k] = r(); a[i * 3 + k] = r(); } lag[i] = r(); const u = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28)); q.set([u.x, u.y, u.z, u.w], i * 4); }
    return { c, a, ou, lag, q, span: -1, seed: 99, N };
  }, []);
  const refs = useRef({}); const brefs = useRef({});
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), dq: new THREE.Quaternion(), s: new THREE.Vector3(), a: new THREE.Vector3(), id: new THREE.Quaternion() }), []);
  useLayoutEffect(() => { for (const m of [...Object.values(refs.current), ...Object.values(brefs.current)]) if (m) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }, [sp, mats]);
  const gauss = () => { st.seed = (Math.imul(st.seed, 1664525) + 1013904223) >>> 0; const u1 = Math.max(1e-6, st.seed / 4294967296); st.seed = (Math.imul(st.seed, 1664525) + 1013904223) >>> 0; const u2 = st.seed / 4294967296; return Math.sqrt(-2 * Math.log(u1)) * Math.cos(6.2832 * u2); };
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05); const rv = revealRef.current; const D = diffuseRef ? diffuseRef.current : 1; const goal = Math.max(0.05, heightRef.current - y0 - 0.16);
    st.span = st.span < 0 || reduced ? goal : st.span + (goal - st.span) * Math.min(1, dt * 1.6); const span = st.span; const rad0 = R - 0.26;
    const th = 1.4; const sig = reduced ? 0 : 0.35; const kOU = Math.sqrt(2 * th * dt) * sig;
    for (const s of sp) {
      for (let i = 0; i < n; i += 1) {
        const id = i + s.si * max; const o = id * 3;
        const d = smooth01(D * 1.5 - st.lag[id] * 0.5); const ang = st.a[o] * 6.2832; const rr = Math.sqrt(st.a[o + 1]) * rad0;
        const tx = Math.cos(ang) * rr, tz = Math.sin(ang) * rr, ty = y0 + 0.1 + st.a[o + 2] * span;
        const cx = entry[0] + (st.c[o] - 0.5) * 0.55, cz = entry[2] + (st.c[o + 1] - 0.5) * 0.55, cy = y0 + span + 0.12 - st.c[o + 2] * 0.35;
        if (!reduced) { for (let k = 0; k < 3; k += 1) st.ou[o + k] += -st.ou[o + k] * th * dt + kOU * gauss(); }
        const amp = 0.3 + 0.7 * d; const jx = st.ou[o] * amp, jy = st.ou[o + 1] * amp, jz = st.ou[o + 2] * amp;
        let x = cx + (tx - cx) * d + jx, y = cy + (ty - cy) * d + jy, z = cz + (tz - cz) * d + jz;
        const rxz = Math.hypot(x, z); if (rxz > rad0) { x *= rad0 / rxz; z *= rad0 / rxz; } y = Math.min(y0 + span + 0.12, Math.max(y0 + 0.08, y));
        tmp.q.set(st.q[id * 4], st.q[id * 4 + 1], st.q[id * 4 + 2], st.q[id * 4 + 3]);
        const k = s.size * Math.max(1e-4, rv);
        for (const a of s.atoms) { tmp.a.set(a.x, a.y, a.z).multiplyScalar(k).applyQuaternion(tmp.q); tmp.p.set(x + tmp.a.x, y + tmp.a.y, z + tmp.a.z); tmp.s.setScalar(Math.max(1e-4, a.r * k)); tmp.m.compose(tmp.p, tmp.id, tmp.s); refs.current[`${s.si}-${a.el}`]?.setMatrixAt(i * s.per[a.el] + a.ord, tmp.m); }
        s.bonds.forEach((b, j) => { tmp.a.copy(b.mid).multiplyScalar(k).applyQuaternion(tmp.q); tmp.p.set(x + tmp.a.x, y + tmp.a.y, z + tmp.a.z); tmp.dq.copy(tmp.q).multiply(b.qb); tmp.s.set(b.rad * k, Math.max(1e-4, b.len * k), b.rad * k); tmp.m.compose(tmp.p, tmp.dq, tmp.s); brefs.current[s.si]?.setMatrixAt(i * s.bonds.length + j, tmp.m); });
      }
      for (const a of Object.keys(s.per)) { const m = refs.current[`${s.si}-${a}`]; if (m) { m.count = n * s.per[a]; m.instanceMatrix.needsUpdate = true; } }
      const bm = brefs.current[s.si]; if (bm) { bm.count = n * s.bonds.length; bm.instanceMatrix.needsUpdate = true; }
    }
  });
  return (
    <group>
      {sp.flatMap((s) => Object.keys(s.per).map((el) => <instancedMesh key={`${soluteId}${s.si}${el}`} ref={(m) => { refs.current[`${s.si}-${el}`] = m; }} args={[sphere, mats[`${s.si}-${el}`], max * s.per[el]]} frustumCulled={false} />))}
      {sp.filter((s) => s.bonds.length > 0).map((s) => <instancedMesh key={`b${soluteId}${s.si}`} ref={(m) => { brefs.current[s.si] = m; }} args={[cyl, mats.bond, max * s.bonds.length]} frustumCulled={false} />)}
    </group>
  );
}

/** Falling particles of a pour: `src` and `dst` are world positions refs; `progressRef` 0..1 over the pour. */
export function PourStream({ count = 70, srcRef, dstRef, progressRef, colour = "#e9eef7", metal = 0.2 }) {
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []); const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: colour, metalness: metal, roughness: 0.2, clearcoat: 1 }), [colour, metal]);
  useEffect(() => () => { sphere.dispose(); mat.dispose(); }, [sphere, mat]);
  const ref = useRef(); const m4 = useMemo(() => new THREE.Matrix4(), []); const p = useMemo(() => new THREE.Vector3(), []); const q = useMemo(() => new THREE.Quaternion(), []); const sc = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const t = progressRef.current; const s = srcRef.current; const d = dstRef.current; if (!ref.current || !s || !d) return;
    let live = 0;
    for (let i = 0; i < count; i += 1) {
      const start = (i / count) * 0.7; const life = (t - start) / 0.28; if (life <= 0 || life >= 1) continue;
      const x = s[0] + (d[0] - s[0]) * life + (rnd(i, 4) - 0.5) * 0.25; const z = s[2] + (rnd(i, 5) - 0.5) * 0.25; const y = s[1] + (d[1] - s[1]) * life * life - 0.0;
      p.set(x, y, z); sc.setScalar(0.06); m4.compose(p, q, sc); ref.current.setMatrixAt(live++, m4);
    }
    ref.current.count = live; ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[sphere, mat, count]} frustumCulled={false} />;
}

/** Glowing particles that fly from the reactant packets, gather at the reaction point and settle into the product packets. */
export function Travelers({ from, to, colours, progressRef, centre = [0, 1.9, 0.5], size = 0.085 }) {
  const count = from.length; const sphere = useMemo(() => new THREE.SphereGeometry(1, 12, 9), []);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.15, metalness: 0.1, clearcoat: 1, emissive: "#8fa4ff", emissiveIntensity: 0.55, envMapIntensity: 1.2 }), []);
  useEffect(() => () => { sphere.dispose(); mat.dispose(); }, [sphere, mat]);
  const ref = useRef(); const m4 = useMemo(() => new THREE.Matrix4(), []); const p = useMemo(() => new THREE.Vector3(), []); const q = useMemo(() => new THREE.Quaternion(), []); const sc = useMemo(() => new THREE.Vector3(), []); const col = useMemo(() => new THREE.Color(), []);
  useEffect(() => { if (!ref.current) return; for (let i = 0; i < count; i += 1) ref.current.setColorAt(i, col.set(colours[i % colours.length])); if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true; }, [count, colours, col]);
  useFrame(({ clock }) => {
    const t = progressRef.current; if (!ref.current) return; const e = clock.getElapsedTime();
    for (let i = 0; i < count; i += 1) {
      const delay = rnd(i, 7) * 0.25; const u = Math.min(1, Math.max(0, (t - delay) / 0.75)); const visible = t > 0.001 && t < 0.999;
      const A = from[i], B = to[i % to.length]; let x, y, z;
      if (u < 0.5) { const k = u / 0.5; const ke = k * k * (3 - 2 * k); x = A[0] + (centre[0] + (rnd(i, 1) - 0.5) * 1.1 - A[0]) * ke; y = A[1] + (centre[1] + (rnd(i, 2) - 0.5) * 0.8 - A[1]) * ke + Math.sin(k * Math.PI) * 0.5; z = A[2] + (centre[2] + (rnd(i, 3) - 0.5) * 0.6 - A[2]) * ke; }
      else { const k = (u - 0.5) / 0.5; const ke = k * k * (3 - 2 * k); const cx = centre[0] + (rnd(i, 1) - 0.5) * 1.1, cy = centre[1] + (rnd(i, 2) - 0.5) * 0.8, cz = centre[2] + (rnd(i, 3) - 0.5) * 0.6; x = cx + (B[0] - cx) * ke; y = cy + (B[1] - cy) * ke; z = cz + (B[2] - cz) * ke; }
      p.set(x + Math.sin(e * 3 + i) * 0.03, y, z); sc.setScalar(visible && u > 0 && u < 1 ? size : 1e-4); m4.compose(p, q, sc); ref.current.setMatrixAt(i, m4);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[sphere, mat, count]} frustumCulled={false} />;
}
