import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

const AuthContext = createContext(null);

// Single source of truth for "who is signed in and what is their profile"
// across the whole app. When Supabase isn't configured (see lib/supabase.js)
// this provider still works — session is always null, isConfigured is
// false, and every action rejects with a clear error instead of the app
// crashing or silently pretending to succeed.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [authError, setAuthError] = useState(null);

  const fetchProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setLoadingProfile(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setProfile(data ?? null);
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

  async function signUp({ email, password }) {
    if (!supabase) throw new Error("Sign-up is unavailable: e-Lab is not yet connected to Supabase.");
    const { data, error } = await supabase.auth.signUp({ email, password });
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

  // Creates the profile row on first login after role/profile-details are
  // collected (registration step 2/3), or updates it from the Profile page.
  async function upsertProfile(fields) {
    if (!supabase || !session?.user?.id) {
      throw new Error("You need to be signed in to save a profile.");
    }
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ user_id: session.user.id, ...fields }, { onConflict: "user_id" })
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
    refetchProfile: () => fetchProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
