import { Link } from "react-router-dom";
import { Atom, Shapes, FolderOpen, ClipboardCheck } from "lucide-react";
import Container from "../ui/Container.jsx";
import Card from "../ui/Card.jsx";

// Illustrative preview cards — every link below points at a route that
// already exists and works today (verified against router.jsx), not
// placeholder content. This section exists purely to show the platform is
// more than the two role buttons above.
const ITEMS = [
  {
    title: "Electron Configuration",
    description: "Atomic structure, visualized",
    to: "/interactives/electron-configuration-explorer",
    icon: Atom,
    accent: "var(--color-role-interactive)",
  },
  {
    title: "Molecular Geometry",
    description: "Bonding & 3D shape",
    to: "/topics/molecular-geometry",
    icon: Shapes,
    accent: "var(--color-role-interactive)",
  },
  {
    title: "Practice & Resources",
    description: "Guides, worksheets, tools",
    to: "/student/resources",
    icon: FolderOpen,
    accent: "var(--color-role-resources)",
  },
  {
    title: "Assessment Support",
    description: "Check your understanding",
    to: "/student/solve",
    icon: ClipboardCheck,
    accent: "var(--color-role-assess)",
  },
];

export default function ExploreGrid() {
  return (
    <section className="border-t border-[var(--color-line)] bg-[var(--color-paper-raised)]/40 py-14 md:py-16">
      <Container>
        <h2 className="text-center font-[var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-ink)] md:text-2xl">
          Explore science visually
        </h2>

        <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ title, description, to, icon: Icon, accent }) => (
            <Link key={title} to={to}>
              <Card className="flex h-full flex-col gap-2.5 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--color-line)] hover:shadow-md">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ color: accent }}>
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
                <p className="text-xs text-[var(--color-ink-faint)]">{description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
