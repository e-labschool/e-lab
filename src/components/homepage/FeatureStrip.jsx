import { MousePointerClick, Eye, Lightbulb } from "lucide-react";
import Container from "../ui/Container.jsx";

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "Interact",
    description: "Manipulate scientific models and observe what changes.",
    accent: "var(--color-role-interactive)",
  },
  {
    icon: Eye,
    title: "Visualize",
    description: "See difficult concepts represented clearly and dynamically.",
    accent: "var(--color-role-student)",
  },
  {
    icon: Lightbulb,
    title: "Understand",
    description: "Connect observations to the underlying science.",
    accent: "var(--color-role-teacher)",
  },
];

// A lightweight, non-card strip — three short items explaining what makes
// e-Lab different, without turning the homepage into a marketing page.
export default function FeatureStrip() {
  return (
    <section className="pb-10 md:pb-12">
      <Container>
        <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-3 sm:gap-4">
          {FEATURES.map(({ icon: Icon, title, description, accent }) => (
            <div key={title} className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
              >
                <Icon size={16} strokeWidth={2} />
              </span>
              <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
              <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
