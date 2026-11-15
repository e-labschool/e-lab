#!/usr/bin/env node
// Tests for the curricula config, the simulation catalogue `curriculum` field + library curriculum filter, and the
// padlock (LOCK) toggle on /admin/simulations:   node scripts/test-curricula-and-locks.mjs
// (Sign-up / profile curriculum UI is in scripts/test-auth-signup-confirmation.mjs; the folders lock toggle is in
// scripts/test-resource-folders-ui.mjs.)  Real modules throughout; Supabase is the in-memory stand-in below via the
// resource-folders loader hooks (supabaseClient + AuthContext are replaced).  Honest limits: jsdom has no layout, so
// look / responsiveness is checked by scripts/verify-curricula-and-locks.mjs (Chromium); the fake is not Supabase.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "Element", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "SVGElement"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
for (const k of ["sessionStorage", "localStorage", "navigator"]) Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true });
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./resource-folders-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const CUR = await import("../src/data/curricula.js");
const cat = await import("../src/data/simulationCatalogue.js");
const model = await import("../src/lib/simulationLibraryModel.js");
const { getAllCurricula } = await import("../src/data/curricula/index.js");
const { default: LockToggle } = await import("../src/components/admin/LockToggle.jsx");
const { default: AdminSimulations } = await import("../src/pages/admin/simulations/AdminSimulations.jsx");
const { default: SimulationLibrary } = await import("../src/components/simulation-library/SimulationLibrary.jsx");
const { DEFAULT_ACCESS_CONFIG } = await import("../src/lib/access/accessPolicy.js");
const h = React.createElement;

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const click = async (el) => { assert.ok(el, "click target missing"); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await wait(); };
let root; let passed = 0; let failed = 0;
async function mount(el) { root?.unmount(); document.body.innerHTML = '<div id="root"></div>'; root = createRoot($("#root")); root.render(h(MemoryRouter, null, el)); await wait(80); }
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; }
}

// ---- curricula config --------------------------------------------------------------------------------------
console.log("curricula config");
await test("integrity: ids unique + kebab-case, labels non-empty and unique, status valid, frozen", () => {
  const list = CUR.PLATFORM_CURRICULA;
  assert.deepEqual(list.map((c) => c.id), ["ib-dp", "cambridge-igcse", "cambridge-as-a-level", "other"]);
  for (const key of ["id", "label", "shortLabel", "profileName"]) {
    const vals = list.map((c) => c[key]);
    assert.ok(vals.every((v) => typeof v === "string" && v.trim()), `${key} present`);
    assert.equal(new Set(vals).size, vals.length, `${key} unique`);
  }
  assert.ok(list.every((c) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)));
  assert.ok(list.every((c) => Object.values(CUR.CURRICULUM_STATUS).includes(c.status)));
  assert.ok(Object.isFrozen(list) && list.every(Object.isFrozen));
  assert.ok(list.some((c) => c.id === CUR.DEFAULT_CURRICULUM_ID) && list.some((c) => c.id === CUR.OTHER_CURRICULUM_ID && c.allowsFreeText));
  assert.equal(list.filter((c) => c.allowsFreeText).length, 1, "only 'Other' takes free text");
  assert.equal(CUR.PLATFORM_CURRICULA[0].profileName, "IB Diploma Programme", "legacy profiles.curriculum text preserved");
});
await test("honesty: only IB DP is 'available' and that matches the content that actually exists in the repo", () => {
  assert.deepEqual(CUR.PLATFORM_CURRICULA.filter((c) => c.status === "available").map((c) => c.id), ["ib-dp"]);
  // Every curriculum map registered for lessons/concept placement is DP Chemistry. When a Cambridge map is added this
  // fails on purpose: flip that curriculum's status to 'available' in src/data/curricula.js.
  assert.ok(getAllCurricula().every((c) => c.curriculum === "dp-chemistry"), "no non-IB curriculum content exists yet");
  assert.equal(CUR.isCurriculumAvailable("cambridge-igcse"), false);
});
await test("the existing student-landing CURRICULA export is untouched", () => {
  assert.equal(CUR.CURRICULA[0].id, "ib-dp"); assert.equal(CUR.CURRICULA[0].subjects[0].path, "/student/learn");
});
await test("role rules: student = exactly one, teacher = one or more, never empty, unknown ids dropped", () => {
  assert.deepEqual(CUR.curriculaForRole("student", ["cambridge-igcse", "ib-dp"]), ["ib-dp"]);
  assert.deepEqual(CUR.curriculaForRole("teacher", ["cambridge-igcse", "ib-dp"]), ["ib-dp", "cambridge-igcse"]);
  assert.deepEqual(CUR.curriculaForRole("teacher", []), ["ib-dp"]);
  assert.deepEqual(CUR.curriculaForRole("student", ["nope"]), ["ib-dp"]);
  assert.equal(CUR.curriculumDisplay("other", " AP  ", { short: true }), "Other (AP)");
  assert.equal(CUR.cleanOtherName("x".repeat(200)).length, CUR.OTHER_NAME_MAX);
});

