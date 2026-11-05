import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CONE_ANGLE, arrowDirection, tumbleDirection } from "../physics/spinEnsemble.js";
import { makeHeadGeometry, makeProtonGeometry, makeShaftGeometry, orient } from "./protonGeometry.js";
import { advanceClock, publish } from "./sceneClock.js";

export const STATE_COLORS = { alpha: new THREE.Color("#2dd4bf"), beta: new THREE.Color("#a78bfa"), free: new THREE.Color("#fcd34d") };

/**
 * The ensemble of small proton models: INSTANCED spheres (spin cue on the surface), INSTANCED moment arrows (shaft + cone head) and, once the field is
 * on, INSTANCED precession rings (the circle the arrow tip travels on). Four draw calls for any number of nuclei.
 *
 *   live.current = { apply, grow, states, paused, reduced, speed }
 *     apply   0..1  progress of switching B0 on (0: random moments that wander slowly; 1: alpha / beta on the quantum cones, precessing about +z)
 *     grow    0..1  how much of the ensemble is shown (step 1 morphs the single large proton into the ensemble)
 *     states  { alpha: boolean[], nAlpha, nBeta } which nuclei are in alpha
 *   clock = makeClock() shared with the other components of the scene.
 * Everything per frame happens on refs: React does not render per frame.
 */
export default function ProtonInstances({ ens, live, clock, radius = 0.13, arrowLen = 0.5, spread = 1, publishInfo = false }) {
  const spheres = useRef(); const shafts = useRef(); const heads = useRef(); const rings = useRef(); const ringMat = useRef();
  const n = ens.n;
  const headLen = arrowLen * 0.34;
  const geo = useMemo(() => ({
    sphere: makeProtonGeometry(), shaft: makeShaftGeometry(0.02, arrowLen - headLen), head: makeHeadGeometry(0.068, headLen),
    ring: new THREE.TorusGeometry(1, 0.03, 6, 44),
  }), [arrowLen, headLen]);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); }, [geo]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const lastKey = useRef("");

  useLayoutEffect(() => {
    for (let i = 0; i < n; i += 1) { shafts.current?.setColorAt(i, STATE_COLORS.free); heads.current?.setColorAt(i, STATE_COLORS.free); rings.current?.setColorAt(i, STATE_COLORS.free); }
    for (const m of [shafts, heads, rings]) if (m.current?.instanceColor) m.current.instanceColor.needsUpdate = true;
  }, [n]);

  useFrame((state, delta) => {
    const S = spheres.current; const A = shafts.current; const H = heads.current; const R = rings.current; if (!S || !A || !H || !R) return;
    const L = live.current; advanceClock(clock, L, state.clock.elapsedTime, delta);
    const { apply, grow, states } = L; const k = Math.max(0.0001, grow);
    const e = apply * apply * (3 - 2 * apply);
    const q = o.quaternion;
    for (let i = 0; i < n; i += 1) {
      const p = ens.pos[i]; const px = p[0] * spread * grow; const py = p[1] * spread * grow; const pz = p[2] * spread * grow;
      const start = tumbleDirection(ens, i, clock.wander);
      const d = apply > 0 ? arrowDirection(ens, i, states.alpha[i], { apply, phase: clock.prec, start }) : start;
      // sphere: turns about its own axis (the surface stripes travel round it)
      o.position.set(px, py, pz); orient(q, d, clock.spin + i * 1.7); o.scale.setScalar(radius * k); o.updateMatrix(); S.setMatrixAt(i, o.matrix);
      // arrow: tail at the centre of the sphere, head outside it
      orient(q, d, 0); o.scale.setScalar(k); o.updateMatrix(); A.setMatrixAt(i, o.matrix);
      o.position.set(px + d[0] * (arrowLen - headLen) * k, py + d[1] * (arrowLen - headLen) * k, pz + d[2] * (arrowLen - headLen) * k); o.updateMatrix(); H.setMatrixAt(i, o.matrix);
      // precession ring: the circle of the arrow tip on its cone (alpha above the nucleus, beta below)
      if (apply > 0.02) {
        const up = states.alpha[i] ? 1 : -1; const rr = arrowLen * Math.sin(CONE_ANGLE) * k;
        o.position.set(px, py, pz + up * arrowLen * Math.cos(CONE_ANGLE) * k); q.identity(); o.scale.setScalar(Math.max(0.0001, rr)); o.updateMatrix(); R.setMatrixAt(i, o.matrix);
      } else { o.position.set(px, py, pz); q.identity(); o.scale.setScalar(0.0001); o.updateMatrix(); R.setMatrixAt(i, o.matrix); }
    }
    for (const m of [S, A, H, R]) m.instanceMatrix.needsUpdate = true;
    if (ringMat.current) ringMat.current.opacity = 0.55 * e;
    const key = `${apply > 0.02}|${states.nAlpha}`;
    if (key !== lastKey.current) { // recolour only when the assignment changes
      lastKey.current = key;
      for (let i = 0; i < n; i += 1) {
        const c = apply > 0.02 ? (states.alpha[i] ? STATE_COLORS.alpha : STATE_COLORS.beta) : STATE_COLORS.free;
        A.setColorAt(i, c); H.setColorAt(i, c); R.setColorAt(i, c);
      }
      for (const m of [A, H, R]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    if (publishInfo && grow > 0.02) {
      publish(state, clock, {
        hero: 0, protons: n, arrows: n, apply: apply.toFixed(2), "n-alpha": states.nAlpha, "n-beta": states.nBeta, "spin-angle": (clock.spin % (2 * Math.PI)).toFixed(3),
        "prec-angle": (clock.prec % (2 * Math.PI)).toFixed(3), "cone-deg": ((CONE_ANGLE * 180) / Math.PI).toFixed(2), motion: L.paused || L.reduced ? "static" : "running",
      });
    }
  });

  return (
    <>
      <instancedMesh ref={spheres} args={[geo.sphere, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.05} emissive="#1d3b7a" emissiveIntensity={0.35} />
      </instancedMesh>
      <instancedMesh ref={shafts} args={[geo.shaft, undefined, n]} frustumCulled={false}><meshBasicMaterial /></instancedMesh>
      <instancedMesh ref={heads} args={[geo.head, undefined, n]} frustumCulled={false}><meshBasicMaterial /></instancedMesh>
      <instancedMesh ref={rings} args={[geo.ring, undefined, n]} frustumCulled={false}><meshBasicMaterial ref={ringMat} transparent opacity={0} depthWrite={false} /></instancedMesh>
    </>
  );
}
