#!/usr/bin/env node
// Unit tests for src/lib/access/accessPolicy.js and accessConfigService.js (pure Node, no DOM):
//   node scripts/test-access-policy.mjs
// Covers every tier x config x sign-in x entitlement combination, the teacher-role rule, entitlement expiry, the
// presentation helpers, and the config service's safe fallbacks (injected fake Supabase clients -- nothing real is called).
import assert from "node:assert/strict";
import { register } from "node:module";
// supabaseClient.js reads import.meta.env (Vite only); the shared loader hook swaps in a stub.  The service under test
// takes its client as an argument, so no real client is ever used.
register("./jsx-loader-hooks.mjs", import.meta.url);
const {
  TIERS, TIER_LIST, DEFAULT_ACCESS_CONFIG, normaliseTier, hasPremiumEntitlement, checkAccess, canAccess,
  showPremiumUi, tierBadge, tierLabel, showTierFilters, showLockChip, matchesTierFilter, lockedCopy,
  ACTIONS, checkAction, canDoAction, showDownloadLock, lockedActionCopy,
} = await import("../src/lib/access/accessPolicy.js");
const {
  CONFIG_COLUMNS, normaliseAccessConfig, fetchAccessConfig, fetchAdminAccessConfig, saveAccessConfig,
  fetchSimulationOverrides, saveSimulationOverride,
} = await import("../src/lib/access/accessConfigService.js");
const { applyAccessOverrides, SIMULATION_CATALOGUE } = await import("../src/data/simulationCatalogue.js");

