import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });

// Mobile viewport, normal motion
let page = await browser.newPage({ viewport: { width: 375, height: 1400 } });
await page.goto("http://localhost:4173/__debug-atomic-spectra", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/claude-0/-home-claude/b4c6c0c2-f7e0-5b05-9e10-7b8823193881/scratchpad/mobile-emission.png", fullPage: true });
await page.getByRole("button", { name: "Absorption", exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/claude-0/-home-claude/b4c6c0c2-f7e0-5b05-9e10-7b8823193881/scratchpad/mobile-absorption.png", fullPage: true });
await page.close();

// reduced motion
const page2 = await browser.newPage({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
await page2.goto("http://localhost:4173/__debug-atomic-spectra", { waitUntil: "networkidle" });
await page2.waitForTimeout(300);
await page2.screenshot({ path: "/tmp/claude-0/-home-claude/b4c6c0c2-f7e0-5b05-9e10-7b8823193881/scratchpad/reduced-motion.png", fullPage: true });
await page2.close();

await browser.close();
