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
await p.click('[data-testid="tech-ms"]'); await p.waitForSelector('[data-testid="stage-stepper"][data-count="13"]');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const measure = () => p.evaluate(() => [...document.querySelectorAll("svg.ms-spec")].map((svg) => {
  const bg = svg.querySelector("rect.ss-plot-bg").getBoundingClientRect(); const ticks = [...svg.querySelectorAll("text.ss-tick")].map((t) => t.textContent);
  const yl = [...svg.querySelectorAll("text.ss-axis-label")].map((t) => t.textContent);
  return { id: svg.dataset.testid, yl: yl[1], bars: [...svg.querySelectorAll("g.ms-peak")].map((g) => { const r = g.querySelector("rect.ms-bar").getBoundingClientRect(); return { mz: +g.dataset.mz, rel: +g.dataset.rel, px: (r.height / bg.height) * 100 }; }) };
}));
let bad = 0; const rows = [];
const report = (stage, tag, ms) => ms.forEach((m) => m.bars.forEach((b) => { const ok = Math.abs(b.px - b.rel) < 1.0; if (!ok) bad += 1; rows.push(`${ok ? "ok  " : "BAD "} stage ${stage} ${tag} ${m.id} [${m.yl}] m/z ${b.mz}: data ${b.rel.toFixed(1)}  drawn ${b.px.toFixed(1)}`); }));
for (let s = 1; s <= 13; s += 1) {
  await p.click(`[data-testid="step-${s}"]`); await sleep(5500);
  if (s === 9 || s === 12 || s === 13 || s === 8) { /* some need actions */ }
  const m = await measure(); if (m.length) report(s, "", m);
  if (s === 10) {
    for (const v of [75, 24.24, 10, 1]) { await p.locator('[data-testid="abundance-slider"]').first().evaluate((el, val) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(val)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, v); await sleep(3500); const mm = await measure(); report(s, `slider ${v}`, mm); const b = mm[0].bars.map((x) => `${x.mz}:${x.px.toFixed(1)}`).join(" "); rows.push(`     slider ${v} => drawn heights ${b}`); }
  }
  if (s === 8) { await p.click('[data-testid="detect-ions"]'); await sleep(7000); report(s, "mid-detect", await measure()); await sleep(9000); const mm = await measure(); report(s, "after detect", mm); rows.push("     final detect heights " + mm[0].bars.map((x) => `${x.mz}:${x.px.toFixed(1)}`).join(" ")); }
  if (s === 13) { await p.click('[data-testid="reveal-ms"]').catch(() => {}); await sleep(1500); const mm = await measure(); report(s, "evidence", mm); }
  if (s === 11) { for (const c of await p.locator('[data-testid^="compound-"]').all()) { await c.click(); await sleep(4500); report(s, "compound", await measure()); } }
}
console.log(rows.join("\n")); console.log(`\nbars checked ${rows.filter((r) => /^(ok|BAD)/.test(r)).length}, mismatches ${bad}`);
await browser.close(); srv.kill();
