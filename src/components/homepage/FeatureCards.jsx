import { useState } from "react";
import { BookOpen, FlaskConical, PenLine, TrendingUp } from "lucide-react";
import Container from "../ui/Container.jsx";

// Real screenshots of the real app (public/landing/*.webp, produced by scripts/capture-sim-thumbs.mjs --app-shots, and
// the simulation thumbnails) -- never mock-ups.  Learn has no screenshot yet: lesson content lives in the production
// database, so the card shows an icon panel until a real lesson capture is added (LEARN_PATH in that script).
// If a file is missing the card also falls back to the icon panel instead of a broken image.
const CARDS = [
  { id: "learn", icon: BookOpen, title: "Learn", text: "Topic-by-topic lessons with visuals and built-in simulations.", shot: null, alt: "" },
  { id: "simulate", icon: FlaskConical, title: "Simulate", text: "Move, rotate and change variables to see what happens.", shot: "/sim-thumbs/vsepr-explorer-3d.webp", alt: "The VSEPR Explorer simulation showing a 3D molecule" },
  { id: "assess", icon: PenLine, title: "Assess", text: "Focused challenges with an on-screen assessment experience.", shot: "/landing/assess.webp", alt: "The Assess area with a Take a Challenge button, shown for a new account" },
  { id: "progress", icon: TrendingUp, title: "Track progress", text: "See your strengths and the topics to revisit next.", shot: "/landing/progress.webp", alt: "The Progress page, shown for a new account with no activity yet" },
];

function Shot({ card }) {
  const [failed, setFailed] = useState(false);
  const Icon = card.icon;
  if (failed || !card.shot) return <div className="flex aspect-[16/10] items-center justify-center bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" aria-hidden="true"><Icon size={34} /></div>;
  return <img src={card.shot} alt={card.alt} width={800} height={500} loading="lazy" decoding="async" onError={() => setFailed(true)} className="aspect-[16/10] w-full object-cover object-top" />;
}

export default function FeatureCards() {
  return (
    <section id="learn" aria-labelledby="features-title" className="scroll-mt-20 border-b border-[var(--color-line)] py-14 md:py-16">
      <Container>
        <h2 id="features-title" className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Everything for IB Chemistry, in one place</h2>
        <p className="mt-2 text-[15px] text-[var(--color-ink-soft)]">Learn a concept, play with it, test yourself and watch your progress grow.</p>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c) => (
            <li key={c.id} className="min-w-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
              <div className="border-b border-[var(--color-line)]"><Shot card={c} /></div>
              <div className="p-4">
                <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">{c.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