let passed = 0; let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 4).join("\n       ")}`); failed += 1; }
}

const NOW = Date.parse("2026-06-01T00:00:00Z");
const FUTURE = "2027-01-01T00:00:00Z"; const PAST = "2026-01-01T00:00:00Z";
const CONFIGS = {
  allFree: { premiumEnabled: false, requireLoginForSimulations: false, downloadRequiresPremium: false },
  loginOnly: { premiumEnabled: false, requireLoginForSimulations: true, downloadRequiresPremium: false },
  premiumOnly: { premiumEnabled: true, requireLoginForSimulations: false, downloadRequiresPremium: false },
  both: { premiumEnabled: true, requireLoginForSimulations: true, downloadRequiresPremium: false },
};
const PREMIUM_USER = { plan: "premium", expiresAt: FUTURE };

await test("default config is everything-free", () => {
  assert.deepEqual({ ...DEFAULT_ACCESS_CONFIG }, CONFIGS.allFree);
  assert.ok(Object.isFrozen(DEFAULT_ACCESS_CONFIG));
  assert.equal(showPremiumUi(), false);
});

await test("normaliseTier: unknown / missing => free", () => {
  for (const t of [undefined, null, "", "gold", 5]) assert.equal(normaliseTier(t), TIERS.FREE);
  for (const t of TIER_LIST) assert.equal(normaliseTier(t), t);
});

await test("premiumEnabled=false and login not required: every tier open to everyone (signed out, student, teacher)", () => {
  for (const tier of [...TIER_LIST, undefined, "bogus"]) for (const signedIn of [false, true]) for (const role of [undefined, "student", "teacher", "admin"]) {
    const r = checkAccess({ tier }, { signedIn, role, config: CONFIGS.allFree });
    assert.deepEqual(r, { allowed: true, reason: "ok" }, `${tier}/${signedIn}/${role}`);
  }
  assert.deepEqual(checkAccess({ tier: "premium" }), { allowed: true, reason: "ok" }, "no ctx at all");
});

await test("requireLogin only: demo open; free/premium need sign-in; signed-in passes", () => {
  const c = CONFIGS.loginOnly;
  assert.equal(checkAccess({ tier: "demo" }, { signedIn: false, config: c }).allowed, true);
  for (const tier of ["free", "premium"]) {
    assert.deepEqual(checkAccess({ tier }, { signedIn: false, config: c }), { allowed: false, reason: "login-required" });
    assert.equal(checkAccess({ tier }, { signedIn: true, config: c }).allowed, true, `${tier} signed in (premium is off, so no entitlement needed)`);
  }
});

await test("premiumEnabled: demo open, free open (login not required), premium needs entitlement", () => {
  const c = CONFIGS.premiumOnly;
  for (const signedIn of [false, true]) {
    assert.equal(checkAccess({ tier: "demo" }, { signedIn, config: c }).allowed, true);
    assert.equal(checkAccess({ tier: "free" }, { signedIn, config: c }).allowed, true);
  }
  assert.deepEqual(checkAccess({ tier: "premium" }, { signedIn: false, config: c }), { allowed: false, reason: "login-required" });
  assert.deepEqual(checkAccess({ tier: "premium" }, { signedIn: true, config: c }), { allowed: false, reason: "premium-required" });
  assert.equal(checkAccess({ tier: "premium" }, { signedIn: true, entitlement: PREMIUM_USER, config: c }).allowed, true);
});

await test("both switches on: full matrix", () => {
  const c = CONFIGS.both;
  const expect = (item, ctx, allowed, reason) => assert.deepEqual(checkAccess(item, { config: c, ...ctx }), { allowed, reason });
  expect({ tier: "demo" }, { signedIn: false }, true, "ok");
  expect({ tier: "free" }, { signedIn: false }, false, "login-required");
  expect({ tier: "free" }, { signedIn: true }, true, "ok");
  expect({ tier: "premium" }, { signedIn: false }, false, "login-required");
  expect({ tier: "premium" }, { signedIn: true }, false, "premium-required");
  expect({ tier: "premium" }, { signedIn: true, entitlement: PREMIUM_USER }, true, "ok");
});

await test("teacher (and admin) role alone never grants Premium", () => {
  for (const role of ["teacher", "admin", "student"]) {
    const r = checkAccess({ tier: "premium" }, { signedIn: true, role, config: CONFIGS.premiumOnly });
    assert.deepEqual(r, { allowed: false, reason: "premium-required" }, role);
  }
  // ... and a "teacher" claim inside the entitlement object is not a plan either
  assert.equal(hasPremiumEntitlement({ plan: "teacher" }), false);
});

await test("entitlements: plans, free, unknown plan, missing, expiry boundaries", () => {
  assert.equal(hasPremiumEntitlement(null), false);
  assert.equal(hasPremiumEntitlement(undefined), false);
  assert.equal(hasPremiumEntitlement({ plan: "free" }), false);
  assert.equal(hasPremiumEntitlement({ plan: "gold" }), false);
  assert.equal(hasPremiumEntitlement({ plan: "premium" }, NOW), true, "no expiry = does not expire");
  assert.equal(hasPremiumEntitlement({ plan: "school", expiresAt: FUTURE }, NOW), true);
  assert.equal(hasPremiumEntitlement({ plan: "premium", expiresAt: PAST }, NOW), false, "expired");
  assert.equal(hasPremiumEntitlement({ plan: "premium", expiresAt: new Date(NOW).toISOString() }, NOW), false, "expires exactly now = expired");
  assert.equal(hasPremiumEntitlement({ plan: "premium", expiresAt: new Date(NOW + 1).toISOString() }, NOW), true);
  assert.equal(checkAccess({ tier: "premium" }, { signedIn: true, entitlement: { plan: "premium", expiresAt: PAST }, config: CONFIGS.premiumOnly }).reason, "premium-required");
});

await test("canAccess mirrors checkAccess", () => {
  assert.equal(canAccess({ tier: "premium" }, { signedIn: true, config: CONFIGS.premiumOnly }), false);
  assert.equal(canAccess({ tier: "premium" }, { signedIn: true, config: CONFIGS.allFree }), true);
});

await test("showPremiumUi / tierBadge: nothing while off; tier badge when on", () => {
  for (const tier of TIER_LIST) assert.equal(tierBadge({ tier }, CONFIGS.allFree), null);
  assert.equal(tierBadge({ tier: "premium" }, CONFIGS.loginOnly), null, "login switch alone shows no Premium chrome");
  assert.equal(tierBadge({ tier: "premium" }, CONFIGS.premiumOnly), "premium");
  assert.equal(tierBadge({ tier: "demo" }, CONFIGS.premiumOnly), "demo");
  assert.equal(tierBadge({ tier: "free" }, CONFIGS.premiumOnly), "free");
  assert.equal(tierBadge({}, CONFIGS.premiumOnly), "free");
  assert.equal(showPremiumUi(null), false);
});

await test("showTierFilters / showLockChip follow showPremiumUi", () => {
  assert.equal(showTierFilters(CONFIGS.allFree), false);
  assert.equal(showTierFilters(CONFIGS.premiumOnly), true);
  const prem = { tier: "premium" };
  assert.equal(showLockChip(prem, { signedIn: true, config: CONFIGS.allFree }), false);
  assert.equal(showLockChip(prem, { signedIn: true, config: CONFIGS.loginOnly }), false);
  assert.equal(showLockChip(prem, { signedIn: true, config: CONFIGS.premiumOnly }), true);
  assert.equal(showLockChip(prem, { signedIn: true, entitlement: PREMIUM_USER, config: CONFIGS.premiumOnly }), false, "entitled users see no lock");
  assert.equal(showLockChip({ tier: "free" }, { signedIn: false, config: CONFIGS.premiumOnly }), false);
});

await test("matchesTierFilter: all / free (includes demo) / premium", () => {
  assert.equal(matchesTierFilter({ tier: "premium" }, "all"), true);
  assert.equal(matchesTierFilter({ tier: "premium" }, "free"), false);
  assert.equal(matchesTierFilter({ tier: "demo" }, "free"), true);
  assert.equal(matchesTierFilter({ tier: "free" }, "premium"), false);
  assert.equal(matchesTierFilter({ tier: "premium" }, "premium"), true);
});

await test("tierLabel / lockedCopy", () => {
  assert.equal(tierLabel("premium"), "Premium"); assert.equal(tierLabel("demo"), "Free demo"); assert.equal(tierLabel("x"), "Free");
  assert.match(lockedCopy("login-required").title, /sign in/i);
  assert.match(lockedCopy("premium-required").title, /Premium/);
  assert.doesNotMatch(JSON.stringify(lockedCopy("premium-required")), /notify/i, "no 'Notify me' box");
});

// ---------------------------------------------------------------- config service (fake clients)
function fakeClient({ views = {}, tables = {}, updates = [], upserts = [] } = {}) {
  const chain = (result) => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => result, single: async () => result, then: (res, rej) => Promise.resolve(result).then(res, rej) };
    return q;
  };
  return {
    from(name) {
      if (views[name] !== undefined || tables[name] !== undefined) {
        const result = views[name] ?? tables[name];
        const q = chain(result);
        q.update = (fields) => { updates.push({ name, fields }); return chain(result.__updated ?? result); };
        q.upsert = async (row, opts) => { upserts.push({ name, row, opts }); return result.__upsert ?? { error: null }; };
        return q;
      }
      return chain({ data: null, error: { message: `relation "${name}" does not exist` } });
    },
  };
}

await test("normaliseAccessConfig: only literal true enables; junk => defaults", () => {
  assert.deepEqual(normaliseAccessConfig(null), CONFIGS.allFree);
  assert.deepEqual(normaliseAccessConfig({}), CONFIGS.allFree);
  assert.deepEqual(normaliseAccessConfig({ premium_enabled: "true", require_login_for_simulations: 1 }), CONFIGS.allFree);
  assert.deepEqual(normaliseAccessConfig({ premium_enabled: true, require_login_for_simulations: false }), CONFIGS.premiumOnly);
  assert.deepEqual(normaliseAccessConfig({ premium_enabled: true, require_login_for_simulations: true }), CONFIGS.both);
});

await test("fetchAccessConfig: no client / missing view / error / throw => safe default, never throws", async () => {
  assert.deepEqual((await fetchAccessConfig(null)).config, CONFIGS.allFree);
  assert.equal((await fetchAccessConfig(null)).source, "default");
  const missing = await fetchAccessConfig(fakeClient());
  assert.deepEqual(missing, { config: CONFIGS.allFree, source: "default" });
  const empty = await fetchAccessConfig(fakeClient({ views: { platform_settings_public: { data: null, error: null } } }));
  assert.equal(empty.source, "default");
  const throwing = await fetchAccessConfig({ from() { throw new Error("boom"); } });
  assert.deepEqual(throwing.config, CONFIGS.allFree);
});

await test("fetchAccessConfig: reads the two flags from the public settings view", async () => {
  const r = await fetchAccessConfig(fakeClient({ views: { platform_settings_public: { data: { premium_enabled: true, require_login_for_simulations: false }, error: null } } }));
  assert.deepEqual(r, { config: CONFIGS.premiumOnly, source: "database" });
});

await test("fetchAdminAccessConfig: reports whether the columns exist", async () => {
  const noCols = await fetchAdminAccessConfig(fakeClient({ tables: { platform_settings: { data: { id: 1, platform_name: "e-Lab" }, error: null } } }));
  assert.equal(noCols.available, false); assert.equal(noCols.reason, "columns-missing"); assert.deepEqual(noCols.config, CONFIGS.allFree);
  const ok = await fetchAdminAccessConfig(fakeClient({ tables: { platform_settings: { data: { id: 1, premium_enabled: false, require_login_for_simulations: true }, error: null } } }));
  assert.equal(ok.available, true); assert.deepEqual(ok.config, CONFIGS.loginOnly);
  assert.equal((await fetchAdminAccessConfig(null)).available, false);
  assert.equal((await fetchAdminAccessConfig(fakeClient())).available, false);
});

await test("saveAccessConfig: maps only the two keys to columns; rejects empty / errors", async () => {
  const updates = [];
  const client = fakeClient({ updates, tables: { platform_settings: { data: { premium_enabled: true, require_login_for_simulations: false }, error: null } } });
  const saved = await saveAccessConfig({ premiumEnabled: true, platform_name: "hack", requireLoginForSimulations: "yes" }, client);
  assert.deepEqual(updates[0].fields, { premium_enabled: true }, "unknown keys and non-booleans are dropped");
  assert.deepEqual(saved, CONFIGS.premiumOnly);
  await assert.rejects(() => saveAccessConfig({}, client), /Nothing to save/);
  await assert.rejects(() => saveAccessConfig({ premiumEnabled: true }, null), /Not connected/);
  await assert.rejects(() => saveAccessConfig({ premiumEnabled: true }, fakeClient({ tables: { platform_settings: { data: null, error: { message: "column does not exist" } } } })));
  assert.deepEqual(Object.keys(CONFIG_COLUMNS).sort(), ["downloadRequiresPremium", "premiumEnabled", "requireLoginForSimulations"]);
});

await test("simulation overrides: missing table => unavailable + empty; rows are validated", async () => {
  assert.deepEqual(await fetchSimulationOverrides(fakeClient()), { overrides: {}, available: false });
  assert.deepEqual(await fetchSimulationOverrides(null), { overrides: {}, available: false });
  const r = await fetchSimulationOverrides(fakeClient({ tables: { simulation_access: { data: [
    { sim_id: "build-an-atom", tier: "premium", featured: false }, { sim_id: "x", tier: "gold", featured: "yes" }, { sim_id: 7, tier: "free" }, null,
  ], error: null } } }));
  assert.equal(r.available, true);
  assert.deepEqual(r.overrides, { "build-an-atom": { tier: "premium", featured: false }, x: {} });
});

await test("saveSimulationOverride: upsert on sim_id with valid fields only", async () => {
  const upserts = [];
  const client = fakeClient({ upserts, tables: { simulation_access: { data: [], error: null } } });
  await saveSimulationOverride("build-an-atom", { tier: "premium", featured: true, junk: 1 }, client);
  assert.deepEqual(upserts[0].row, { sim_id: "build-an-atom", tier: "premium", featured: true });
  assert.deepEqual(upserts[0].opts, { onConflict: "sim_id" });
  await assert.rejects(() => saveSimulationOverride("a", { tier: "gold" }, client), /Nothing to save/);
  await assert.rejects(() => saveSimulationOverride("a", { tier: "free" }, fakeClient({ tables: { simulation_access: { data: [], error: null, __upsert: { error: { message: "denied" } } } } })));
});

await test("applyAccessOverrides: defaults when absent; overrides applied; junk ignored; catalogue not mutated", () => {
  assert.equal(applyAccessOverrides(SIMULATION_CATALOGUE, null), SIMULATION_CATALOGUE);
  assert.equal(applyAccessOverrides(SIMULATION_CATALOGUE, {}).every((e, i) => e.tier === SIMULATION_CATALOGUE[i].tier), true);
  const out = applyAccessOverrides(SIMULATION_CATALOGUE, { "build-an-atom": { tier: "premium", featured: false }, "vsepr-explorer-3d": { tier: "gold" }, nope: { tier: "premium" } });
  const byId = Object.fromEntries(out.map((e) => [e.id, e]));
  assert.equal(byId["build-an-atom"].tier, "premium"); assert.equal(byId["build-an-atom"].featured, false);
  assert.equal(byId["vsepr-explorer-3d"].tier, "free", "invalid tier ignored");
  assert.equal(SIMULATION_CATALOGUE.find((e) => e.id === "build-an-atom").tier, "free", "source catalogue untouched");
  assert.equal(out.length, SIMULATION_CATALOGUE.length);
});


// ---------------------------------------------------------------- per-action capabilities (view / download)
const DL = { premiumEnabled: true, requireLoginForSimulations: false, downloadRequiresPremium: true };
const dl = (item, ctx) => checkAction(item, "download", ctx);

await test("checkAction('view') is exactly checkAccess for every tier x config x user", () => {
  for (const tier of [...TIER_LIST, undefined, "gold"]) for (const config of [...Object.values(CONFIGS), DL]) for (const signedIn of [true, false]) for (const entitlement of [null, PREMIUM_USER]) {
    const ctx = { signedIn, config, entitlement, role: "student" };
    assert.deepEqual(checkAction({ tier }, "view", ctx), checkAccess({ tier }, ctx));
  }
  assert.deepEqual(ACTIONS, { VIEW: "view", DOWNLOAD: "download" }); assert.ok(Object.isFrozen(ACTIONS));
});

await test("download is allowed for everyone while Premium is off or the download switch is off (everything free today)", () => {
  for (const tier of [...TIER_LIST, undefined]) for (const signedIn of [true, false]) for (const role of ["student", "teacher", "admin", undefined]) {
    for (const config of [{ premiumEnabled: false, downloadRequiresPremium: true }, { premiumEnabled: false, downloadRequiresPremium: false }, { premiumEnabled: true, downloadRequiresPremium: false }, undefined, {}]) {
      // a Premium-tier ITEM is still gated by view when Premium is on; the download switch adds nothing to it
      if (tier === "premium" && config?.premiumEnabled === true) continue;
      assert.deepEqual(dl({ tier }, { signedIn, role, config }), { allowed: true, reason: "ok" }, `${tier}/${signedIn}/${role}/${JSON.stringify(config)}`);
    }
  }
  assert.deepEqual(dl({ tier: "premium" }), { allowed: true, reason: "ok" }, "no ctx at all");
  assert.equal(DEFAULT_ACCESS_CONFIG.downloadRequiresPremium, false);
});

await test("download needs Premium ONLY when premiumEnabled AND downloadRequiresPremium; view stays free", () => {
  const free = { tier: "free" };
  assert.deepEqual(dl(free, { signedIn: true, role: "student", config: DL }), { allowed: false, reason: "premium-required" });
  assert.deepEqual(dl(free, { signedIn: false, config: DL }), { allowed: false, reason: "login-required" });
  assert.deepEqual(checkAction(free, "view", { signedIn: true, role: "student", config: DL }), { allowed: true, reason: "ok" }, "view of a free item is not affected");
  assert.deepEqual(dl(free, { signedIn: true, entitlement: PREMIUM_USER, config: DL }), { allowed: true, reason: "ok" });
  assert.deepEqual(dl(free, { signedIn: true, entitlement: { plan: "school", expiresAt: FUTURE }, config: DL }), { allowed: true, reason: "ok" });
  assert.equal(dl(free, { signedIn: true, entitlement: { plan: "premium", expiresAt: PAST }, config: DL }).allowed, false, "expired entitlement does not count");
  assert.equal(dl(free, { signedIn: true, entitlement: { plan: "free" }, config: DL }).allowed, false);
  assert.equal(dl({ tier: "demo" }, { signedIn: true, role: "student", config: DL }).allowed, true, "a demo item stays downloadable");
});

await test("a teacher or admin role never grants download Premium (all combinations)", () => {
  for (const role of ["teacher", "admin", "student"]) for (const tier of ["free", "premium", undefined]) {
    assert.deepEqual(dl({ tier }, { signedIn: true, role, config: DL }), { allowed: false, reason: "premium-required" }, `${role}/${tier}`);
  }
  assert.equal(dl({ tier: "free" }, { signedIn: true, role: "teacher", entitlement: PREMIUM_USER, config: DL }).allowed, true, "only a real entitlement unlocks it");
});

await test("download requires view first: a Premium item the user cannot view is denied with the VIEW reason", () => {
  const prem = { tier: "premium" };
  assert.deepEqual(dl(prem, { signedIn: true, config: CONFIGS.premiumOnly }), { allowed: false, reason: "premium-required" }, "premium on, download switch off: still denied because the item itself is Premium");
  assert.deepEqual(dl(prem, { signedIn: false, config: CONFIGS.premiumOnly }), { allowed: false, reason: "login-required" });
  assert.equal(dl(prem, { signedIn: true, entitlement: PREMIUM_USER, config: CONFIGS.premiumOnly }).allowed, true);
  assert.equal(dl({ tier: "free" }, { signedIn: false, config: CONFIGS.loginOnly }).reason, "login-required");
});

await test("download config must be literal true: junk values do not switch it on; unknown actions fail closed", () => {
  for (const junk of ["true", 1, "yes", null, undefined]) assert.equal(dl({ tier: "free" }, { signedIn: true, config: { premiumEnabled: true, downloadRequiresPremium: junk } }).allowed, true, String(junk));
  assert.equal(dl({ tier: "free" }, { signedIn: true, config: { premiumEnabled: "true", downloadRequiresPremium: true } }).allowed, true, "premiumEnabled must also be literal true");
  assert.deepEqual(checkAction({ tier: "free" }, "print", { signedIn: true }), { allowed: false, reason: "unknown-action" });
  assert.deepEqual(checkAction({ tier: "free" }, undefined, {}), { allowed: false, reason: "unknown-action" });
  assert.equal(canDoAction({ tier: "free" }, "download", { signedIn: true, config: DL }), false);
  assert.equal(canDoAction({ tier: "free" }, "view", { signedIn: true, config: DL }), true);
});

await test("showDownloadLock: never while free; only with Premium + download switch + no entitlement", () => {
  const free = { tier: "free" };
  assert.equal(showDownloadLock(free, { signedIn: true, config: CONFIGS.allFree }), false);
  assert.equal(showDownloadLock(free, { signedIn: true, config: { premiumEnabled: false, downloadRequiresPremium: true } }), false, "switch saved but Premium off -> invisible");
  assert.equal(showDownloadLock(free, { signedIn: true, config: CONFIGS.premiumOnly }), false);
  assert.equal(showDownloadLock(free, { signedIn: true, config: DL }), true);
  assert.equal(showDownloadLock(free, { signedIn: true, entitlement: PREMIUM_USER, config: DL }), false);
  assert.equal(showDownloadLock(free), false);
});

await test("lockedActionCopy: download copy says viewing still works; no 'Notify me'", () => {
  assert.match(lockedActionCopy("download", "premium-required").title, /Download/i);
  assert.match(lockedActionCopy("download", "premium-required").body, /view/i);
  assert.equal(lockedActionCopy("download", "premium-required").cta, null);
  assert.match(lockedActionCopy("download", "login-required").title, /sign in/i);
  assert.equal(lockedActionCopy("download", "login-required").cta, "Log in");
  assert.deepEqual(lockedActionCopy("view", "premium-required"), lockedCopy("premium-required"));
  assert.doesNotMatch(JSON.stringify([lockedActionCopy("download", "premium-required"), lockedActionCopy("download", "login-required")]), /notify/i);
});

await test("config service: download switch normalised, saved, and optional (missing column keeps the other two switches usable)", async () => {
  assert.equal(normaliseAccessConfig({ download_requires_premium: true }).downloadRequiresPremium, true);
  assert.equal(normaliseAccessConfig({ download_requires_premium: "true" }).downloadRequiresPremium, false);
  const updates = [];
  const saved = await saveAccessConfig({ downloadRequiresPremium: true }, fakeClient({ updates, tables: { platform_settings: { data: { download_requires_premium: true }, error: null } } }));
  assert.deepEqual(updates[0].fields, { download_requires_premium: true }); assert.equal(saved.downloadRequiresPremium, true);
  const old = await fetchAdminAccessConfig(fakeClient({ tables: { platform_settings: { data: { id: 1, premium_enabled: true, require_login_for_simulations: false }, error: null } } }));
  assert.equal(old.available, true, "001 only: switches still available"); assert.equal(old.downloadSwitchAvailable, false); assert.equal(old.config.downloadRequiresPremium, false);
  const full = await fetchAdminAccessConfig(fakeClient({ tables: { platform_settings: { data: { id: 1, premium_enabled: true, require_login_for_simulations: false, download_requires_premium: true }, error: null } } }));
  assert.equal(full.downloadSwitchAvailable, true); assert.deepEqual(full.config, DL);
  assert.equal((await fetchAdminAccessConfig(null)).downloadSwitchAvailable, false);
  // public read: first query (with the download column) fails -> retried with the two older columns
  const selects = [];
  const retry = { from: () => ({ select: (cols) => { selects.push(cols); const r = /download/.test(cols) ? { data: null, error: { message: "column does not exist" } } : { data: { premium_enabled: true, require_login_for_simulations: false }, error: null }; return { maybeSingle: async () => r }; } }) };
  const r = await fetchAccessConfig(retry);
  assert.equal(selects.length, 2); assert.deepEqual(r, { config: CONFIGS.premiumOnly, source: "database" });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
