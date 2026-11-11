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
  calls = { signUp: [], resend: [], signIn: [] };
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
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "u1", role: "student" }, error: null }) }), maybeSingle: async () => ({ data: null, error: null }) }) }),
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

for (const { name, fn } of tests) {
  sessionStorage.clear();
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; try { root?.unmount(); } catch { /* ignore */ } }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