// ---- catalogue + library filter ----------------------------------------------------------------------------
console.log("catalogue field and library filter");
const live = cat.getLiveSimulations();
await test("every live simulation is ['ib-dp'] (verified by IB syllabus codes); coming-soon entries claim nothing", () => {
  assert.ok(live.length >= 25);
  for (const e of live) {
    assert.deepEqual([...e.curriculum], ["ib-dp"], e.id);
    assert.ok(e.syllabus.length > 0 && e.syllabus.every((c) => /^[SR]\d/.test(c)), `${e.id}: IB DP syllabus codes back the mapping`);
    assert.ok(Object.isFrozen(e.curriculum));
  }
  const soon = cat.SIMULATION_CATALOGUE.filter((e) => !cat.isLive(e));
  assert.ok(soon.length > 0 && soon.every((e) => Array.isArray(e.curriculum) && e.curriculum.length === 0));
  const known = new Set(CUR.PLATFORM_CURRICULA.map((c) => c.id));
  assert.ok(cat.SIMULATION_CATALOGUE.every((e) => (e.curriculum ?? []).every((id) => known.has(id))), "all ids exist in the config");
  assert.ok(!cat.SIMULATION_CATALOGUE.some((e) => (e.curriculum ?? []).some((id) => id.includes("cambridge"))), "no invented IGCSE / A Level mapping");
});
await test("the field is optional: entries without it behave as 'no curriculum'; overrides keep it", () => {
  assert.deepEqual(model.curriculaOf([{ id: "x" }]), []);
  const ov = cat.applyAccessOverrides(cat.SIMULATION_CATALOGUE, { "wave-explorer": { tier: "premium" } });
  assert.deepEqual([...ov.find((e) => e.id === "wave-explorer").curriculum], ["ib-dp"]);
});
await test("model: curriculaOf is in config order; filterSimulations narrows by curriculum and combines with a chip", () => {
  const mixed = [
    { id: "a", label: "A", topic: "Bonding", status: "live", tier: "free", syllabus: [], curriculum: ["ib-dp"], description: "" },
    { id: "b", label: "B", topic: "Bonding", status: "live", tier: "free", syllabus: [], curriculum: ["cambridge-igcse", "ib-dp"], description: "" },
    { id: "c", label: "C", topic: "Kinetics", status: "live", tier: "free", syllabus: [], curriculum: ["cambridge-igcse"], description: "" },
  ];
  assert.deepEqual(model.curriculaOf(mixed), ["ib-dp", "cambridge-igcse"]);
  assert.deepEqual(model.filterSimulations(mixed, { curriculum: "cambridge-igcse" }).map((e) => e.id), ["b", "c"]);
  assert.deepEqual(model.filterSimulations(mixed, { curriculum: "cambridge-igcse", chip: { kind: "topic", value: "Bonding" } }).map((e) => e.id), ["b"]);
  assert.equal(model.filterSimulations(mixed, {}).length, 3);
  assert.deepEqual(model.curriculaOf(live), ["ib-dp"], "today only one curriculum has simulations");
});
const lib = (entries) => h(SimulationLibrary, { role: "student", userId: "u1", entries, ctx: { signedIn: true, role: "student", entitlement: null, config: DEFAULT_ACCESS_CONFIG }, basePath: "/student/simulations" });
await test("library: the curriculum chip row is HIDDEN while only one curriculum has items", async () => {
  await mount(lib(cat.SIMULATION_CATALOGUE));
  assert.ok($("[data-sim-grid]"));
  assert.equal($("[data-curriculum-filter]"), null);
  assert.equal($$("[data-chip^='curriculum:']").length, 0);
});
await test("library: with a second curriculum the row appears, filters, combines, and clears", async () => {
  const entries = cat.SIMULATION_CATALOGUE.map((e) => (e.id === "wave-explorer" ? Object.freeze({ ...e, curriculum: Object.freeze(["ib-dp", "cambridge-igcse"]) }) : e));
  await mount(lib(entries));
  assert.ok($("[data-curriculum-filter]"));
  assert.deepEqual($$("[data-chip^='curriculum:']").map((b) => norm(b.textContent)), ["All curricula", "IB DP", "IGCSE"]);
  const count = () => norm($("[data-result-count]").textContent);
  await click($("[data-chip='curriculum:cambridge-igcse']"));
  assert.equal(count(), "1 simulation match"); assert.equal($("[data-chip='curriculum:cambridge-igcse']").getAttribute("aria-pressed"), "true");
  assert.deepEqual($$("[data-sim-grid] article h2").map((n) => n.textContent), ["Wave Explorer"]);
  await click($("[data-chip='topic:Kinetics']"));
  assert.ok($("[data-empty]"), "IGCSE + Kinetics has no items -> friendly empty state");
  await click($("[data-chip='curriculum:all']")); await click($("[data-chip='all']"));
  assert.equal($$("[data-sim-grid] article").length, live.length);
});

