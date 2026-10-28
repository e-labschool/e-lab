import { useMemo } from "react";
import { Box } from "lucide-react";
import { detectWebGL } from "./webgl.js";

/** Renders `children` only when WebGL is available; otherwise a clear text fallback (3D is never the only way to read the result). */
export default function WebGLGate({ children, fallback }) {
  const ok = useMemo(() => detectWebGL(), []);
  if (ok) return children;
  return (
    <div className="bv-nogl" data-testid="webgl-fallback" role="status">
      <Box size={22} aria-hidden="true" />
      <p><b>3D view unavailable on this device.</b></p>
      {fallback && <p>{fallback}</p>}
    </div>
  );
}
