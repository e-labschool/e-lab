#!/usr/bin/env node
// Tests for the single simulation catalogue, the shared SimulationLibrary / viewer, the role navs and the "no Premium
// chrome while everything is free" rule:   node scripts/test-simulation-library.mjs
// Real modules throughout (catalogue, model, React components rendered with react-dom in jsdom + MemoryRouter).
// Honest limits: jsdom has no layout, no real localStorage quota behaviour and no WebGL -- the simulation engines
// themselves are replaced by a stub component in the viewer tests (layout / real engines: scripts/verify-platform-simulations.mjs).
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const cat = await import("../src/data/simulationCatalogue.js");
const { SIMULATION_REGISTRY } = await import("../src/data/simulationRegistry.js");
const { SIMULATION_COMPONENTS } = await import("../src/data/simulationEngineComponents.js");
const resources = await import("../src/data/resources-registry.js");
const model = await import("../src/lib/simulationLibraryModel.js");
const { STUDENT_TABS } = await import("../src/pages/student/StudentLayout.jsx");
const { TEACHER_TABS } = await import("../src/pages/teacher/TeacherLayout.jsx");
const SimulationLibrary = (await import("../src/components/simulation-library/SimulationLibrary.jsx")).default;
const SimulationViewer = (await import("../src/components/simulation-library/SimulationViewer.jsx")).default;
const { DEFAULT_ACCESS_CONFIG } = await import("../src/lib/access/accessPolicy.js");
const { DP_CHEMISTRY_2025_SYLLABUS_POINTS } = await import("../src/data/curricula/dp-chemistry/syllabus-points-2025.js");
const h = React.createElement;

let passed = 0; let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; }
}
const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
let mounted = null;
async function mount(el) {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); }
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); root.render(el); mounted = { root, host }; await tick(60);
}
async function click(el) { assert.ok(el, "missing element"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); }
async function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); await tick();
}
const names = () => $$("[data-sim-grid] article h2").map((n) => n.textContent);
const CONFIG_ON = { premiumEnabled: true, requireLoginForSimulations: false };
const router = (el, path = "/student/simulations") => h(MemoryRouter, { initialEntries: [path] }, el);
const live = cat.getLiveSimulations();
const lib = (props = {}) => router(h(SimulationLibrary, { role: "student", userId: "u1", entries: cat.SIMULATION_CATALOGUE, ctx: { signedIn: true, role: "student", entitlement: null, config: DEFAULT_ACCESS_CONFIG }, basePath: "/student/simulations", ...props }));
function brokenStorage() {
  const real = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("SecurityError: storage disabled"); } });
  return () => Object.defineProperty(window, "localStorage", real);
}