// ---- LockToggle --------------------------------------------------------------------------------------------
console.log("lock toggle");
await test("LockToggle: button with aria-pressed, constant name, action tooltip + description, onChange(!locked)", async () => {
  const calls = [];
  await mount(h(LockToggle, { id: "t", name: "Wave Explorer", locked: false, onChange: (v) => calls.push(v) }));
  const b = $("#t");
  assert.equal(b.tagName, "BUTTON"); assert.equal(b.getAttribute("type"), "button");
  assert.equal(b.getAttribute("aria-pressed"), "false"); assert.equal(b.getAttribute("aria-label"), "Premium lock for Wave Explorer");
  assert.equal(b.getAttribute("title"), "Lock for Premium"); assert.equal(norm($("#t-action").textContent), "Lock for Premium");
  assert.equal(b.getAttribute("aria-describedby"), "t-action");
  await click(b); assert.deepEqual(calls, [true]);
  await mount(h(LockToggle, { id: "t", name: "Wave Explorer", locked: true, onChange: (v) => calls.push(v) }));
  assert.equal($("#t").getAttribute("aria-pressed"), "true"); assert.equal($("#t").getAttribute("title"), "Unlock (free)");
  assert.equal(norm($("#t-action").textContent), "Unlock (free)");
  assert.equal($("#t").getAttribute("aria-label"), "Premium lock for Wave Explorer", "name never flips (no 'Unlock, pressed' contradiction)");
  await click($("#t")); assert.deepEqual(calls, [true, false]);
});
await test("LockToggle: disabled does nothing; Enter/Space keydown does not leak to a parent tree handler", async () => {
  const calls = []; let leaked = 0;
  await mount(h("div", { onKeyDown: () => { leaked += 1; } }, h(LockToggle, { id: "d", name: "X", locked: false, disabled: true, onChange: (v) => calls.push(v) })));
  assert.equal($("#d").disabled, true); await click($("#d")); assert.deepEqual(calls, []);
  await mount(h("div", { onKeyDown: () => { leaked += 1; } }, h(LockToggle, { id: "d", name: "X", locked: false, onChange: (v) => calls.push(v) })));
  $("#d").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); assert.equal(leaked, 0);
});

// ---- /admin/simulations --------------------------------------------------------------------------------------
console.log("admin simulations page");
function fakeSupabase({ table = true, settings = true, initial = [] } = {}) {
  const rows = initial.map((r) => ({ ...r })); const log = [];
  const settingsRow = settings ? { id: 1, premium_enabled: false, require_login_for_simulations: false } : null;
  const from = (name) => {
    if (name === "platform_settings") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: settingsRow, error: settingsRow ? null : { message: "x" } }) }), maybeSingle: async () => ({ data: settingsRow, error: null }) }) };
    if (name === "simulation_access") {
      return {
        select: () => Promise.resolve(table ? { data: rows.map((r) => ({ ...r })), error: null } : { data: null, error: { code: "PGRST205", message: "no table" } }),
        upsert: async (row) => {
          log.push(row); const i = rows.findIndex((r) => r.sim_id === row.sim_id);
          if (i >= 0) Object.assign(rows[i], row); else rows.push({ featured: false, tier: "free", ...row });
          return { error: null };
        },
      };
    }
    return { select: () => Promise.resolve({ data: [], error: null }) };
  };
  return { from, log, rows };
}
const adminAuth = { isConfigured: true, profile: { role: "admin" }, user: { id: "a" } };
async function mountAdmin(fake) { globalThis.__rfSupabase = fake; globalThis.__rfAuth = adminAuth; await mount(h(AdminSimulations)); await wait(60); }

