import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "./AuthContext.jsx";
import { getLearnTree } from "../lib/learn-tree.js";

const ProgressContext = createContext(null);
const LOCAL_KEY = "e-lab:guest-progress";

// Signed-in progress lives ONLY in Supabase (learning_progress table) —
// this hook never treats localStorage as the source of truth for a signed
// -in user. For a signed-out visitor, there is no account to persist to,
// so a small localStorage map is used purely as a same-browser convenience
// (per the brief: "local storage only as temporary UI state or signed-out
// fallback"). Signing in does NOT merge guest localStorage progress into
// the account — that would silently attribute one anonymous browser's
// activity to whichever account next signs in on it, which is worse than
// just starting fresh.
function readLocalProgress() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalProgress(map) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
}

export function ProgressProvider({ children }) {
  const { user, isConfigured } = useAuth();
  const [progress, setProgress] = useState({}); // conceptId -> row
  const [loading, setLoading] = useState(false);

  const loadFromSupabase = useCallback(async (userId) => {
    setLoading(true);
    const { data, error } = await supabase.from("learning_progress").select("*").eq("user_id", userId);
    setLoading(false);
    if (error) return;
    const map = {};
    for (const row of data) map[row.concept_id] = row;
    setProgress(map);
  }, []);

  useEffect(() => {
    if (user && isConfigured) {
      loadFromSupabase(user.id);
    } else {
      setProgress(readLocalProgress());
    }
  }, [user, isConfigured, loadFromSupabase]);

  const upsertRow = useCallback(
    async (conceptId, patch) => {
      const tree = getLearnTree();
      const ctx = tree?.conceptIndex.get(conceptId);
      const now = new Date().toISOString();

      if (user && isConfigured) {
        const existing = progress[conceptId];
        const nextRow = {
          user_id: user.id,
          concept_id: conceptId,
          curriculum_code: ctx?.subtopicCode ?? "",
          status: existing?.status ?? "not_started",
          attempt_count: existing?.attempt_count ?? 0,
          first_opened_at: existing?.first_opened_at ?? now,
          last_visited_at: now,
          ...patch,
        };
        const { data, error } = await supabase
          .from("learning_progress")
          .upsert(nextRow, { onConflict: "user_id,concept_id" })
          .select()
          .single();
        if (!error && data) setProgress((prev) => ({ ...prev, [conceptId]: data }));
      } else {
        setProgress((prev) => {
          const existing = prev[conceptId];
          const nextRow = {
            concept_id: conceptId,
            curriculum_code: ctx?.subtopicCode ?? "",
            status: existing?.status ?? "not_started",
            attempt_count: existing?.attempt_count ?? 0,
            first_opened_at: existing?.first_opened_at ?? now,
            last_visited_at: now,
            ...patch,
          };
          const next = { ...prev, [conceptId]: nextRow };
          writeLocalProgress(next);
          return next;
        });
      }
    },
    [user, isConfigured, progress]
  );

  // Called when a concept page is actually opened/studied — moves
  // not_started -> in_progress. Never called just from a sidebar hover, so
  // opening the page is what counts as "meaningfully" studying it.
  function openConcept(conceptId) {
    const existing = progress[conceptId];
    if (existing?.status === "completed") {
      upsertRow(conceptId, {}); // just bump last_visited_at
      return;
    }
    upsertRow(conceptId, { status: "in_progress" });
  }

  function markCompleted(conceptId) {
    upsertRow(conceptId, { status: "completed", completed_at: new Date().toISOString() });
  }

  async function recordCheckAttempt(conceptId, { questionId, isCorrect, score }) {
    const existing = progress[conceptId];
    const attemptCount = (existing?.attempt_count ?? 0) + 1;
    const bestScore = Math.max(existing?.best_check_score ?? 0, score);
    await upsertRow(conceptId, {
      attempt_count: attemptCount,
      last_check_score: score,
      best_check_score: bestScore,
    });

    if (user && isConfigured) {
      await supabase.from("concept_attempts").insert({
        user_id: user.id,
        concept_id: conceptId,
        question_id: questionId,
        is_correct: isCorrect,
      });
    }
  }

  const value = useMemo(
    () => ({
      progress,
      loading,
      openConcept,
      markCompleted,
      recordCheckAttempt,
      statusFor: (conceptId) => progress[conceptId]?.status ?? "not_started",
      isSignedIn: Boolean(user),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, loading, user]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useLearningProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useLearningProgress must be used within a ProgressProvider");
  return ctx;
}
