import { useNavigate } from "react-router-dom";
import { GraduationCap, Presentation, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Container from "../ui/Container.jsx";

const ROLES = [
  { id: "student", label: "I'm a Student", icon: GraduationCap },
  { id: "teacher", label: "I'm a Teacher", icon: Presentation },
];

// Dark, high-contrast entry buttons — per the brief, this is the single
// strongest visual action on the homepage. Auth-routing logic is
// unchanged from before: already signed in as this exact role -> straight
// into the platform; otherwise -> the one dedicated auth page.
export default function RoleCards() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  function choose(roleId) {
    if (user && profile?.role === roleId) {
      navigate(`/${roleId}`);
    } else {
      navigate(`/auth?role=${roleId}`);
    }
  }

  return (
    <section className="pb-12 md:pb-14">
      <Container className="flex justify-center">
        <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {ROLES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              className="group flex items-center justify-between gap-3 rounded-md bg-[#12172A] px-6 py-5 text-left shadow-[0_1px_2px_rgba(20,30,80,0.2),0_6px_16px_-4px_rgba(20,30,80,0.3)] transition-all duration-200 hover:-translate-y-px hover:bg-[#1A2038]"
            >
              <span className="flex items-center gap-3">
                <Icon size={22} className="shrink-0 text-white/80" strokeWidth={1.75} />
                <span className="text-base font-bold text-white">{label}</span>
              </span>
              <ArrowRight size={17} className="shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </Container>
    </section>
  );
}