await test("the Access-level dropdowns are gone; one lock toggle per live simulation, all unlocked (free) by default", async () => {
  await mountAdmin(fakeSupabase());
  assert.equal($$("select").length, 0, "no dropdowns on the page");
  assert.equal($$("[data-sim-row]").length, live.length);
  const locks = $$("[data-lock-toggle]");
  assert.equal(locks.length, live.length);
  assert.ok(locks.every((b) => b.getAttribute("aria-pressed") === "false" && !b.disabled));
  assert.match(norm($('[data-testid="lock-help"]').textContent), /Locks only take effect when Premium is switched on .* right now everything is free for everyone/);
  assert.match(norm($("[data-banner='all-free']").textContent), /Everything is currently free for everyone/);
  assert.ok(/Premium lock/.test(norm($("thead").textContent)));
});
await test("locking writes the unchanged payload {sim_id, tier:'premium', featured}; unlocking writes tier 'free'", async () => {
  const fake = fakeSupabase(); await mountAdmin(fake);
  await click($("#lock-build-an-atom")); await wait(60);
  assert.deepEqual(fake.log[0], { sim_id: "build-an-atom", tier: "premium", featured: true });
  assert.equal($("#lock-build-an-atom").getAttribute("aria-pressed"), "true"); assert.equal($("#lock-build-an-atom").getAttribute("title"), "Unlock (free)");
  assert.match(norm($("[data-sim-row='build-an-atom']").textContent), /Locked.*Saved; open to everyone while Premium is off/);
  assert.equal($("#lock-wave-explorer").getAttribute("aria-pressed"), "false", "other rows untouched");
  await click($("#lock-build-an-atom")); await wait(60);
  assert.deepEqual(fake.log[1], { sim_id: "build-an-atom", tier: "free", featured: true });
  assert.equal($("#lock-build-an-atom").getAttribute("aria-pressed"), "false");
});
await test("Featured star still works and keeps the lock; a previously saved 'demo' row shows as free demo and can be locked", async () => {
  const fake = fakeSupabase({ initial: [{ sim_id: "wave-explorer", tier: "demo", featured: false }] }); await mountAdmin(fake);
  assert.equal($("#lock-wave-explorer").getAttribute("aria-pressed"), "false");
  assert.match(norm($("[data-sim-row='wave-explorer']").textContent), /Free demo/);
  await click($("#lock-build-an-atom")); await wait(60);
  await click($("button[aria-label^='Remove Build an Atom']")); await wait(60);
  assert.deepEqual(fake.log.at(-1), { sim_id: "build-an-atom", tier: "premium", featured: false });
  await click($("#lock-wave-explorer")); await wait(60);
  assert.deepEqual(fake.log.at(-1), { sim_id: "wave-explorer", tier: "premium", featured: false });
});
await test("table missing: lock toggles are disabled and the notice explains; nothing is written", async () => {
  const fake = fakeSupabase({ table: false }); await mountAdmin(fake);
  assert.ok($("[data-notice='table-missing']"));
  assert.ok($$("[data-lock-toggle]").every((b) => b.disabled));
  await click($("#lock-build-an-atom")); assert.equal(fake.log.length, 0);
});
await test("a failed save rolls the toggle back and shows the error", async () => {
  const fake = fakeSupabase();
  const orig = fake.from; fake.from = (n) => (n === "simulation_access" ? { ...orig(n), upsert: async () => ({ error: { message: "permission denied" } }) } : orig(n));
  await mountAdmin(fake);
  await click($("#lock-build-an-atom")); await wait(60);
  assert.equal($("#lock-build-an-atom").getAttribute("aria-pressed"), "false");
  assert.match(norm($("[data-sim-row='build-an-atom'] [role=alert]").textContent), /permission denied/);
});

root?.unmount();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