console.log("Catalogue integrity");
await test("ids are unique and every entry has the required metadata", () => {
  const ids = cat.SIMULATION_CATALOGUE.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of cat.SIMULATION_CATALOGUE) {
    assert.ok(e.label && e.description && e.subject === "chemistry" && e.topic, e.id);
    assert.ok(Object.values(cat.SIM_STATUS).includes(e.status), e.id);
    assert.ok(["demo", "free", "premium"].includes(e.tier), e.id);
    assert.equal(typeof e.featured, "boolean");
    assert.ok(Array.isArray(e.syllabus));
    assert.ok(!("level" in e), "level is omitted: no existing data records it");
  }
});
await test("every simulation in simulationRegistry has catalogue metadata (and a matching label)", () => {
  for (const [id, meta] of Object.entries(SIMULATION_REGISTRY)) {
    const e = cat.getCatalogueEntry(id);
    assert.ok(e, `${id} missing from catalogue`);
    assert.equal(e.label, meta.label);
    assert.equal(e.status, "live");
  }
});
await test("every live catalogue entry is in simulationRegistry AND has an engine component (and vice versa)", () => {
  assert.deepEqual(live.map((e) => e.id).sort(), Object.keys(SIMULATION_REGISTRY).sort());
  // mixture-separation-explorer was rebuilt (docs/sim-review/mixture-separation-rebuild.md) and is live again: it is in the registry,
  // the component map and the catalogue like every other simulation.
  assert.deepEqual(live.map((e) => e.id).sort(), Object.keys(SIMULATION_COMPONENTS).sort());
  assert.equal(cat.getCatalogueEntry("mixture-separation-explorer")?.status, "live");
});
await test("registry key order unchanged (the historical engine order, now including the rebuilt mixture-separation-explorer + mole-lab + polarity-playground + equilibrium-lab = 28)", () => {
  assert.equal(Object.keys(SIMULATION_REGISTRY).length, 28);
  assert.deepEqual(Object.keys(SIMULATION_REGISTRY).slice(0, 3), ["electron-configuration", "vsepr-explorer-3d", "explore-matter-and-states"]);
  assert.equal(Object.keys(SIMULATION_REGISTRY).at(-1), "spectroscopy-studio");
});
await test("topics come from TOPIC_AREAS; syllabus codes are real 2025 syllabus topics", () => {
  const known = new Set(DP_CHEMISTRY_2025_SYLLABUS_POINTS.map((p) => p.code.split(".").slice(0, 2).join(".")));
  for (const e of cat.SIMULATION_CATALOGUE) {
    assert.ok(cat.TOPIC_AREAS.includes(e.topic) || e.topic === "Other", `${e.id}: topic ${e.topic}`);
    for (const code of e.syllabus) { assert.match(code, /^[SR]\d\.\d+$/); assert.ok(known.has(code), `${e.id}: ${code} not in syllabus-points-2025`); }
  }
  const byId = (id) => cat.getCatalogueEntry(id).syllabus.join();
  assert.equal(byId("build-an-atom"), "S1.2"); assert.equal(byId("vsepr-explorer-3d"), "S2.2"); assert.equal(byId("chocolate-wrapping-rate"), "R2.2");
});
await test("all simulations default to the free tier (everything is free for now)", () => {
  assert.ok(cat.SIMULATION_CATALOGUE.every((e) => e.tier === "free"));
});
await test("every live simulation has a thumbnail file under public/ (< 60 KB); coming-soon items have none", () => {
  for (const e of live) {
    const file = new URL(`../public${e.thumbnail}`, import.meta.url);
    assert.ok(fs.existsSync(file), `${e.id}: ${e.thumbnail} missing -- run node scripts/capture-sim-thumbs.mjs`);
    assert.ok(fs.statSync(file).size < 60 * 1024, `${e.id} thumbnail too big`);
  }
  assert.ok(cat.SIMULATION_CATALOGUE.filter((e) => !cat.isLive(e)).every((e) => e.thumbnail === null));
});
await test("featured set: VSEPR, Heating Curve, Hybridisation now; Electron Configuration is not featured", () => {
  const f = cat.getFeaturedSimulations();
  assert.equal(cat.FEATURE_WHEN_READY, false, "FEATURE_WHEN_READY is off until the rebuilds land (flip it, then update this test)");
  assert.deepEqual(f.map((e) => e.id), ["vsepr-explorer-3d", "phase-change-heating-curve", "hybridisation-explorer"]);
  assert.ok(!f.some((e) => e.id === "electron-configuration"));
  assert.equal(cat.getCatalogueEntry("electron-configuration").featured, false);
  // the owner's four 'when ready' sims stay fully live and openable, just not featured yet
  for (const id of ["build-an-atom", "collision-theory-visualizer", "buffer-action-visualizer", "bonding-visualizer"]) {
    const e = cat.getCatalogueEntry(id); assert.ok(cat.isLive(e), id); assert.equal(e.featured, false, `${id} featured only after FEATURE_WHEN_READY`);
  }
});
await test("existing /interactives registry still intact and linked: every live resource maps to a catalogue entry; non-live ones are not lost", () => {
  const all = resources.getAllResources();
  assert.ok(all.length >= 24);
  for (const r of resources.getResourcesByStatus("live")) {
    assert.ok(cat.SIMULATION_CATALOGUE.some((e) => e.resourceId === r.id), `live resource ${r.id} not linked from the catalogue`);
  }
  const covered = new Set(cat.SIMULATION_CATALOGUE.map((e) => e.id).concat(cat.SIMULATION_CATALOGUE.map((e) => e.resourceId)));
  for (const r of all) if (r.status !== "live") assert.ok(covered.has(r.id) || ["mixture-separation-explorer", "ideal-gas-simulator", "molecular-geometry-explorer", "collision-theory-lab", "titration-lab", "spectroscopy-studio", "mass-spectrometer-simulator", "molecular-polarity-explorer", "equilibrium-simulator"].includes(r.id), `${r.id} dropped`);
});

