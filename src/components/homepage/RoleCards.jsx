import { useNavigate } from "react-router-dom";
import { GraduationCap, Presentation, ArrowRight } from "lucide-react";
import { useRole } from "../../context/RoleContext.jsx";
import Container from "../ui/Container.jsx";
import Card from "../ui/Card.jsx";

const ROLES = [
  {
    id: "student",
    label: "Student",
    icon: GraduationCap,
    description: "Learn concepts, explore visually and build confidence through practice.",
    cta: "Continue as Student",
    accent: "var(--color-indigo)",
  },
  {
    id: "teacher",
    label: "Teacher",
    icon: Presentation,
    description: "Teach visually, engage your class and access classroom tools.",
    cta: "Continue as Teacher",
    accent: "var(--color-amber)",
  },
];

export default function RoleCards() {
  const { setRole } = useRole();
  const navigate = useNavigate();

  function choose(roleId) {
    setRole(roleId);
    navigate(`/${roleId}`);
  }

  return (
    <section className="pb-24">
      <Container className="flex justify-center">
        <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          {ROLES.map(({ id, label, icon: Icon, description, cta, accent }) => (
            <button key={id} type="button" onClick={() => choose(id)} className="text-left">
              <Card className="group flex h-full flex-col justify-between p-8 transition-colors hover:border-[var(--color-ink)]">
                <div>
                  <Icon size={24} strokeWidth={1.5} style={{ color: accent }} />
                  <h2 className="mt-5 text-lg font-medium text-[var(--color-ink)]">{label}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{description}</p>
                </div>
                <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                  {cta}
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Card>
            </button>
          ))}
        </div>
      </Container>
    </section>
  );
}
