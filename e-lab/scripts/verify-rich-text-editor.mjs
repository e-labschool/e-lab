#!/usr/bin/env node
// Headless-Chromium verification of the admin Rich Text editor (PART 3) AND
// of unsaved-draft handling (PART 5), against the REAL app with
// src/lib/supabaseClient.js swapped for scripts/harness/mock-supabase.js.
//
// Usage: node scripts/verify-rich-text-editor.mjs [outDir]
//   (starts the mock-Supabase Vite server on :5301 itself if it is not running)
//
// Real mouse/keyboard input: double-click word, shift+arrow, triple-click
// paragraph, drag across two paragraphs. Native <select> popups cannot be
// operated by Playwright in headless Chromium, so selects are driven the way a
// keyboard user does (focus + ArrowDown/Enter) or via selectOption (which still
// moves focus to the select and fires a real change event). The native colour
// PICKER dialog is OS UI and cannot be driven; for it the `change` event is
// dispatched on the real <input type=color> after focusing it.
import fs from "node:fs";
import { BASE, startServer, launch, reporter, sleep } from "./harness/browser.mjs";

const out = process.argv[2] || "/tmp/rte-verify";
fs.mkdirSync(out, { recursive: true });
const stop = await startServer();
const browser = await launch();
const R = reporter();
const { check } = R;

async function newAdminPage(ctx, { reset = true } = {}) {
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));
  page.on("pageerror", (e) => { console.log("  pageerror:", e.message); R.check(false, `page error ${e.message}`); });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("__init")) { sessionStorage.setItem("__init", "1"); } } catch { /* */ } });
  if (reset) {
    await page.goto(`${BASE}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("mock-role", "admin"); });
  }
  await page.goto(`${BASE}/admin/learn-content/lesson-long`);
  await page.waitForSelector("#learn-block-b1");
  return page;
}
async function openBlock(page, id = "b1") {
  const edit = page.locator(`#learn-block-${id} button`, { hasText: /^Edit$/ });
  if (await edit.count()) await edit.click(); // after a reload the open block is restored (already "Close")
  await page.waitForSelector(`#learn-block-${id} [contenteditable=true]`);
  const ed = page.locator(`#learn-block-${id} [contenteditable=true]`);
  await ed.scrollIntoViewIfNeeded();
  await sleep(900); // LessonEditor smooth-scrolls the opened block into view
  return ed;
}
const html = (ed) => ed.evaluate((el) => el.innerHTML);
const selText = (page) => page.evaluate(() => window.getSelection().toString());
const activeIsEditor = (page) => page.evaluate(() => document.activeElement?.getAttribute("contenteditable") === "true");
const P2 = "Second paragraph of block 1 with H<sub>2</sub>O and a marker ⟦math:x^2⟧ to check scientific rendering.";
async function wordBox(ed, pIndex, word) {
  return ed.evaluate((el, [pi, w]) => {
    const p = el.querySelectorAll("p")[pi];
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.data.indexOf(w);
      if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const b = r.getBoundingClientRect(); // integer coordinates: fractional mouse positions make Chromium's synthetic drag-select collapse (test artefact, not app behaviour)
      const R = Math.round; return { x: R(b.x + b.width / 2), y: R(b.y + b.height / 2), left: R(b.x + 1), right: R(b.right - 1), cy: R(b.y + b.height / 2) }; }
    }
    return null;
  }, [pIndex, word]);
}
async function dbl(page, ed, pIndex, word) { const b = await wordBox(ed, pIndex, word); await page.mouse.dblclick(b.x, b.y); return b; }
async function dragSelect(page, from, to) { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up(); }
const btn = (page, label) => page.locator(`[role=toolbar] button[aria-label="${label}"]`);
async function savedHtml(page, id = "b1") { return page.evaluate((bid) => window.__mockDb.get().learn_blocks.find((b) => b.id === bid)?.content?.html, id); }

const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });

// ----------------------------------------------------------------------------
console.log("\n== 1. root cause guards: card is not draggable by default; toolbar buttons keep focus + selection");
{
  const page = await newAdminPage(ctx);
  const ed = await openBlock(page);
  check((await page.locator("#learn-block-b1").getAttribute("draggable")) === "false", "block card is NOT draggable until the grip is pressed (text selection by mouse is not hijacked)");
  await dbl(page, ed, 0, "electrostatic");
  check((await selText(page)) === "electrostatic", "double-click selects the word");
  await btn(page, "Bold").click();
  check((await selText(page)) === "electrostatic", "selection still intact after clicking Bold");
  check(await activeIsEditor(page), "focus stays in the editor after clicking a toolbar button");
  check((await html(ed)).includes("<b>electrostatic</b>"), "Bold wraps only the word");
  check((await html(ed)).includes(P2), "second paragraph untouched");
  await btn(page, "Bold").click();
  check(!(await html(ed)).includes("<b>"), "second click toggles bold off");
  await page.screenshot({ path: `${out}/1-bold.png` });
  await page.close();
}

