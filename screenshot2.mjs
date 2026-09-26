import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
await page.goto("http://localhost:4173/__debug-atomic-spectra", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.getByRole("button", { name: "H", exact: true }).click();
await page.getByRole("button", { name: "Compare", exact: true }).click();
await page.waitForTimeout(300);

const svgs = await page.locator('svg[role="img"]').all();
console.log("svg count", svgs.length);
const box = await svgs[0].boundingBox();
// click near the H-alpha line (rightmost, longest wavelength ~656nm out of 380-750 range)
const clickX = box.x + box.width * ((656.3 - 380) / (750 - 380));
const clickY = box.y + box.height / 2;
await page.mouse.click(clickX, clickY);
await page.waitForTimeout(300);

await page.screenshot({ path: "/tmp/claude-0/-home-claude/b4c6c0c2-f7e0-5b05-9e10-7b8823193881/scratchpad/compare-hydrogen-clicked.png", fullPage: true });
await browser.close();
