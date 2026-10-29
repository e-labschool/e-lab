import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import WebGLGate from "./WebGLGate.jsx";
import { isSoftwareGL } from "./webgl.js";
import { chargeText, getBondingElement } from "../model/elements.js";
import { MAX_METAL_ATOMS } from "../model/metallic.js";
import { MAX_ELECTRONS, R_ELECTRON, createEngine, cubeHalf, stepEngine } from "../scene/metallicScene.js";

const DURATION = { releasing: 3.2, forming: 4.8 };
const CORE_COLOR = new THREE.Color("#ef6c6c");
const ELECTRON_COLOR = "#1fb6ff";
const FOV = 42;
const DEFAULT_DIR = new THREE.Vector3(4.6, 3.1, 6.3).normalize();

/** Maps a screen position to a point on the plane through the origin facing the camera (drag-and-drop from the library). */
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

/** Writes uniform-scale translation matrices straight into an InstancedMesh (no objects created per frame). */
function writeMatrices(mesh, pos, count, scale) {
  const a = mesh.instanceMatrix.array;
  for (let i = 0; i < count; i += 1) {
    const o = i * 16; const k = i * 3;
    a[o] = scale; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
    a[o + 4] = 0; a[o + 5] = scale; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = scale; a[o + 11] = 0;
    a[o + 12] = pos[k]; a[o + 13] = pos[k + 1]; a[o + 14] = pos[k + 2]; a[o + 15] = 1;
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}

/** Default camera distance that frames the whole cube (half-size H) for the canvas aspect ratio. */
function fitDistance(H, aspect) {
  const vHalf = (FOV * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  return (1.95 * H) / Math.sin(Math.min(vHalf, hHalf));
}

/**
 * The transparent cube: 12 thin edge lines, a softly tinted floor and very faint walls/top. Everything transparent with
 * depthWrite=false and rendered after the opaque ions/electrons, so the contents always stay visible.
 */
function Cube({ groupRef }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)), []);
  const faces = useMemo(() => {
    const mk = (pos, rot) => ({ pos, rot });
    return {
      floor: mk([0, -1, 0], [-Math.PI / 2, 0, 0]),
      top: mk([0, 1, 0], [Math.PI / 2, 0, 0]),
      walls: [mk([0, 0, -1], [0, 0, 0]), mk([0, 0, 1], [0, Math.PI, 0]), mk([-1, 0, 0], [0, Math.PI / 2, 0]), mk([1, 0, 0], [0, -Math.PI / 2, 0])],
    };
  }, []);
  return (
    <group ref={groupRef} data-testid="cube">
      <lineSegments geometry={edges} renderOrder={3}>
        <lineBasicMaterial color="#5f78ad" transparent opacity={0.6} depthWrite={false} />
      </lineSegments>
      <mesh position={faces.floor.pos} rotation={faces.floor.rot} renderOrder={1}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial color="#6f9bf0" transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={faces.top.pos} rotation={faces.top.rot} renderOrder={1}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial color="#9db6e8" transparent opacity={0.035} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {faces.walls.map((w, i) => (
        <mesh key={i} position={w.pos} rotation={w.rot} renderOrder={1}>
          <planeGeometry args={[2, 2]} />
          <meshBasicMaterial color="#9db6e8" transparent opacity={0.04} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ metal, atomPos, sitePos, n, stage, runKey, playing, selectedIndex, lat, onMove, onSelect, onDone, apiRef, viewKey, reduced }) {
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const eng = useMemo(() => createEngine(), []);
  const coreRef = useRef(null); const eRef = useRef(null); const haloRef = useRef(null); const cubeRef = useRef(null);
  const matRef = useRef(null);
  const timeRef = useRef(0); const pRef = useRef(0); const doneRef = useRef(false);
  const hRef = useRef(cubeHalf(Math.max(1, n)));
  const fit = useRef({ active: true, dist: 0 });
  const drag = useRef(null);
  const live = useRef({});
  useEffect(() => { live.current = { atomPos, sitePos, n, stage, playing, selectedIndex, lat, v: metal.valence, onMove, onSelect, onDone }; });
  const neutral = useMemo(() => new THREE.Color(getBondingElement(metal.symbol).color), [metal.symbol]);
  const tmp = useMemo(() => ({ color: new THREE.Color(), plane: new THREE.Plane(), grab: new THREE.Vector3(), hit: new THREE.Vector3(), dir: new THREE.Vector3() }), []);
  const bigSphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(), 1000), []);

  const H = lat?.H ?? cubeHalf(Math.max(1, n));
  const targetH = useRef(H);
  useEffect(() => { targetH.current = H; }, [H]);
  const dist = fitDistance(H, size.width / Math.max(1, size.height));

  // re-fit the camera distance when the cube size (atom count) or the canvas shape changes; the user's rotation/zoom otherwise stays
  useEffect(() => { fit.current.active = true; fit.current.dist = dist; if (controls) { controls.maxDistance = dist * 2.4; controls.minDistance = Math.max(2.5, H * 0.8); } }, [dist, H, controls]);
  useEffect(() => { controls?.saveState?.(); }, [controls]);
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    camera.position.copy(DEFAULT_DIR).multiplyScalar(dist); camera.lookAt(0, 0, 0); controls?.update?.();
    fit.current.active = false;
  }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { pRef.current = 0; doneRef.current = false; }, [stage, runKey]);
  useEffect(() => { if (haloRef.current) haloRef.current.visible = false; }, []);
  useEffect(() => { const m = coreRef.current; if (m) m.boundingSphere = bigSphere; }, [bigSphere]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const L = live.current;
    if (L.playing) {
      timeRef.current += dt;
      if ((L.stage === "releasing" || L.stage === "forming") && !doneRef.current) {
        pRef.current = Math.min(1, pRef.current + (dt * (reduced ? 6 : 1)) / DURATION[L.stage]);
        if (pRef.current >= 1) { doneRef.current = true; L.onDone(L.stage); }
      }
    }
    // cube size follows the atom count smoothly
    hRef.current += (targetH.current - hRef.current) * (1 - Math.exp(-dt * 6));
    if (Math.abs(hRef.current - targetH.current) < 0.002) hRef.current = targetH.current;
    const h = hRef.current;
    cubeRef.current?.scale.setScalar(h);
    // camera glides to the framing distance (only while a re-fit is pending, so manual zoom is never fought)
    if (fit.current.active) {
      const cur = camera.position.length();
      const want = fit.current.dist; // framing distance for the final cube size
      const next = cur + (want - cur) * (1 - Math.exp(-dt * 5));
      if (Math.abs(next - want) < 0.02) { fit.current.active = false; }
      camera.position.multiplyScalar(next / Math.max(1e-6, cur));
    }
    const p = L.stage === "releasing" || L.stage === "forming" ? pRef.current : 1;
    stepEngine(eng, { atomPos: L.atomPos, sitePos: L.sitePos, n: L.n, v: L.v, stage: L.stage, p, time: timeRef.current, H: h, u: L.lat?.u ?? 1 });
    const core = coreRef.current; const el = eRef.current;
    if (core) writeMatrices(core, eng.corePos, eng.n, eng.coreRadius);
    if (el) writeMatrices(el, eng.elecPos, eng.nElec, R_ELECTRON);
    const mat = matRef.current;
    if (mat) { tmp.color.copy(neutral).lerp(CORE_COLOR, eng.mix); mat.color.copy(tmp.color); mat.emissive.copy(tmp.color); }
    const halo = haloRef.current;
    if (halo) {
      const si = L.selectedIndex;
      const on = si >= 0 && si < eng.n && (L.stage === "place" || L.stage === "released");
      halo.visible = on;
      if (on) { halo.position.set(eng.corePos[si * 3], eng.corePos[si * 3 + 1], eng.corePos[si * 3 + 2]); halo.scale.setScalar(eng.coreRadius * 1.35); }
    }
  });

  const draggable = stage === "place" || stage === "released";
  const handlers = useMemo(() => ({
    onPointerDown: (e) => {
      const L = live.current;
      if (L.stage !== "place" && L.stage !== "released") return;
      const i = e.instanceId;
      if (i == null || i >= L.n) return;
      e.stopPropagation();
      L.onSelect(i);
      tmp.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tmp.dir), e.point);
      tmp.grab.set(e.point.x - eng.corePos[i * 3], e.point.y - eng.corePos[i * 3 + 1], e.point.z - eng.corePos[i * 3 + 2]);
      drag.current = { i, pid: e.pointerId };
      if (controls) controls.enabled = false;
      e.target.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      if (e.ray.intersectPlane(tmp.plane, tmp.hit)) {
        const m = hRef.current - 0.47;
        const c = (v) => Math.max(-m, Math.min(m, v));
        live.current.onMove(d.i, [c(tmp.hit.x - tmp.grab.x), c(tmp.hit.y - tmp.grab.y), c(tmp.hit.z - tmp.grab.z)]);
      }
    },
    onPointerUp: (e) => { if (drag.current) { drag.current = null; if (controls) controls.enabled = true; e.target.releasePointerCapture?.(e.pointerId); } },
    onPointerOver: () => { if (live.current.stage === "place" || live.current.stage === "released") document.body.style.cursor = "grab"; },
    onPointerOut: () => { document.body.style.cursor = ""; },
  }), [camera, controls, eng, tmp]);

  const hi = n > 100;
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 8, 5]} intensity={1.1} />
      <directionalLight position={[-6, -3, -4]} intensity={0.35} />
      <ApiBridge apiRef={apiRef} />
      <instancedMesh ref={coreRef} args={[null, null, MAX_METAL_ATOMS]} frustumCulled={false} {...(draggable ? handlers : {})} onPointerCancel={handlers.onPointerUp} name="cores">
        <sphereGeometry args={[1, hi ? 14 : 28, hi ? 10 : 18]} />
        <meshLambertMaterial ref={matRef} color={neutral} emissiveIntensity={0.3} />
      </instancedMesh>
      <instancedMesh ref={eRef} args={[null, null, MAX_ELECTRONS]} frustumCulled={false} name="electrons">
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#3cc0ff" />
      </instancedMesh>
      <mesh ref={haloRef} visible={false} renderOrder={2}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color="#2f7bf5" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <Cube groupRef={cubeRef} />
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.1} minDistance={2.5} maxDistance={60} autoRotate={stage === "lattice" && playing && !reduced} autoRotateSpeed={0.9} />
    </>
  );
}

