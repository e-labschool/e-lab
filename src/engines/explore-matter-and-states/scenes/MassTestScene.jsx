import { useEffect, useState } from "react";
import { BalanceIcon } from "../components/ApparatusIcons.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import NeedSample from "../components/NeedSample.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";

export default function MassTestScene({ example, forceToken, onChooseSample, onRandomSample }) {
  const [tested, setTested] = useState(false);

  useEffect(() => {
    setTested(false);
  }, [example?.id]);

  useEffect(() => {
    if (forceToken) setTested(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceToken]);

  if (!example || !example.mass) {
    return <NeedSample example={example} what="mass" onChooseSample={onChooseSample} onRandomSample={onRandomSample} />;
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

      <p className="text-xs text-[var(--color-ink-faint)]">Values are calculated from typical densities (m = \u03c1 \u00d7 V at about 25 \u00b0C) and rounded; they are not measurements. Gases have a very small mass, so a sensitive balance is needed.</p>
    </div>
  );
}
