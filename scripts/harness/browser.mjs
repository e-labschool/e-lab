// Shared helpers for the headless-Chromium verify scripts: starts the
// mock-Supabase dev server if nothing listens on the port, launches Chromium,
// and provides tiny check/report utilities.
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
export const PORT = Number(process.env.HARNESS_PORT || 5301);
export const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
  });
}

export async function startServer() {
  if (await portOpen(PORT)) return () => {};
  const child = spawn("npx", ["vite", "--config", "scripts/harness/vite.harness.config.js"], { cwd: root, stdio: "ignore" });
  for (let i = 0; i < 100; i += 1) { if (await portOpen(PORT)) break; await new Promise((r) => setTimeout(r, 200)); }
  return () => child.kill();
}

export async function launch() {
  const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
  return chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
}

export function reporter() {
  const problems = [];
  let checks = 0;
  return {
    check(cond, msg) { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } else console.log("  ok  ", msg); },
    done() {
      console.log(`\n${checks - problems.length}/${checks} checks passed`);
      if (problems.length) { console.log("FAILURES:\n - " + problems.join("\n - ")); process.exitCode = 1; }
    },
  };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
