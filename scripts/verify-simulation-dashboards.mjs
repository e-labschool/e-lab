// Headless-Chromium layout verification for the shared simulation dashboard.
// Usage: node scripts/verify-simulation-dashboards.mjs [baseUrl] [outDir]
// Requires a running dev server (npm run dev) and Playwright + chromium.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:5199";
const out = process.argv[3] || "/tmp/sim-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const sizes = [[1366, 768], [1440, 900], [1920, 1080]];
const problems = [];
let shots = 0;

async function overflow(p, label) {
  const r = await p.evaluate(() => {
    const d = document.documentElement;
    const ws = document.querySelector('[data-testid="workspace"]');
    const bad = [];
    if (ws) {
      const wr = ws.getBoundingClientRect();
      for (const el of ws.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.position === "absolute" && el.closest('[role="dialog"],[data-popover]')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.right > wr.right + 2 || r.bottom > wr.bottom + 2) bad.push(`${el.tagName}.${String(el.className).slice(0, 40)}`);
      }
    }
    return { vs: d.scrollHeight - innerHeight, hs: d.scrollWidth - innerWidth, bad: bad.slice(0, 4) };
  });
  if (r.vs > 1 || r.hs > 1 || r.bad.length) problems.push(`${label}: ${JSON.stringify(r)}`);
}
async function snap(p, label) {
  await p.waitForTimeout(500);
  await overflow(p, label);
  await p.screenshot({ path: `${out}/${label}.png` }); shots++;
}
const click = async (p, t) => { await p.locator(`button:has-text("${t}"), [role=tab]:has-text("${t}"), [role=radio]:has-text("${t}")`).first().click(); await p.waitForTimeout(350); };

for (const [w, h] of sizes) {
  const tag = `${w}x${h}`;
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(m.text()); });

  await p.goto(`${base}/simulation/ideal-gas-simulation`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.waitForTimeout(1000);
  await snap(p, `ig-${tag}-hidden`);
  await p.click('[data-testid="graph-toggle"]'); await snap(p, `ig-${tag}-graph`);
  await click(p, "Real Gas"); await snap(p, `ig-${tag}-real`);
  await click(p, "Change Volume"); await snap(p, `ig-${tag}-real-volume`);
  await click(p, "Ideal Gas"); await snap(p, `ig-${tag}-ideal-volume`);
  await click(p, "Settings"); await snap(p, `ig-${tag}-settings`); await p.keyboard.press("Escape");
  await click(p, "Reset"); await snap(p, `ig-${tag}-reset`);

  await p.goto(`${base}/simulation/gas-laws-explorer`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.waitForTimeout(1000);
  for (const m of ["P–V", "V–T", "P–T", "V–n"]) {
    await click(p, m); await snap(p, `gl-${tag}-${m}-hidden`);
    const g = p.locator('[data-testid="graph-toggle"]');
    if ((await g.getAttribute("aria-pressed")) !== "true") await g.click();
    await snap(p, `gl-${tag}-${m}-graph`);
    await g.click();
  }
  await click(p, "Settings"); await snap(p, `gl-${tag}-settings`); await p.keyboard.press("Escape");
  if (errs.length) problems.push(`${tag} console: ${errs.slice(0, 3).join(" | ")}`);
  await p.close();
}

// Learn-with-sidebar equivalent: embed width = viewport - 260px sidebar (container-driven layout)
{
  const p = await b.newPage({ viewport: { width: 1366 - 260 + 0, height: 768 } });
  await p.goto(`${base}/simulation/ideal-gas-simulation`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.click('[data-testid="graph-toggle"]');
  await snap(p, "ig-learn-width"); await p.close();
}
// narrow
{
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  await p.goto(`${base}/simulation/gas-laws-explorer`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/gl-narrow.png` }); shots++; await p.close();
}
await b.close();
console.log(`${shots} screenshots in ${out}`);
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "no overflow/console problems detected");
process.exit(problems.length ? 1 : 0);
