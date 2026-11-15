// Single, central access policy for e-Lab content (simulations, lessons,
// resources, folders).  EVERYTHING IS FREE FOR NOW: while `premiumEnabled`
// is false, canAccess() returns true for every item and no UI shows locks,
// Premium badges, plan cards or upgrade prompts.
//
// Later, Premium is switched on by changing the site config (an admin
// setting) and each item's `tier` -- not by editing components.  Every
// component that needs to decide "may this user open this?" or "should I
// show a lock?" must call these functions instead of comparing tiers itself.
//
// IMPORTANT: this file is UI/behaviour policy only.  It is NOT security.
// Real enforcement for protected content must live in the database (RLS,
// entitlement functions) -- see docs/security-plan/.  Never decide payment
// or entitlement from frontend variables or editable user metadata.

export const TIERS = Object.freeze({ DEMO: "demo", FREE: "free", PREMIUM: "premium" });
export const TIER_LIST = Object.freeze([TIERS.DEMO, TIERS.FREE, TIERS.PREMIUM]);

/** Default site access configuration.  Replaced at runtime by the admin
 *  setting (see accessConfigService) once that table exists. */
export const DEFAULT_ACCESS_CONFIG = Object.freeze({
  premiumEnabled: false,          // master switch -- everything free while false
  requireLoginForSimulations: false, // when true, non-demo simulations need a signed-in user
  downloadRequiresPremium: false, // when true AND premiumEnabled, DOWNLOADING resource files needs Premium (viewing stays free)
});

export function normaliseTier(tier) {
  return TIER_LIST.includes(tier) ? tier : TIERS.FREE;
}

/** Is this user entitled to Premium content?  `entitlement` comes from the
 *  server (plan + expiry), never from client-editable data. */
export function hasPremiumEntitlement(entitlement, now = Date.now()) {
  if (!entitlement || entitlement.plan === "free") return false;
  if (!["premium", "school"].includes(entitlement.plan)) return false;
  if (entitlement.expiresAt && new Date(entitlement.expiresAt).getTime() <= now) return false;
  return true;
}

/**
 * @param item   { tier?: 'demo'|'free'|'premium' }
 * @param ctx    { signedIn: boolean, role?: string, entitlement?: {plan, expiresAt}, config?: access config }
 * @returns { allowed: boolean, reason: 'ok'|'login-required'|'premium-required' }
 */
export function checkAccess(item, ctx = {}) {
  const config = { ...DEFAULT_ACCESS_CONFIG, ...(ctx.config || {}) };
  const tier = normaliseTier(item?.tier);
  if (!config.premiumEnabled && !config.requireLoginForSimulations) return { allowed: true, reason: "ok" };
  if (tier === TIERS.DEMO) return { allowed: true, reason: "ok" };
  if (config.requireLoginForSimulations && !ctx.signedIn) return { allowed: false, reason: "login-required" };
  if (!config.premiumEnabled || tier === TIERS.FREE) return { allowed: true, reason: "ok" };
  // Premium content: a teacher role alone never grants Premium.
  if (hasPremiumEntitlement(ctx.entitlement)) return { allowed: true, reason: "ok" };
  return { allowed: false, reason: ctx.signedIn ? "premium-required" : "login-required" };
}

export const canAccess = (item, ctx) => checkAccess(item, ctx).allowed;

// ---------------------------------------------------------------------------
// Per-action capabilities.  VIEW (open in the browser) and DOWNLOAD (save a copy) are decided separately so that
// Premium can later cover downloads only.  UI policy, not security: a file that can be viewed in a browser can be
// saved from it (see docs/RESOURCE_VIEW_DOWNLOAD.md).
// ---------------------------------------------------------------------------

export const ACTIONS = Object.freeze({ VIEW: "view", DOWNLOAD: "download" });

/**
 * @param item    { tier?: 'demo'|'free'|'premium' }
 * @param action  'view' | 'download'
 * @param ctx     same as checkAccess (signedIn, role, entitlement, config)
 * @returns { allowed: boolean, reason: 'ok'|'login-required'|'premium-required'|'unknown-action' }
 *
 *  view     -> exactly checkAccess(): unchanged behaviour.
 *  download -> requires view first.  Then, ONLY when premiumEnabled AND downloadRequiresPremium are both true, a
 *              non-demo item needs a Premium entitlement (a teacher/admin role never grants it).  In every other
 *              configuration download is allowed for everyone who may view -- i.e. everything today.
 *  other    -> denied (fail closed).
 */
