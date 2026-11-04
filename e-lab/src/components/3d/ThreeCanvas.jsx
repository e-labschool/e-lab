import { useState, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { RotateCcw, Box } from "lucide-react";

// Shared scene shell for every 3D interactive in e-Lab — one place that
// decides camera, lighting, controls, mobile degradation, and the WebGL
// fallback, so individual viewers (MoleculeViewer3D, future lattice/
// stereochemistry viewers) only need to describe the science, not re-solve
// "how do we render a scene" each time.
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

export default function ThreeCanvas({ children, height = 360, cameraDistance = 6, fallbackDescription, fallbackLabel = "3D view" }) {
  const [resetKey, setResetKey] = useState(0);
  const webglAvailable = useMemo(() => detectWebGL(), []);
  const mobile = useMemo(() => isMobileViewport(), []);
  const controlsRef = useRef(null);

  // A 3D scene is never the ONLY way essential information is conveyed —
  // every viewer using this wrapper must be given a fallbackDescription,
  // shown here if WebGL genuinely isn't available.
  if (!webglAvailable) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-paper-raised)] px-6 text-center"
      >
        <Box size={22} className="text-[var(--color-ink-faint)]" />
        <p className="text-sm font-medium text-[var(--color-ink)]">{fallbackLabel} unavailable on this device</p>
        {fallbackDescription && <p className="max-w-sm text-xs text-[var(--color-ink-faint)]">{fallbackDescription}</p>}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)]" style={{ height }}>
      <Canvas
        key={resetKey}
        dpr={mobile ? [1, 1.25] : [1, 2]}
        camera={{ position: [cameraDistance * 0.6, cameraDistance * 0.4, cameraDistance], fov: 45 }}
        gl={{ antialias: !mobile, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 5]} intensity={1.1} />
        <directionalLight position={[-4, -3, -5]} intensity={0.3} />
        {children}
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={cameraDistance * 0.5}
          maxDistance={cameraDistance * 2}
          enableDamping
          dampingFactor={0.1}
        />
      </Canvas>

      <button
        type="button"
        onClick={() => setResetKey((k) => k + 1)}
        aria-label="Reset view"
        title="Reset view"
        className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-paper)]/90 text-[var(--color-ink-soft)] backdrop-blur hover:text-[var(--color-ink)]"
      >
        <RotateCcw size={14} />
      </button>
      <p className="pointer-events-none absolute left-2.5 top-2.5 rounded-md bg-[var(--color-paper)]/80 px-2 py-1 text-[10px] text-[var(--color-ink-faint)] backdrop-blur">
        Drag to rotate &middot; scroll to zoom
      </p>
    </div>
  );
}
