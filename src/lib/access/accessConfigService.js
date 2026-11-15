// Reads / writes the two site-wide access settings and the optional per-simulation tier overrides.
//
// MECHANISM (reused, not new): the settings live as two extra columns on the existing singleton row
// public.platform_settings (see supabase/admin-settings-migration.sql and src/lib/settingsService.js):
//   premium_enabled                 boolean  -> premiumEnabled
//   require_login_for_simulations   boolean  -> requireLoginForSimulations
// They are exposed to signed-out visitors through the same curated view as the other public settings,
// public.platform_settings_public, and written by admins through the same RLS-protected table.
// The columns / view change / simulation_access table are DRAFTS (docs/platform-sql/) and are not applied.
//
// SAFE FALLBACK: every read path swallows errors (no Supabase, table / column / row missing, network) and returns
// DEFAULT_ACCESS_CONFIG, i.e. "everything is free".  Reads never throw.  The client is injectable for tests.
import { supabase as defaultClient } from "../supabaseClient.js";
import { DEFAULT_ACCESS_CONFIG, TIER_LIST } from "./accessPolicy.js";

export const CONFIG_COLUMNS = Object.freeze({
  premiumEnabled: "premium_enabled",
  requireLoginForSimulations: "require_login_for_simulations",
  downloadRequiresPremium: "download_requires_premium", // draft docs/platform-sql/011_download_requires_premium.sql
});
// The first two come from 001_site_access_config.sql; the download switch has its own, later, draft (011).  They are
// kept apart so a site that only ran 001 keeps working exactly as before (switches enabled, download switch disabled).
const BASE_COLUMNS = ["premium_enabled", "require_login_for_simulations"];
const DOWNLOAD_COLUMN = CONFIG_COLUMNS.downloadRequiresPremium;

/** Row (snake_case, possibly missing / malformed) -> access config.  Only a literal `true` switches anything on. */
export function normaliseAccessConfig(row) {
  const out = { ...DEFAULT_ACCESS_CONFIG };
  if (!row || typeof row !== "object") return out;
  for (const [key, col] of Object.entries(CONFIG_COLUMNS)) {
    if (row[col] === true) out[key] = true;
  }
  return out;
}

/** Public read (works signed out).  Never throws; `source` says whether the database answered. */
export async function fetchAccessConfig(client = defaultClient) {
  if (!client) return { config: { ...DEFAULT_ACCESS_CONFIG }, source: "default" };
  try {
    let { data, error } = await client.from("platform_settings_public").select(`${BASE_COLUMNS.join(", ")}, ${DOWNLOAD_COLUMN}`).maybeSingle();
    // Before 011 the download column does not exist and the select fails: retry with the original two columns.
    if (error) ({ data, error } = await client.from("platform_settings_public").select(BASE_COLUMNS.join(", ")).maybeSingle());
    if (error || !data) return { config: { ...DEFAULT_ACCESS_CONFIG }, source: "default" };
    return { config: normaliseAccessConfig(data), source: "database" };
  } catch {
    return { config: { ...DEFAULT_ACCESS_CONFIG }, source: "default" };
  }
}

/** Admin read: also reports whether the columns exist yet (`available`). */
export async function fetchAdminAccessConfig(client = defaultClient) {
  if (!client) return { config: { ...DEFAULT_ACCESS_CONFIG }, available: false, downloadSwitchAvailable: false, reason: "not-connected" };
  try {
    const { data, error } = await client.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (error) return { config: { ...DEFAULT_ACCESS_CONFIG }, available: false, downloadSwitchAvailable: false, reason: "error" };
    const available = Boolean(data) && BASE_COLUMNS.every((col) => col in data);
    const downloadSwitchAvailable = available && DOWNLOAD_COLUMN in data;
    return { config: normaliseAccessConfig(data), available, downloadSwitchAvailable, reason: available ? "ok" : "columns-missing" };
  } catch {
    return { config: { ...DEFAULT_ACCESS_CONFIG }, available: false, downloadSwitchAvailable: false, reason: "error" };
  }
}

/** Admin write.  `patch` holds only access-config keys; RLS (is_admin()) is the real gate.  Throws on failure. */
export async function saveAccessConfig(patch, client = defaultClient) {
  if (!client) throw new Error("Not connected to Supabase.");
  const fields = {};
  for (const [key, col] of Object.entries(CONFIG_COLUMNS)) if (typeof patch?.[key] === "boolean") fields[col] = patch[key];
  if (!Object.keys(fields).length) throw new Error("Nothing to save.");
  const { data, error } = await client.from("platform_settings").update(fields).eq("id", 1).select().single();
  if (error) throw error;
  return normaliseAccessConfig(data);
}

/** Per-simulation overrides.  { overrides: { [simId]: { tier, featured } }, available } -- table missing => available:false. */
export async function fetchSimulationOverrides(client = defaultClient) {
  if (!client) return { overrides: {}, available: false };
  try {
    const { data, error } = await client.from("simulation_access").select("sim_id, tier, featured");
    if (error || !Array.isArray(data)) return { overrides: {}, available: false };
    const overrides = {};
    for (const row of data) {
      if (!row || typeof row.sim_id !== "string") continue;
      const o = {};
      if (TIER_LIST.includes(row.tier)) o.tier = row.tier;
      if (typeof row.featured === "boolean") o.featured = row.featured;
      overrides[row.sim_id] = o;
    }
    return { overrides, available: true };
  } catch {
    return { overrides: {}, available: false };
  }
}

/** Admin write of one simulation's override (upsert on sim_id).  Throws on failure. */
export async function saveSimulationOverride(simId, patch, client = defaultClient) {
  if (!client) throw new Error("Not connected to Supabase.");
  const row = { sim_id: simId };
  if (TIER_LIST.includes(patch?.tier)) row.tier = patch.tier;
  if (typeof patch?.featured === "boolean") row.featured = patch.featured;
  if (Object.keys(row).length < 2) throw new Error("Nothing to save.");
  const { error } = await client.from("simulation_access").upsert(row, { onConflict: "sim_id" });
  if (error) throw error;
  return row;
}