console.log("\n== 2. words / shift+arrow / triple-click / drag, with selects");
{
  const page = await newAdminPage(ctx);
  const ed = await openBlock(page);
  // font size on one double-clicked word through the real <select> (focus moves to the select)
  await dbl(page, ed, 0, "nuclei");
  await page.selectOption('select[aria-label="Font size"]', "28");
  let h = await html(ed);
  check(/<span style="font-size: 28px;">nuclei<\/span>/.test(h), "font size 28px applied to ONLY the double-clicked word (via <select>)");
  check(!/<span[^>]*><p/.test(h) && !h.includes("<span style=\"font-size: 12px;\">​"), "no stray/zero-width spans, no span wrapping a <p> (previous bug)");
  check((await selText(page)) === "nuclei" && await activeIsEditor(page), "selection restored and focus back in the editor after the <select> change");
  // keyboard-driven select (ArrowDown on focused select)
  await page.keyboard.press("Escape");
  await dbl(page, ed, 0, "electrons");
  await page.focus('select[aria-label="Font family"]');
  await page.keyboard.press("G"); // type-ahead -> Georgia (fires a real change event)
  await sleep(150);
  h = await html(ed);
  check(/font-family:[^"]*">electrons<\/span>/.test(h), "font family applied to the selected word via keyboard-operated <select>");
  // shift+arrow selection
  const start = await wordBox(ed, 0, "geometry");
  await page.mouse.click(start.left + 1, start.cy);
  await page.keyboard.press("Home"); await page.keyboard.press("Shift+ArrowRight"); await page.keyboard.press("Shift+ArrowRight");
  const picked = await selText(page);
  await btn(page, "Italic").click();
  h = await html(ed);
  check(picked.length > 0 && h.includes(`<i>${picked}</i>`), `Shift+Arrow selection ("${picked}") italicised exactly`);
  // triple-click paragraph 1: highlight + underline + strike + colour; paragraph 2 unchanged
  await ed.locator("p").first().click({ clickCount: 3 });
  const trip = await selText(page);
  check(trip.startsWith("Paragraph 1."), "triple-click selects the paragraph");
  await page.locator('[role=toolbar] button[aria-label="Highlight Yellow"]').click();
  await btn(page, "Underline").click();
  await btn(page, "Strikethrough").click();
  await page.locator('[role=toolbar] button[aria-label="Text colour Teal"]').click();
  h = await html(ed);
  const p1 = await ed.evaluate((el) => el.querySelector("p").outerHTML);
  check(/background-color: rgb\(254, 240, 138\)/.test(p1), "highlight applied");
  check(/<u>/.test(p1) && /<s>/.test(p1), "underline + strikethrough applied");
  check(/color: rgb\(43, 122, 110\)/.test(p1), "text colour applied");
  check(h.includes(P2) && (await ed.evaluate((el) => el.querySelectorAll("p").length)) === 2, "triple-click formatting did not touch/duplicate paragraph 2 and left no empty <p>");
  check(!/<span[^>]*>\s*<p/.test(h), "never wraps a <p> in a <span>");
  // native colour input (picker dialog is OS UI: dispatch the real change event)
  await dbl(page, ed, 1, "marker");
  await page.locator('input[aria-label="Custom text colour"]').evaluate((el) => { el.focus(); el.value = "#ff0000"; el.dispatchEvent(new Event("change", { bubbles: true })); });
  await sleep(100);
  check(/color: rgb\(255, 0, 0\);">marker<\/span>/.test(await html(ed)), "custom colour input applies to the (previously blurred-out) selection");
  await page.screenshot({ path: `${out}/2-mixed.png` });
  await page.close();
}

console.log("\n== 3. drag across two paragraphs; headings; alignment; lists; indent; sub/sup; clear formatting");
{
  const page = await newAdminPage(ctx);
  const ed = await openBlock(page);
  const a = await wordBox(ed, 0, "geometry"); const b = await wordBox(ed, 1, "marker");
  await dragSelect(page, { x: a.x, y: a.y }, { x: b.x, y: b.y });
  check((await selText(page)).includes("Second paragraph"), "drag selects across the paragraph boundary");
  await page.selectOption('select[aria-label="Font size"]', "20");
  let h = await html(ed);
  const spans = await ed.evaluate((el) => Array.from(el.querySelectorAll("span")).map((s) => (s.closest("p, h1, h2, h3, li") ? "P" : "OUT") + ":" + s.textContent.slice(0, 12)));
  check(spans.length >= 2 && spans.every((s) => s.startsWith("P:")) && !/<span[^>]*><p/.test(h), `size spans live INSIDE both paragraphs (${spans.join(" | ")})`);
  check(/Paragraph 1\. Atoms combine/.test(await ed.evaluate((el) => el.querySelector("p").textContent)) && !/font-size: 20px;">Paragraph 1\./.test(h), "text before the selection start is unchanged");
  await btn(page, "Bold").click(); await btn(page, "Bold").click();
  // headings on paragraph 2 only
  await ed.locator("p").nth(1).click();
  await page.selectOption('select[aria-label="Paragraph style"]', "h2");
  check(/<h2[ >]/.test(await html(ed)) && (await ed.evaluate((el) => el.querySelectorAll("p").length)) === 1, "Heading 2 applies to the caret's paragraph only");
  await page.selectOption('select[aria-label="Paragraph style"]', "h1");
  check(/<h1[ >]/.test(await html(ed)), "Heading 1");
  await page.selectOption('select[aria-label="Paragraph style"]', "h3");
  check(/<h3[ >]/.test(await html(ed)), "Heading 3");
  await page.selectOption('select[aria-label="Paragraph style"]', "p");
  check(!/<h[1-3]/.test(await html(ed)), "Normal paragraph restores a <p>");
  // alignment on paragraph 1
  await ed.locator("p").first().click();
  for (const [label, val] of [["Align Center", "center"], ["Align Right", "right"], ["Justify", "justify"], ["Align Left", "left"]]) {
    await btn(page, label).click();
    check((await ed.evaluate((el) => el.querySelector("p").style.textAlign)) === val && (await ed.evaluate((el) => el.querySelectorAll("p")[1].style.textAlign)) === "", `${label} sets text-align:${val} on that paragraph only`);
  }
  // lists + indent
  await ed.evaluate((el) => { const r = document.createRange(); r.setStart(el.querySelectorAll("p")[0].firstChild, 0); r.setEnd(el.querySelectorAll("p")[1].lastChild, 1); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await btn(page, "Bullets").click();
  check((await ed.evaluate((el) => el.querySelectorAll("ul > li").length)) === 2, "Bullets: both selected paragraphs become list items");
  await btn(page, "Numbered List").click();
  check((await ed.evaluate((el) => el.querySelectorAll("ol > li").length)) === 2 && (await ed.evaluate((el) => el.querySelectorAll("ul").length)) === 0, "Numbered list replaces bullets");
  await ed.locator("li").nth(1).click();
  await btn(page, "Increase Indent").click();
  check((await ed.evaluate((el) => el.querySelectorAll("ol ol > li").length)) === 1, "Increase indent nests the list item");
  await btn(page, "Decrease Indent").click();
  check((await ed.evaluate((el) => el.querySelectorAll("ol ol").length)) === 0, "Decrease indent un-nests it");
  await page.keyboard.press("Control+a");
  await btn(page, "Numbered List").click();
  check((await ed.evaluate((el) => el.querySelectorAll("li").length)) === 0 && (await ed.evaluate((el) => el.querySelectorAll("p").length)) === 2, "select-all + toggling the list off returns to two paragraphs");
  await ed.locator("p").first().click();
  await btn(page, "Increase Indent").click();
  check((await ed.evaluate((el) => el.querySelector("p").style.marginLeft)) === "24px", "paragraph indent = margin-left:24px");
  // sub/sup on a word
  await dbl(page, ed, 0, "nuclei");
  await btn(page, "Superscript").click();
  check((await html(ed)).includes("<sup>nuclei</sup>"), "Superscript");
  await btn(page, "Subscript").click();
  check((await html(ed)).includes("<sub>nuclei</sub>") && !(await html(ed)).includes("<sup>nuclei"), "Subscript replaces superscript");
  // clear formatting only on the selection
  await dbl(page, ed, 0, "nuclei");
  await btn(page, "Clear Formatting").click();
  h = await html(ed);
  if (!/<sub>(<span[^>]*>)?2/.test(h)) console.log("   html after clear:", h);
  check(!h.includes("<sub>nuclei") && /<sub>(<span[^>]*>)?2/.test(h), "Clear Formatting removed the selection's formatting only (other <sub> kept)");
  await page.close();
}

console.log("\n== 4. undo / redo (toolbar + keyboard), typing, no block-level undo hijack");
{
  const page = await newAdminPage(ctx);
  const ed = await openBlock(page);
  const original = await html(ed);
  await dbl(page, ed, 0, "nuclei"); await btn(page, "Bold").click();
  await dbl(page, ed, 0, "electrons"); await page.selectOption('select[aria-label="Font size"]', "24");
  const afterTwo = await html(ed);
  await btn(page, "Undo").click();
  check(!(await html(ed)).includes("font-size: 24px") && (await html(ed)).includes("<b>nuclei</b>"), "Undo button reverts only the last formatting step");
  await page.keyboard.press("Control+z");
  check((await html(ed)) === original, "Ctrl+Z reverts the earlier step -> original html exactly");
  await page.keyboard.press("Control+Shift+z");
  check((await html(ed)).includes("<b>nuclei</b>"), "Ctrl+Shift+Z redoes");
  await btn(page, "Redo").click();
  check((await html(ed)) === afterTwo, "Redo button restores both steps exactly");
  // typing is undoable and does not break formatting history
  await ed.locator("p").nth(1).click(); await page.keyboard.press("End");
  await page.keyboard.type(" TYPED");
  await sleep(500);
  check((await html(ed)).includes(" TYPED"), "typing works");
  await page.keyboard.press("Control+z");
  check(!(await html(ed)).includes("TYPED") && (await html(ed)).includes("<b>nuclei</b>"), "Ctrl+Z undoes the typing without disturbing earlier formatting");
  const blockCount = await page.locator('[id^="learn-block-"]').count();
  check(blockCount === 16, "Ctrl+Z inside the editor did not trigger lesson-level block undo (still 16 blocks)");
  // Ctrl+B / Ctrl+I shortcuts
  await dbl(page, ed, 1, "paragraph"); await page.keyboard.press("Control+b");
  check((await html(ed)).includes("<b>paragraph</b>"), "Ctrl+B toggles bold");
  await page.close();
}

console.log("\n== 5. save -> reload round trip + student render");
{
  const page = await newAdminPage(ctx);
  const ed = await openBlock(page);
  await dbl(page, ed, 0, "nuclei"); await page.selectOption('select[aria-label="Font size"]', "28");
  await dbl(page, ed, 0, "electrons"); await btn(page, "Bold").click();
  await ed.locator("p").nth(1).click(); await page.selectOption('select[aria-label="Paragraph style"]', "h2");
  await page.mouse.click(5, 500); // blur -> commit
  await sleep(500);
  const saved = await savedHtml(page);
  check(!!saved && saved.includes('font-size: 28px;">nuclei') && saved.includes("<b>electrons</b>") && /<h2/.test(saved), "formatted HTML was saved to the (mock) database");
  check(!saved.includes("​"), "no zero-width placeholder characters leak into saved HTML");
  await page.reload(); await page.waitForSelector("#learn-block-b1");
  const ed2 = await openBlock(page);
  check((await html(ed2)).includes('font-size: 28px;">nuclei') && (await html(ed2)).includes("<b>electrons</b>") && /<h2/.test(await html(ed2)), "reopening the lesson shows the same formatting");
  await page.screenshot({ path: `${out}/5-reopened.png` });
  // student view
  const stu = await ctx.newPage();
  await stu.goto(`${BASE}/`);
  await stu.evaluate(() => localStorage.setItem("mock-role", "student"));
  await stu.goto(`${BASE}/student/learn/lesson-long`);
  await stu.waitForSelector("text=Section 1");
  const r = await stu.evaluate(() => {
    const sec = document.querySelector("section");
    const span = Array.from(sec.querySelectorAll("span")).find((s) => s.textContent === "nuclei");
    const h2 = sec.querySelector("h2.mb-2") ? sec.querySelectorAll("h2")[1] : sec.querySelector("h2");
    const hh = Array.from(sec.querySelectorAll("h2")).find((x) => /Second paragraph/.test(x.textContent));
    const cs = (e) => getComputedStyle(e);
    return { size: span && cs(span).fontSize, bold: !!sec.querySelector("b"), h2size: hh && cs(hh).fontSize, h2weight: hh && cs(hh).fontWeight, pSize: cs(sec.querySelector("p")).fontSize, sub: !!sec.querySelector("sub"), math: /x/.test(sec.textContent) && !sec.textContent.includes("⟦math:") };
  });
  check(r.size === "28px", `student page renders the 28px span at 28px (got ${r.size})`);
  check(r.bold, "student page renders <b>");
  check(r.h2size && parseFloat(r.h2size) > parseFloat(r.pSize) && Number(r.h2weight) >= 600, `Heading 2 renders larger+bold on the student page (${r.h2size} vs body ${r.pSize})`);
  check(r.sub && r.math, "H<sub>2</sub>O and the ⟦math:⟧ marker still render (marker no longer shown raw)");
  await stu.screenshot({ path: `${out}/5-student.png`, fullPage: false });
  await stu.close(); await page.close();
}

console.log("\n== 6. tab switch + unsaved draft (PART 5)");
{
  const page = await newAdminPage(ctx);
  const ed = await openBlock(page);
  await ed.evaluate((el) => el.setAttribute("data-identity", "same-node"));
  await dbl(page, ed, 0, "nuclei");
  await btn(page, "Bold").click();
  await page.keyboard.press("End"); await page.keyboard.type(" UNSAVED-TEXT");
  const selBefore = await selText(page);
  const scrollBefore = await page.evaluate(() => document.querySelector("main").scrollTop);
  // real second tab, then back
  const other = await ctx.newPage(); await other.goto("about:blank"); await other.bringToFront(); await sleep(400);
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("blur")); });
  await page.bringToFront(); await sleep(400);
  await page.evaluate(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
  await other.close();
  await page.evaluate(() => window.__mockAuth.emit("SIGNED_IN")); await page.evaluate(() => window.__mockAuth.emit("TOKEN_REFRESHED")); await sleep(500);
  check((await ed.getAttribute("data-identity")) === "same-node", "editor DOM node identity unchanged across tab switch + auth events (no remount)");
  check((await html(ed)).includes("UNSAVED-TEXT") && (await html(ed)).includes("<b>nuclei</b>"), "unsaved edits survive the tab switch");
  check((await page.evaluate(() => document.querySelector("main").scrollTop)) === scrollBefore, "admin scroll position unchanged");
  check(selBefore.length >= 0, "selection read before the switch");
  await page.close();
}
{
  // Draft restore: type, flush draft, reload before any blur-commit.
  const page = await newAdminPage(ctx);
  const ed = await openBlock(page);
  await ed.locator("p").first().click(); await page.keyboard.press("End"); await page.keyboard.type(" DRAFT-ONLY");
  await sleep(600); // debounce -> draft written; editor still focused, nothing committed
  check(!(await savedHtml(page)).includes("DRAFT-ONLY"), "typed text has not reached the server yet (no blur)");
  await page.reload(); await page.waitForSelector("#learn-block-b1");
  const ed2 = await openBlock(page);
  check((await html(ed2)).includes("DRAFT-ONLY"), "after reload the unsaved draft is restored into the editor");
  check(await page.locator('[data-testid="rte-draft-notice"]').isVisible(), "the 'Unsaved draft restored' notice is shown");
  check(!(await savedHtml(page)).includes("DRAFT-ONLY"), "restoring did not silently write to the server");
  await page.screenshot({ path: `${out}/6-draft-restored.png` });
  await page.locator('[data-testid="rte-draft-notice"] button', { hasText: "Discard" }).click();
  check(!(await html(ed2)).includes("DRAFT-ONLY") && !(await page.locator('[data-testid="rte-draft-notice"]').count()), "Discard returns to the saved version and removes the notice");
  await page.close();
}
{
  // Conflict: saved content changed after the draft was made -> not applied.
  const page = await newAdminPage(ctx);
  const ed = await openBlock(page);
  await ed.locator("p").first().click(); await page.keyboard.press("End"); await page.keyboard.type(" OLD-DRAFT");
  await sleep(600);
  await page.evaluate(() => { const db = window.__mockDb.get(); db.learn_blocks.find((b) => b.id === "b1").content.html = "<p>NEWER SAVED CONTENT</p>"; window.__mockDb.persist(); });
  await page.reload(); await page.waitForSelector("#learn-block-b1");
  const ed2 = await openBlock(page);
  check((await html(ed2)).includes("NEWER SAVED CONTENT") && !(await html(ed2)).includes("OLD-DRAFT"), "newer saved content is NOT overwritten by an older draft");
  check(await page.locator('[data-testid="rte-draft-notice"]').isVisible(), "a notice explains the draft was set aside");
  await page.locator('[data-testid="rte-draft-notice"] button', { hasText: "Restore draft" }).click();
  check((await html(ed2)).includes("OLD-DRAFT"), "explicit 'Restore draft' applies it on request");
  await page.close();
}

await browser.close();
stop();
R.done();
