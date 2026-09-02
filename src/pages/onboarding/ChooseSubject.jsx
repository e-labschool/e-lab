import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getProgramme, getAvailableSubjects } from "../../data/programmes.js";
import Container from "../../components/ui/Container.jsx";
import Card from "../../components/ui/Card.jsx";

export default function ChooseSubject({ role }) {
  const { programmeId } = useParams();
  const navigate = useNavigate();
  const programme = getProgramme(programmeId);
  const subjects = getAvailableSubjects(programmeId);

  if (!programme) {
    return (
      <Container className="py-20">
        <p className="text-[var(--color-ink-soft)]">
          We don&rsquo;t recognize that curriculum.{" "}
          <Link to={`/${role}`} className="underline">Back</Link>
        </p>
      </Container>
    );
  }

  return (
    <Container className="py-16">
      <div className="max-w-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
          {role === "student" ? "Student" : "Teacher"} &middot; {programme.shortLabel}
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          Choose your subject
        </h1>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:max-w-xl">
        {subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            onClick={() => navigate(`/${role}/${programmeId}/${subject.id}`)}
            className="text-left"
          >
            <Card className="p-7 transition-colors hover:border-[var(--color-ink)]">
              <h2 className="text-lg font-medium text-[var(--color-ink)]">{subject.label}</h2>
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
