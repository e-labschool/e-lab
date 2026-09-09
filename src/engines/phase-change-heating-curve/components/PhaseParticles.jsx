import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOX_SIZE, HALF } from "../../particle-model-visualizer/components/ChamberWalls.jsx";
import { STATE_ACCENT } from "../../particle-model-visualizer/data/palette.js";
import {
  DONE_AT,
  PAUSE_BUFFER,
  STAGES,
  meltProgressAt,
  boilProgressAt,
  solidAmplitudeAt,
  liquidSpeedScaleAt,
  gasSpeedScaleAt,
} from "../data/timeline.js";

const POOL_SIZE = 64; // one fixed sample throughout — never added to or reduced
const PARTICLE_RADIUS = 0.14;

const SOLID_COLOR = new THREE.Color(STATE_ACCENT.solid);
const LIQUID_COLOR = new THREE.Color(STATE_ACCENT.liquid);
const GAS_COLOR = new THREE.Color(STATE_ACCENT.gas);

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Evenly spread thresholds across (0,1) then shuffle the assignment to
// particles, so melting/boiling proceeds as a steady, organic trickle
// (roughly one particle at a time) rather than a synchronized block move
// or a clumped random cluster.
function shuffledThresholds(n) {
  const values = Array.from({ length: n }, (_, i) => (i + 0.5) / n);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function buildParticles() {
  const dims = [4, 4, 4];
  const spacing = 0.3;
  const offsets = dims.map((d) => (spacing * (d - 1)) / 2);
  const lattice = [];
  for (let ix = 0; ix < dims[0]; ix++) {
    for (let iy = 0; iy < dims[1]; iy++) {
      for (let iz = 0; iz < dims[2]; iz++) {
        lattice.push(new THREE.Vector3(ix * spacing - offsets[0], iy * spacing - offsets[1], iz * spacing - offsets[2]));
      }
    }
  }

  const cols = 8;
  const rows = Math.ceil(POOL_SIZE / cols);
  const liqSpacing = 0.34;
  const bottomY = -HALF + PARTICLE_RADIUS + 0.04;
  const topY = -HALF + BOX_SIZE * 0.55;
  const sideBound = HALF - PARTICLE_RADIUS;

  const meltThresholds = shuffledThresholds(POOL_SIZE);
  const boilThresholds = shuffledThresholds(POOL_SIZE);

  const particles = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lx = (col - (cols - 1) / 2) * liqSpacing + randRange(-0.1, 0.1);
    const lz = randRange(-sideBound + 0.1, sideBound - 0.1);
    const ly = bottomY + (row / Math.max(rows - 1, 1)) * (topY - bottomY) + randRange(-0.05, 0.05);
    const liquidHome = new THREE.Vector3(
      THREE.MathUtils.clamp(lx, -sideBound, sideBound),
      THREE.MathUtils.clamp(ly, bottomY, topY),
      THREE.MathUtils.clamp(lz, -sideBound, sideBound)
    );

    particles.push({
      latticeOrigin: lattice[i],
      phase: new THREE.Vector3(randRange(0, Math.PI * 2), randRange(0, Math.PI * 2), randRange(0, Math.PI * 2)),
      freq: new THREE.Vector3(randRange(6, 9), randRange(6, 9), randRange(6, 9)),

      meltThreshold: meltThresholds[i],
      boilThreshold: boilThresholds[i],

      liquidHome,
      liquidPos: liquidHome.clone(),
      liquidVel: new THREE.Vector3(),
      liquidWanderTarget: liquidHome.clone(),
      liquidRetargetAt: 0,

      gasPos: new THREE.Vector3(),
      gasDir: new THREE.Vector3(0, 1, 0),
      gasBaseSpeed: randRange(1.9, 2.7),

      currentPhase: "solid",
      rendered: lattice[i].clone(),
    });
  }
  return particles;
}

function solidPositionOf(p, t, amplitude) {
  return new THREE.Vector3(
    p.latticeOrigin.x + Math.sin(t * p.freq.x + p.phase.x) * amplitude,
    p.latticeOrigin.y + Math.sin(t * p.freq.y + p.phase.y) * amplitude,
    p.latticeOrigin.z + Math.sin(t * p.freq.z + p.phase.z) * amplitude
  );
}

/**
 * clockRef: a shared { t, finished } object (not React state) — this
 * component is the sole writer of `t`, advancing it each r3f frame with an
 * accurate delta. The 2D heating curve / status strip read the same
 * object every animation frame via their own requestAnimationFrame loop,
 * so both sides of the block are always describing the same instant.
 */
