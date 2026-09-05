import { supabase } from "./supabaseClient.js";

export const PAGE_SIZE = 20;

// Centralizes every Admin Users DB call — mirrors resourceService.js's
// pattern (one place, not scattered raw supabase.from("profiles") calls).
// Every function here relies on the "Admins can read/update all profiles"
// RLS policies added by admin-users-migration.sql; a non-admin calling
// these gets rejected at the database, not just hidden in the UI.

export async function getUserCounts() {
  if (!supabase) return { total: 0, student: 0, teacher: 0, admin: 0 };
  const { data, error } = await supabase.from("profiles").select("role");
  if (error) throw error;
  return {
    total: data.length,
    student: data.filter((r) => r.role === "student").length,
    teacher: data.filter((r) => r.role === "teacher").length,
    admin: data.filter((r) => r.role === "admin").length,
  };
}

/**
 * Server-side filtered + paginated profile list.
 * filters: { search, role, level }. page is 1-indexed.
 * Returns { rows, totalCount }.
 */
export async function listUsersPage({ page = 1, filters = {} }) {
  if (!supabase) return { rows: [], totalCount: 0 };

  let query = supabase.from("profiles").select("*", { count: "exact" });

  if (filters.role && filters.role !== "All") {
    query = query.eq("role", filters.role.toLowerCase());
  }
  if (filters.level && filters.level !== "All") {
    query = query.eq("level", filters.level);
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    // Searches full name, email, and school in one round trip rather than
    // three separate queries.
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,school.ilike.%${q}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: data, totalCount: count ?? 0 };
}

export async function updateUserProfile(id, fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.from("profiles").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function setUserStatus(id, status) {
  return updateUserProfile(id, { status });
}
