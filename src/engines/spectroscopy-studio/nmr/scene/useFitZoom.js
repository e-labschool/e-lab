import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Zooms the camera out when the canvas is narrower than the scene needs (phones): `aspectNeeded` is the width / height the composition
 * requires. The vertical extent is already fixed by the camera's field of view, so only a narrow canvas needs help. Never zooms in.
 */
export function useFitZoom(aspectNeeded = 1) {
  const camera = useThree((s) => s.camera); const w = useThree((s) => s.size.width); const h = useThree((s) => s.size.height);
  const zoom = Math.max(0.45, Math.min(1, w / Math.max(1, h) / aspectNeeded));
  useEffect(() => { camera.zoom = zoom; camera.updateProjectionMatrix(); }, [camera, zoom]);
  return { compact: w < 430, zoom };
}
