// Temp production build + `vite preview` on a free port for the verify scripts (does not touch dist/).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on("error", reject);
  });
}

/** Builds to a temp dir (or reuses PREVIEW_DIST) and serves it. Returns { base, stop }. */
export async function startPreview() {
  const out = process.env.PREVIEW_DIST || fs.mkdtempSync(path.join(os.tmpdir(), "elab-verify-"));
  if (!process.env.PREVIEW_DIST) {
    const r = spawnSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir"], { cwd: root, stdio: "ignore" });
    if (r.status !== 0) throw new Error("vite build failed");
  }
  const port = await freePort();
  const child = spawn("npx", ["vite", "preview", "--outDir", out, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  for (let i = 0; i < 100; i += 1) {
    const ok = await new Promise((res) => { const c = net.connect(port, "127.0.0.1"); c.on("connect", () => { c.destroy(); res(true); }); c.on("error", () => res(false)); });
    if (ok) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return { base: `http://127.0.0.1:${port}`, stop: () => { child.kill(); if (!process.env.PREVIEW_DIST) fs.rmSync(out, { recursive: true, force: true }); } };
}
