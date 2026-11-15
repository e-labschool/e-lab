import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Presentation } from "lucide-react";
import Container from "../ui/Container.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// Only features that exist in the app today (Teach, Class Planner + Present Class, Question Builder, Resources, simulations).
const POINTS = [
  "Class Planner with curriculum-linked teaching tools",
  "Present Class mode for the projector",
  "Question Builder using the e-Lab question bank",
  "Teacher resources: IB-related documents, worksheets and supporting materials",
  "Every simulation ready to present, with Fullscreen",
];

function Shot() {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-amber-soft)] text-[var(--color-amber)]" aria-hidden="true"><Presentation size={40} /></div>;
  return <img src="/landing/teacher-simulations.webp" alt="The teacher Simulations library with search, topic filters and simulation cards" width={800} height={500} loading="lazy" decoding="async" onError={() => setFailed(true)} className="aspect-[16/10] w-full rounded-xl border border-[var(--color-line)] object-cover object-top shadow-[0_18px_50px_-18px_rgba(20,30,80,0.35)]" />;
}

export default function TeachersSection() {
  const { user, profile } = useAuth();
  const to = user && profile?.role === "teacher" ? "/teacher" : "/auth?role=teacher";
  return (
    <section id="teachers" aria-labelledby="teachers-title" className="scroll-mt-20 border-b border-[var(--color-line)] bg-[var(--color-amber-soft)] py-14 md:py-16">
      <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="min-w-0">
          <p className="inline-flex rounded-full border border-[var(--color-amber)]/40 px-3 py-1 text-xs font-semibold text-[var(--color-amber)]">For teachers</p>
          <h2 id="teachers-title" className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Plan, present and assess &mdash; faster</h2>
          <ul className="mt-5 space-y-2.5">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[15px] text-[var(--color-ink)]"><Check size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-amber)]" />{p}</li>
            ))}
          </ul>
          <Link to={to} className="mt-6 inline-flex items-center rounded-md bg-[#12172A] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#1F2747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-amber-soft)] dark:border dark:border-white/25">Explore teacher tools</Link>
        </div>
        <div className="min-w-0"><Shot /></div>
      </Container>
    </section>
  );
}
