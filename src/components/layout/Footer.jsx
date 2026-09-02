import { Link } from "react-router-dom";
import Wordmark from "./Wordmark.jsx";
import Container from "../ui/Container.jsx";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] py-12">
      <Container>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Wordmark withTagline />
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-ink-soft)]">
              e-Lab is an independent educational platform and is not affiliated with or
              endorsed by the International Baccalaureate Organization, Cambridge Assessment
              International Education, or any curriculum publisher.
            </p>
          </div>

          <div className="flex gap-12">
            <div className="flex flex-col gap-2 text-sm">
              <span className="mb-1 font-medium text-[var(--color-ink)]">Platform</span>
              <Link to="/explore" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Explore</Link>
              <Link to="/interactives" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Interactives</Link>
              <Link to="/topics" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Topics</Link>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <span className="mb-1 font-medium text-[var(--color-ink)]">About</span>
              <Link to="/teachers" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">For Teachers</Link>
              <Link to="/about" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">About e-Lab</Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col-reverse items-start gap-3 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink-faint)] md:flex-row md:items-center md:justify-between">
          <span>&copy; {new Date().getFullYear()} e-Lab. All rights reserved.</span>
          <span>Built for students and teachers.</span>
        </div>
      </Container>
    </footer>
  );
}
