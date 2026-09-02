import { useNavigate } from "react-router-dom";
import { GraduationCap, Presentation } from "lucide-react";
import { useMode } from "../../context/ModeContext.jsx";
import Button from "../ui/Button.jsx";
import Container from "../ui/Container.jsx";

export default function Hero() {
  const { setMode } = useMode();
  const navigate = useNavigate();

  function chooseMode(mode) {
    setMode(mode);
    navigate("/explore/dp-chemistry");
  }

  return (
    <section className="border-b border-[var(--color-line)] py-20 md:py-28">
      <Container>
        <div className="max-w-3xl">
          <h1 className="font-[var(--font-display)] text-5xl font-semibold tracking-tight text-[var(--color-ink)] md:text-6xl">
            e-Lab
          </h1>
          <p className="mt-3 text-xl text-[var(--color-ink-soft)] md:text-2xl">
            Explore. Interact. Understand.
          </p>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--color-ink-soft)] md:text-lg">
            Interactive science tools for teaching, exploring and understanding difficult
            concepts.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => chooseMode("student")}>
              <GraduationCap size={18} strokeWidth={2} />
              I&rsquo;m a Student
            </Button>
            <Button size="lg" variant="secondary" onClick={() => chooseMode("teacher")}>
              <Presentation size={18} strokeWidth={2} />
              I&rsquo;m a Teacher
            </Button>
          </div>

          <div className="mt-5">
            <Button to="/explore/dp-chemistry" variant="ghost" size="sm" className="!px-0">
              Explore Chemistry
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
