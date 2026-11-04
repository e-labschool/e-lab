import { supabase } from "./supabaseClient.js";

export const ACCESS_PAGE_SIZE = 20;
const EXPIRING_SOON_DAYS = 14;

// Centralizes every Admin Access DB call, same pattern as
// resourceService.js/userService.js. Reads go through the
// user_access_overview view (see admin-access-migration.sql), which
// computes access_status/effective_plan in the database — this file
// never re-derives those itself, so there's exactly one source of truth
// for "is this access active/expired/scheduled".

export async function getAccessCounts() {
  if (!supabase) return { free: 0, premium: 0, school: 0, expiringSoon: 0 };
  const { data, error } = await supabase.from("user_access_overview").select("plan, access_status, expires_at");
  if (error) throw error;

  const soonCutoff = Date.now() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  return {
    free: data.filter((r) => r.plan === "free").length,
    premium: data.filter((r) => r.plan === "premium").length,
    school: data.filter((r) => r.plan === "school").length,
    expiringSoon: data.filter((r) => (
      r.access_status === "active" && r.plan !== "free" && r.expires_at && new Date(r.expires_at).getTime() <= soonCutoff
    )).length,
  };
}

/**
 * filters: { search, plan, role, accessStatus }. page is 1-indexed.
 * Returns { rows, totalCount }.
 */
export async function listAccessPage({ page = 1, filters = {} }) {
  if (!supabase) return { rows: [], totalCount: 0 };

  let query = supabase.from("user_access_overview").select("*", { count: "exact" });

  if (filters.plan && filters.plan !== "All") query = query.eq("plan", filters.plan.toLowerCase());
  if (filters.role && filters.role !== "All") query = query.eq("role", filters.role.toLowerCase());
  if (filters.accessStatus && filters.accessStatus !== "All") query = query.eq("access_status", filters.accessStatus.toLowerCase());
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,school.ilike.%${q}%`);
  }

  const from = (page - 1) * ACCESS_PAGE_SIZE;
  const to = from + ACCESS_PAGE_SIZE - 1;
  const { data, error, count } = await query.order("joined_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: data, totalCount: count ?? 0 };
}

export async function getUserAccess(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("user_access_overview").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Grant/change plan — upserts the one entitlement row for this user. */
export async function grantAccess(userId, { plan, startsAt, expiresAt }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("user_access")
    .upsert(
      { user_id: userId, plan, starts_at: startsAt || null, expires_at: expiresAt || null, created_by: userData?.user?.id },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** "Remove Premium/School Access" — reverts to free rather than deleting the row, preserving the audit trail. */
export async function removeAccess(userId) {
  return grantAccess(userId, { plan: "free", startsAt: null, expiresAt: null });
}
