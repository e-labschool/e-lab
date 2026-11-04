#!/usr/bin/env node
// Headless-Chromium verification of PART 4 (simulation/Learn state survives
// tab switches, reload, back/forward) and PART 5 (admin editor state), against
// the REAL app with src/lib/supabaseClient.js swapped for
// scripts/harness/mock-supabase.js (starts its own Vite server on :5301).
//
// Usage: node scripts/verify-state-persistence.mjs [outDir]
//
// HOW "TAB SWITCH" IS SIMULATED (be careful what this proves):
//  * page.bringToFront() between two real pages, plus dispatching the events a
//    browser fires (visibilitychange, window blur/focus).
//  * The supabase-js behaviour that caused the original bug (re-emitting
//    SIGNED_IN / TOKEN_REFRESHED when the tab becomes visible) is reproduced
//    through the mock's emitter, with 150 ms of simulated network latency on
//    every query so the old "loading" window is really observable.
// NOT proven here: real Supabase refresh timing, a truly hidden tab (headless
// Chromium keeps both pages "visible"), other browsers.
import fs from "node:fs";
import { BASE, startServer, launch, reporter, sleep } from "./harness/browser.mjs";

const out = process.argv[2] || "/tmp/state-verify";
fs.mkdirSync(out, { recursive: true });
const stop = await startServer();
const browser = await launch();
const R = reporter();
const { check } = R;
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });

async function fresh(role) {
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));
  page.on("pageerror", (e) => check(false, `page error: ${e.message}`));
  await page.goto(`${BASE}/`);
  await page.evaluate((r) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("mock-role", r); }, role);
  return page;
}
const slider = (p) => p.locator('[data-testid="slider-T"]');

async function simulateTabSwitch(page, label) {
  const other = await ctx.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.evaluate(() => { window.__mockLatency = 150; Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("blur")); });
  await sleep(500);
  await page.bringToFront();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus"));
    // what supabase-js does on return to the tab:
    window.__mockAuth.emit("SIGNED_IN"); window.__mockAuth.emit("TOKEN_REFRESHED");
  });
  await sleep(120); // inside the old loading window
  const midLoader = await page.evaluate(() => window.__removed.length);
  await sleep(900);
  await other.close();
  console.log(`  (${label}: tab switch simulated)`);
  return midLoader;
}

