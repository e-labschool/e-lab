import { Link } from "react-router-dom";
import { Presentation, FileEdit, Library } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Container from "../../components/ui/Container.jsx";

const SHORTCUTS = [
  { to: "/teacher/teach", label: "Teach", icon: Presentation, description: "Classroom-ready visuals and walkthroughs for each concept." },
  { to: "/teacher/question-builder", label: "Question Builder", icon: FileEdit, description: "Build and export papers from the e-Lab question bank." },
  { to: "/teacher/resources", label: "Resources", icon: Library, description: "Reference material and printable resources." },
];

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <Container className="py-14">
      <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
        Welcome back, {firstName}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{profile?.school ? `${profile.school} \u00b7 ` : ""}IB Diploma Programme</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {SHORTCUTS.map((s) => (
          <Link key={s.to} to={s.to} className="group rounded-lg border border-[var(--color-line)] p-5 transition-colors hover:border-[var(--color-ink)]">
            <s.icon size={18} className="text-[var(--color-amber)]" />
            <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">{s.label}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{s.description}</p>
          </Link>
        ))}
      </div>
    </Container>
  );
}
