import { Component } from "react";

/** Catches a crash while loading / running one simulation so the surrounding page keeps working.
 *  `fallback` (node or (error) => node) is what is shown instead.  Resets when `resetKey` changes. */
export default class SimulationErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  componentDidCatch(error) { if (typeof console !== "undefined") console.warn("[e-Lab] simulation failed to load:", error?.message || error); }
  render() {
    if (!this.state.error) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === "function" ? fallback(this.state.error) : (fallback ?? (
      <p role="alert" className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">This simulation could not be loaded. Please refresh the page and try again.</p>
    ));
  }
}
