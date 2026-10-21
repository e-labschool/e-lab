#!/usr/bin/env node
// Node/jsdom regression harness for the shared Image Lightbox
// (src/components/image-viewer) -- run with:  node scripts/test-image-viewer.mjs
//
// Renders the REAL provider / ZoomableImage / ZoomableHtml / LearnBlockRenderer
// / QuestionRenderer into jsdom and drives them with dispatched DOM events.
// Honest limits: jsdom has no layout engine (all sizes are 0) and no real
// touch/pinch, so pan-bounds and pinch maths are verified against the pure
// functions in imageViewerCore.js (the same ones the component calls), and
// real-pointer/pinch/wheel behaviour is verified separately in headless
// Chromium (see the verification notes in the change report).
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const core = await import("../src/components/image-viewer/imageViewerCore.js");
const { ImageLightboxProvider } = await import("../src/components/image-viewer/ImageLightbox.jsx");
const ZoomableImage = (await import("../src/components/image-viewer/ZoomableImage.jsx")).default;
const ZoomableHtml = (await import("../src/components/image-viewer/ZoomableHtml.jsx")).default;
const { default: EnlargeGraphicButton, graphicToImageSrc } = await import("../src/components/image-viewer/EnlargeGraphicButton.jsx");
const LearnBlockRenderer = (await import("../src/components/learn/LearnBlockRenderer.jsx")).default;
const QuestionRenderer = (await import("../src/pages/student/solve/QuestionRenderer.jsx")).default;
const h = React.createElement;

