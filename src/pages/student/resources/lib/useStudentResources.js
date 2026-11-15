import { useMemo } from "react";
import { useVisibleResources } from "../../../../lib/useVisibleResources.js";
import { isResourceVisibleToAudience } from "../../../../lib/resourceService.js";
import staticResources from "../../../../data/student-resources.js";
import { useAuth } from "../../../../context/AuthContext.jsx";
import { canStudentAccessResourceLevel } from "../../../../lib/learnLevelAccess.js";

/** Same merge + audience + level filtering the Student Resources pages always used (unchanged logic). */
export function useStudentResources() {
  const { profile } = useAuth();
  const studentLevel = profile?.level;
  const { resources: supabaseResources, loading, error } = useVisibleResources();
  const resources = useMemo(
    () => [...staticResources, ...supabaseResources.filter((r) => isResourceVisibleToAudience(r, "student"))].filter((r) => canStudentAccessResourceLevel(studentLevel, r.level)),
    [supabaseResources, studentLevel]
  );
  return { resources, loading, error };
}
