import { useEffect, useState } from "react";
import { BalanceIcon } from "../components/ApparatusIcons.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";

export default function MassTestScene({ example, forceToken }) {
  const [tested, setTested] = useState(false);

  useEffect(() => {
    setTested(false);
  }, [example?.id]);

  useEffect(() => {
    if (forceToken) setTested(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceToken]);

  if (!example || !example.mass) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-ink-faint)]">
        Choose a matter sample from the tray in the previous section first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow={example.label}>Does it have mass?</SceneQuestion>

      <div className="flex flex-wrap items-center gap-8">
        <BalanceIcon highlighted={tested} />
        <div className="flex flex-col gap-2">
          <p className="font-[var(--font-mono)] text-sm text-[var(--color-ink-soft)]">
            {tested ? example.mass.after : example.mass.before}
          </p>
          {!tested && (
            <button
              type="button"
              onClick={() => setTested(true)}
              className="self-start rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]"
            >
              Test mass
            </button>
          )}
          {tested && <ConclusionBadge tone="yes">HAS MASS</ConclusionBadge>}
        </div>
      </div>

      <p className="text-xs text-[var(--color-ink-faint)]">Values shown are illustrative, not measured data.</p>
    </div>
  );
}
