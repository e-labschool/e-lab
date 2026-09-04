import { useNavigate } from "react-router-dom";
import { GraduationCap, Presentation, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Container from "../ui/Container.jsx";
import Card from "../ui/Card.jsx";

const ROLES = [
  {
    id: "student",
    label: "Student",
    icon: GraduationCap,
    description: "Learn concepts, explore visually and build confidence through practice.",
    cta: "Continue as Student",
    accent: "var(--color-role-student)",
    accentSoft: "var(--color-role-student-soft)",
  },
  {
    id: "teacher",
    label: "Teacher",
    icon: Presentation,
    description: "Teach visually, engage your class and access classroom tools.",
    cta: "Continue as Teacher",
    accent: "var(--color-role-teacher)",
    accentSoft: "var(--color-role-teacher-soft)",
  },
];

export default function RoleCards() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Already signed in as this exact role -> straight into the platform.
  // Otherwise -> the dedicated auth page, opened on the right role's tab.
  // This is the site's ONE authentication entry point; there is no second
  // role-selection flow living anywhere else.
  function choose(roleId) {
    if (user && profile?.role === roleId) {
      navigate(`/${roleId}`);
    } else {
      navigate(`/auth?role=${roleId}`);
    }
  }

  return (
    <section className="pb-16 md:pb-20">
      <Container className="flex justify-center">
        <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          {ROLES.map(({ id, label, icon: Icon, description, cta, accent, accentSoft }) => (
            <button key={id} type="button" onClick={() => choose(id)} className="text-left">
              <Card
                className="group flex h-full flex-col justify-between overflow-hidden p-8 transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--color-line)] hover:shadow-md"
                style={{ borderTopWidth: "3px", borderTopColor: accent }}
              >
                <div>
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg"
                    style={{ backgroundColor: accentSoft, color: accent }}
                  >
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <h2 className="mt-5 text-lg font-medium text-[var(--color-ink)]">{label}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{description}</p>
                </div>
                <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: accent }}>
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
