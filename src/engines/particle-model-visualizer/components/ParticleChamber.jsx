import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { RotateCcw, Box } from "lucide-react";

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
 * The chamber always renders on its own dark "instrument viewport"
 * background, independent of the site's light/dark theme — the same way a
 * map or video player keeps its own chrome. Everything around the chamber
 * (control panel, info card) still uses the e-Lab theme tokens so it sits
 * naturally in Learn content either way.
 */
export default function ParticleChamber({ children, height = 420, fallbackDescription }) {
  const webglAvailable = useMemo(() => detectWebGL(), []);
  const mobile = useMemo(() => isMobileViewport(), []);
  const controlsRef = useRef(null);

  if (!webglAvailable) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0B0E15] px-6 text-center"
      >
        <Box size={22} className="text-[#5B6478]" />
        <p className="text-sm font-medium text-[#E7E9EF]">3D chamber unavailable on this device</p>
        {fallbackDescription && <p className="max-w-sm text-xs text-[#7B8298]">{fallbackDescription}</p>}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[#232B3D]"
      style={{
        height,
        background: "radial-gradient(120% 100% at 50% 8%, #182034 0%, #0C0F17 55%, #090B10 100%)",
      }}
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

      <button
        type="button"
        onClick={() => controlsRef.current?.reset()}
        aria-label="Reset view"
        title="Reset view"
        className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#2A3244] bg-[#12161F]/85 text-[#9BA3B8] backdrop-blur transition-colors hover:text-[#E7E9EF]"
      >
        <RotateCcw size={13} />
      </button>
      <p className="pointer-events-none absolute left-2.5 top-2.5 rounded-md border border-[#2A3244] bg-[#12161F]/70 px-2 py-1 text-[10px] tracking-wide text-[#8890A3] backdrop-blur">
        Drag to rotate &middot; scroll to zoom
      </p>
    </div>
  );
}
