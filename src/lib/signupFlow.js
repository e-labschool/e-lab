// Pure helpers for the post-sign-up "check your email" flow. Kept free of
// React / Supabase imports so scripts/test-auth-signup-confirmation.mjs can
// exercise them directly.

/** Supabase email rate limit for confirmation/resend mails is 60 s per user. */
export const RESEND_COOLDOWN_MS = 60_000;

/** Where the confirmation link sends the user back to (must be in the
 * Supabase Auth "Redirect URLs" allow-list; if it is not, Supabase falls back
 * to the project's Site URL, which is exactly today's behaviour). */
export const CONFIRMED_PATH = "/auth?confirmed=1";

export function confirmationRedirectUrl(origin) {
  return `${origin}${CONFIRMED_PATH}`;
}

/**
 * Classify the `data` returned by supabase.auth.signUp():
 *  - "signed-in":          a session exists (email confirmation is OFF)
 *  - "already-registered": Supabase's obfuscated response for an existing
 *                          confirmed email (user.identities === [] and no session)
 *  - "confirm-email":      new user, no session yet (confirmation is ON)
 * The last two deliberately lead to the SAME screen (see docs).
 */
export function classifySignUp(data) {
  if (data?.session) return "signed-in";
  const identities = data?.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) return "already-registered";
  return "confirm-email";
}

/** Whole seconds left on the resend cooldown (0 when it may be used). */
export function cooldownSecondsLeft(sentAt, now = Date.now(), cooldownMs = RESEND_COOLDOWN_MS) {
  return Math.max(0, Math.ceil((sentAt + cooldownMs - now) / 1000));
}

/** Turns a Supabase resend error into a short, polite message. */
export function friendlyResendError(err) {
  const msg = String(err?.message || "");
  const rateLimited =
    err?.status === 429 || err?.code === "over_email_send_rate_limit" || /rate limit|after \d+ seconds|too many/i.test(msg);
  if (rateLimited) return { rateLimited: true, message: "Please wait a minute before requesting another email." };
  return { rateLimited: false, message: "We couldn't send the email just now. Please check your connection and try again." };
}

// --- tab-scoped persistence so a refresh keeps the confirmation screen -----
const KEY = "elab.signup.pending.v1";
const MAX_AGE_MS = 60 * 60 * 1000;

export function savePending(pending, storage = safeStorage()) {
  try { storage?.setItem(KEY, JSON.stringify(pending)); } catch { /* storage unavailable: screen just won't survive a refresh */ }
}
export function loadPending(storage = safeStorage(), now = Date.now()) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p.email !== "string" || typeof p.sentAt !== "number" || now - p.sentAt > MAX_AGE_MS) return null;
    return p;
  } catch { return null; }
}
export function clearPending(storage = safeStorage()) {
  try { storage?.removeItem(KEY); } catch { /* ignore */ }
}
function safeStorage() {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}
