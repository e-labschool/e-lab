import Container from "../components/ui/Container.jsx";
import CurriculumPicker from "../components/curriculum/CurriculumPicker.jsx";

export default function Explore() {
  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
          Explore
        </h1>
        <p className="mt-3 text-base text-[var(--color-ink-soft)]">
          Choose a curriculum to see how e-Lab's chemistry concepts are organized for it.
          The concepts themselves stay the same across every curriculum — only the map
          changes.
        </p>
      </div>

      <div className="mt-10">
        <CurriculumPicker />
      </div>
    </Container>
  );
}
