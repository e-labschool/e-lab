import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOX_SIZE, HALF } from "./ChamberWalls.jsx";

// One shared pool, sized for the densest state (solid). Liquid and gas each
// use a smaller, fixed subset of this same pool (chosen by index) so the
// simulation always represents "the same set of idealized particles" —
// switching state never implies particles are created or destroyed, it
// just changes how many of them are relevant to show for that state's
// teaching model, and the ones that aren't fade out/in smoothly rather
// than popping.
const POOL_SIZE = 180; // solid: fills the chamber, densely packed
const LIQUID_ACTIVE = 110; // still a large, close-packed body — visibly a little less than solid
const GAS_ACTIVE = 40; // noticeably fewer — large empty space is the point

const PARTICLE_RADIUS = 0.14;
const TRANSITION_SECONDS = 0.9;
const ATTRACTION_RANGE = 0.5; // "short-range" — deliberately tight
const ATTRACTION_MAX_LINES = 70; // keeps it restrained, never cluttered

const STATE_COLOR = {
  solid: new THREE.Color("#6C86EE"),
  liquid: new THREE.Color("#3FA9A0"),
  gas: new THREE.Color("#D97757"),
};

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function isActiveIn(stateKey, index) {
  if (stateKey === "solid") return true;
  if (stateKey === "liquid") return index < LIQUID_ACTIVE;
  return index < GAS_ACTIVE;
}

// ---------------------------------------------------------------------
// Particle data — one persistent pool, reused by all three states so a
// switch is a smooth blend rather than a scene swap.
// ---------------------------------------------------------------------

function buildParticles() {
  // Solid target: a dense 6 x 6 x 5 lattice, spacing barely larger than
  // the sphere diameter — "almost touching, never overlapping".
  const dims = [6, 6, 5];
  const spacing = 0.3; // diameter is 0.28, so this is as tight as it gets without overlap
  const offsets = dims.map((d) => (spacing * (d - 1)) / 2);
  const lattice = [];
  for (let ix = 0; ix < dims[0]; ix++) {
    for (let iy = 0; iy < dims[1]; iy++) {
      for (let iz = 0; iz < dims[2]; iz++) {
        lattice.push(new THREE.Vector3(ix * spacing - offsets[0], iy * spacing - offsets[1], iz * spacing - offsets[2]));
      }
    }
  }
  while (lattice.length < POOL_SIZE) lattice.push(lattice[lattice.length % (dims[0] * dims[1] * dims[2])].clone());
  lattice.length = POOL_SIZE;

  // Liquid initial layout: a jittered grid confined to the lower ~55% of
  // the chamber — close together with small irregular gaps, and an
  // implicit upper "surface" where the confinement band ends.
  const cols = 9;
  const rows = Math.ceil(POOL_SIZE / cols);
  const liqSpacing = 0.34;
  const bottomY = -HALF + PARTICLE_RADIUS + 0.04;
  const topY = -HALF + BOX_SIZE * 0.55;

  const gasBound = HALF - PARTICLE_RADIUS;

  const particles = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lx = (col - (cols - 1) / 2) * liqSpacing + randRange(-0.11, 0.11);
    const lz = randRange(-1.05, 1.05) + randRange(-0.11, 0.11);
    const ly = bottomY + (row / Math.max(rows - 1, 1)) * (topY - bottomY) + randRange(-0.05, 0.05);
    const liquidHome = new THREE.Vector3(
      THREE.MathUtils.clamp(lx, -HALF + PARTICLE_RADIUS, HALF - PARTICLE_RADIUS),
      THREE.MathUtils.clamp(ly, bottomY, topY),
      THREE.MathUtils.clamp(lz, -HALF + PARTICLE_RADIUS, HALF - PARTICLE_RADIUS)
    );

    const gasDir = new THREE.Vector3(randRange(-1, 1), randRange(-1, 1), randRange(-1, 1)).normalize();

    particles.push({
      latticeOrigin: lattice[i],
      phase: new THREE.Vector3(randRange(0, Math.PI * 2), randRange(0, Math.PI * 2), randRange(0, Math.PI * 2)),
      // Rapid but tiny vibration: high frequency, small amplitude — fast
      // motion that never travels anywhere (peak speed stays well below
      // the liquid's translational speed, see below).
      freq: new THREE.Vector3(randRange(6, 9), randRange(6, 9), randRange(6, 9)),

      liquidHome,
      liquidPos: liquidHome.clone(),
      liquidVel: new THREE.Vector3(),
      liquidWanderTarget: liquidHome.clone(),
      liquidRetargetAt: randRange(0, 1.6),

      gasPos: new THREE.Vector3(randRange(-gasBound, gasBound), randRange(-gasBound, gasBound), randRange(-gasBound, gasBound)),
      gasVel: gasDir.multiplyScalar(randRange(1.9, 2.7)),

      rendered: new THREE.Vector3(),
    });
  }
  return particles;
}

