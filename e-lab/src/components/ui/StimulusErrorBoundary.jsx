import { Component } from "react";

/**
 * Final safety net around StimulusRenderer specifically — if a stimulus
 * sub-renderer throws for any reason not already caught by
 * StimulusRenderer's own array validation (e.g. a malformed non-array
 * element deep inside an otherwise-valid array, or any other unexpected
 * shape mismatch), this stops the crash from taking down the whole
 * Assess route. Question text, answer controls, navigation, timer, and
 * Submit all keep working — only the visual itself is affected.
 */
export default class StimulusErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.warn(`[StimulusErrorBoundary] A stimulus visual threw during render (question id: ${this.props.questionId ?? "unknown"}):`, error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-ink-faint)]">
          Visual unavailable
        </p>
      );
    }
    return this.props.children;
  }
}
