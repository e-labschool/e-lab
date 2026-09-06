import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

// Single source of truth for "who is signed in and what is their profile"
// across the whole app. When Supabase isn't configured (see
// lib/supabaseClient.js) this provider still works — session is always
// null, isConfigured is false, and every action rejects with a clear error
// instead of the app crashing or silently pretending to succeed.
//
// Profile rows are keyed by `id` = auth.users.id (the standard Supabase
// convention for a table with an automatic profile-creation trigger,
// matching the schema you set up in Supabase) — not a separate `user_id`
// column.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Returns the fetched row (or null) directly, in addition to updating
  // context state — callers that need the value immediately (e.g. the
  // sign-in redirect, which must read `role` right away) can await this
  // instead of racing a subsequent render of `profile`.
  const fetchProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null);
      return null;
    }
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setLoadingProfile(false);
    if (error) {
      setAuthError(error.message);
      return null;
    }
    setProfile(data ?? null);
    return data ?? null;
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoadingSession(false);
      if (data.session?.user?.id) fetchProfile(data.session.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        fetchProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [fetchProfile]);

  // `metadata` (full_name, role, school, country, grade_or_class,
  // curriculum, level) is passed as Supabase auth user metadata
  // (`options.data`), NOT written to the profiles table directly by the
  // client — your database trigger reads it from the new auth.users row
  // (`raw_user_meta_data`) and creates the profiles row automatically.
  // The client never inserts into profiles itself on sign-up.
  async function signUp({ email, password, metadata }) {
    if (!supabase) throw new Error("Sign-up is unavailable: e-Lab is not yet connected to Supabase.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
    return data;
  }

  async function signIn({ email, password }) {
    if (!supabase) throw new Error("Sign-in is unavailable: e-Lab is not yet connected to Supabase.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function sendPasswordReset(email) {
    if (!supabase) throw new Error("Password reset is unavailable: e-Lab is not yet connected to Supabase.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    if (!supabase) throw new Error("Password update is unavailable: e-Lab is not yet connected to Supabase.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  // Used by the Profile pages to save EDITS (name/school/country/level/
  // grade) after the row already exists — initial creation is the
  // database trigger's job, not this function's.
  // Self-service profile edits only — explicitly whitelisted to the six
  // fields a normal signed-in user is allowed to change themselves.
  // role/status/email/id/created_at can never reach the database through
  // this function, regardless of what a caller passes in, matching the
  // profiles column-level grant lockdown (which would reject them at the
  // database anyway — this is the same boundary enforced one layer
  // earlier, not a substitute for it).
  //
  // Also switched from .upsert() to a plain .update(): after that same
  // lockdown, upsert's insert-on-conflict path isn't the right shape for
  // an editing operation on a row that (per the signup trigger) always
  // already exists — this function only ever edits, it never creates.
  const SELF_EDITABLE_FIELDS = ["full_name", "school", "country", "grade_or_class", "curriculum", "level"];

  async function upsertProfile(fields) {
    if (!supabase || !session?.user?.id) {
      throw new Error("You need to be signed in to save a profile.");
    }
    const safeFields = Object.fromEntries(
      Object.entries(fields).filter(([key]) => SELF_EDITABLE_FIELDS.includes(key))
    );
    const { data, error } = await supabase
      .from("profiles")
      .update(safeFields)
      .eq("id", session.user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  }

  const value = {
    isConfigured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    loadingSession,
    loadingProfile,
    authError,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    upsertProfile,
    fetchProfile,
    refetchProfile: () => fetchProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
