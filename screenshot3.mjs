import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
await page.goto("http://localhost:4173/__debug-atomic-spectra", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

await page.getByRole("button", { name: "Energy Levels", exact: true }).click();
await page.waitForTimeout(200);
// absorption sub-mode is default; select n1->n2 bound transition
await page.getByRole("button", { name: "n1→2" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Send Photon" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/claude-0/-home-claude/b4c6c0c2-f7e0-5b05-9e10-7b8823193881/scratchpad/energy-bound.png", fullPage: true });

// now test ionization: from n1, click ionization target and send at higher energy
await page.getByRole("button", { name: /ionization/ }).click();
await page.waitForTimeout(150);
const slider = page.locator('input[type="range"]');
await slider.evaluate((el) => { el.value = (Number(el.max) ).toString(); el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Send Photon" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/claude-0/-home-claude/b4c6c0c2-f7e0-5b05-9e10-7b8823193881/scratchpad/energy-ionization.png", fullPage: true });

await browser.close();