/**
 * state: "solid" | "liquid" | "gas" — the target. Switching this blends
 * smoothly over ~0.9s (position AND active/inactive scale) rather than
 * cutting to a new scene, since every particle's solid/liquid/gas position
 * is computed continuously regardless of which one is currently displayed.
 */
export default function ParticleSystem({ state, running, showAttractions }) {
  const particles = useMemo(() => buildParticles(), []);
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const materialRef = useRef();
  const lineRef = useRef();

  const simTimeRef = useRef(0); // advances only while running — drives vibration + integrators
  const elapsedRef = useRef(0); // always advances — drives the state-switch transition timer
  const targetStateRef = useRef(state);
  const prevStateRef = useRef(state);
  const transitionStartRef = useRef(0);

  useEffect(() => {
    if (state !== targetStateRef.current) {
      prevStateRef.current = targetStateRef.current;
      targetStateRef.current = state;
      transitionStartRef.current = elapsedRef.current;
    }
  }, [state]);

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ATTRACTION_MAX_LINES * 2 * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(ATTRACTION_MAX_LINES * 2 * 3), 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  function solidPositionOf(p, t) {
    return new THREE.Vector3(
      p.latticeOrigin.x + Math.sin(t * p.freq.x + p.phase.x) * 0.04,
      p.latticeOrigin.y + Math.sin(t * p.freq.y + p.phase.y) * 0.04,
      p.latticeOrigin.z + Math.sin(t * p.freq.z + p.phase.z) * 0.04
    );
  }

  function positionByKey(key, p, t) {
    if (key === "solid") return solidPositionOf(p, t);
    if (key === "liquid") return p.liquidPos;
    return p.gasPos;
  }

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.05);
    elapsedRef.current += dt;
    if (running) simTimeRef.current += dt;
    const t = simTimeRef.current;

    if (running) {
      const sideBound = HALF - PARTICLE_RADIUS;
      const bottomBound = -HALF + PARTICLE_RADIUS + 0.04;
      const topBound = -HALF + BOX_SIZE * 0.55;
      const wanderRadius = 0.42;
      const springK = 3.4;
      const liquidDamping = 0.9;
      const liquidMaxSpeed = 1.35;
      const gasBound = HALF - PARTICLE_RADIUS;

      particles.forEach((p) => {
        // --- liquid: continuous translational "sliding" around a local
        // home cell, clearly more energetic than the solid's vibration
        // (peak liquid speed ~1.3 vs peak solid vibration speed ~0.36).
        if (t >= p.liquidRetargetAt) {
          const offset = new THREE.Vector3(randRange(-1, 1), randRange(-0.5, 0.6), randRange(-1, 1))
            .normalize()
            .multiplyScalar(randRange(0.15, wanderRadius));
          p.liquidWanderTarget.copy(p.liquidHome).add(offset);
          p.liquidWanderTarget.y = THREE.MathUtils.clamp(p.liquidWanderTarget.y, bottomBound, topBound);
          p.liquidWanderTarget.x = THREE.MathUtils.clamp(p.liquidWanderTarget.x, -sideBound, sideBound);
          p.liquidWanderTarget.z = THREE.MathUtils.clamp(p.liquidWanderTarget.z, -sideBound, sideBound);
          p.liquidRetargetAt = t + randRange(0.7, 1.5);
        }
        const toTarget = new THREE.Vector3().subVectors(p.liquidWanderTarget, p.liquidPos);
        p.liquidVel.addScaledVector(toTarget, springK * dt);
        p.liquidVel.x += randRange(-1, 1) * 0.5 * dt;
        p.liquidVel.y += randRange(-1, 1) * 0.25 * dt;
        p.liquidVel.z += randRange(-1, 1) * 0.5 * dt;
        p.liquidVel.multiplyScalar(liquidDamping);
        p.liquidVel.clampLength(0, liquidMaxSpeed);
        p.liquidPos.addScaledVector(p.liquidVel, dt);

        if (p.liquidPos.y > topBound) { p.liquidPos.y = topBound; p.liquidVel.y *= -0.4; }
        if (p.liquidPos.y < bottomBound) { p.liquidPos.y = bottomBound; p.liquidVel.y *= -0.4; }
        if (p.liquidPos.x > sideBound) { p.liquidPos.x = sideBound; p.liquidVel.x *= -0.5; }
        if (p.liquidPos.x < -sideBound) { p.liquidPos.x = -sideBound; p.liquidVel.x *= -0.5; }
        if (p.liquidPos.z > sideBound) { p.liquidPos.z = sideBound; p.liquidVel.z *= -0.5; }
        if (p.liquidPos.z < -sideBound) { p.liquidPos.z = -sideBound; p.liquidVel.z *= -0.5; }

        // --- gas: fastest, longest paths, elastic collisions with all six walls
        p.gasPos.addScaledVector(p.gasVel, dt);
        ["x", "y", "z"].forEach((axis) => {
          if (p.gasPos[axis] > gasBound || p.gasPos[axis] < -gasBound) {
            p.gasPos[axis] = THREE.MathUtils.clamp(p.gasPos[axis], -gasBound, gasBound);
            p.gasVel[axis] *= -1;
          }
        });
      });
    }

    const rawAlpha = THREE.MathUtils.clamp((elapsedRef.current - transitionStartRef.current) / TRANSITION_SECONDS, 0, 1);
    const alpha = easeInOutCubic(rawAlpha);
    const fromKey = prevStateRef.current;
    const toKey = targetStateRef.current;

    const activeList = []; // indices currently visible enough to count for attraction lines

    particles.forEach((p, i) => {
      const scaleFrom = isActiveIn(fromKey, i) ? 1 : 0;
      const scaleTo = isActiveIn(toKey, i) ? 1 : 0;
      const scale = alpha >= 1 ? scaleTo : THREE.MathUtils.lerp(scaleFrom, scaleTo, alpha);

      if (alpha >= 1) {
        p.rendered.copy(positionByKey(toKey, p, t));
      } else {
        p.rendered.lerpVectors(positionByKey(fromKey, p, t), positionByKey(toKey, p, t), alpha);
      }

      dummy.position.copy(p.rendered);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      if (scale > 0.5) activeList.push(i);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    if (materialRef.current) {
      const fromColor = STATE_COLOR[fromKey];
      const toColor = STATE_COLOR[toKey];
      materialRef.current.color.copy(fromColor).lerp(toColor, alpha);
    }

    if (showAttractions && lineRef.current) {
      const attr = lineGeometry.getAttribute("position");
      const colorAttr = lineGeometry.getAttribute("color");
      const posArr = attr.array;
      const colorArr = colorAttr.array;

      const candidates = [];
      for (let a = 0; a < activeList.length; a++) {
        for (let b = a + 1; b < activeList.length; b++) {
          const i = activeList[a];
          const j = activeList[b];
          const d = particles[i].rendered.distanceTo(particles[j].rendered);
          if (d < ATTRACTION_RANGE) candidates.push([i, j, d]);
        }
      }
      candidates.sort((a, b) => a[2] - b[2]);
      const used = Math.min(candidates.length, ATTRACTION_MAX_LINES);
      const tint = materialRef.current ? materialRef.current.color : STATE_COLOR.solid;

      for (let k = 0; k < used; k++) {
        const [i, j, d] = candidates[k];
        const a = particles[i].rendered;
        const b = particles[j].rendered;
        const base = k * 6;
        posArr[base] = a.x; posArr[base + 1] = a.y; posArr[base + 2] = a.z;
        posArr[base + 3] = b.x; posArr[base + 4] = b.y; posArr[base + 5] = b.z;

        const strength = 1 - d / ATTRACTION_RANGE;
        const r = tint.r + (1 - tint.r) * strength * 0.6;
        const g = tint.g + (1 - tint.g) * strength * 0.6;
        const bch = tint.b + (1 - tint.b) * strength * 0.6;
        colorArr[base] = r; colorArr[base + 1] = g; colorArr[base + 2] = bch;
        colorArr[base + 3] = r; colorArr[base + 4] = g; colorArr[base + 5] = bch;
      }
      attr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      lineGeometry.setDrawRange(0, used * 2);
    } else if (lineGeometry) {
      lineGeometry.setDrawRange(0, 0);
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[null, null, POOL_SIZE]}>
        <sphereGeometry args={[PARTICLE_RADIUS, 20, 20]} />
        <meshPhysicalMaterial
          ref={materialRef}
          color={STATE_COLOR[state]}
          roughness={0.28}
          metalness={0.12}
          clearcoat={0.5}
          clearcoatRoughness={0.25}
        />
      </instancedMesh>
      {showAttractions && (
        <lineSegments ref={lineRef} geometry={lineGeometry}>
          <lineBasicMaterial vertexColors transparent opacity={0.55} />
        </lineSegments>
      )}
    </>
  );
}
