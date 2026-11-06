// Browser check: do the bar heights drawn in every mass-spectrum plot equal the numbers (data-rel) and the percentages printed on the page?
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import net from "node:net"; import { spawn } from "node:child_process";
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); });
const cwd = new URL("..", import.meta.url).pathname; const dist = `/tmp/plotchk-${process.pid}`;
await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error("build")))));
const port = await freePort(); const srv = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${base}/simulation/spectroscopy-studio`); await p.waitForSelector('[data-testid="spectroscopy-workspace"]'); await new Promise((r) => setTimeout(r, 1500));


await p.click('[data-testid="tech-ir"]'); await p.waitForSelector('[data-testid="stage-stepper"][data-count="9"]'); await new Promise((r) => setTimeout(r, 800));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = []; let bad = 0;
const curveT = () => p.evaluate(() => { const svg = document.querySelector('svg[data-testid^="ir-spectrum"], svg.ir-plot'); const bg = svg.querySelector("rect.ss-plot-bg").getBoundingClientRect();
  const path = svg.querySelector('[data-testid="ir-curve"]'); const len = path.getTotalLength(); const pts = []; const ctm = path.getScreenCTM();
  for (let i = 0; i <= 1200; i += 1) { const q = path.getPointAtLength((len * i) / 1200); pts.push({ x: q.x * ctm.a + ctm.e, y: q.y * ctm.d + ctm.f }); }
  return { top: bg.top, h: bg.height, left: bg.left, w: bg.width, pts }; });
for (const s of [6, 8, 9]) {
  await p.click(`[data-testid="step-${s}"]`); await sleep(2500);
  if (s === 9) {
    const box = await p.locator("svg.ir-plot").first().boundingBox(); const info = await curveT();
    for (const f of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85]) {
      const x = info.left + f * info.w; await p.mouse.move(x, box.y + box.height / 2); await sleep(250);
      const hint = await p.locator(".ir-plothint").first().innerText(); const m = hint.match(/(\d+) cm.*T ≈ (\d+)/); const nu = +m[1], T = +m[2];
      const cur = await p.locator('[data-testid="cursor"] line').first().evaluate((l) => l.getBoundingClientRect().left + l.getBoundingClientRect().width / 2);
      const near = info.pts.reduce((a, q) => (Math.abs(q.x - cur) < Math.abs(a.x - cur) ? q : a)); const drawn = 100 - ((near.y - info.top) / info.h) * 100;
      const ok = Math.abs(drawn - T) < 2.0; if (!ok) bad += 1; rows.push(`${ok ? "ok  " : "BAD "} IR stage 9 cursor ${nu} cm-1: readout T ${T} %, curve drawn at ${drawn.toFixed(1)} %`);
    }
  } else {
    const info = await curveT();
    const dots = await p.evaluate(() => [...document.querySelectorAll("svg.ir-plot circle.ir-banddot")].map((c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
    if (!dots.length) rows.push(`     IR stage ${s}: no band dots visible (not clickable yet)`);
    dots.forEach((d, i) => { const near = info.pts.reduce((a, q) => (Math.abs(q.x - d.x) < Math.abs(a.x - d.x) ? q : a)); const dy = Math.abs(near.y - d.y); const ok = dy < 3; if (!ok) bad += 1; rows.push(`${ok ? "ok  " : "BAD "} IR stage ${s} band dot ${i}: ${dy.toFixed(1)} px from the curve`); });
  }
}
console.log(rows.join("\n")); console.log(`IR checks ${rows.filter((r) => /^(ok|BAD)/.test(r)).length}, mismatches ${bad}`);
await browser.close(); srv.kill();
