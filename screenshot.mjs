import { chromium } from "playwright-core";

const url = process.argv[2] || "http://localhost:4173/__debug-atomic-spectra";
const outPath = process.argv[3] || "/tmp/claude-0/-home-claude/b4c6c0c2-f7e0-5b05-9e10-7b8823193881/scratchpad/shot.png";
const width = Number(process.argv[4] || 1280);
const height = Number(process.argv[5] || 1400);
const actions = process.argv[6]; // JSON array of {click: "selector"} steps, optional

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

if (actions) {
  const steps = JSON.parse(actions);
  for (const step of steps) {
    if (step.click) {
      await page.click(step.click);
      await page.waitForTimeout(250);
    }
  }
}

await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log("saved", outPath);