console.log("Library model: search / sort / filter / storage");
const all = cat.SIMULATION_CATALOGUE;
await test("search matches name, description, topic and syllabus code (case-insensitive, all words)", () => {
  const ids = (q) => model.filterSimulations(all, { query: q }).map((e) => e.id);
  assert.ok(ids("titration").includes("titration-ph-curve"));
  assert.deepEqual(ids("TITRATION"), ids("titration"), "case-insensitive");
  assert.deepEqual(ids("S1.2"), ["build-an-atom"]);
  assert.ok(ids("s2.2").includes("vsepr-explorer-3d") && ids("s2.2").includes("hybridisation-explorer"));
  assert.ok(ids("spectroscopy").includes("spectroscopy-studio"));
  assert.ok(ids("isotopes").includes("build-an-atom"), "description match");
  assert.ok(ids("acids").every((id) => cat.getCatalogueEntry(id).topic === "Acids & bases" || /acid/i.test(cat.getCatalogueEntry(id).description)));
  assert.deepEqual(ids("zzzz-nothing"), []);
  assert.equal(ids("  ").length, live.length, "blank query = everything live");
  assert.deepEqual(ids("atom s1.2"), ["build-an-atom"], "all words must match");
});
await test("sort A->Z and Z->A (live first; coming soon after)", () => {
  const az = model.filterSimulations(all, { sort: "az" }).map((e) => e.label);
  const za = model.filterSimulations(all, { sort: "za" }).map((e) => e.label);
  assert.equal(az.length, live.length);
  assert.deepEqual(az, [...az].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true })));
  assert.deepEqual(za, [...az].reverse());
  const withSoon = model.filterSimulations(all, { showComingSoon: true });
  assert.equal(withSoon.length, all.length);
  assert.ok(withSoon.slice(0, live.length).every(cat.isLive) && withSoon.slice(live.length).every((e) => !cat.isLive(e)));
});
await test("topic chips, favourites and recently-used filters", () => {
  const bonding = model.filterSimulations(all, { chip: { kind: "topic", value: "Bonding" } });
  assert.ok(bonding.length >= 4 && bonding.every((e) => e.topic === "Bonding"));
  assert.deepEqual(model.filterSimulations(all, { chip: { kind: "favourites" }, favourites: ["wave-explorer", "build-an-atom"] }).map((e) => e.id), ["build-an-atom", "wave-explorer"]);
  assert.deepEqual(model.filterSimulations(all, { chip: { kind: "recent" }, recent: ["wave-explorer", "build-an-atom"] }).map((e) => e.id), ["wave-explorer", "build-an-atom"], "recent: most recent first");
  assert.deepEqual(model.filterSimulations(all, { chip: { kind: "favourites" }, favourites: [] }), []);
  const topics = model.topicsOf(live);
  assert.deepEqual(topics, cat.TOPIC_AREAS.filter((t) => live.some((e) => e.topic === t)));
});
await test("tier chip filter works on overridden tiers", () => {
  const ov = cat.applyAccessOverrides(all, { "wave-explorer": { tier: "premium" } });
  assert.deepEqual(model.filterSimulations(ov, { chip: { kind: "tier", value: "premium" } }).map((e) => e.id), ["wave-explorer"]);
  assert.equal(model.filterSimulations(ov, { chip: { kind: "tier", value: "free" } }).length, live.length - 1);
});
await test("favourites / recent persist per user (localStorage) and are namespaced", () => {
  window.localStorage.clear();
  let favs = model.loadFavourites("uA");
  favs = model.toggleFavourite("uA", favs, "build-an-atom"); favs = model.toggleFavourite("uA", favs, "wave-explorer");
  assert.deepEqual(model.loadFavourites("uA"), ["build-an-atom", "wave-explorer"]);
  assert.deepEqual(model.loadFavourites("uB"), []);
  assert.deepEqual(model.toggleFavourite("uA", favs, "build-an-atom"), ["wave-explorer"]);
  let rec = []; for (const id of ["a", "b", "c", "a"]) rec = model.pushRecent("uA", rec, id);
  assert.deepEqual(rec, ["a", "c", "b"]);
  for (let i = 0; i < 30; i += 1) rec = model.pushRecent("uA", rec, `s${i}`);
  assert.equal(model.loadRecent("uA").length, model.MAX_RECENT);
  window.localStorage.setItem("e-lab:uA:sim-favourites", "{not json");
  assert.deepEqual(model.loadFavourites("uA"), [], "corrupt storage -> empty, no throw");
  window.localStorage.setItem("e-lab:uA:sim-favourites", JSON.stringify({ a: 1 }));
  assert.deepEqual(model.loadFavourites("uA"), [], "wrong shape -> empty");
  window.localStorage.clear();
});
await test("storage unavailable: model never throws and still works for the session", () => {
  const restore = brokenStorage();
  try {
    assert.deepEqual(model.loadFavourites("u1"), []); assert.deepEqual(model.loadRecent("u1"), []);
    assert.deepEqual(model.toggleFavourite("u1", [], "build-an-atom"), ["build-an-atom"]);
    assert.deepEqual(model.pushRecent("u1", ["a"], "b"), ["b", "a"]);
    assert.doesNotThrow(() => model.recordRecentUse("u1", "x"));
  } finally { restore(); }
});

