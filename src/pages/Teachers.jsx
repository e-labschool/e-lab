import { Presentation, MonitorPlay, StepForward, EyeOff } from "lucide-react";
import Container from "../components/ui/Container.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import { useMode } from "../context/ModeContext.jsx";

const FEATURES = [
  { icon: MonitorPlay, title: "Presentation-friendly layout", body: "Full-screen views built for a projector or interactive board, not a laptop screen shrunk down." },
  { icon: StepForward, title: "Step-by-step reveal", body: "Build a concept up in front of the class instead of showing the finished answer immediately." },
  { icon: EyeOff, title: "Hide and show on demand", body: "Toggle labels, values or explanations to keep the visualization visually dominant." },
];

export default function Teachers() {
  const { setMode } = useMode();

  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <Presentation size={22} strokeWidth={1.75} className="text-[var(--color-amber)]" />
        <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
          For Teachers
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--color-ink-soft)]">
          Every e-Lab interactive is the same tool a student uses independently — switched
          into a mode built for explaining live in class. Reset it, reveal it step by
          step, hide the labels, highlight what matters. It's a resource you present with,
          not just a link you hand out.
        </p>
        <div className="mt-8">
          <Button to="/explore/dp-chemistry" onClick={() => setMode("teacher")}>
            Switch to Teacher Mode and explore
          </Button>
        </div>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-6">
            <Icon size={19} strokeWidth={1.75} className="text-[var(--color-indigo)]" />
            <h3 className="mt-3 text-sm font-medium text-[var(--color-ink)]">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">{body}</p>
          </Card>
        ))}
      </div>
    </Container>
  );
}
