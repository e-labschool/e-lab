import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import GuardedFrame from "../../shared-3d/GuardedFrame.jsx";
import CameraKeyApi from "../../shared-3d/CameraKeyApi.jsx";
import { benchTexture, makeTexture } from "./textures.js";
import { BENCH_HALF_X, BENCH_HALF_Z } from "./benchLayout.js";

/** Image-based lighting from three's built-in RoomEnvironment (generated on the GPU, no network): soft reflections on plastic and particles. */
function LabEnvironment({ intensity = 0.85 }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl); const room = new RoomEnvironment(); const rt = pm.fromScene(room, 0.04);
    const prev = scene.environment; scene.environment = rt.texture; scene.environmentIntensity = intensity;
    return () => { scene.environment = prev; rt.dispose(); pm.dispose(); room.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); };
  }, [gl, scene, intensity]);
  return null;
}

function Bench({ dark, children }) {
  const tex = useMemo(() => benchTexture(dark ? "#1d2436" : "#cfd6ea", dark), [dark]);
  const fade = useMemo(() => makeTexture(256, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.5); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.7, "rgba(255,255,255,0.85)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h); }), []);
  useEffect(() => () => { tex.dispose(); }, [tex]);
  useEffect(() => () => { fade.dispose(); }, [fade]);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 5);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.5]} receiveShadow={false}>
        <planeGeometry args={[BENCH_HALF_X * 2 + 10, BENCH_HALF_Z * 2 + 8]} />
        <meshStandardMaterial map={tex} alphaMap={fade} transparent roughness={0.8} metalness={0} envMapIntensity={0.2} color={dark ? "#9aa3bd" : "#c9d0e6"} depthWrite={false} />
      </mesh>
      {children}
    </group>
  );
}

/** Moves the camera to `focus` ({ target:[x,y,z], distance }) whenever the focus key changes; the student can then orbit freely. */
function CameraRig({ focus, reduced, controlsRef }) {
  const { camera } = useThree();
  const state = useRef({ key: null, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), tFrom: new THREE.Vector3(), tTo: new THREE.Vector3() });
  const key = `${focus.target.map((n) => n.toFixed(2)).join(",")}|${focus.distance.toFixed(2)}|${focus.nonce ?? 0}`;
  useEffect(() => {
    const s = state.current; if (s.key === key) return;
    const c = controlsRef.current; const tgt = c?.target ?? new THREE.Vector3();
    s.key = key; s.from.copy(camera.position); s.tFrom.copy(tgt);
    s.tTo.set(...focus.target); const d = focus.distance; s.to.set(focus.target[0], focus.target[1] + d * 0.3, focus.target[2] + d * 0.95);
    s.t = reduced ? 1 : 0;
    if (reduced) { camera.position.copy(s.to); c?.target.copy(s.tTo); c?.update(); }
  }, [key, camera, controlsRef, focus, reduced]);
  useFrame((_, dt) => {
    const s = state.current; if (s.t >= 1) return; s.t = Math.min(1, s.t + dt / 0.85); const k = s.t * s.t * (3 - 2 * s.t);
    camera.position.lerpVectors(s.from, s.to, k); const c = controlsRef.current; if (c) { c.target.lerpVectors(s.tFrom, s.tTo, k); c.update(); } else camera.lookAt(s.tTo);
  });
  return null;
}

/** Counts frames; reports a low-fps condition ONCE so the packet detail level can step down (adaptive detail, spec H). */
function FpsMonitor({ onSlow, enabled }) {
  const acc = useRef({ t: 0, n: 0, warm: 0, fired: false });
  useFrame((_, dt) => {
    if (!enabled) return; const a = acc.current; a.warm += dt; if (a.warm < 2.5 || a.fired) return; a.t += dt; a.n += 1;
    if (a.t >= 2) { const fps = a.n / a.t; a.t = 0; a.n = 0; if (fps < 24) { a.fired = true; onSlow?.(fps); } }
  });
  return null;
}

/** The shared lab viewport for EVERY stage: guarded canvas (context-loss + keyboard orbit), IBL, lights, bench, camera rig. */
export default function LabCanvas({ dark, focus, reduced, ariaLabel, testId, fallback, noGL, onSlow, children, overlay, onKeyDownCapture }) {
  const controlsRef = useRef(null);
  return (
    <GuardedFrame
      className="ml-stage" testId={testId} ariaLabel={ariaLabel} fallback={fallback} noGL={noGL}
      onKeyDownCapture={onKeyDownCapture}
      render={({ canvasKey, aa, camRef }) => (
        <Canvas
          key={canvasKey} flat dpr={[1, 1.6]} frameloop="always" shadows={false}
          camera={{ fov: 32, position: [0, focus.distance * 0.3, focus.distance * 0.95 + 0], near: 0.1, far: 120 }}
          gl={{ antialias: aa, alpha: true, powerPreference: "low-power", preserveDrawingBuffer: false }} style={{ touchAction: "none" }} resize={{ scroll: false }}
        >
          <LabEnvironment />
          <hemisphereLight args={[0xffffff, dark ? 0x3a4260 : 0x9aa4c4, dark ? 0.55 : 0.75]} />
          <directionalLight position={[4.5, 8, 6]} intensity={dark ? 1.1 : 1.45} />
          <directionalLight position={[-6, 4, 3]} intensity={0.35} />
          <CameraKeyApi apiRef={camRef} />
          <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableDamping dampingFactor={0.1} rotateSpeed={0.7} zoomSpeed={0.7} minPolarAngle={0.55} maxPolarAngle={1.5} minAzimuthAngle={-0.9} maxAzimuthAngle={0.9} minDistance={2.2} maxDistance={40} target={focus.target} />
          <CameraRig focus={focus} reduced={reduced} controlsRef={controlsRef} />
          <FpsMonitor onSlow={onSlow} enabled={Boolean(onSlow)} />
          <Bench dark={dark}>{children}</Bench>
        </Canvas>
      )}
    >{overlay}</GuardedFrame>
  );
}
