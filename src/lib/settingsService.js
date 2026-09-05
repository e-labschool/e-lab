import { supabase } from "./supabaseClient.js";

// Centralizes every platform_settings DB call, same pattern as
// resourceService.js/userService.js/accessService.js.

export const DEFAULT_PUBLIC_SETTINGS = {
  platform_name: "e-Lab",
  tagline: "Making Science Interactive.",
  allow_student_registration: true,
  allow_teacher_registration: true,
  maintenance_mode: false,
  maintenance_message: "e-Lab is currently undergoing scheduled maintenance. Please check back shortly.",
};

/** Public, pre-auth-safe settings — works signed out, and provides a
 * reasonable fallback (registration open, no maintenance) if the
 * platform_settings_public view/migration doesn't exist yet, rather than
 * breaking signup or falsely showing a maintenance screen. */
export async function getPublicSettings() {
  if (!supabase) return DEFAULT_PUBLIC_SETTINGS;
  const { data, error } = await supabase.from("platform_settings_public").select("*").maybeSingle();
  if (error || !data) return DEFAULT_PUBLIC_SETTINGS;
  return data;
}

export async function getSettingsForAdmin() {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.from("platform_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateSettings(fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.from("platform_settings").update(fields).eq("id", 1).select().single();
  if (error) throw error;
  return data;
}
