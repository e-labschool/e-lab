import Container from "../components/ui/Container.jsx";
import Button from "../components/ui/Button.jsx";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-start gap-4 py-24">
      <h1 className="font-[var(--font-display)] text-3xl font-semibold text-[var(--color-ink)]">
        Page not found
      </h1>
      <p className="text-[var(--color-ink-soft)]">This page doesn't exist, or hasn't been built yet.</p>
      <Button to="/">Back to home</Button>
    </Container>
  );
}
