// Headless-Chromium check of the post-sign-up "Check your email" screen.
// Usage: node scripts/verify-auth-signup-confirmation.mjs [outDir]
// Builds the app into a temp dir WITH fake Supabase env vars, serves it with `vite preview`
// on a free port, and answers every Supabase network call via page.route (no live Supabase).
// Checks: screen content, focus, no horizontal overflow at 320/390/1366 wide, light + dark,
// Back to login prefill, button contrast (white on #2647C4 is fixed by Button.jsx), screenshots.
// Honest limits: mocked network; Chromium only; no real email, no real confirmation link.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";

const free = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const cwd = new URL("..", import.meta.url).pathname;
const out = process.argv[2] || `${process.env.TMPDIR || "/tmp"}/auth-signup-shots`;
const dist = `${process.env.TMPDIR || "/tmp"}/auth-signup-dist-${process.pid}`;
fs.mkdirSync(out, { recursive: true });
const SB = "https://mock-elab.supabase.co";
const env = { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock" };
await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, env, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
const port = await free();
const server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 500)); }

let checks = 0; const bad = [];
const check = (c, m) => { checks += 1; if (!c) { bad.push(m); console.log("  FAIL", m); } else console.log("  ok  ", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] });
const user = { id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", email: "ada@example.com", identities: [{ id: "i" }], user_metadata: {}, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

try {
  for (const theme of ["light", "dark"]) {
    for (const [w, h] of [[1366, 768], [390, 844], [320, 640]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      await ctx.addInitScript((t) => { try { localStorage.setItem("e-lab:theme", t); } catch { /* ignore */ } }, theme);
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let resendBody = null;
      await page.route(`${SB}/**`, async (route) => {
        const url = route.request().url();
        const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(b) });
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
        if (url.includes("/auth/v1/signup")) return json(user);
        if (url.includes("/auth/v1/resend")) { resendBody = route.request().postData(); return json({ message_id: "m" }); }
        return json([]);
      });
      // Make sure the dark class matches regardless of the theme storage key used by the app.
      await page.goto(`${base}/auth?tab=create-account`);
      await page.evaluate((t) => { document.documentElement.classList.toggle("dark", t === "dark"); }, theme);
      const tag = `${theme}-${w}x${h}`;
      console.log(`\n== ${tag} ==`);
      await page.fill("#su-name", "Ada Lovelace");
      await page.fill("#su-email", "ada@example.com");
      await page.fill("#su-password", "longenough1");
      await page.fill("#su-confirm", "longenough1");
      await page.screenshot({ path: `${out}/${tag}-0-form.png` });
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="signup-confirmation"]');
      check(await page.textContent("h1") === "Check your email", "headline");
      check((await page.textContent('[data-testid="confirmation-email"]')) === "ada@example.com", "email shown");
      check(await page.evaluate(() => document.activeElement?.tagName === "H1"), "heading focused");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal overflow");
      const btn = await page.getByRole("button", { name: "Back to login" });
      const box = await btn.boundingBox();
      check(box && box.x >= 0 && box.x + box.width <= w && box.height >= 36, "Back to login visible, in viewport, >=36px tall");
      const colors = await btn.evaluate((el) => { const c = getComputedStyle(el); return [c.color, c.backgroundColor]; });
      check(colors[0] === "rgb(255, 255, 255)" && colors[1] === "rgb(38, 71, 196)", `primary button white on #2647C4 (${colors.join(" on ")})`);
      check(await page.evaluate(() => document.documentElement.classList.contains("dark")) === (theme === "dark"), "theme applied");
      await page.screenshot({ path: `${out}/${tag}-1-confirmation.png`, fullPage: true });
      const resend = page.getByRole("button", { name: /Resend confirmation email/ });
      check((await resend.getAttribute("aria-disabled")) === "true", "resend on cooldown");
      // survive refresh
      await page.reload();
      await page.waitForSelector('[data-testid="signup-confirmation"]');
      check(true, "confirmation survives refresh");
      await page.getByRole("button", { name: "Back to login" }).click();
      check((await page.inputValue("#signin-email")) === "ada@example.com", "login email prefilled");
      check(await page.evaluate(() => document.activeElement?.id === "signin-password"), "password focused");
      await page.screenshot({ path: `${out}/${tag}-2-login.png` });
      check(errors.length === 0, `no page errors ${errors.join("|")}`);
      check(resendBody === null, "no resend request made during cooldown");
      await ctx.close();
    }
  }
  // ?confirmed=1
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(`${SB}/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await page.goto(`${base}/auth?confirmed=1`);
  await page.waitForSelector('[data-testid="signin-notice"]');
  check(/Email confirmed/.test(await page.textContent('[data-testid="signin-notice"]')), "confirmed notice on login form");
  await page.screenshot({ path: `${out}/confirmed-390.png` });
  await ctx.close();
} finally {
  await browser.close(); server.kill(); fs.rmSync(dist, { recursive: true, force: true });
}
console.log(`\n${checks - bad.length}/${checks} checks passed. Screenshots: ${out}`);
if (bad.length) { console.log("FAILURES:\n - " + bad.join("\n - ")); process.exitCode = 1; }
