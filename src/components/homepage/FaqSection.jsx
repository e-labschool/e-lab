import { useId, useState } from "react";
import { Plus, Minus } from "lucide-react";
import Container from "../ui/Container.jsx";

// Every answer states only what is true today.  If access rules change (e.g. Premium is switched on), review this list.
export const FAQ_ITEMS = [
  { q: "Is e-Lab free?", a: "Yes. Everything on e-Lab is currently free to use." },
  { q: "Do I need an account?", a: "No account is needed to try the live demo on this page or to open a simulation from a link. A free account is needed for lessons, practice challenges and saved progress." },
  { q: "Which IB syllabus is covered?", a: "e-Lab currently features IB Diploma Chemistry (SL and HL), organised by the first-assessment-2025 syllabus. Coverage is still growing, so not every syllabus point has a lesson or simulation yet." },
  { q: "Can my whole class use it?", a: "Yes. Each student signs up with their own free account, and teachers can use a free teacher account to plan classes, present simulations and build question papers." },
  { q: "Is e-Lab connected to the IB?", a: "No. e-Lab is an independent educational platform and is not affiliated with or endorsed by the International Baccalaureate Organization." },
];

/** Accessible accordion: each question is a real button with aria-expanded / aria-controls; the answer is a labelled region. */
export default function FaqSection() {
  const base = useId();
  const [open, setOpen] = useState(null);
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-b border-[var(--color-line)] py-14 md:py-16">
      <Container>
        <h2 id="faq-title" className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Questions</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2 md:items-start">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            const panelId = `${base}-panel-${i}`; const btnId = `${base}-btn-${i}`;
            return (
              <div key={item.q} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
                <h3>
                  <button id={btnId} type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3.5 text-left text-[15px] font-semibold text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)]">
                    {item.q}
                    {isOpen ? <Minus size={16} aria-hidden="true" className="shrink-0 text-[var(--color-ink-faint)]" /> : <Plus size={16} aria-hidden="true" className="shrink-0 text-[var(--color-ink-faint)]" />}
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={btnId} hidden={!isOpen} className="px-4 pb-4 text-sm leading-relaxed text-[var(--color-ink-soft)]">{item.a}</div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
