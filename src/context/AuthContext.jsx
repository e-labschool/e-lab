import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { sameJson, mergeSameUserSession } from "../lib/authSessionMerge.js";

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

  const profileRef = useRef(null);
  const userIdRef = useRef(null);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { userIdRef.current = session?.user?.id ?? null; }, [session]);

  // Returns the fetched row (or null) directly, in addition to updating
  // context state — callers that need the value immediately (e.g. the
  // sign-in redirect, which must read `role` right away) can await this
  // instead of racing a subsequent render of `profile`.
  //
  // SILENT REVALIDATION (tab-switch bug): when a profile for this same
  // user is already loaded, a refetch must NOT flip `loadingProfile` on
  // (ProtectedRoute used to answer that with a full-page loader, which
  // unmounted the entire signed-in tree -- Learn page, open simulation,
  // admin editor -- and reset scroll to the top) and must not replace the
  // profile object unless a field really changed. Errors are swallowed in
  // silent mode so a flaky network on tab return can't blank the UI.
  const fetchProfile = useCallback(async (userId, { silent } = {}) => {
    if (!supabase || !userId) {
      setProfile(null);
      return null;
    }
    const isSilent = silent ?? profileRef.current?.id === userId;
    if (!isSilent) setLoadingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!isSilent) setLoadingProfile(false);
    if (error) {
      if (!isSilent) setAuthError(error.message);
      return isSilent ? profileRef.current : null;
    }
    const next = data ?? null;
    setProfile((prev) => (sameJson(prev, next) ? prev : next));
    return next;
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoadingSession(false);
      if (data.session?.user?.id) fetchProfile(data.session.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextId = nextSession?.user?.id ?? null;
      const sameUser = Boolean(nextId) && nextId === userIdRef.current;
      if (sameUser) {
        // supabase-js re-emits SIGNED_IN (and TOKEN_REFRESHED) for the
        // already-signed-in user whenever the browser tab becomes visible
        // again. That is a token bookkeeping event, not an identity
        // change: keep the existing `user` object (so every effect keyed
        // on it stays put), take the fresh tokens, and only revalidate
        // the profile quietly for events that can actually change it.
        setSession((prev) => mergeSameUserSession(prev, nextSession));
        if (event === "USER_UPDATED") fetchProfile(nextId, { silent: true });
        return;
      }
      setSession(nextSession);
      if (nextId) {
        fetchProfile(nextId);
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
