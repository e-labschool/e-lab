import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOX_SIZE, HALF } from "./ChamberWalls.jsx";
import { DIAMETER, createParticleSystem } from "../../../lib/particles/particleCore.js";

// Renders the SHARED particle core (src/lib/particles/particleCore.js) as instanced spheres. The SAME N particles are used in
// every state (nothing fades in or out): switching state changes the forces (lattice springs / cohesion + gravity / none), and
// the temperature slider sets the mean kinetic energy in every state. Gas particles collide with each other and with the walls.
// reducedMotion: the model is advanced in discrete 0.5 s snapshots instead of continuously (no fast animation).
export const CORE_BOX = { w: 12, h: 12, d: 12 };
const SCALE = BOX_SIZE / CORE_BOX.w;
const PARTICLE_RADIUS = (DIAMETER / 2) * SCALE;
const ATTRACTION_RANGE = 1.25 * DIAMETER; // in core units
const ATTRACTION_MAX_LINES = 90;
const N = 96;

const STATE_COLOR = { solid: new THREE.Color("#6C86EE"), liquid: new THREE.Color("#3FA9A0"), gas: new THREE.Color("#D97757") };
const dummy = new THREE.Object3D();

export default function ParticleSystem({ state, running, showAttractions, temperature, reducedMotion = false, onStats }) {
  const meshRef = useRef(null);
  const lineRef = useRef(null);
  const materialRef = useRef(null);
  const sys = useMemo(() => createParticleSystem({ n: N, dim: 3, seed: 7, box: CORE_BOX, state: "solid", T: temperature }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const acc = useRef(0);
  const statClock = useRef(0);

  useEffect(() => { sys.setState(state); }, [sys, state]);
  useEffect(() => { sys.setTemperature(temperature); }, [sys, temperature]);
  useEffect(() => { if (typeof window !== "undefined") window.__particleCore = sys; return () => { if (window.__particleCore === sys) delete window.__particleCore; }; }, [sys]);

  const lineGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ATTRACTION_MAX_LINES * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(ATTRACTION_MAX_LINES * 6), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  const toWorld = (p, out) => out.set((p.x - CORE_BOX.w / 2) * SCALE, (p.y - CORE_BOX.h / 2) * SCALE, (p.z - CORE_BOX.d / 2) * SCALE);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (running) {
      if (reducedMotion) { acc.current += delta; if (acc.current >= 0.5) { acc.current = 0; sys.step(0.5); } }
      else sys.step(Math.min(delta, 0.05));
    }
    const ps = sys.particles;
    for (let i = 0; i < ps.length; i++) {
      toWorld(ps[i], dummy.position);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (materialRef.current) materialRef.current.color.lerp(STATE_COLOR[state], 0.12);

    statClock.current += delta;
    if (onStats && statClock.current > 0.4) { statClock.current = 0; onStats(sys.getStats()); }

    if (showAttractions && lineRef.current) {
      const attr = lineGeometry.getAttribute("position"); const colorAttr = lineGeometry.getAttribute("color");
      const cand = [];
      for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) {
        const d = Math.hypot(ps[a].x - ps[b].x, ps[a].y - ps[b].y, ps[a].z - ps[b].z);
        if (d < ATTRACTION_RANGE) cand.push([a, b, d]);
      }
      cand.sort((x, y) => x[2] - y[2]);
      const used = Math.min(cand.length, ATTRACTION_MAX_LINES);
      const tint = materialRef.current ? materialRef.current.color : STATE_COLOR.solid;
      for (let k = 0; k < used; k++) {
        const [i, j, d] = cand[k]; const base = k * 6;
        toWorld(ps[i], v); attr.array[base] = v.x; attr.array[base + 1] = v.y; attr.array[base + 2] = v.z;
        toWorld(ps[j], v); attr.array[base + 3] = v.x; attr.array[base + 4] = v.y; attr.array[base + 5] = v.z;
        const s = 1 - (d - DIAMETER) / (ATTRACTION_RANGE - DIAMETER + 1e-6);
        const c = [tint.r + (1 - tint.r) * s * 0.6, tint.g + (1 - tint.g) * s * 0.6, tint.b + (1 - tint.b) * s * 0.6];
        colorAttr.array.set(c, base); colorAttr.array.set(c, base + 3);
      }
      attr.needsUpdate = true; colorAttr.needsUpdate = true;
      lineGeometry.setDrawRange(0, used * 2);
    } else lineGeometry.setDrawRange(0, 0);
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[null, null, N]}>
        <sphereGeometry args={[PARTICLE_RADIUS, 20, 20]} />
        <meshPhysicalMaterial ref={materialRef} color={STATE_COLOR[state]} roughness={0.28} metalness={0.12} clearcoat={0.5} clearcoatRoughness={0.25} />
      </instancedMesh>
      {showAttractions && (
        <lineSegments ref={lineRef} geometry={lineGeometry}>
          <lineBasicMaterial vertexColors transparent opacity={0.55} />
        </lineSegments>
      )}
    </>
  );
}
export { HALF };
