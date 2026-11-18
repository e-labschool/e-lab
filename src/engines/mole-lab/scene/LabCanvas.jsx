import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import GuardedFrame from "../../shared-3d/GuardedFrame.jsx";
import CameraKeyApi from "../../shared-3d/CameraKeyApi.jsx";
import { makeTexture } from "./textures.js";
import { paintBackdrop } from "./backdrop.js";

const FOV = 24;

function LabEnvironment({ intensity }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl); const room = new RoomEnvironment(); const rt = pm.fromScene(room, 0.03);
    const prev = scene.environment; scene.environment = rt.texture; scene.environmentIntensity = intensity;
    return () => { scene.environment = prev; rt.dispose(); pm.dispose(); room.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); };
  }, [gl, scene, intensity]);
  return null;
}

/** Glossy light-grey laboratory bench; fades into the painted backdrop at the far edge. */
function Bench({ dark, reflect }) {
  const fade = useMemo(() => makeTexture(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.4, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,1)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }), []);
  useEffect(() => () => fade.dispose(), [fade]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0.5]}>
      <planeGeometry args={[60, 24]} />
      {reflect
        ? <MeshReflectorMaterial color={dark ? "#3a4560" : "#b4bfce"} roughness={0.85} metalness={0.05} envMapIntensity={dark ? 0.5 : 0.9} alphaMap={fade} transparent blur={[260, 80]} resolution={512} mixBlur={1.2} mixStrength={dark ? 0.7 : 0.75} mirror={0.6} depthScale={0.5} minDepthThreshold={0.6} maxDepthThreshold={1.4} />
        : <meshStandardMaterial color={dark ? "#3a4560" : "#b4bfce"} roughness={0.22} metalness={0.05} envMapIntensity={dark ? 0.5 : 0.95} alphaMap={fade} transparent depthWrite={false} />}
    </mesh>
  );
}

/** Frames `bounds` ({ w, h, cx, cy, depth }) for the viewport aspect; re-frames when the bounds or the viewport change; the student may orbit afterwards. */
function CameraRig({ bounds, focus, reduced, controlsRef }) {
  const { camera, size } = useThree();
  const st = useRef({ key: "", t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), tFrom: new THREE.Vector3(), tTo: new THREE.Vector3() });
  const aspect = size.width / Math.max(1, size.height);
  const plan = useMemo(() => {
    const th = Math.tan((FOV * Math.PI) / 360);
    if (focus) { const d = focus.distance; return { target: focus.target, pos: [focus.target[0], focus.target[1] + d * 0.12, focus.target[2] + d], key: `f${focus.key}` }; }
    const dH = (bounds.h * 1.1) / 2 / th; const dW = (bounds.w * 1.06) / 2 / (th * aspect);
    const d = Math.max(dH, dW) + bounds.depth * 0.5;
    const el = 0.07; // camera looks slightly down at the bench
    const target = [bounds.cx, bounds.cy, 0];
    return { target, pos: [bounds.cx, bounds.cy + Math.sin(el) * d, Math.cos(el) * d], key: `b${bounds.cx.toFixed(2)}|${bounds.cy.toFixed(2)}|${bounds.w.toFixed(2)}|${bounds.h.toFixed(2)}|${aspect.toFixed(2)}` };
  }, [bounds, focus, aspect]);
  useEffect(() => {
    const s = st.current; if (s.key === plan.key) return; s.key = plan.key;
    const c = controlsRef.current; s.from.copy(camera.position); s.tFrom.copy(c?.target ?? new THREE.Vector3()); s.to.set(...plan.pos); s.tTo.set(...plan.target);
    s.t = reduced || camera.position.lengthSq() < 1e-6 || camera.userData.__init !== true ? 1 : 0;
    if (s.t >= 1) { camera.position.copy(s.to); c?.target.copy(s.tTo); camera.lookAt(s.tTo); c?.update(); camera.userData.__init = true; }
  }, [plan, camera, controlsRef, reduced]);
  useFrame((_, dt) => { const s = st.current; if (s.t >= 1) return; s.t = Math.min(1, s.t + dt / 0.8); const k = s.t * s.t * (3 - 2 * s.t); camera.position.lerpVectors(s.from, s.to, k); const c = controlsRef.current; if (c) { c.target.lerpVectors(s.tFrom, s.tTo, k); c.update(); } else camera.lookAt(s.tTo); });
  return null;
}

function FpsMonitor({ onSlow, enabled }) {
  const acc = useRef({ t: 0, n: 0, warm: 0, fired: false });
  useFrame((_, dt) => {
    if (!enabled) return; const a = acc.current; a.warm += dt; if (a.warm < 3 || a.fired) return; a.t += dt; a.n += 1;
    if (a.t >= 2) { const fps = a.n / a.t; a.t = 0; a.n = 0; if (fps < 22) { a.fired = true; onSlow?.(fps); } }
  });
  return null;
}

/** The shared lab viewport for EVERY stage: painted backdrop, guarded transparent canvas (context loss, keyboard orbit), IBL, lights, bench, camera. */
export default function LabCanvas({ dark, reflect = false, bounds, focus, reduced, ariaLabel, testId, fallback, noGL, onSlow, children, overlay, onPointerMissed }) {
  const controlsRef = useRef(null); const bgRef = useRef(null);
  useEffect(() => { if (bgRef.current) paintBackdrop(bgRef.current, dark); }, [dark]);
  return (
    <div className="ml-viewport">
      <canvas ref={bgRef} className="ml-backdrop" aria-hidden="true" />
      <GuardedFrame className="ml-stage" testId={testId} ariaLabel={ariaLabel} fallback={fallback} noGL={noGL}
        render={({ canvasKey, aa, camRef }) => (
          <Canvas key={canvasKey} dpr={[1, 1.75]} frameloop="always" shadows={false} camera={{ fov: FOV, position: [0, 3, 14], near: 0.5, far: 120 }}
            gl={{ antialias: aa, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: dark ? 0.9 : 0.98 }}
            style={{ touchAction: "none" }} resize={{ scroll: false }} onPointerMissed={onPointerMissed}>
            <LabEnvironment intensity={dark ? 0.5 : 0.95} />
            <hemisphereLight args={[0xffffff, dark ? 0x3a4260 : 0xb4c0d6, dark ? 0.5 : 0.8]} />
            <directionalLight position={[4, 9, 7]} intensity={dark ? 1.0 : 1.5} />
            <directionalLight position={[-7, 4, 4]} intensity={0.45} color="#dfe9ff" />
            <CameraKeyApi apiRef={camRef} />
            <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableDamping dampingFactor={0.1} rotateSpeed={0.55} zoomSpeed={0.7} minPolarAngle={1.05} maxPolarAngle={1.52} minAzimuthAngle={-0.6} maxAzimuthAngle={0.6} minDistance={3} maxDistance={40} />
            <CameraRig bounds={bounds} focus={focus} reduced={reduced} controlsRef={controlsRef} />
            <FpsMonitor onSlow={onSlow} enabled={Boolean(onSlow)} />
            <Bench dark={dark} reflect={reflect} />
            {children}
          </Canvas>
        )}>{overlay}</GuardedFrame>
    </div>
  );
}