export default function PhaseParticles({ clockRef }) {
  const particles = useMemo(() => buildParticles(), []);
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const materialRef = useRef();

  useEffect(() => {
    clockRef.current.t = 0;
    clockRef.current.finished = false;
  }, [clockRef]);

  useFrame((_, delta) => {
    if (!meshRef.current || clockRef.current.finished) return;
    const dt = Math.min(delta, 0.05);
    const nextT = clockRef.current.t + dt;
    if (nextT >= DONE_AT + PAUSE_BUFFER) {
      clockRef.current.t = DONE_AT + PAUSE_BUFFER;
      clockRef.current.finished = true;
    } else {
      clockRef.current.t = nextT;
    }
    const t = Math.min(clockRef.current.t, DONE_AT);

    const mp = meltProgressAt(t);
    const bp = boilProgressAt(t);
    const solidAmp = solidAmplitudeAt(t);
    const liquidMaxSpeed = 1.35 * liquidSpeedScaleAt(t);
    const gasScale = gasSpeedScaleAt(t);

    const sideBound = HALF - PARTICLE_RADIUS;
    const bottomBound = -HALF + PARTICLE_RADIUS + 0.04;
    const topBound = -HALF + BOX_SIZE * 0.55;
    const gasBound = HALF - PARTICLE_RADIUS;
    const wanderRadius = 0.42;
    const springK = 3.4;

    particles.forEach((p) => {
      const targetPhase = mp < 1 && p.meltThreshold > mp ? "solid" : bp < 1 && p.boilThreshold > bp ? "liquid" : "gas";

      if (targetPhase !== p.currentPhase) {
        if (targetPhase === "liquid" && p.currentPhase === "solid") {
          // Melts in place, then the wander-spring below carries it down
          // into the liquid pool — a continuous "sinking in" motion rather
          // than a teleport.
          p.liquidPos.copy(solidPositionOf(p, t, solidAmp));
          p.liquidVel.set(0, 0, 0);
          p.liquidWanderTarget.copy(p.liquidHome);
          p.liquidRetargetAt = t;
        } else if (targetPhase === "gas" && p.currentPhase === "liquid") {
          // Escapes from exactly where it was in the liquid, moving mostly
          // upward at first — reads as leaving the liquid's surface.
          p.gasPos.copy(p.liquidPos);
          p.gasDir.set(randRange(-0.6, 0.6), randRange(0.5, 1), randRange(-0.6, 0.6)).normalize();
        }
        p.currentPhase = targetPhase;
      }

      if (p.currentPhase === "liquid") {
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
        p.liquidVel.multiplyScalar(0.9);
        p.liquidVel.clampLength(0, liquidMaxSpeed);
        p.liquidPos.addScaledVector(p.liquidVel, dt);

        if (p.liquidPos.y > topBound) { p.liquidPos.y = topBound; p.liquidVel.y *= -0.4; }
        if (p.liquidPos.y < bottomBound) { p.liquidPos.y = bottomBound; p.liquidVel.y *= -0.4; }
        if (p.liquidPos.x > sideBound) { p.liquidPos.x = sideBound; p.liquidVel.x *= -0.5; }
        if (p.liquidPos.x < -sideBound) { p.liquidPos.x = -sideBound; p.liquidVel.x *= -0.5; }
        if (p.liquidPos.z > sideBound) { p.liquidPos.z = sideBound; p.liquidVel.z *= -0.5; }
        if (p.liquidPos.z < -sideBound) { p.liquidPos.z = -sideBound; p.liquidVel.z *= -0.5; }
      } else if (p.currentPhase === "gas") {
        const speed = p.gasBaseSpeed * gasScale;
        p.gasPos.addScaledVector(p.gasDir, speed * dt);
        ["x", "y", "z"].forEach((axis) => {
          if (p.gasPos[axis] > gasBound || p.gasPos[axis] < -gasBound) {
            p.gasPos[axis] = THREE.MathUtils.clamp(p.gasPos[axis], -gasBound, gasBound);
            p.gasDir[axis] *= -1;
          }
        });
      }
    });

    particles.forEach((p, i) => {
      if (p.currentPhase === "solid") p.rendered.copy(solidPositionOf(p, t, solidAmp));
      else if (p.currentPhase === "liquid") p.rendered.copy(p.liquidPos);
      else p.rendered.copy(p.gasPos);

      dummy.position.copy(p.rendered);
      dummy.scale.setScalar(1); // consistent particle size throughout — only arrangement/spacing changes
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    if (materialRef.current) {
      let color;
      if (t < STAGES.melt.start) color = SOLID_COLOR;
      else if (t < STAGES.melt.end) color = SOLID_COLOR.clone().lerp(LIQUID_COLOR, mp);
      else if (t < STAGES.boil.start) color = LIQUID_COLOR;
      else if (t < STAGES.boil.end) color = LIQUID_COLOR.clone().lerp(GAS_COLOR, bp);
      else color = GAS_COLOR;
      materialRef.current.color.copy(color);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, POOL_SIZE]}>
      <sphereGeometry args={[PARTICLE_RADIUS, 20, 20]} />
      <meshPhysicalMaterial ref={materialRef} color={SOLID_COLOR} roughness={0.28} metalness={0.12} clearcoat={0.5} clearcoatRoughness={0.25} />
    </instancedMesh>
  );
}