// ---------------------------------------------------------------- student
console.log("\n== A. Learn page, simulation near the bottom, tab switch");
{
  const page = await fresh("student");
  await page.goto(`${BASE}/student/learn/lesson-long`);
  await page.waitForSelector('[data-testid="slider-T"]');
  await sleep(800);
  await slider(page).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 160));
  // user changes the simulation: pick Real Gas + raise temperature with the keyboard
  await page.getByRole("radio", { name: /Real Gas/ }).click();
  await slider(page).focus();
  for (let i = 0; i < 20; i += 1) await page.keyboard.press("ArrowRight");
  await sleep(300);
  const before = await page.evaluate(() => ({
    y: Math.round(scrollY), T: document.querySelector('[data-testid="slider-T"]').value,
    real: document.querySelector('[role=radio][aria-checked=true]')?.textContent,
  }));
  check(before.y > 1500, `scrolled near the bottom (${before.y}px)`);
  check(before.T !== "300" && /Real/.test(before.real || ""), `simulation changed: T=${before.T}, mode=${before.real}`);
  await page.evaluate(() => {
    document.querySelector('[data-testid="slider-T"]').setAttribute("data-identity", "sim-node");
    window.__removed = [];
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.removedNodes) if (n.nodeType === 1 && (n.matches?.("[data-identity]") || n.querySelector?.("[data-identity]"))) window.__removed.push(1); }).observe(document.body, { childList: true, subtree: true });
    window.__profileCalls0 = window.__mockCalls.select.profiles || 0;
  });
  const canvasBefore = await page.evaluate(() => document.querySelector('[data-testid="gas-canvas"]').getAttribute("data-particles"));
  const loaderMid = await simulateTabSwitch(page, "student");
  const after = await page.evaluate(() => ({
    y: Math.round(scrollY), T: document.querySelector('[data-testid="slider-T"]')?.value,
    real: document.querySelector('[role=radio][aria-checked=true]')?.textContent,
    ident: document.querySelector('[data-testid="slider-T"]')?.getAttribute("data-identity"),
    removed: window.__removed.length, profileCalls: (window.__mockCalls.select.profiles || 0) - window.__profileCalls0,
    particles: document.querySelector('[data-testid="gas-canvas"]')?.getAttribute("data-particles"),
  }));
  check(loaderMid === 0 && after.removed === 0, "the simulation DOM was never removed (no loader flash, no unmount) during the 120 ms-1 s after SIGNED_IN/TOKEN_REFRESHED");
  check(after.ident === "sim-node", "slider element identity unchanged (same node, not a remount)");
  check(Math.abs(after.y - before.y) <= 2, `scroll position unchanged (${before.y} -> ${after.y})`);
  check(after.T === before.T && after.real === before.real, `selected mode and slider unchanged (T ${before.T} -> ${after.T}, ${after.real})`);
  check(after.particles === canvasBefore, "simulation canvas state preserved");
  check(after.profileCalls === 0, `same-user SIGNED_IN/TOKEN_REFRESHED triggered no profile refetch (${after.profileCalls})`);
  // USER_UPDATED => quiet revalidation: allowed to fetch, must still never unmount
  await page.evaluate(() => { window.__mockLatency = 300; window.__mockAuth.emit("USER_UPDATED"); });
  await sleep(150);
  const midUpdated = await page.evaluate(() => ({ removed: window.__removed.length, y: Math.round(scrollY) }));
  await sleep(700);
  const endUpdated = await page.evaluate(() => ({ removed: window.__removed.length, calls: (window.__mockCalls.select.profiles || 0) - window.__profileCalls0 }));
  check(midUpdated.removed === 0 && endUpdated.removed === 0, "USER_UPDATED revalidates the profile silently (no unmount while the request is in flight)");
  check(endUpdated.calls === 1, `...and does refetch exactly once (${endUpdated.calls})`);
  await page.screenshot({ path: `${out}/A-after-tabswitch.png` });

  // ---- reload: simulation settings + scroll restored from sessionStorage
  await page.reload();
  await page.waitForSelector('[data-testid="slider-T"]');
  await sleep(2500);
  const reloaded = await page.evaluate(() => ({ y: Math.round(scrollY), T: document.querySelector('[data-testid="slider-T"]').value, real: document.querySelector('[role=radio][aria-checked=true]')?.textContent }));
  check(reloaded.T === before.T && /Real/.test(reloaded.real || ""), `after a RELOAD the simulation mode and slider are restored (T=${reloaded.T}, ${reloaded.real})`);
  check(Math.abs(reloaded.y - before.y) <= 60, `after a RELOAD the page scroll is restored (${before.y} -> ${reloaded.y})`);

  // ---- navigate away and back (browser Back)
  await page.goto(`${BASE}/student/solve`);
  await page.waitForSelector("text=Assess", { timeout: 15000 }).catch(() => {});
  await sleep(500);
  await page.goBack();
  await page.waitForSelector('[data-testid="slider-T"]');
  await sleep(2500);
  const back = await page.evaluate(() => ({ y: Math.round(scrollY), T: document.querySelector('[data-testid="slider-T"]').value }));
  check(back.T === before.T, `after navigating away and BACK the slider is restored (T=${back.T})`);
  check(Math.abs(back.y - before.y) <= 60, `after navigating away and BACK the scroll is restored (${before.y} -> ${back.y})`);

  // ---- a normal navigation to the lesson (sidebar/link) still starts at the top
  await page.goto(`${BASE}/student/learn`);
  await sleep(300);
  await page.evaluate(() => window.history.pushState({}, "", "/student/learn/lesson-long"));
  await page.close();
}

