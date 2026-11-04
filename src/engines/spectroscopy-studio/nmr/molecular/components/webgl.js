// WebGL probes. Each probe creates a context, and browsers cap live contexts (about 16), so the answer is computed once per page and the probe
// context is released immediately; otherwise switching stages repeatedly would exhaust the limit.
let probe = null;
function run() {
  if (probe) return probe;
  probe = { webgl: false, software: false };
  if (typeof window === "undefined") return probe;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    probe.webgl = Boolean(window.WebGLRenderingContext && gl);
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
      probe.software = /swiftshader|llvmpipe|softpipe|software/i.test(name);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch { /* leave the defaults */ }
  return probe;
}
export function detectWebGL() { return run().webgl; }
/** True when WebGL is emulated on the CPU (SwiftShader, llvmpipe, ...): multisampling is skipped there because it is very slow. */
export function isSoftwareGL() { return run().software; }
