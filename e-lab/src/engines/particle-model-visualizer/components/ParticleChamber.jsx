import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Box } from "lucide-react";
import { PALETTE } from "../data/palette.js";

function detectWebGL() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

/**
 * The chamber viewport. Exposes reset() via ref so the surrounding control
 * bar can offer a single "Reset View" action instead of a second, floating
 * button duplicating the same job.
 */
const ParticleChamber = forwardRef(function ParticleChamber({ children, height = 420, fallbackDescription }, ref) {
  const webglAvailable = useMemo(() => detectWebGL(), []);
  const mobile = useMemo(() => isMobileViewport(), []);
  const controlsRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset: () => controlsRef.current?.reset(),
  }));

  if (!webglAvailable) {
    return (
      <div
        style={{ height, background: PALETTE.bg, borderColor: PALETTE.border }}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border px-6 text-center"
      >
        <Box size={22} style={{ color: PALETTE.textFaint }} />
        <p className="text-sm font-medium" style={{ color: PALETTE.textPrimary }}>3D chamber unavailable on this device</p>
        {fallbackDescription && <p className="max-w-sm text-xs" style={{ color: PALETTE.textSecondary }}>{fallbackDescription}</p>}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg border"
      style={{ height, background: PALETTE.bgGradient, borderColor: PALETTE.border }}
    >
      <Canvas
        dpr={mobile ? [1, 1.25] : [1, 2]}
        camera={{ position: [4.6, 3.6, 7.1], fov: 38 }}
        gl={{ antialias: !mobile, powerPreference: "low-power", alpha: true }}
      >
        <ambientLight intensity={0.42} />
        <directionalLight position={[5, 7, 4]} intensity={1.15} color="#EAF0FF" />
        <directionalLight position={[-5, 2, -4]} intensity={0.35} color="#6C86EE" />
        <pointLight position={[0, -2.4, 1.5]} intensity={0.25} color="#3FA9A0" />

        {children}

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          minDistance={5.5}
          maxDistance={11}
          minPolarAngle={0.45}
          maxPolarAngle={2.35}
        />
      </Canvas>

      <p
        className="pointer-events-none absolute left-2.5 top-2.5 rounded-md border px-2 py-1 text-[10px] tracking-wide backdrop-blur"
        style={{ borderColor: PALETTE.borderStrong, background: `${PALETTE.panelRaised}B3`, color: PALETTE.textSecondary }}
      >
        Drag to rotate &middot; scroll to zoom
      </p>
    </div>
  );
});

export default ParticleChamber;
