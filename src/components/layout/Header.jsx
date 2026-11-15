import Wordmark from "./Wordmark.jsx";
import Container from "../ui/Container.jsx";
import PublicNav from "./PublicNav.jsx";

// The public-site header only — Shell (which renders this) covers exclusively the public routes (/, /auth, /explore,
// /topics, /interactives, /about, ...). Once a user is inside /student/* or /teacher/*, StudentLayout/TeacherLayout
// render their own complete header (nav tabs, account menu) instead, since those are separate top-level route trees,
// not nested under Shell — see router.jsx.  Navigation, theme toggle and the auth entry live in PublicNav.
export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <PublicNav />
      </Container>
    </header>
  );
}
