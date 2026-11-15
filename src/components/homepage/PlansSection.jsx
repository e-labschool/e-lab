import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import Container from "../ui/Container.jsx";

/**
 * Plans section for the landing page.  It is BUILT but only rendered when accessPolicy.showPremiumUi(config) is true
 * (see Home.jsx) -- while everything is free it does not exist on the page.  Copy is deliberately generic and carries no
 * prices: finalise plans, wording and any contact / sign-up action before switching Premium on.  No "Notify me" box.
 */
export default function PlansSection() {
  return (
    <section id="plans" aria-labelledby="plans-title" className="scroll-mt-20 border-b border-[var(--color-line)] py-14 md:py-16">
      <Container>
        <h2 id="plans-title" className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Plans</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">Free</h3>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-ink-soft)]">
              <li className="flex gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-teal)]" />Simulations and lessons marked Free</li>
              <li className="flex gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-teal)]" />Progress tracking</li>
            </ul>
            <Link to="/auth?tab=create-account" className="mt-5 inline-flex rounded-md border border-[var(--color-ink)]/50 px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)]">Create free account</Link>
          </div>
          <div className="rounded-xl border-2 border-[var(--color-indigo)] bg-[var(--color-paper-raised)] p-6">
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">Premium</h3>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-ink-soft)]">
              <li className="flex gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-teal)]" />Everything in Free</li>
              <li className="flex gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-teal)]" />Content marked Premium</li>
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