/**
 * The 3D metallic workspace: a transparent cube holding sphere atoms, then positive ion cores with a moving cloud of
 * delocalised electrons. Cores and electrons are two InstancedMeshes (no per-atom components); the electron motion is a
 * deliberately simplified illustration (smooth looping paths inside the cube), not a trajectory.
 */
export default function MetallicStage(props) {
  const { metal, stage, n, playing } = props;
  const aa = useMemo(() => !isSoftwareGL(), []); // multisampling is skipped only when WebGL runs on the CPU
  const cam = useMemo(() => {
    const d = fitDistance(cubeHalf(1), 1.6);
    return { position: DEFAULT_DIR.clone().multiplyScalar(d).toArray(), fov: FOV, near: 0.1, far: 400 };
  }, []);
  return (
    <div className="bv-3d" data-testid="metallic-stage" data-stage={stage} data-n={n}>
      <WebGLGate fallback="Metal ions (+) sit in a regular lattice inside a cube, surrounded by delocalized valence electrons that are shared throughout the whole structure.">
        <Canvas camera={cam} dpr={[1, 1.5]} frameloop={playing ? "always" : "demand"} gl={{ antialias: aa, powerPreference: "low-power" }}>
          <Scene {...props} />
        </Canvas>
      </WebGLGate>
      <div className="bv-legend" data-testid="metal-legend">
        {stage === "place" || stage === "releasing"
          ? <><span><i style={{ background: getBondingElement(metal.symbol).color }} />{metal.symbol} atom</span><span><i style={{ background: ELECTRON_COLOR }} />valence electron</span></>
          : <><span><i style={{ background: "#ef6c6c" }} />{chargeText(metal.symbol, metal.valence)} ion core</span><span><i style={{ background: ELECTRON_COLOR }} />delocalized electron</span></>}
      </div>
    </div>
  );
}