// ------------------------------------------------------------------ admin
console.log("\n== B. Admin lesson editor, unsaved Rich Text, tab switch");
{
  const page = await fresh("admin");
  await page.goto(`${BASE}/admin/learn-content/lesson-long`);
  await page.waitForSelector("#learn-block-b3");
  await page.locator("#learn-block-b3 button", { hasText: /^Edit$/ }).click();
  await sleep(1000);
  const ed = page.locator("#learn-block-b3 [contenteditable=true]");
  await ed.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ADMIN-UNSAVED");
  await page.keyboard.press("Shift+Home");
  const selBefore = await page.evaluate(() => getSelection().toString());
  await page.locator('[role=toolbar] button[aria-label="Bold"]').click();
  await page.evaluate(() => {
    document.querySelector("#learn-block-b3 [contenteditable=true]").setAttribute("data-identity", "ed");
    document.querySelector("#learn-block-b3").setAttribute("data-identity", "card");
    window.__removed = [];
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.removedNodes) if (n.nodeType === 1 && (n.matches?.("[data-identity]") || n.querySelector?.("[data-identity]"))) window.__removed.push(1); }).observe(document.body, { childList: true, subtree: true });
  });
  const mainBefore = await page.evaluate(() => Math.round(document.querySelector("main").scrollTop));
  await simulateTabSwitch(page, "admin");
  const st = await page.evaluate(() => ({
    removed: window.__removed.length, text: document.querySelector("#learn-block-b3 [contenteditable=true]")?.textContent,
    sel: getSelection().toString(), main: Math.round(document.querySelector("main").scrollTop),
    ed: document.querySelector("#learn-block-b3 [contenteditable=true]")?.getAttribute("data-identity"), open: !!document.querySelector("#learn-block-b3 [contenteditable=true]"),
  }));
  check(st.removed === 0 && st.ed === "ed", "admin block + editor never unmounted by tab switch / auth events");
  check(st.text.includes("ADMIN-UNSAVED"), "unsaved typed text still in the editor");
  check(selBefore.length > 0 && st.sel === selBefore, `text selection preserved across the switch ("${selBefore.slice(0, 20)}...")`);
  check(Math.abs(st.main - mainBefore) <= 2, `admin scroll position unchanged (${mainBefore} -> ${st.main})`);
  check(st.open, "the open block stays open");

  // preview panel state + reload with unsaved text -> draft + panel restore
  await page.evaluate(() => document.activeElement?.blur?.());
  await sleep(300);
  await ed.locator("p").first().click(); await page.keyboard.press("End"); await page.keyboard.type(" SECOND-EDIT");
  await sleep(600);
  await page.evaluate(() => { document.querySelector("main").scrollTop = 400; });
  await sleep(500);
  await page.reload();
  await page.waitForSelector("#learn-block-b3");
  await sleep(1500);
  const re = await page.evaluate(() => ({ text: document.querySelector("#learn-block-b3 [contenteditable=true]")?.textContent || "", notice: !!document.querySelector('[data-testid="rte-draft-notice"]'), main: Math.round(document.querySelector("main").scrollTop), saved: window.__mockDb.get().learn_blocks.find((b) => b.id === "b3").content.html }));
  check(re.text.includes("SECOND-EDIT") && re.notice, "after reload the open block re-opens with the unsaved draft and the notice");
  check(!re.saved.includes("SECOND-EDIT"), "the draft was not silently written to the server");
  check(re.main > 0, `admin scroll offset restored after reload (${re.main})`);
  await page.screenshot({ path: `${out}/B-admin-after-reload.png` });
  // preview toggle persists
  await page.locator("button", { hasText: "Preview as Student" }).click();
  await sleep(300);
  await page.reload();
  await page.waitForSelector("text=Preview as Student", { timeout: 15000 });
  check(await page.locator("text=Back to editor").isVisible(), "an open 'Preview as Student' is restored after reload");
  await page.close();
}

await browser.close();
stop();
R.done();