console.log("Role navs and routes");
await test("student nav: Learn, Simulations, Assess, Resources, Progress", () => {
  assert.deepEqual(STUDENT_TABS.map((t) => t.label), ["Learn", "Simulations", "Assess", "Resources", "Progress"]);
  assert.equal(STUDENT_TABS[1].to, "/student/simulations");
});
await test("teacher nav: Teach, Class Planner, Simulations, Question Builder, Resources", () => {
  assert.deepEqual(TEACHER_TABS.map((t) => t.label), ["Teach", "Class Planner", "Simulations", "Question Builder", "Resources"]);
  assert.equal(TEACHER_TABS[2].to, "/teacher/simulations");
});
await test("router keeps every old route and adds the library + viewer routes for both roles + admin page", () => {
  const src = fs.readFileSync(new URL("../src/router.jsx", import.meta.url), "utf8");
  for (const p of ['path: "interactives"', 'path: "/simulation/:simulationId"', 'path: "simulations"', 'path: "simulations/:simulationId"', 'path: "learn"', 'path: "solve"', 'path: "progress"', 'path: "resources"', 'path: "class-planner"', 'path: "question-builder"']) assert.ok(src.includes(p), p);
  assert.equal((src.match(/path: "simulations"/g) || []).length, 3, "student + teacher + admin");
  assert.equal((src.match(/path: "simulations\/:simulationId"/g) || []).length, 2, "student + teacher viewers");
  const admin = fs.readFileSync(new URL("../src/pages/admin/AdminLayout.jsx", import.meta.url), "utf8");
  assert.ok(/to: "\/admin\/simulations", label: "Simulations"/.test(admin));
});

