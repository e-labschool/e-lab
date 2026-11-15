import { useAccessConfig } from "../../lib/access/AccessConfigContext.jsx";
import { hasPremiumEntitlement, showPremiumUi } from "../../lib/access/accessPolicy.js";

/**
 * "Your plan" card for the profile pages.  Renders NOTHING unless accessPolicy.showPremiumUi(config) -- i.e. it is
 * invisible while everything is free.  The plan shown comes from `entitlement` (server-side data, when that exists);
 * a teacher role never implies Premium.  Display only: no upgrade or payment action exists yet.
 */
export default function PlanCard({ role, entitlement = null }) {
  const { config } = useAccessConfig();
  if (!showPremiumUi(config)) return null;
  const premium = hasPremiumEntitlement(entitlement);
  return (
    <section aria-labelledby="plan-card-title" data-plan-card className="mt-6 max-w-lg rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
      <h2 id="plan-card-title" className="text-sm font-semibold text-[var(--color-ink)]">Your plan</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        {premium ? "Premium: you can open Free and Premium content." : "Free: you can open everything marked Free."}
      </p>
      {role === "teacher" && !premium && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">A teacher account does not include Premium content by itself.</p>}
    </section>
  );
}
