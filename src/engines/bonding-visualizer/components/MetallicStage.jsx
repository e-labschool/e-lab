import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import WebGLGate from "./WebGLGate.jsx";
import CellGrid from "./CellGrid.jsx";
import { chargeText, getBondingElement } from "../model/elements.js";
import { metallicScene } from "../scene/metallicScene.js";
import { cubicCellEdge } from "../model/metallic.js";

const DURATION = { releasing: 3.2, forming: 4.8 };
const CORE_COLOR = new THREE.Color("#ef6c6c");
const ELECTRON_COLOR = "#1fb6ff";
const LIMIT = 4.6;

/** Maps a screen position to a point on the plane through the origin facing the camera (used for drag-and-drop from the library). */
function ApiBridge({ apiRef }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    apiRef.current = {
      project(cx, cy) {
        const r = gl.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), new THREE.Vector3());
        const out = new THREE.Vector3();
        return ray.ray.intersectPlane(plane, out) ? [out.x, out.y, out.z] : null;
      },
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, gl]);
  return null;
}

function Core({ index, setRef, symbol, color, label, onDown, onMove, onUp }) {
  return (
    <group ref={(el) => setRef(index, el)} visible={false}>
      <mesh onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "grab"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <sphereGeometry args={[1, 36, 24]} />
        <meshStandardMaterial color={color} roughness={0.32} metalness={0.05} />
      </mesh>
      {label && <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}><span className="bv-html-label" data-testid="core-label">{label}</span></Html>}
      <mesh visible={false} name={symbol} />
    </group>
  );
}

