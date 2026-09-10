import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Navigate } from "react-router-dom";
import { listPublishedLessonMeta } from "../../lib/learnContentService.js";
import ELabLoader from "../ui/ELabLoader.jsx";

export default function LearnCmsHome() {
  const [welcomeId, setWelcomeId] = useState(undefined);
  useEffect(() => { listPublishedLessonMeta().then(rows => setWelcomeId(rows.find(r=>r.parent_topic==="__welcome__")?.id || null)).catch(()=>setWelcomeId(null)); }, []);
  if (welcomeId === undefined) return <div className="flex min-h-[40vh] items-center justify-center"><ELabLoader/></div>;
  if (welcomeId) return <Navigate to={`/student/learn/${welcomeId}`} replace />;
  return <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center"><BookOpen size={28} className="text-[var(--color-ink-faint)]"/><p className="mt-3 text-lg font-semibold text-[var(--color-ink)]">Welcome to e-Lab Learn</p><p className="mt-1 max-w-sm text-sm text-[var(--color-ink-soft)]">Your welcome page will appear here after it is published from Admin → Learn Content.</p></div>;
}
