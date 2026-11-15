#!/usr/bin/env node
// Node/jsdom tests for the post-sign-up "Check your email" screen:
//   node scripts/test-auth-signup-confirmation.mjs
// Renders the REAL AuthPage (inside the real AuthProvider/SettingsProvider and a
// MemoryRouter) into jsdom. Only src/lib/supabaseClient.js is replaced (see
// auth-signup-loader-hooks.mjs) by a scriptable stub - there is no live Supabase.
// Honest limits: jsdom has no layout/CSS, so responsive/theme rendering is NOT
// covered here (see scripts/verify-auth-signup-confirmation.mjs, headless
// Chromium), and nothing here proves real email delivery or a real
// confirmation-link redirect.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "sessionStorage", { value: dom.window.sessionStorage, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: dom.window.localStorage, configurable: true });
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

// Controllable clock + interval so the 60 s resend cooldown is tested without waiting.
let clockOffset = 0;
const realNow = Date.now.bind(Date);
Date.now = () => realNow() + clockOffset;
const intervals = new Map();
let intervalId = 0;
globalThis.setInterval = (fn) => { intervals.set(++intervalId, fn); return intervalId; };
globalThis.clearInterval = (id) => { intervals.delete(id); };
const fireTicks = async () => { for (const fn of [...intervals.values()]) fn(); await wait(); };

register("./auth-signup-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { AuthProvider } = await import("../src/context/AuthContext.jsx");
const { SettingsProvider } = await import("../src/context/SettingsContext.jsx");
const { default: AuthPage } = await import("../src/pages/AuthPage.jsx");
const { default: ProfileCard } = await import("../src/components/profile/ProfileCard.jsx");
const CUR = await import("../src/data/curricula.js");
const TP = await import("../src/data/teacherProfile.js");
const F = await import("../src/lib/signupFlow.js");

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const text = (sel) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (el) => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await wait(); };
async function setValue(el, value) {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  await wait(5);
}
const button = (label) => [...document.querySelectorAll("button")].find((b) => b.textContent.replace(/\s+/g, " ").trim().startsWith(label));

// --- scriptable Supabase stub ------------------------------------------------
let calls;
let script;
function installSupabase(initialSession = null) {
  calls = { signUp: [], resend: [], signIn: [], updateUser: [], profileUpdate: [] };
  script = {
    signUp: async () => ({ data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null }, error: null }),
    resend: async () => ({ data: {}, error: null }),
  };
  globalThis.__authTestSupabase = {
    auth: {
      getSession: async () => ({ data: { session: initialSession } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: async (args) => { calls.signUp.push(args); return script.signUp(args); },
      resend: async (args) => { calls.resend.push(args); return script.resend(args); },
      signInWithPassword: async (args) => { calls.signIn.push(args); return { data: {}, error: { message: "n/a" } }; },
      updateUser: async (args) => { calls.updateUser.push(args); return script.updateUser ? script.updateUser(args) : { data: { user: { id: "u1", user_metadata: args.data } }, error: null }; },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: globalThis.__profileRow ?? { id: "u1", role: "student" }, error: null }) }), maybeSingle: async () => ({ data: null, error: null }) }),
      update: (fields) => ({ eq: () => ({ select: () => ({ single: async () => { calls.profileUpdate.push(fields); return { data: { ...(globalThis.__profileRow ?? { id: "u1" }), ...fields }, error: null }; } }) }) }),
    }),
  };
}

let root;
async function mount(entry = "/auth?tab=create-account", session = null) {
  installSupabase(session);
  clockOffset = 0;
  intervals.clear();
  document.getElementById("root").innerHTML = "";
  root = createRoot(document.getElementById("root"));
  root.render(
    React.createElement(MemoryRouter, { initialEntries: [entry] },
      React.createElement(SettingsProvider, null,
        React.createElement(AuthProvider, null,
          React.createElement(Routes, null,
            React.createElement(Route, { path: "/auth", element: React.createElement(AuthPage) }),
            React.createElement(Route, { path: "/student", element: React.createElement("div", { "data-testid": "student-home" }, "STUDENT HOME") }),
            React.createElement(Route, { path: "/teacher", element: React.createElement("div", { "data-testid": "teacher-home" }, "TEACHER HOME") }))))));
  await wait(80);
}
async function mountProfile(role, userMetadata, profileRow) {
  globalThis.__profileRow = { id: "u1", full_name: "Ada Lovelace", school: "", country: "", grade_or_class: "", level: "SL", role, ...profileRow };
  installSupabase({ user: { id: "u1", email: "ada@example.com", user_metadata: userMetadata }, access_token: "t" });
  document.getElementById("root").innerHTML = "";
  root = createRoot(document.getElementById("root"));
  root.render(React.createElement(MemoryRouter, { initialEntries: ["/p"] }, React.createElement(SettingsProvider, null, React.createElement(AuthProvider, null,
    React.createElement(Routes, null, React.createElement(Route, { path: "/p", element: React.createElement(ProfileCard, { role }) }))))));
  await wait(120);
}
async function unmount() { root.unmount(); await wait(); }

