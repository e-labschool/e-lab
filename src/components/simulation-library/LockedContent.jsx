import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import SimulationThumb from "./SimulationThumb.jsx";
import { lockedCopy } from "../../lib/access/accessPolicy.js";

/**
 * The "locked" screen (docs/mockups/09-locked-premium-prompt.png), shown by the simulation viewer ONLY when
 * accessPolicy.checkAccess() denies access.  While premiumEnabled is false and login is not required, checkAccess never
 * denies, so this never renders.  There is deliberately no "Notify me" box: Premium is not launched.
 * `reason` is 'login-required' | 'premium-required'.
 */
export default function LockedContent({ entry, reason, backTo, loginTo = "/auth", previews = [] }) {
  const copy = lockedCopy(reason);
  return (
    <section className="relative isolate overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]" data-locked-content data-reason={reason} aria-labelledby="locked-title">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-60 blur-xl">
        <SimulationThumb id={entry.id} src={entry.thumbnail} label={entry.label} className="!aspect-auto h-full" />
      </div>
      <div className="mx-auto my-10 flex max-w-xl flex-col items-center rounded-xl bg-[var(--color-paper-raised)] px-6 py-8 text-center shadow-lg">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF0E4] text-[#8F4A12]"><Lock size={22} aria-hidden="true" /></span>
        <h2 id="locked-title" className="mt-3 font-[var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">{copy.title}</h2>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{copy.body}</p>
        {previews.length > 0 && (
          <ul className="mt-4 grid w-full grid-cols-3 gap-2">
            {previews.slice(0, 3).map((p) => <li key={p.id}><SimulationThumb id={p.id} src={p.thumbnail} label={p.label} className="rounded-md" /></li>)}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {copy.cta && <Link to={loginTo} className="rounded-md bg-[#2647C4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3654D6]">{copy.cta}</Link>}
          <Link to={backTo} className="rounded-md border border-[var(--color-ink)]/40 bg-[var(--color-paper-raised)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)]">Back to simulations</Link>
        </div>
      </div>
    </section>
  );
}