function Scene({ metal, structure, atoms, sites, assign, stage, runKey, playing, selected, onMove, onSelect, onDone, apiRef, viewKey }) {
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const first = useRef(true);
  const coreRefs = useRef([]);
  const eRef = useRef(null);
  const timeRef = useRef(0);
  const pRef = useRef(0);
  const doneRef = useRef(false);
  const drag = useRef(null);
  const atomsRef = useRef(atoms);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const neutral = useMemo(() => new THREE.Color(getBondingElement(metal.symbol).color), [metal.symbol]);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const v = metal.valence;

  useEffect(() => { atomsRef.current = atoms; });
  useEffect(() => { pRef.current = 0; doneRef.current = false; }, [stage, runKey]);
  useEffect(() => { controls?.saveState?.(); }, [controls]);
  useEffect(() => { if (first.current) { first.current = false; return; } controls?.reset?.(); }, [viewKey, controls]);

  const coreCount = stage === "forming" || stage === "lattice" ? Math.max(atoms.length, sites.length) : atoms.length;
  const electronCount = Math.max(1, coreCount * v);
  const showLabels = coreCount <= 14;
  const charged = stage === "released" || stage === "forming" || stage === "lattice";

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (playing) {
      timeRef.current += dt;
      if ((stage === "releasing" || stage === "forming") && !doneRef.current) {
        pRef.current = Math.min(1, pRef.current + dt / DURATION[stage]);
        if (pRef.current >= 1) { doneRef.current = true; onDone(stage); }
      }
    }
    const p = stage === "releasing" || stage === "forming" ? pRef.current : 1;
    const sc = metallicScene({ atoms: atomsRef.current.map((a) => a.pos), sites, assign, stage, p, time: timeRef.current, v });
    coreRefs.current.forEach((g, i) => {
      if (!g) return;
      const c = sc.cores[i];
      if (!c) { g.visible = false; return; }
      g.visible = c.alpha > 0.01;
      g.position.set(c.pos[0], c.pos[1], c.pos[2]);
      const mesh = g.children[0];
      mesh.scale.setScalar(Math.max(0.0001, c.radius));
      tmpColor.copy(neutral).lerp(CORE_COLOR, c.mix);
      mesh.material.color.copy(tmpColor);
      const isSel = atomsRef.current[i]?.id === selected && (stage === "place" || stage === "released");
      if (isSel) { mesh.material.emissive.set("#2f7bf5"); mesh.material.emissiveIntensity = 0.4; } else { mesh.material.emissive.copy(tmpColor); mesh.material.emissiveIntensity = 0.3; }
    });
    const mesh = eRef.current;
    if (mesh) {
      for (let i = 0; i < electronCount; i += 1) {
        const e = sc.electrons[i];
        if (!e) { dummy.scale.setScalar(0.0001); dummy.position.set(0, 0, 0); } else {
          dummy.position.set(e.pos[0], e.pos[1], e.pos[2]);
          dummy.scale.setScalar(Math.max(0.0001, 0.1 * e.alpha));
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const plane = useMemo(() => new THREE.Plane(), []);
  const grab = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const draggable = stage === "place" || stage === "released";
  const handlers = (i) => ({
    onPointerDown: (e) => {
      if (!draggable || !atomsRef.current[i]) return;
      e.stopPropagation();
      onSelect(atomsRef.current[i].id);
      const g = coreRefs.current[i];
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tmp.clone()), e.point);
      grab.copy(e.point).sub(g.position);
      drag.current = { i, pid: e.pointerId };
      if (controls) controls.enabled = false;
      e.target.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d || d.i !== i) return;
      if (e.ray.intersectPlane(plane, tmp)) {
        const x = (n) => Math.max(-LIMIT, Math.min(LIMIT, n));
        onMove(atomsRef.current[i].id, [x(tmp.x - grab.x), x(tmp.y - grab.y), x(tmp.z - grab.z)]);
      }
    },
    onPointerUp: (e) => { if (drag.current?.i === i) { drag.current = null; if (controls) controls.enabled = true; e.target.releasePointerCapture?.(e.pointerId); } },
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 8, 5]} intensity={1.1} />
      <directionalLight position={[-6, -3, -4]} intensity={0.35} />
      <gridHelper args={[12, 12, "#c3d1ea", "#e3eaf6"]} position={[0, -3.2, 0]} />
      <ApiBridge apiRef={apiRef} />
      {Array.from({ length: coreCount }, (_, i) => (
        <Core
          key={i} index={i} setRef={(idx, el) => { coreRefs.current[idx] = el; }} symbol={metal.symbol} color={neutral}
          label={showLabels && !(stage === "forming" || stage === "lattice") ? (charged ? chargeText(metal.symbol, 1) : metal.symbol) : null}
          {...handlers(i)}
        />
      ))}
      <instancedMesh key={electronCount} ref={eRef} args={[null, null, electronCount]} frustumCulled={false}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={ELECTRON_COLOR} emissive={ELECTRON_COLOR} emissiveIntensity={0.55} roughness={0.3} />
      </instancedMesh>
      {stage === "lattice" && cubicCellEdge(structure) && <CellGrid edge={cubicCellEdge(structure)} />}
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.1} minDistance={3.5} maxDistance={20} autoRotate={stage === "lattice" && playing} autoRotateSpeed={0.9} />
    </>
  );
}

/**
 * The 3D metallic workspace: sphere atoms, then positive ion cores with a moving cloud of delocalised electrons.
 * The electron motion is a deliberately simplified illustration (smooth looping paths), not a trajectory.
 */
export default function MetallicStage(props) {
  const { metal, stage, apiRef } = props;
  const cam = useMemo(() => ({ position: [4.6, 3.1, 6.3], fov: 42 }), []);
  return (
    <div className="bv-3d" data-testid="metallic-stage" data-stage={stage}>
      <WebGLGate fallback="Metal ions (+) sit in a regular lattice surrounded by delocalized valence electrons that are shared throughout the whole structure.">
        <Canvas camera={cam} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: "low-power" }}>
          <Scene {...props} apiRef={apiRef} />
        </Canvas>
      </WebGLGate>
      <div className="bv-legend" data-testid="metal-legend">
        {stage === "place" || stage === "releasing"
          ? <><span><i style={{ background: getBondingElement(metal.symbol).color }} />{metal.symbol} atom</span><span><i style={{ background: ELECTRON_COLOR }} />valence electron</span></>
          : <><span><i style={{ background: "#ef6c6c" }} />{chargeText(metal.symbol, 1)} ion core</span><span><i style={{ background: ELECTRON_COLOR }} />delocalized electron</span></>}
      </div>
    </div>
  );
}