async function fillAndSubmit({ email = "ada@example.com", password = "longenough1", confirm = password } = {}) {
  await setValue($("#su-name"), "Ada Lovelace");
  await setValue($("#su-email"), email);
  await setValue($("#su-password"), password);
  await setValue($("#su-confirm"), confirm);
  $("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await wait(60);
}

let passed = 0, failed = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---- pure helpers ----------------------------------------------------------
test("classifySignUp: session -> signed-in", () => {
  assert.equal(F.classifySignUp({ session: { access_token: "x" }, user: { identities: [{}] } }), "signed-in");
});
test("classifySignUp: user without session -> confirm-email", () => {
  assert.equal(F.classifySignUp({ session: null, user: { identities: [{}] } }), "confirm-email");
  assert.equal(F.classifySignUp({ session: null, user: {} }), "confirm-email");
});
test("classifySignUp: empty identities -> already-registered", () => {
  assert.equal(F.classifySignUp({ session: null, user: { identities: [] } }), "already-registered");
});
test("cooldownSecondsLeft counts down and floors at 0", () => {
  assert.equal(F.cooldownSecondsLeft(1000, 1000), 60);
  assert.equal(F.cooldownSecondsLeft(1000, 1000 + 59_001), 1);
  assert.equal(F.cooldownSecondsLeft(1000, 1000 + 60_000), 0);
  assert.equal(F.cooldownSecondsLeft(1000, 1000 + 90_000), 0);
});
test("friendlyResendError separates rate limits from other failures", () => {
  assert.equal(F.friendlyResendError({ status: 429, message: "x" }).rateLimited, true);
  assert.equal(F.friendlyResendError({ message: "For security purposes, you can only request this after 42 seconds." }).rateLimited, true);
  const net = F.friendlyResendError({ message: "Failed to fetch" });
  assert.equal(net.rateLimited, false);
  assert.ok(!/fetch/i.test(net.message), "raw network text is not shown to users");
});
test("redirect URL is origin + /auth?confirmed=1", () => {
  assert.equal(F.confirmationRedirectUrl("https://e-lab.example"), "https://e-lab.example/auth?confirmed=1");
});

// ---- screen: confirmation required -----------------------------------------
test("no session: confirmation screen replaces the form, shows email, copy and focus", async () => {
  await mount();
  await fillAndSubmit({ email: "  ada@example.com " });
  assert.ok($('[data-testid="signup-confirmation"]'), "confirmation screen shown");
  assert.equal($("#su-email"), null, "sign-up form is gone");
  assert.equal(text("h1"), "Check your email");
  assert.equal(text('[data-testid="confirmation-email"]'), "ada@example.com", "trimmed email displayed");
  const body = text('[data-testid="signup-confirmation"]');
  assert.match(body, /We've sent a confirmation email/);
  assert.match(body, /Please confirm your email address, then log in\./);
  assert.match(body, /spam or junk/i);
  assert.ok(document.activeElement === $("h1"), "focus moved to heading"); // (not assert.equal: diffing DOM nodes exhausts memory on failure)
  assert.equal($("h1").getAttribute("tabindex"), "-1");
  assert.ok(button("Back to login"));
  assert.ok(button("Resend confirmation email"));
  assert.equal(calls.signUp.length, 1);
  assert.equal(calls.signUp[0].email, "ada@example.com");
  assert.equal(calls.signUp[0].options.emailRedirectTo, "http://localhost/auth?confirmed=1");
  assert.equal(calls.signUp[0].options.data.full_name, "Ada Lovelace");
  await unmount();
});

test("Back to login: sign-in form with email prefilled, password focused, pending cleared", async () => {
  await mount();
  await fillAndSubmit();
  await click(button("Back to login"));
  assert.equal($('[data-testid="signup-confirmation"]'), null);
  assert.ok($("#signin-email"), "sign-in form shown");
  assert.equal($("#signin-email").value, "ada@example.com");
  assert.ok(document.activeElement === $("#signin-password"), "password field focused");
  assert.equal(sessionStorage.getItem("elab.signup.pending.v1"), null);
  await unmount();
});

test("Start over returns to an empty create-account form", async () => {
  await mount();
  await fillAndSubmit();
  await click(button("Wrong email address"));
  assert.ok($("#su-email"));
  assert.equal($("#su-email").value, "");
  await unmount();
});

test("refresh (remount in the same tab) keeps the confirmation screen", async () => {
  await mount();
  await fillAndSubmit();
  await unmount();
  await mount(); // sessionStorage is tab-scoped and survives, like a reload
  assert.ok($('[data-testid="signup-confirmation"]'));
  assert.equal(text('[data-testid="confirmation-email"]'), "ada@example.com");
  await unmount();
});

test("stale pending state (>1h) is ignored", async () => {
  sessionStorage.setItem("elab.signup.pending.v1", JSON.stringify({ email: "old@example.com", sentAt: Date.now() - 2 * 3600_000 }));
  await mount();
  assert.equal($('[data-testid="signup-confirmation"]'), null);
  assert.ok($("#su-email"));
  await unmount();
});

// ---- resend ----------------------------------------------------------------
test("resend is blocked during the 60 s cooldown and shows the countdown", async () => {
  await mount();
  await fillAndSubmit();
  const b = button("Resend confirmation email");
  assert.equal(b.getAttribute("aria-disabled"), "true");
  assert.match(b.textContent, /\(60s\)|\(59s\)/);
  await click(b);
  assert.equal(calls.resend.length, 0, "no request during cooldown");
  clockOffset = 30_000; await fireTicks();
  assert.match(button("Resend confirmation email").textContent, /\(30s\)|\(29s\)/);
  await unmount();
});

test("resend after the cooldown calls supabase.auth.resend, confirms politely, restarts cooldown", async () => {
  await mount();
  await fillAndSubmit();
  clockOffset = 61_000; await fireTicks();
  const b = button("Resend confirmation email");
  assert.equal(b.getAttribute("aria-disabled"), "false");
  await click(b);
  assert.equal(calls.resend.length, 1);
  assert.equal(calls.resend[0].type, "signup");
  assert.equal(calls.resend[0].email, "ada@example.com");
  assert.equal(calls.resend[0].options.emailRedirectTo, "http://localhost/auth?confirmed=1");
  assert.match(text('[role="status"]'), /Another email is on its way/);
  assert.equal(button("Resend confirmation email").getAttribute("aria-disabled"), "true");
  await click(button("Resend confirmation email"));
  assert.equal(calls.resend.length, 1, "cooldown re-applied");
  await unmount();
});

test("resend network error: friendly alert, no raw text, button usable again", async () => {
  await mount();
  await fillAndSubmit();
  script.resend = async () => ({ data: null, error: { message: "Failed to fetch", status: 0 } });
  clockOffset = 61_000; await fireTicks();
  await click(button("Resend confirmation email"));
  const alert = text('[role="alert"]');
  assert.match(alert, /couldn't send the email/i);
  assert.ok(!/Failed to fetch/.test(alert));
  assert.equal(button("Resend confirmation email").getAttribute("aria-disabled"), "false", "can retry after a non-rate-limit failure");
  assert.ok($('[data-testid="signup-confirmation"]'), "screen stays");
  await unmount();
});

test("resend rate-limit error: asks the user to wait and restarts cooldown", async () => {
  await mount();
  await fillAndSubmit();
  script.resend = async () => ({ data: null, error: { message: "email rate limit exceeded", status: 429, code: "over_email_send_rate_limit" } });
  clockOffset = 61_000; await fireTicks();
  await click(button("Resend confirmation email"));
  assert.match(text('[role="alert"]'), /wait a minute/i);
  assert.equal(button("Resend confirmation email").getAttribute("aria-disabled"), "true");
  await unmount();
});

// ---- other sign-up outcomes -------------------------------------------------
test("session returned (confirmation off): NO confirmation screen, goes to the role home", async () => {
  await mount();
  script.signUp = async () => ({ data: { user: { id: "u1", identities: [{}] }, session: { access_token: "t" } }, error: null });
  await fillAndSubmit();
  assert.equal($('[data-testid="signup-confirmation"]'), null);
  assert.ok($('[data-testid="student-home"]'), "redirected to /student");
  assert.equal(sessionStorage.getItem("elab.signup.pending.v1"), null);
  await unmount();
});

test("already registered (empty identities): same neutral screen, no existence hint, no error", async () => {
  await mount();
  script.signUp = async () => ({ data: { user: { id: "x", identities: [] }, session: null }, error: null });
  await fillAndSubmit({ email: "taken@example.com" });
  assert.ok($('[data-testid="signup-confirmation"]'));
  const body = text('[data-testid="signup-confirmation"]');
  assert.ok(!/already (registered|exists|in use)|taken/i.test(body.replace(/taken@example\.com/g, "")), "does not say the account exists");
  assert.equal($('[role="alert"]'), null);
  await unmount();
});

test("real errors still show their message and no confirmation screen (already registered w/ autoconfirm, weak password, network)", async () => {
  for (const message of ["User already registered", "Password should contain at least one number", "Failed to fetch"]) {
    await mount();
    script.signUp = async () => ({ data: { user: null, session: null }, error: new Error(message) });
    await fillAndSubmit();
    assert.equal($('[data-testid="signup-confirmation"]'), null, message);
    assert.equal(text('[role="alert"]'), message);
    assert.ok($("#su-email"), "form kept so the user can fix it");
    assert.equal($("#su-email").value, "ada@example.com", "typed values kept");
    await unmount();
  }
});

test("client-side validation unchanged (short password, mismatch) - no signUp call", async () => {
  await mount();
  await fillAndSubmit({ password: "short", confirm: "short" });
  assert.equal(text('[role="alert"]'), "Password must be at least 8 characters.");
  assert.equal(calls.signUp.length, 0);
  await unmount();
  await mount();
  await fillAndSubmit({ password: "longenough1", confirm: "different12" });
  assert.equal(text('[role="alert"]'), "Passwords don't match.");
  assert.equal(calls.signUp.length, 0);
  await unmount();
});

// ---- returning from the confirmation link -----------------------------------
test("?confirmed=1 without a session shows the friendly confirmed notice on the login form", async () => {
  await mount("/auth?confirmed=1");
  assert.match(text('[data-testid="signin-notice"]'), /Email confirmed - you can log in now/);
  assert.ok($("#signin-email"));
  await unmount();
});

test("?confirmed=1 with a session (link signed the user in) continues to the dashboard", async () => {
  await mount("/auth?confirmed=1", { user: { id: "u1" }, access_token: "t" });
  await wait(100);
  assert.ok($('[data-testid="student-home"]'));
  await unmount();
});

test("plain /auth shows no confirmed notice", async () => {
  await mount("/auth");
  assert.equal($('[data-testid="signin-notice"]'), null);
  await unmount();
});

// ---- curriculum on the sign-up form ------------------------------------------
const checkedIds = () => [...document.querySelectorAll('[data-testid="curriculum-field"] input:checked')].map((i) => i.dataset.curriculum);
test("student sign-up: ONE curriculum (radio group), IB Diploma preselected, required wording and planned content stated", async () => {
  await mount("/auth?tab=create-account");
  const field = $('[data-testid="curriculum-field"]');
  assert.ok(field && field.dataset.role === "student");
  const inputs = [...field.querySelectorAll("input[type=radio]")];
  assert.deepEqual(inputs.map((i) => i.dataset.curriculum), CUR.PLATFORM_CURRICULA.map((c) => c.id), "one radio per configured curriculum");
  assert.equal(field.querySelectorAll("input[type=checkbox]").length, 0);
  assert.deepEqual(checkedIds(), ["ib-dp"]);
  assert.match(text('[data-testid="curriculum-help"]'), /Required\. IB Diploma \(DP\) is preselected so nobody is blocked/);
  assert.match(text('[data-testid="curriculum-field"]'), /Content planned/);
  await click($('input[data-curriculum="cambridge-igcse"]'));
  assert.deepEqual(checkedIds(), ["cambridge-igcse"], "radio: choosing another replaces the choice");
  await unmount();
});
test("student sign-up submits curriculum metadata (default IB DP keeps the legacy profile text)", async () => {
  await mount("/auth?tab=create-account");
  await fillAndSubmit();
  const d = calls.signUp[0].options.data;
  assert.deepEqual(d.curricula, ["ib-dp"]);
  assert.equal(d.curriculum, "IB Diploma Programme", "same string the profiles trigger stored before");
  assert.equal(d.role, "student"); assert.equal("curriculum_other" in d, false);
  assert.ok($('[data-testid="signup-confirmation"]'), "confirmation flow unchanged");
  await unmount();
});
test("student picks Cambridge IGCSE: metadata carries the id and the readable text", async () => {
  await mount("/auth?tab=create-account");
  await click($('input[data-curriculum="cambridge-igcse"]'));
  await fillAndSubmit();
  assert.deepEqual(calls.signUp[0].options.data.curricula, ["cambridge-igcse"]);
  assert.equal(calls.signUp[0].options.data.curriculum, "Cambridge IGCSE");
  await unmount();
});
test("teacher sign-up: one OR MORE (checkboxes), IB DP preselected, last box cannot be unticked, role redirect unchanged", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  const field = $('[data-testid="curriculum-field"]');
  assert.equal(field.dataset.role, "teacher");
  assert.equal(field.querySelectorAll("input[type=radio]").length, 0);
  assert.deepEqual(checkedIds(), ["ib-dp"]);
  await click($('input[data-curriculum="ib-dp"]'));
  assert.deepEqual(checkedIds(), ["ib-dp"], "cannot end up with nothing selected");
  await click($('input[data-curriculum="cambridge-igcse"]'));
  await click($('input[data-curriculum="cambridge-as-a-level"]'));
  assert.deepEqual(checkedIds(), ["ib-dp", "cambridge-igcse", "cambridge-as-a-level"]);
  script.signUp = async () => ({ data: { user: { id: "u1", identities: [{}] }, session: { access_token: "t" } }, error: null });
  await setValue($("#su-school"), "Greenfield School");
  await setValue($("#su-prof-field"), "chemistry-teacher");
  await fillAndSubmit();
  const d = calls.signUp[0].options.data;
  assert.deepEqual(d.curricula, ["ib-dp", "cambridge-igcse", "cambridge-as-a-level"]);
  assert.equal(d.curriculum, "IB Diploma Programme, Cambridge IGCSE, Cambridge AS & A Level");
  assert.equal(d.role, "teacher");
  assert.ok($('[data-testid="teacher-home"]'), "teacher lands on /teacher");
  assert.equal(d.school, "Greenfield School"); assert.equal(d.professional_field, "chemistry-teacher");
  await unmount();
});
test("'Other' shows an optional free-text name; it is trimmed into curriculum_other; blank is allowed", async () => {
  await mount("/auth?tab=create-account");
  assert.equal($("#su-curriculum-other-name"), null);
  await click($('input[data-curriculum="other"]'));
  assert.ok($("#su-curriculum-other-name"));
  await fillAndSubmit();
  assert.deepEqual(calls.signUp[0].options.data.curricula, ["other"]);
  assert.equal("curriculum_other" in calls.signUp[0].options.data, false, "blank name is simply omitted");
  await unmount();
  sessionStorage.clear(); // the first submit left the "check your email" screen pending
  await mount("/auth?tab=create-account");
  await click($('input[data-curriculum="other"]'));
  await setValue($("#su-curriculum-other-name"), "  Swiss   Matura ");
  await fillAndSubmit();
  assert.equal(calls.signUp[0].options.data.curriculum_other, "Swiss Matura");
  assert.equal(calls.signUp[0].options.data.curriculum, "Other (Swiss Matura)");
  await unmount();
});
test("switching role on the page after choosing several still submits ONE curriculum for a student", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  await click($('input[data-curriculum="cambridge-igcse"]'));
  assert.deepEqual(checkedIds(), ["ib-dp", "cambridge-igcse"]);
  await click(button("Signing up as a student instead?"));
  assert.equal($('[data-testid="curriculum-field"]').dataset.role, "student");
  assert.deepEqual(checkedIds(), ["ib-dp"], "radio group shows a single choice");
  await fillAndSubmit();
  assert.deepEqual(calls.signUp[0].options.data.curricula, ["ib-dp"]);
  await unmount();
});
test("curricula helpers: metadata/readback round-trip, ids validated", () => {
  const m = CUR.buildCurriculumMetadata("teacher", ["cambridge-igcse", "bogus", "ib-dp", "other"], " AP ");
  assert.deepEqual(m.curricula, ["ib-dp", "cambridge-igcse", "other"], "config order, unknown dropped");
  assert.equal(m.curriculum, "IB Diploma Programme, Cambridge IGCSE, Other (AP)");
  assert.deepEqual(CUR.readCurricula({ userMetadata: m }), { ids: ["ib-dp", "cambridge-igcse", "other"], other: "AP", legacyText: "" });
  assert.deepEqual(CUR.readCurricula({ profileCurriculum: m.curriculum }), { ids: ["ib-dp", "cambridge-igcse", "other"], other: "AP", legacyText: "" }, "text fallback parses the same string");
  assert.deepEqual(CUR.buildCurriculumMetadata("student", [], "").curricula, ["ib-dp"], "never empty");
});

// ---- curriculum on the profile pages ----------------------------------------
const chipTexts = () => [...document.querySelectorAll('[data-testid="curriculum-chips"] li')].map((l) => l.textContent.replace(/\s+/g, " ").replace(" (content planned)", "").trim());
test("profile (student): chips come from user_metadata.curricula", async () => {
  await mountProfile("student", { curricula: ["cambridge-igcse"] }, { curriculum: "Cambridge IGCSE" });
  assert.deepEqual(chipTexts(), ["IGCSE"]);
  await unmount();
});
test("profile (teacher): several chips, and 'Other' shows its name", async () => {
  await mountProfile("teacher", { curricula: ["ib-dp", "other"], curriculum_other: "AP" }, { curriculum: "IB Diploma Programme, Other (AP)" });
  assert.deepEqual(chipTexts(), ["IB DP", "Other (AP)"]);
  await unmount();
});
test("profile of an older account (no metadata) falls back to the profiles.curriculum text", async () => {
  await mountProfile("student", {}, { curriculum: "IB Diploma Programme" });
  assert.deepEqual(chipTexts(), ["IB DP"]);
  await unmount();
  await mountProfile("student", {}, { curriculum: "Some Old Free Text" });
  assert.deepEqual(chipTexts(), ["Some Old Free Text"], "unrecognised legacy text is shown, not hidden");
  await unmount();
});
test("profile edit: curricula are editable and saved to user_metadata AND profiles.curriculum", async () => {
  await mountProfile("teacher", { curricula: ["ib-dp"], professional_field: "chemistry-teacher" }, { curriculum: "IB Diploma Programme", school: "Greenfield School" });
  await click(button("Edit Profile"));
  assert.deepEqual(checkedIds(), ["ib-dp"]);
  await click($('input[data-curriculum="cambridge-igcse"]'));
  $("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await wait(80);
  assert.deepEqual(calls.updateUser[0].data, { curricula: ["ib-dp", "cambridge-igcse"], curriculum_other: "" });
  assert.equal(calls.profileUpdate[0].curriculum, "IB Diploma Programme, Cambridge IGCSE");
  await wait(60);
  assert.deepEqual(chipTexts(), ["IB DP", "IGCSE"], "view updates after saving");
  await unmount();
});
test("profile edit (student): single choice; saving without touching curriculum on an old account backfills metadata with IB DP", async () => {
  await mountProfile("student", {}, { curriculum: "IB Diploma Programme" });
  await click(button("Edit Profile"));
  assert.equal(document.querySelectorAll("[data-testid=curriculum-field] input[type=radio]").length, 4);
  $("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await wait(80);
  assert.deepEqual(calls.updateUser[0].data.curricula, ["ib-dp"]);
  assert.equal(calls.profileUpdate[0].curriculum, "IB Diploma Programme");
  await unmount();
});

// ---- teacher-only sign-up fields: school name + professional field ----------------------------------------------
const submit = async () => { $("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await wait(80); };
const fillBasics = async () => {
  await setValue($("#su-name"), "Ada Lovelace"); await setValue($("#su-email"), "ada@example.com");
  await setValue($("#su-password"), "longenough1"); await setValue($("#su-confirm"), "longenough1");
};
const errText = (id) => text(`[data-testid="${id}"]`);
test("teacher config: unique stable ids, labels, 'other' last, validation and metadata helpers", () => {
  const ids = TP.PROFESSIONAL_FIELDS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length); assert.equal(ids.at(-1), "other");
  for (const f of TP.PROFESSIONAL_FIELDS) { assert.match(f.id, /^[a-z0-9]+(-[a-z0-9]+)*$/); assert.ok(f.label.trim()); }
  assert.deepEqual(TP.validateTeacherProfile({ school: "  ", professionalField: "" }), { school: TP.MESSAGES.schoolRequired, professionalField: TP.MESSAGES.fieldRequired });
  assert.equal(TP.validateTeacherProfile({ school: "A", professionalField: "tutor" }).school, TP.MESSAGES.schoolTooShort);
  assert.equal(TP.validateTeacherProfile({ school: "x".repeat(TP.SCHOOL_NAME_MAX + 1), professionalField: "tutor" }).school, TP.MESSAGES.schoolTooLong);
  assert.deepEqual(TP.validateTeacherProfile({ school: "St Mary's", professionalField: "tutor" }), {});
  assert.equal(TP.validateTeacherProfile({ school: "St Mary's", professionalField: "not-in-list" }).professionalField, TP.MESSAGES.fieldRequired, "unknown id rejected");
  assert.deepEqual(TP.buildTeacherProfileMetadata({ school: "  Green   School ", professionalField: "tutor", other: "ignored" }), { school: "Green School", professional_field: "tutor" }, "other text only kept with 'other'");
  assert.deepEqual(TP.buildTeacherProfileMetadata({ school: "S1", professionalField: "other", other: "  Exam   marker " }), { school: "S1", professional_field: "other", professional_field_other: "Exam marker" });
  assert.equal(TP.professionalFieldDisplay("other", "Examiner"), "Other (Examiner)");
  assert.equal(TP.professionalFieldDisplay("removed-id"), "removed-id", "id dropped from the list still displays");
  const r = TP.readTeacherProfile({ userMetadata: { school: "Meta School", professional_field: "tutor" }, profileSchool: "" });
  assert.equal(r.school, "Meta School", "school falls back to user_metadata"); assert.equal(r.display, "Tutor / private educator");
  assert.equal(TP.readTeacherProfile({ userMetadata: {}, profileSchool: "Row School" }).school, "Row School");
  assert.equal(TP.readTeacherProfile({}).display, "");
});
test("teacher sign-up form: required, accessible school + professional field; student form unchanged", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  const sch = $("#su-school"), sel = $("#su-prof-field");
  assert.ok(sch && sel && sel.tagName === "SELECT");
  assert.equal(sch.getAttribute("aria-required"), "true"); assert.equal(sel.getAttribute("aria-required"), "true");
  assert.equal(sch.maxLength, TP.SCHOOL_NAME_MAX);
  assert.match(document.querySelector('label[for="su-school"]').textContent, /School name.*\(required\)/);
  assert.match(document.querySelector('label[for="su-prof-field"]').textContent, /Professional field.*\(required\)/);
  assert.deepEqual([...sel.options].map((o) => o.value), ["", ...TP.PROFESSIONAL_FIELDS.map((f) => f.id)]);
  assert.equal($("#su-prof-other"), null, "free text hidden until Other");
  await unmount();
  await mount("/auth?tab=create-account");
  assert.equal($("#su-prof-field"), null, "student: no professional field");
  assert.equal($("#su-school").getAttribute("aria-required"), null, "student school stays optional");
  assert.equal(text('label[for="su-school"]'), "School");
  await unmount();
});
test("teacher: empty submit blocks sign-up with inline messages, aria wiring and focus on the first bad field", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  await fillBasics(); await submit();
  assert.equal(calls.signUp.length, 0);
  assert.equal(errText("su-school-error"), TP.MESSAGES.schoolRequired);
  assert.equal(errText("su-prof-field-error"), TP.MESSAGES.fieldRequired);
  assert.equal($("#su-school").getAttribute("aria-invalid"), "true"); assert.equal($("#su-school").getAttribute("aria-describedby"), "su-school-error");
  assert.equal($("#su-prof-field").getAttribute("aria-describedby"), "su-prof-field-error");
  assert.ok(document.activeElement === $("#su-school"), "focus on first invalid field");
  assert.equal($('[data-testid="signup-confirmation"]'), null);
  await setValue($("#su-school"), "Greenfield School");
  assert.equal($("#su-school-error"), null, "error clears as the user fixes it"); assert.ok($("#su-prof-field-error"));
  await submit();
  assert.equal(calls.signUp.length, 0); assert.ok(document.activeElement === $("#su-prof-field"), "focus moves to the dropdown");
  await setValue($("#su-prof-field"), "science-teacher"); await submit();
  assert.equal(calls.signUp.length, 1, "valid -> signs up"); assert.ok($('[data-testid="signup-confirmation"]'), "Check your email flow intact");
  await unmount();
});
test("teacher: whitespace-only or one-character school is rejected", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  await fillBasics(); await setValue($("#su-prof-field"), "tutor");
  await setValue($("#su-school"), "     "); await submit();
  assert.equal(errText("su-school-error"), TP.MESSAGES.schoolRequired);
  await setValue($("#su-school"), " A "); await submit();
  assert.equal(errText("su-school-error"), TP.MESSAGES.schoolTooShort);
  assert.equal(calls.signUp.length, 0);
  await unmount();
});
test("teacher payload: trimmed school, professional_field id, existing keys kept (role, curricula, country, class)", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  await setValue($("#su-school"), "   Greenfield   International School "); await setValue($("#su-prof-field"), "ib-dp-coordinator");
  await setValue($("#su-country"), ""); await fillAndSubmit();
  const d = calls.signUp[0].options.data;
  assert.equal(d.school, "Greenfield International School"); assert.equal(d.professional_field, "ib-dp-coordinator");
  assert.equal("professional_field_other" in d, false);
  assert.equal(d.role, "teacher"); assert.deepEqual(d.curricula, ["ib-dp"]); assert.equal(d.curriculum, "IB Diploma Programme");
  assert.deepEqual(Object.keys(d).filter((k) => /premium|plan|tier|admin|entitle/i.test(k)), [], "no access-related keys");
  await unmount();
});
test("teacher 'Other' professional field: optional trimmed free text, blank allowed, hidden again when another option is chosen", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  await setValue($("#su-school"), "Greenfield School"); await setValue($("#su-prof-field"), "other");
  assert.ok($("#su-prof-other")); assert.equal($("#su-prof-other").maxLength, TP.PROFESSIONAL_OTHER_MAX);
  await setValue($("#su-prof-other"), "  Exam   marker "); await fillAndSubmit();
  assert.equal(calls.signUp[0].options.data.professional_field, "other"); assert.equal(calls.signUp[0].options.data.professional_field_other, "Exam marker");
  await unmount(); sessionStorage.clear();
  await mount("/auth?tab=create-account&role=teacher");
  await setValue($("#su-school"), "Greenfield School"); await setValue($("#su-prof-field"), "other"); await fillAndSubmit();
  assert.equal(calls.signUp.length, 1, "blank Other text is accepted"); assert.equal("professional_field_other" in calls.signUp[0].options.data, false);
  await unmount(); sessionStorage.clear();
  await mount("/auth?tab=create-account&role=teacher");
  await setValue($("#su-school"), "Greenfield School"); await setValue($("#su-prof-field"), "other"); await setValue($("#su-prof-other"), "Examiner");
  await setValue($("#su-prof-field"), "tutor"); assert.equal($("#su-prof-other"), null); await fillAndSubmit();
  assert.equal("professional_field_other" in calls.signUp[0].options.data, false, "stale Other text is not sent");
  await unmount();
});
test("student payload has NO teacher-only keys; student sign-up works with a blank school", async () => {
  await mount("/auth?tab=create-account"); await fillAndSubmit();
  const d = calls.signUp[0].options.data;
  assert.equal(d.role, "student"); assert.equal(d.school, ""); assert.equal("professional_field" in d, false); assert.equal("professional_field_other" in d, false);
  await unmount();
});
test("teacher validation runs first; a switch to student clears teacher errors and needs neither field", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  await fillBasics(); await submit(); assert.ok($("#su-school-error"));
  await click(button("Signing up as a student instead?"));
  assert.equal($("#su-school-error"), null); assert.equal($("#su-prof-field"), null);
  await submit(); assert.equal(calls.signUp.length, 1); assert.equal(calls.signUp[0].options.data.role, "student");
  await unmount();
});
test("password rules still apply to teachers once the fields are valid", async () => {
  await mount("/auth?tab=create-account&role=teacher");
  await setValue($("#su-school"), "Greenfield School"); await setValue($("#su-prof-field"), "tutor");
  await fillAndSubmit({ password: "short", confirm: "short" });
  assert.equal(text('[role="alert"]'), "Password must be at least 8 characters."); assert.equal(calls.signUp.length, 0);
  await unmount();
});

