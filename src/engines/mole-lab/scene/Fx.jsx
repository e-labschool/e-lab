import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lookOf } from "./palette.js";

const rnd = (i, k) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Dissolved ions in a cylinder of liquid: `perSpecies` Na+/anion ions each, drifting slowly (Brownian-looking).  `reveal` 0..1 scales them in.
 *  The NUMBER of ions never depends on the volume: a bigger liquid volume only spreads the same ions out (dilution). */
export function IonCloud({ perSpecies, R, y0, heightRef, revealRef, anion = "OH", dark = false, reduced = false }) {
  const max = 460; const n = Math.min(max, perSpecies);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []);
  const mk = (c, m = 0, r = 0.18) => new THREE.MeshPhysicalMaterial({ color: c, metalness: m, roughness: r, clearcoat: 1, envMapIntensity: 1.2 });
  const mats = useMemo(() => ({ na: mk(lookOf("Na").color), o: mk(lookOf("O").color), h: mk(lookOf("H").color), cl: mk(lookOf("Cl").color) }), []); // eslint-disable-line
  useEffect(() => () => { sphere.dispose(); Object.values(mats).forEach((m) => m.dispose()); }, [sphere, mats]);
  const na = useRef(), a1 = useRef(), a2 = useRef(); const m4 = useMemo(() => new THREE.Matrix4(), []); const p = useMemo(() => new THREE.Vector3(), []); const q = useMemo(() => new THREE.Quaternion(), []); const sc = useMemo(() => new THREE.Vector3(), []);
  const home = useMemo(() => Array.from({ length: max * 2 }, (_, i) => [rnd(i, 1), rnd(i, 2), rnd(i, 3)]), []);
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.getElapsedTime(); const top = heightRef.current; const rv = revealRef.current; const span = Math.max(0.05, top - y0 - 0.16);
    for (let i = 0; i < n; i += 1) for (let sp = 0; sp < 2; sp += 1) {
      const h = home[i + sp * max]; const ang = h[0] * 6.2832; const rad = Math.sqrt(h[1]) * (R - 0.22);
      const x = Math.cos(ang) * rad + Math.sin(t * 0.7 + i) * 0.05; const z = Math.sin(ang) * rad + Math.cos(t * 0.6 + i * 1.3) * 0.05; const y = y0 + 0.08 + h[2] * span + Math.sin(t * 0.9 + i * 0.7) * 0.04;
      const s = (sp === 0 ? 0.075 : anion === "Cl" ? 0.115 : 0.085) * rv; p.set(x, y, z); sc.setScalar(Math.max(1e-4, s)); m4.compose(p, q.identity(), sc);
      if (sp === 0) na.current?.setMatrixAt(i, m4); else { a1.current?.setMatrixAt(i, m4); if (anion === "OH") { p.set(x + 0.075 * rv, y + 0.05 * rv, z); sc.setScalar(Math.max(1e-4, 0.05 * rv)); m4.compose(p, q, sc); a2.current?.setMatrixAt(i, m4); } }
    }
    for (const r of [na, a1, a2]) if (r.current) { r.current.count = n; r.current.instanceMatrix.needsUpdate = true; }
  });
  return (
    <group>
      <instancedMesh ref={na} args={[sphere, mats.na, max]} frustumCulled={false} />
      <instancedMesh ref={a1} args={[sphere, anion === "OH" ? mats.o : mats.cl, max]} frustumCulled={false} />
      {anion === "OH" && <instancedMesh ref={a2} args={[sphere, mats.h, max]} frustumCulled={false} />}
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
