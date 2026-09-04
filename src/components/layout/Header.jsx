import Wordmark from "./Wordmark.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Container from "../ui/Container.jsx";
import AuthHeaderControl from "../auth/AuthHeaderControl.jsx";

// The public-site header only — Shell (which renders this) now covers
// exclusively the public routes (/, /auth, /explore, /topics,
// /interactives, /about, ...). Once a user is inside /student/* or
// /teacher/*, StudentLayout/TeacherLayout render their own complete
// header (nav tabs, account menu) instead, since those are separate
// top-level route trees, not nested under Shell — see router.jsx.
export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <AuthHeaderControl />
        </div>
      </Container>
    </header>
  );
}