// ---- teacher profile page: both fields shown + editable ----------------------------------------------------------
const rowValue = (label) => { const dt = [...document.querySelectorAll("dt")].find((d) => d.textContent === label); return dt ? dt.nextElementSibling.textContent.replace(/\s+/g, " ").trim() : null; };
test("teacher profile shows School and Professional field (from user_metadata); student profile does not show the new row", async () => {
  await mountProfile("teacher", { curricula: ["ib-dp"], professional_field: "ib-dp-coordinator" }, { school: "Greenfield School", curriculum: "IB Diploma Programme" });
  assert.equal(rowValue("School"), "Greenfield School"); assert.equal(rowValue("Professional field"), "IB DP Coordinator");
  await unmount();
  await mountProfile("teacher", { professional_field: "other", professional_field_other: "Examiner" }, { school: "Greenfield School" });
  assert.equal(rowValue("Professional field"), "Other (Examiner)");
  await unmount();
  await mountProfile("teacher", {}, { school: "" , curriculum: "IB Diploma Programme" });
  assert.equal(rowValue("Professional field"), "Not provided yet", "older teacher accounts degrade gracefully");
  assert.equal(rowValue("School"), "—");
  await unmount();
  await mountProfile("teacher", { school: "Meta School" }, { school: "" });
  assert.equal(rowValue("School"), "Meta School", "school falls back to user_metadata");
  await unmount();
  await mountProfile("student", { professional_field: "tutor" }, { school: "Kid School" });
  assert.equal(rowValue("Professional field"), null); assert.equal(rowValue("School"), "Kid School");
  await click(button("Edit Profile")); assert.equal($("#pc-prof-field"), null); assert.equal($("#pc-school").getAttribute("aria-required"), null);
  await unmount();
});
test("teacher profile edit: both fields editable, saved to user_metadata (+ school to profiles.school), view updates", async () => {
  await mountProfile("teacher", { curricula: ["ib-dp"], professional_field: "tutor" }, { school: "Old School", curriculum: "IB Diploma Programme" });
  await click(button("Edit Profile"));
  assert.equal($("#pc-school").value, "Old School"); assert.equal($("#pc-prof-field").value, "tutor");
  await setValue($("#pc-school"), "  New   School "); await setValue($("#pc-prof-field"), "other"); await setValue($("#pc-prof-other"), "Examiner");
  await submit();
  assert.deepEqual(calls.updateUser[0].data, { professional_field: "other", professional_field_other: "Examiner" }, "only changed keys, curricula untouched");
  assert.equal(calls.profileUpdate[0].school, "New School");
  await wait(60);
  assert.equal(rowValue("School"), "New School"); assert.equal(rowValue("Professional field"), "Other (Examiner)");
  await unmount();
});
test("teacher profile edit: unchanged fields cause no metadata write; clearing a required field is blocked with messages", async () => {
  await mountProfile("teacher", { curricula: ["ib-dp"], professional_field: "tutor" }, { school: "Old School", curriculum: "IB Diploma Programme" });
  await click(button("Edit Profile")); await submit();
  assert.equal(calls.updateUser.length, 0); assert.equal(calls.profileUpdate.length, 1);
  await unmount();
  await mountProfile("teacher", {}, { school: "", curriculum: "IB Diploma Programme" });
  await click(button("Edit Profile")); await submit();
  assert.equal(calls.profileUpdate.length, 0, "blocked");
  assert.equal(errText("pc-school-error"), TP.MESSAGES.schoolRequired); assert.equal(errText("pc-prof-field-error"), TP.MESSAGES.fieldRequired);
  assert.ok(document.activeElement === $("#pc-school"));
  await unmount();
});
test("teacher stored professional_field no longer in the list: shown as plain text, must be re-chosen on edit", async () => {
  await mountProfile("teacher", { curricula: ["ib-dp"], professional_field: "retired-option" }, { school: "S School" });
  assert.equal(rowValue("Professional field"), "retired-option");
  await click(button("Edit Profile")); assert.equal($("#pc-prof-field").value, "");
  await unmount();
});

for (const { name, fn } of tests) {
  sessionStorage.clear();
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; try { root?.unmount(); } catch { /* ignore */ } }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
