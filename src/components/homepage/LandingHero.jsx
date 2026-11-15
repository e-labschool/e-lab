import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import Container from "../ui/Container.jsx";
import LiveDemo from "./LiveDemo.jsx";

/** Hero: headline + the two actions on the left, the lazy live demo on the right.  The ONLY h1 on the page. */
export default function LandingHero({ demoRequested, onTryDemo }) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-[var(--color-line)] py-10 md:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60" style={{ background: "radial-gradient(ellipse 640px 320px at 20% 0%, var(--color-indigo-soft), transparent 70%)" }} />
      <Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="min-w-0">
          <p className="inline-flex rounded-full bg-[var(--color-indigo-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-indigo)]">IB Diploma Chemistry &middot; SL &amp; HL</p>
          <h1 id="hero-title" className="mt-4 font-[var(--font-display)] text-[2.5rem] font-bold leading-[1.05] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-[3.4rem]">
            IB Chemistry you can <span className="text-[var(--color-indigo)]">see, move</span> and test.
          </h1>
          <p className="mt-4 text-xl text-[var(--color-ink-soft)]">Making Science Interactive.</p>
          <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-[var(--color-ink-soft)]">
            Designed by educators, e-Lab brings simulations, lessons, practice questions and progress tracking together in one place for IB Diploma Chemistry students and teachers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={onTryDemo} data-try-simulation className="inline-flex items-center gap-2 rounded-md bg-[#12172A] px-5 py-3 text-[15px] font-semibold text-white shadow-[0_6px_16px_-4px_rgba(20,30,80,0.4)] hover:bg-[#1F2747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] dark:border dark:border-white/25">
              <Play size={15} aria-hidden="true" /> Try a simulation
            </button>
            <Link to="/auth?tab=create-account" className="inline-flex items-center rounded-md border border-[var(--color-ink)]/50 bg-[var(--color-paper-raised)] px-5 py-3 text-[15px] font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)]">
              Create free account
            </Link>
          </div>
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">The demo needs no sign-up. A free account saves your progress.</p>
        </div>
        <div className="min-w-0 scroll-mt-20" id="demo"><LiveDemo requested={demoRequested} onRequest={onTryDemo} /></div>
      </Container>
    </section>
  );
}