export function checkAction(item, action, ctx = {}) {
  if (action === ACTIONS.VIEW) return checkAccess(item, ctx);
  if (action !== ACTIONS.DOWNLOAD) return { allowed: false, reason: "unknown-action" };
  const viewable = checkAccess(item, ctx);
  if (!viewable.allowed) return viewable;
  const config = { ...DEFAULT_ACCESS_CONFIG, ...(ctx.config || {}) };
  if (config.premiumEnabled !== true || config.downloadRequiresPremium !== true) return { allowed: true, reason: "ok" };
  if (normaliseTier(item?.tier) === TIERS.DEMO) return { allowed: true, reason: "ok" };
  if (hasPremiumEntitlement(ctx.entitlement)) return { allowed: true, reason: "ok" };
  return { allowed: false, reason: ctx.signedIn ? "premium-required" : "login-required" };
}

export const canDoAction = (item, action, ctx) => checkAction(item, action, ctx).allowed;

/** Should a lock be drawn on the Download control?  Only while Premium is on and the user would be refused. */
export function showDownloadLock(item, ctx = {}) {
  if (!showPremiumUi(ctx.config)) return false;
  return !checkAction(item, ACTIONS.DOWNLOAD, ctx).allowed;
}

/** Copy for the "download is locked" prompt (the file can still be viewed). */
export function lockedActionCopy(action, reason) {
  if (action === ACTIONS.DOWNLOAD) {
    return reason === "login-required"
      ? { title: "Sign in to download this file", body: "Create a free account or log in to download. You can still view it in your browser.", cta: "Log in" }
      : { title: "Downloads are a Premium feature", body: "You can still view this file in your browser with the eye button. Premium lets you download a copy.", cta: null };
  }
  return lockedCopy(reason);
}

/** Should the UI show Premium-related chrome (lock icons, Premium badges,
 *  plan cards, upgrade prompts, "Plans" nav link)?  False while everything is free. */
export function showPremiumUi(config = DEFAULT_ACCESS_CONFIG) {
  return Boolean(config?.premiumEnabled);
}

/** A tier badge to display for an item, or null when none should show. */
export function tierBadge(item, config = DEFAULT_ACCESS_CONFIG) {
  if (!showPremiumUi(config)) return null;
  const tier = normaliseTier(item?.tier);
  return tier === TIERS.PREMIUM ? "premium" : tier === TIERS.DEMO ? "demo" : "free";
}

// ---------------------------------------------------------------------------
// Presentation helpers.  Components call these instead of comparing tiers or
// reading config flags themselves, so "Premium chrome" can only ever appear
// when the master switch is on.  Still UI policy, not security.
// ---------------------------------------------------------------------------

const TIER_LABELS = Object.freeze({ demo: "Free demo", free: "Free", premium: "Premium" });

/** Human label for a tier badge value returned by tierBadge(). */
export const tierLabel = (tier) => TIER_LABELS[normaliseTier(tier)];

/** Should the Free / Premium filter chips (and any tier legend) be shown? */
export const showTierFilters = (config = DEFAULT_ACCESS_CONFIG) => showPremiumUi(config);

/** Should this item show a lock chip for this user?  Only while Premium is on
 *  and the user would not be allowed in -- never while everything is free. */
export function showLockChip(item, ctx = {}) {
  if (!showPremiumUi(ctx.config)) return false;
  return !checkAccess(item, ctx).allowed;
}

/** Does this tier pass a Free / Premium library filter ('all' | 'free' | 'premium')?  'free' includes demo. */
export function matchesTierFilter(item, filter = "all") {
  if (filter === "all") return true;
  const tier = normaliseTier(item?.tier);
  return filter === "premium" ? tier === TIERS.PREMIUM : tier !== TIERS.PREMIUM;
}

/** Copy for the locked-content screen, by denial reason. */
export function lockedCopy(reason) {
  if (reason === "login-required") {
    return { title: "Sign in to open this simulation", body: "Create a free account or log in to continue.", cta: "Log in" };
  }
  return { title: "This is a Premium simulation", body: "Premium gives access to every simulation.", cta: null };
}
