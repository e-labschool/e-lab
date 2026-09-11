import { BookOpen } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { loadUserScopedValue } from "../../lib/userScopedStorage.js";

export default function LearnCmsHome() {
  const { user } = useAuth();
  const rememberedLessonId = user?.id ? loadUserScopedValue(user.id, "learn:last-lesson", null) : null;

  // Resume the last lesson the student had open, if one is remembered —
  // LearnLessonPage itself then resumes the remembered internal page
  // number for that lesson. Falls through to the normal "choose a
  // topic" placeholder the very first time, or if nothing was ever
  // remembered for this account.
  if (rememberedLessonId) {
    return <Navigate to={`/student/learn/${rememberedLessonId}`} replace />;
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <BookOpen size={28} className="text-[var(--color-ink-faint)]" />
      <p className="mt-3 text-lg font-semibold text-[var(--color-ink)]">Choose a topic to begin</p>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-ink-soft)]">Select a section from the curriculum panel to open a lesson.</p>
    </div>
  );
}