console.log("SimulationLibrary rendering");
await test("premium OFF: no Free/Premium chips, no tier badges, no lock chips, no 'Premium' text anywhere", async () => {
  const withPremium = cat.applyAccessOverrides(all, { "wave-explorer": { tier: "premium" }, "build-an-atom": { tier: "demo" } });
  await mount(lib({ entries: withPremium }));
  assert.equal($$("[data-chip^='tier']").length, 0);
  assert.equal($$("[data-tier-badge]").length, 0); assert.equal($$("[data-lock-chip]").length, 0);
  assert.doesNotMatch(document.body.textContent, /premium|upgrade|notify|plans?\b/i);
  assert.equal(names().length, live.length);
  assert.equal($$("[data-sim-grid] article a").every((a) => a.getAttribute("href").startsWith("/student/simulations/")), true);
});
await test("premium ON: Free/Premium chips, tier badges and lock chips appear (and filter works)", async () => {
  const withPremium = cat.applyAccessOverrides(all, { "wave-explorer": { tier: "premium" }, "build-an-atom": { tier: "demo" } });
  const ctx = { signedIn: true, role: "student", entitlement: null, config: CONFIG_ON };
  await mount(lib({ entries: withPremium, ctx }));
  assert.ok($("[data-chip='tier:free']") && $("[data-chip='tier:premium']"));
  assert.ok($$("[data-tier-badge]").length >= live.length - 1);
  assert.equal($$("[data-lock-chip]").length, 1, "only the premium sim, for a user without entitlement");
  await click($("[data-chip='tier:premium']"));
  assert.deepEqual(names(), ["Wave Explorer"]);
  await mount(lib({ entries: withPremium, ctx: { ...ctx, entitlement: { plan: "premium", expiresAt: "2999-01-01T00:00:00Z" } } }));
  assert.equal($$("[data-lock-chip]").length, 0, "entitled user sees no lock");
});
await test("student cards say Open; teacher cards say Present", async () => {
  await mount(lib());
  assert.ok($$("[data-sim-grid] article").every((a) => /Open/.test(a.textContent) && !/Present/.test(a.textContent)));
  await mount(lib({ role: "teacher", basePath: "/teacher/simulations" }));
  assert.ok($$("[data-sim-grid] article").every((a) => /Present/.test(a.textContent)));
  assert.ok($$("[data-sim-grid] article a").every((a) => a.getAttribute("href").startsWith("/teacher/simulations/")));
});
await test("search box, sort select and topic chips drive the grid", async () => {
  await mount(lib());
  await type($("input[type=search]"), "S1.2");
  assert.deepEqual(names(), ["Build an Atom"]);
  await type($("input[type=search]"), "");
  const select = $("select"); select.value = "za"; select.dispatchEvent(new window.Event("change", { bubbles: true })); await tick();
  const za = names(); assert.deepEqual(za, [...za].sort((a, b) => b.localeCompare(a, "en", { sensitivity: "base", numeric: true })));
  await click($("[data-chip='topic:Kinetics']"));
  assert.equal(names().length, 2);
  assert.equal($("[data-chip='topic:Kinetics']").getAttribute("aria-pressed"), "true");
  await type($("input[type=search]"), "no such thing");
  assert.ok($("[data-empty]"), "empty state");
});
await test("coming-soon items are hidden by default; with the toggle they show, with no link", async () => {
  await mount(lib());
  assert.equal($$("article[data-live='false']").length, 0);
  await click($("input[type=checkbox]"));
  const soon = $$("article[data-live='false']"); assert.ok(soon.length >= 10);
  assert.ok(soon.every((a) => a.querySelector("a") === null && /Coming soon/.test(a.textContent)));
});
await test("favourites: star toggles, persists per user, Favourites chip filters; thumbnails fall back to a gradient", async () => {
  window.localStorage.clear();
  await mount(lib());
  const star = $("article[data-sim-id='build-an-atom'] button[aria-pressed]");
  assert.equal(star.getAttribute("aria-pressed"), "false");
  await click(star); assert.equal($("article[data-sim-id='build-an-atom'] button[aria-pressed]").getAttribute("aria-pressed"), "true");
  assert.deepEqual(model.loadFavourites("u1"), ["build-an-atom"]);
  await click($("[data-chip='favourites']")); assert.deepEqual(names(), ["Build an Atom"]);
  await mount(lib()); // remount = new visit
  assert.equal($("article[data-sim-id='build-an-atom'] button[aria-pressed]").getAttribute("aria-pressed"), "true");
  await mount(lib({ userId: "someone-else" }));
  assert.equal($("article[data-sim-id='build-an-atom'] button[aria-pressed]").getAttribute("aria-pressed"), "false");
  // missing thumbnail -> gradient fallback, never a broken image
  const noThumb = all.map((e) => (e.id === "build-an-atom" ? { ...e, thumbnail: null } : e));
  await mount(lib({ entries: noThumb }));
  assert.equal($("article[data-sim-id='build-an-atom'] [data-thumb]").getAttribute("data-thumb"), "fallback");
  window.localStorage.clear();
});
await test("storage unavailable: the library renders and favourites still toggle for the visit", async () => {
  const restore = brokenStorage();
  try {
    await mount(lib());
    assert.equal(names().length, live.length);
    await click($("article[data-sim-id='wave-explorer'] button[aria-pressed]"));
    assert.equal($("article[data-sim-id='wave-explorer'] button[aria-pressed]").getAttribute("aria-pressed"), "true");
    await click($("[data-chip='recent']")); assert.ok($("[data-empty]"));
  } finally { restore(); }
});