let passed = 0; let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.stack || err.message}`); failed++; }
}
const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));

const mounted = [];
async function mount(element) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(element);
  await tick();
  mounted.push({ root, host });
  return host;
}
async function cleanup() {
  while (mounted.length) { const { root, host } = mounted.pop(); root.unmount(); host.remove(); }
  await tick();
  document.body.removeAttribute("style");
}
const dialog = () => document.querySelector("[role=dialog][data-image-lightbox]");
const click = async (el) => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); };
const key = async (target, k, extra = {}) => { target.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra })); await tick(); };
const pct = () => dialog().querySelector("button[aria-label^='Reset zoom']").textContent;

const SB = "https://abc.supabase.co/storage/v1";
const THUMB = `${SB}/render/image/public/learn-media/p1/b1/diagram.png?width=300&quality=60`;
const ORIG = `${SB}/object/public/learn-media/p1/b1/diagram.png`;

console.log("\n== pure viewer maths ==");
await test("clampScale clamps to [1, 8] and survives NaN", () => {
  assert.equal(core.clampScale(0.2), 1); assert.equal(core.clampScale(99), 8);
  assert.equal(core.clampScale(3), 3); assert.equal(core.clampScale(NaN), 1);
});
await test("clampPan: no pan at scale 1, bounded when zoomed", () => {
  const stage = { w: 800, h: 600 }; const base = { w: 800, h: 400 };
  assert.deepEqual(core.clampPan({ x: 500, y: 500 }, 1, stage, base), { x: 0, y: 0 });
  const p = core.clampPan({ x: 9999, y: -9999 }, 2, stage, base); // 1600x800 vs 800x600
  assert.equal(p.x, 400); assert.equal(p.y, -100);
});
await test("zoomAround keeps the anchored content point fixed", () => {
  const stage = { w: 1000, h: 800 }; const base = { w: 1000, h: 800 };
  const v = core.zoomAround({ scale: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 }, stage, base);
  assert.equal(v.scale, 2);
  // content point under anchor before: (100,50); after: anchor - t over scale
  assert.equal((100 - v.x) / v.scale, 100); assert.equal((50 - v.y) / v.scale, 50);
});
await test("zoomAround never exceeds max / goes below min", () => {
  const s = { w: 100, h: 100 };
  assert.equal(core.zoomAround({ scale: 7, x: 0, y: 0 }, 50, { x: 0, y: 0 }, s, s).scale, 8);
  const out = core.zoomAround({ scale: 2, x: 30, y: 30 }, 0.1, { x: 0, y: 0 }, s, s);
  assert.deepEqual(out, { scale: 1, x: 0, y: 0 });
});
await test("wheel factor: up zooms in, down zooms out, pinch(ctrl) is finer", () => {
  assert.ok(core.wheelZoomFactor({ deltaY: -100 }) > 1);
  assert.ok(core.wheelZoomFactor({ deltaY: 100 }) < 1);
  assert.ok(core.wheelZoomFactor({ deltaY: -10, ctrlKey: true }) > core.wheelZoomFactor({ deltaY: -10 }));
});
await test("pinchView scales by finger-distance ratio, clamped, follows midpoint", () => {
  const s = { w: 1000, h: 800 }; const b = { w: 1000, h: 800 };
  const start = { scale: 1, x: 0, y: 0, dist: 100, mid: { x: 0, y: 0 } };
  const v = core.pinchView(start, { x: -100, y: 0 }, { x: 100, y: 0 }, s, b);
  assert.equal(v.scale, 2);
  assert.equal(core.pinchView(start, { x: -5000, y: 0 }, { x: 5000, y: 0 }, s, b).scale, 8);
  assert.equal(core.pinchView(start, { x: -1, y: 0 }, { x: 1, y: 0 }, s, b).scale, 1);
});
await test("fitSize preserves aspect ratio (never crops) and caps upscale", () => {
  const f = core.fitSize({ w: 2000, h: 1000 }, { w: 1000, h: 800 }, 0);
  assert.equal(f.w / f.h, 2); assert.ok(f.w <= 1000 && f.h <= 800);
  const tiny = core.fitSize({ w: 10, h: 10 }, { w: 1000, h: 800 }, 0);
  assert.equal(tiny.w, 30);
  assert.equal(core.fitSize({ w: 0, h: 0 }, { w: 1, h: 1 }), null);
  const reserved = core.fitSize({ w: 1000, h: 1000 }, { w: 1000, h: 800 }, 16, 3, 56);
  assert.equal(reserved.h, 800 - 32 - 56, "toolbar band kept clear");
});
await test("resolveOriginalImageSrc: Supabase render/transform URL -> original object", () => {
  assert.equal(core.resolveOriginalImageSrc(THUMB), ORIG);
  assert.equal(core.resolveOriginalImageSrc(ORIG), ORIG);
  assert.equal(core.resolveOriginalImageSrc("/storage/v1/render/image/public/b/x.png?width=10"), "/storage/v1/object/public/b/x.png");
  assert.equal(core.resolveOriginalImageSrc("https://example.com/a.png?w=100"), "https://example.com/a.png?w=100");
  assert.equal(core.resolveOriginalImageSrc("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  const signed = `${SB}/render/image/sign/b/x.png?token=t`;
  assert.equal(core.resolveOriginalImageSrc(signed), signed);
});
await test("pickLargestSrcset / getImageOriginalSrc precedence", () => {
  assert.equal(core.pickLargestSrcset("a.png 300w, b.png 1200w, c.png 600w"), "b.png");
  const img = document.createElement("img");
  img.setAttribute("src", THUMB); img.setAttribute("srcset", "s.png 100w, big.png 900w");
  assert.equal(core.getImageOriginalSrc(img), "big.png");
  img.setAttribute("data-original-src", "https://cdn/orig.png");
  assert.equal(core.getImageOriginalSrc(img), "https://cdn/orig.png");
});

console.log("\n== lightbox behaviour (provider + ZoomableImage) ==");
function Page({ extra = null, imgProps = {} }) {
  return h("div", { id: "page" },
    h("button", { id: "before" }, "before"),
    h(ZoomableImage, { id: "img1", src: THUMB, alt: "Orbital diagram", className: "h-auto w-full", ...imgProps }),
    extra,
  );
}

await test("click opens a portal dialog (aria-modal, labelled) with the ORIGINAL src; body scroll locked", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  assert.equal(dialog(), null);
  await click(document.getElementById("img1"));
  const d = dialog();
  assert.ok(d, "dialog opened");
  assert.equal(d.parentElement, document.body, "portal to body");
  assert.equal(d.getAttribute("aria-modal"), "true");
  assert.match(d.getAttribute("aria-label"), /Orbital diagram/);
  assert.equal(d.querySelector("img").getAttribute("src"), ORIG);
  assert.equal(d.querySelector("img").getAttribute("alt"), "Orbital diagram");
  assert.equal(d.querySelector("button[aria-label='Close image viewer']") !== null, true);
  assert.equal(document.body.style.overflow, "hidden");
  await cleanup();
});
await test("Escape closes, restores scroll lock and returns focus to the originating image", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  const img = document.getElementById("img1");
  img.focus(); await click(img);
  assert.ok(dialog());
  assert.notEqual(document.activeElement, img, "focus moved into dialog");
  assert.ok(dialog().contains(document.activeElement), "focus inside dialog");
  await key(document.body, "Escape");
  assert.equal(dialog(), null);
  assert.equal(document.body.style.overflow, "");
  assert.equal(document.activeElement, img, "focus returned to image");
  await cleanup();
});
await test("X button closes and returns focus", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  const img = document.getElementById("img1"); img.focus(); await click(img);
  await click(dialog().querySelector("button[aria-label='Close image viewer']"));
  assert.equal(dialog(), null); assert.equal(document.activeElement, img);
  await cleanup();
});
await test("backdrop click closes; clicking the image itself does NOT close", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  await click(document.getElementById("img1"));
  await click(dialog().querySelector("[data-lightbox-stage] img"));
  assert.ok(dialog(), "image tap keeps it open");
  await click(dialog().querySelector("[data-lightbox-stage]"));
  assert.equal(dialog(), null, "backdrop closes");
  await cleanup();
});
await test("a drag that ends on the backdrop does not close (moved flag)", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  await click(document.getElementById("img1"));
  const stage = dialog().querySelector("[data-lightbox-stage]");
  const PE = dom.window.PointerEvent || dom.window.MouseEvent;
  stage.dispatchEvent(new PE("pointerdown", { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }));
  stage.dispatchEvent(new PE("pointermove", { bubbles: true, clientX: 80, clientY: 80, pointerId: 1 }));
  stage.dispatchEvent(new PE("pointerup", { bubbles: true, clientX: 80, clientY: 80, pointerId: 1 }));
  await click(stage);
  assert.ok(dialog(), "still open after drag-ending click");
  await click(stage);
  assert.equal(dialog(), null);
  await cleanup();
});
await test("zoom in / out / reset buttons; scale is clamped to 100%..800%", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  await click(document.getElementById("img1"));
  assert.equal(pct(), "100%");
  const zin = dialog().querySelector("button[aria-label='Zoom in']");
  const zout = dialog().querySelector("button[aria-label='Zoom out']");
  assert.equal(zout.disabled, true, "cannot zoom out below fit");
  await click(zin); assert.equal(pct(), "150%");
  for (let i = 0; i < 20; i++) await click(zin);
  assert.equal(pct(), "800%"); assert.equal(zin.disabled, true);
  await click(dialog().querySelector("button[aria-label^='Reset zoom']"));
  assert.equal(pct(), "100%");
  await cleanup();
});
await test("wheel zoom works and the wheel event is default-prevented (page does not scroll)", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  await click(document.getElementById("img1"));
  const stage = dialog().querySelector("[data-lightbox-stage]");
  const ev = new window.Event("wheel", { bubbles: true, cancelable: true });
  Object.assign(ev, { deltaY: -240, deltaMode: 0, ctrlKey: false, clientX: 0, clientY: 0 });
  stage.dispatchEvent(ev); await tick();
  assert.equal(ev.defaultPrevented, true);
  assert.ok(parseInt(pct(), 10) > 100, "zoomed in by wheel");
  await cleanup();
});
await test("keyboard: + - 0 shortcuts", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  await click(document.getElementById("img1"));
  await key(document.body, "+"); assert.equal(pct(), "150%");
  await key(document.body, "-"); assert.equal(pct(), "100%");
  await key(document.body, "+"); await key(document.body, "0"); assert.equal(pct(), "100%");
  await cleanup();
});
await test("focus trap: Tab from last control wraps to first, Shift+Tab from first wraps to last", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  await click(document.getElementById("img1"));
  const btns = [...dialog().querySelectorAll("button:not([disabled])")];
  const first = btns[0]; const last = btns[btns.length - 1];
  last.focus(); await key(last, "Tab"); assert.equal(document.activeElement, first);
  first.focus(); await key(first, "Tab", { shiftKey: true }); assert.equal(document.activeElement, last);
  document.getElementById("before").focus(); await tick();
  assert.ok(dialog().contains(document.activeElement), "outside focus is pulled back in");
  await cleanup();
});
await test("keyboard activation: Enter and Space open; images have role=button, tabindex, accessible name", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  const img = document.getElementById("img1");
  assert.equal(img.getAttribute("role"), "button"); assert.equal(img.getAttribute("tabindex"), "0");
  assert.match(img.getAttribute("aria-label"), /Enlarge image: Orbital diagram/);
  await key(img, "Enter"); assert.ok(dialog()); await key(document.body, "Escape");
  await key(img, " "); assert.ok(dialog()); await key(document.body, "Escape");
  assert.equal(dialog(), null);
  await cleanup();
});
await test("opening/closing does not re-render the page tree (no state/progress side-effects)", async () => {
  let renders = 0;
  function Counter() { renders++; return h("p", null, "lesson"); }
  const stable = h(Page, { extra: h(Counter) });
  await mount(h(ImageLightboxProvider, null, stable));
  const before = renders;
  await click(document.getElementById("img1")); await key(document.body, "Escape");
  assert.equal(renders, before, "children untouched by open/close");
  await cleanup();
});
await test("scroll position of the page is untouched while open", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  window.scrollTo = () => { throw new Error("scrollTo must not be called"); };
  await click(document.getElementById("img1")); await key(document.body, "Escape");
  delete window.scrollTo;
  await cleanup();
});
await test("outside a provider ZoomableImage is a plain inert <img>", async () => {
  await mount(h(Page));
  const img = document.getElementById("img1");
  assert.equal(img.getAttribute("role"), null); assert.equal(img.getAttribute("tabindex"), null);
  await click(img); assert.equal(dialog(), null);
  await cleanup();
});
await test("falls back to the displayed src if the original fails to load", async () => {
  await mount(h(ImageLightboxProvider, null, h(Page)));
  await click(document.getElementById("img1"));
  const big = dialog().querySelector("[data-lightbox-stage] img");
  big.dispatchEvent(new window.Event("error")); await tick();
  assert.equal(dialog().querySelector("[data-lightbox-stage] img").getAttribute("src"), THUMB);
  await cleanup();
});

console.log("\n== rich text (delegated), wrapping, student surfaces ==");
// Canonical form of an HTML string with the viewer's a11y attributes removed
// and attributes sorted, so only real structure/class/style differences show.
const ZOOM_ATTRS = ["role", "tabindex", "aria-label", "data-zoomable-image"];
function stripZoomAttrs(html) {
  const box = document.createElement("div"); box.innerHTML = html;
  const walk = (el) => {
    if (el.tagName === "IMG") ZOOM_ATTRS.forEach((a) => el.removeAttribute(a));
    const attrs = [...el.attributes].map((a) => [a.name, a.value]).sort();
    attrs.forEach(([n]) => el.removeAttribute(n)); attrs.forEach(([n, v]) => el.setAttribute(n, v));
    [...el.children].forEach(walk);
  };
  [...box.children].forEach(walk);
  return box.innerHTML;
}

await test("ZoomableHtml: delegated click on <img> opens with original; links/no-zoom skipped; markup otherwise unchanged", async () => {
  const html = `<p>Text <img id="a" src="${THUMB}" alt="A" style="float:right;margin:0 0 8px 12px" width="120"> more</p><a href="https://x"><img id="b" src="https://e.com/b.png" alt="B"></a><span data-no-zoom><img id="c" src="https://e.com/c.png" alt="C"></span>`;
  const host = await mount(h(ImageLightboxProvider, null, h(ZoomableHtml, { html, className: "prose" })));
  const a = host.querySelector("#a");
  assert.equal(a.getAttribute("role"), "button");
  assert.equal(host.querySelector("#b").getAttribute("role"), null);
  assert.equal(host.querySelector("#c").getAttribute("role"), null);
  assert.equal(a.getAttribute("style"), "float:right;margin:0 0 8px 12px"); // layout styling untouched
  assert.equal(stripZoomAttrs(host.querySelector(".prose").innerHTML), stripZoomAttrs(html));
  await click(a);
  assert.equal(dialog().querySelector("img").getAttribute("src"), ORIG);
  await key(document.body, "Escape");
  assert.equal(document.activeElement, a);
  host.querySelector("a").addEventListener("click", (e) => e.preventDefault());
  await click(host.querySelector("#b")); assert.equal(dialog(), null);
  await cleanup();
});
await test("Rich Text block: wrapped (floated) image keeps identical layout classes/structure with the viewer on", async () => {
  const block = { block_type: "rich_text", content: { title: "T", html: "<p>Hello</p>", imageUrl: THUMB, imageAlt: "Wrapped", imageWrap: "right", imageWidth: "medium" } };
  const plain = await mount(h(LearnBlockRenderer, { block }));
  const plainHtml = stripZoomAttrs(plain.innerHTML);
  await cleanup();
  const host = await mount(h(ImageLightboxProvider, null, h(LearnBlockRenderer, { block })));
  assert.equal(stripZoomAttrs(host.innerHTML), plainHtml, "only a11y attributes differ");
  const fig = host.querySelector("figure");
  assert.match(fig.className, /sm:float-right/); assert.match(fig.className, /sm:ml-5/);
  assert.equal(fig.querySelector("img").parentElement, fig, "no wrapper element inserted around the image");
  await click(host.querySelector("figure img"));
  assert.ok(dialog(), "wrapped image opens the overlay");
  assert.equal(stripZoomAttrs(host.innerHTML), plainHtml, "layout unchanged while overlay is open");
  await cleanup();
});
await test("Image block, Real-Life block and rich-text-embedded images all open", async () => {
  const blocks = [
    { block_type: "image", content: { url: ORIG, alt: "Block", wrap: "left", width: "small" } },
    { block_type: "image", content: { url: ORIG, alt: "Block2" } },
    { block_type: "real_life", content: { title: "RL", content: "text", imageUrl: ORIG, imageAlt: "RL img", imageWrap: "left" } },
    { block_type: "rich_text", content: { html: `<table><tr><td><img src="${ORIG}" alt="in table"></td></tr></table>` } },
  ];
  for (const block of blocks) {
    const host = await mount(h(ImageLightboxProvider, null, h(LearnBlockRenderer, { block })));
    const img = host.querySelector("img"); assert.ok(img, block.block_type);
    await click(img); assert.ok(dialog(), `${block.block_type} opens`);
    await key(document.body, "Escape"); await cleanup();
  }
});
await test("floated figure keeps its float classes for image block wrap=left", async () => {
  const block = { block_type: "image", content: { url: ORIG, alt: "x", wrap: "left", width: "small" } };
  const host = await mount(h(ImageLightboxProvider, null, h(LearnBlockRenderer, { block })));
  assert.match(host.querySelector("figure").className, /sm:float-left/);
  await cleanup();
});

const mcqQuestion = {
  id: "q1", questionType: "MCQ", questionText: "Which?", marks: 1,
  options: [{ id: "A", text: "Option A", imageUrl: THUMB, imageAlt: "Graph A" }, { id: "B", text: "Option B" }],
};
await test("MCQ option image: clicking the image opens the viewer and does NOT select/answer the option", async () => {
  const answers = [];
  const host = await mount(h(ImageLightboxProvider, null, h(QuestionRenderer, { question: mcqQuestion, questionNumber: 1, answer: null, onAnswer: (v) => answers.push(v) })));
  const img = host.querySelector("label img");
  assert.ok(img);
  await click(img);
  assert.ok(dialog(), "viewer opened");
  assert.deepEqual(answers, [], "no answer was selected");
  assert.equal(host.querySelector("input[type=radio]").checked, false);
  await key(document.body, "Escape");
  await key(img, "Enter"); assert.deepEqual(answers, []); await key(document.body, "Escape");
  // normal selection still works
  await click(host.querySelectorAll("label")[1]);
  assert.deepEqual(answers, ["B"]);
  await cleanup();
});
await test("Question stimulus image (assessment / Check your understanding) opens via ImageDiagram", async () => {
  const q = { id: "q2", questionType: "Short Response", questionText: "Look", stimulus: { type: "image", src: ORIG, alt: "Stim graph", caption: "Fig 1" } };
  const host = await mount(h(ImageLightboxProvider, null, h(QuestionRenderer, { question: q, questionNumber: 1, answer: "", onAnswer: () => {} })));
  const img = host.querySelector("figure img"); assert.ok(img);
  await click(img); assert.ok(dialog());
  assert.match(dialog().textContent, /Fig 1/);
  await cleanup();
});
await test("EnlargeGraphicButton: renders only inside provider; SVG/canvas -> image src", async () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 10 10");
  const src = graphicToImageSrc(svg);
  assert.match(src, /^data:image\/svg\+xml/);
  assert.match(decodeURIComponent(src), /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal(graphicToImageSrc("https://x/y.png"), "https://x/y.png");
  const none = await mount(h(EnlargeGraphicButton, { getTarget: () => svg }));
  assert.equal(none.querySelector("button"), null); await cleanup();
  const host = await mount(h(ImageLightboxProvider, null, h(EnlargeGraphicButton, { getTarget: () => svg, label: "Z vs P graph" })));
  await click(host.querySelector("button[aria-label='Enlarge Z vs P graph']"));
  assert.ok(dialog()); await cleanup();
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
