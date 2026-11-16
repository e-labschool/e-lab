// WebGL capability probes shared by the four 3D chemistry engines.  The probe contexts are released immediately
// (WEBGL_lose_context) so the page does not burn two of the browser's ~16 live contexts on every mount.
function probe() {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return gl ? { gl, canvas } : null;
  } catch { return null; }
}
const release = (p) => { try { p?.gl?.getExtension?.("WEBGL_lose_context")?.loseContext?.(); } catch { /* ignore */ } };

export function detectWebGL() {
  if (typeof window === "undefined" || !window.WebGLRenderingContext) return false;
  const p = probe(); const ok = Boolean(p); release(p); return ok;
}
/** True when WebGL is emulated on the CPU (SwiftShader, llvmpipe, ...): multisampling is skipped there because it is very slow. */
export function isSoftwareGL() {
  const p = probe(); if (!p) return false;
  try {
    const ext = p.gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(p.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|llvmpipe|softpipe|software/i.test(name);
  } catch { return false; } finally { release(p); }
}
