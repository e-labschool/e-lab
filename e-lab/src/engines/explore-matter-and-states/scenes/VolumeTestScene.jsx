import { useEffect, useState } from "react";
import { GraduatedCylinder, RulerBlock, BalloonIcon, SyringeIcon } from "../components/ApparatusIcons.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";

function RegularSolid({ example, tested }) {
  const { l, w, h, unit } = example.volume;
  return (
    <div className="flex flex-wrap items-center gap-8">
      <RulerBlock scale={tested ? 1 : 0.85} />
      <div className="flex flex-col gap-1 font-[var(--font-mono)] text-sm text-[var(--color-ink-soft)]">
        <span>l = {l} {unit}</span>
        <span>w = {w} {unit}</span>
        <span>h = {h} {unit}</span>
        {tested && <span className="text-[var(--color-ink)]">V = l &times; w &times; h = {l * w * h} {unit}&sup3;</span>}
      </div>
    </div>
  );
}

function IrregularSolid({ example, tested }) {
  const { before, after, unit } = example.volume;
  return (
    <div className="flex flex-wrap items-center gap-8">
      <GraduatedCylinder levelPercent={tested ? 68 : 46} highlight={tested} />
      <div className="flex flex-col gap-1 font-[var(--font-mono)] text-sm text-[var(--color-ink-soft)]">
        <span>Initial level: {before} {unit}</span>
        {tested && (
          <>
            <span>Final level: {after} {unit}</span>
            <span className="text-[var(--color-ink)]">{after} &minus; {before} = {after - before} {unit}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Liquid({ example, tested }) {
  const { amount, unit } = example.volume;
  return (
    <div className="flex flex-wrap items-center gap-8">
      <GraduatedCylinder levelPercent={tested ? 60 : 8} highlight={tested} />
      <div className="flex flex-col gap-1 font-[var(--font-mono)] text-sm text-[var(--color-ink-soft)]">
        {tested ? <span>Volume: {amount} {unit}</span> : <span>Pouring&hellip;</span>}
      </div>
    </div>
  );
}

function Gas({ example, tested }) {
  const { amount, unit } = example.volume;
  return (
    <div className="flex flex-wrap items-center gap-10">
      <div className="flex flex-col items-center gap-2">
        <BalloonIcon inflated={tested} />
        <span className="text-xs text-[var(--color-ink-faint)]">{tested ? "Inflated" : "Deflated"}</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <SyringeIcon fillPercent={tested ? 60 : 5} />
        {tested && <span className="font-[var(--font-mono)] text-sm text-[var(--color-ink)]">{amount} {unit}</span>}
      </div>
    </div>
  );
}

const METHOD_COMPONENT = { "regular-solid": RegularSolid, "irregular-solid": IrregularSolid, liquid: Liquid, gas: Gas };

export default function VolumeTestScene({ example, forceToken }) {
  const [tested, setTested] = useState(false);

  useEffect(() => setTested(false), [example?.id]);
  useEffect(() => {
    if (forceToken) setTested(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceToken]);

  if (!example || !example.volumeMethod) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-ink-faint)]">
        Choose a matter sample from the tray first.
      </div>
    );
  }

  const Method = METHOD_COMPONENT[example.volumeMethod];

  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow={example.label}>Does it occupy space?</SceneQuestion>

      <Method example={example} tested={tested} />

      {!tested ? (
        <button
          type="button"
          onClick={() => setTested(true)}
          className="self-start rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]"
        >
          Test volume
        </button>
      ) : (
        <ConclusionBadge tone="yes">OCCUPIES SPACE</ConclusionBadge>
      )}

      {tested && example.volumeMethod === "gas" && (
        <p className="max-w-md text-sm text-[var(--color-ink-soft)]">
          A container holding a gas is not empty \u2014 the gas itself occupies that space.
        </p>
      )}
    </div>
  );
}
