import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getAllProgrammes } from "../../data/programmes.js";
import { useRole } from "../../context/RoleContext.jsx";
import Container from "../../components/ui/Container.jsx";
import Card from "../../components/ui/Card.jsx";

// Shared by both /student and /teacher — the curriculum-selection step
// doesn't care which role is browsing it, only where to send them next.
export default function ChooseProgramme({ role }) {
  const { setRole } = useRole();
  const navigate = useNavigate();
  const programmes = getAllProgrammes();

  useEffect(() => {
    setRole(role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <Container className="py-16">
      <div className="max-w-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
          {role === "student" ? "Student" : "Teacher"}
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          Choose your curriculum
        </h1>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:max-w-xl">
        {programmes.map((programme) => (
          <button
            key={programme.id}
            type="button"
            onClick={() => navigate(`/${role}/${programme.id}`)}
            className="text-left"
          >
            <Card className="p-7 transition-colors hover:border-[var(--color-ink)]">
              <h2 className="text-lg font-medium text-[var(--color-ink)]">{programme.label}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{programme.description}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-indigo)]">
                Continue <ArrowRight size={14} />
              </span>
            </Card>
          </button>
        ))}
      </div>
    </Container>
  );
}