console.log("SimulationViewer / LockedContent");
const Stub = () => h("div", { "data-engine-stub": "true" }, "engine");
const stubs = Object.fromEntries(Object.keys(SIMULATION_COMPONENTS).map((id) => [id, Stub]));
const viewer = (entries, ctx, simulationId = "wave-explorer") => router(h(SimulationViewer, { role: "student", userId: "u1", simulationId, entries, ctx, basePath: "/student/simulations", components: stubs }), `/student/simulations/${simulationId}`);
const signedIn = (config, extra = {}) => ({ signedIn: true, role: "student", entitlement: null, config, ...extra });
await test("premium OFF: even a Premium-tier simulation opens (no locked screen); recently-used is recorded", async () => {
  window.localStorage.clear();
  const entries = cat.applyAccessOverrides(all, { "wave-explorer": { tier: "premium" } });
  await mount(viewer(entries, signedIn(DEFAULT_ACCESS_CONFIG)));
  assert.ok($("[data-engine-stub]")); assert.equal($("[data-locked-content]"), null);
  assert.equal($$("[data-tier-badge]").length, 0);
  assert.deepEqual(model.loadRecent("u1"), ["wave-explorer"]);
  assert.match($("h1").textContent, /Wave Explorer/);
  window.localStorage.clear();
});
await test("flipping the config ON shows the locked prompt for a Premium simulation (no 'Notify me'); entitlement opens it", async () => {
  const entries = cat.applyAccessOverrides(all, { "wave-explorer": { tier: "premium" } });
  await mount(viewer(entries, signedIn(CONFIG_ON)));
  assert.ok($("[data-locked-content]")); assert.equal($("[data-locked-content]").getAttribute("data-reason"), "premium-required");
  assert.equal($("[data-engine-stub]"), null);
  assert.match(document.body.textContent, /This is a Premium simulation/); assert.doesNotMatch(document.body.textContent, /notify/i);
  assert.ok($$("a").some((a) => a.getAttribute("href") === "/student/simulations" && /Back to simulations/.test(a.textContent)));
  await mount(viewer(entries, signedIn(CONFIG_ON, { entitlement: { plan: "premium", expiresAt: "2999-01-01T00:00:00Z" } })));
  assert.ok($("[data-engine-stub]") && !$("[data-locked-content]"));
  await mount(viewer(entries, signedIn(CONFIG_ON, { role: "teacher" })));
  assert.ok($("[data-locked-content]"), "teacher role does not unlock Premium");
  await mount(viewer(entries, signedIn(CONFIG_ON, { entitlement: { plan: "premium", expiresAt: "2020-01-01T00:00:00Z" } })));
  assert.ok($("[data-locked-content]"), "expired entitlement is locked");
});
await test("requireLoginForSimulations: signed-out visitors get the login prompt; free sims stay open when signed in", async () => {
  const cfg = { premiumEnabled: false, requireLoginForSimulations: true };
  await mount(viewer(all, { signedIn: false, config: cfg }));
  assert.equal($("[data-locked-content]").getAttribute("data-reason"), "login-required");
  assert.ok($$("a").some((a) => /Log in/.test(a.textContent)));
  await mount(viewer(all, { signedIn: true, role: "student", config: cfg }));
  assert.ok($("[data-engine-stub]"));
});
await test("unknown and coming-soon ids show a friendly message, not a crash", async () => {
  await mount(viewer(all, signedIn(DEFAULT_ACCESS_CONFIG), "does-not-exist"));
  assert.match(document.body.textContent, /Simulation not available/);
  await mount(viewer(all, signedIn(DEFAULT_ACCESS_CONFIG), "mole-calculator"));
  assert.match(document.body.textContent, /not ready yet/);
});
await test("viewer adds no Fullscreen / Open-in-New-Tab buttons of its own (the engine's InteractiveFrame supplies them once)", async () => {
  await mount(viewer(all, signedIn(DEFAULT_ACCESS_CONFIG)));
  assert.equal($$("button").filter((b) => /fullscreen|new tab/i.test(b.textContent + b.getAttribute("aria-label"))).length, 0);
});

if (mounted) mounted.root.unmount();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
