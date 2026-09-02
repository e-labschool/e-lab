import { useEffect, useState } from "react";
import { Crosshair, Eye } from "lucide-react";
import ParticleField from "../components/ParticleField.jsx";
import RevealChip from "../components/RevealChip.jsx";
import ConclusionBadge from "../components/ConclusionBadge.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";
import { STATE_PARTICLE } from "../data/stateContent.js";
import { substancesForState } from "../data/substances.js";

export default function StateParticleScene({ state, forceToken }) {
  const content = STATE_PARTICLE[state];
  const substances = substancesForState(state);
  const [substanceId, setSubstanceId] = useState(substances[0].id);
  const [trackOn, setTrackOn] = useState(false);
  const [trailOn, setTrailOn] = useState(false);
  const [speedVariationOn, setSpeedVariationOn] = useState(false);

  useEffect(() => {
    setSubstanceId(substances[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const substance = substances.find((s) => s.id === substanceId);

  return (
    <div className="flex flex-col gap-6">
      <SceneQuestion eyebrow={`${content.label} \u00b7 particle view`}>What do you notice about how the particles behave?</SceneQuestion>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          <ParticleField
            mode={state}
            trackParticle={trackOn}
            showTrail={trailOn}
            highlightSpeedVariation={state === "gas" && speedVariationOn}
          />
          {substance.unit !== "particle" && (
            <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
              Model representation &middot; each particle represents {substance.unit === "ionic-lattice" ? `one ${substance.formula} ion pair, arranged as an ionic lattice` : substance.unit === "metallic" ? "a metal cation in a delocalized electron sea" : substance.unit === "diatomic" ? `one ${substance.formula} molecule` : substance.unit === "linear-triatomic" ? `one ${substance.formula} molecule` : `one ${substance.formula} unit`}.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Substance</label>
            <select
              value={substanceId}
              onChange={(e) => setSubstanceId(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-[var(--color-line)] bg-transparent px-2.5 py-1.5 text-sm text-[var(--color-ink)]"
            >
              {substances.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setTrackOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${trackOn ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
          >
            <Crosshair size={14} /> Track particle
          </button>
          {trackOn && (
            <button
              type="button"
              onClick={() => setTrailOn((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${trailOn ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
            >
              <Eye size={14} /> Show trail
            </button>
          )}
          {state === "gas" && (
            <button
              type="button"
              onClick={() => setSpeedVariationOn((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${speedVariationOn ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
            >
              Show speed variation
            </button>
          )}
          {trackOn && <p className="text-xs text-[var(--color-ink-faint)]">Click a particle in the simulation to track it.</p>}
          {speedVariationOn && (
            <p className="text-xs text-[var(--color-ink-faint)]">
              <span className="text-[var(--color-indigo)]">slower</span> &middot; <span className="text-[var(--color-teal)]">medium</span> &middot; <span className="text-[var(--color-amber)]">faster</span> &mdash; gas particles have a distribution of speeds.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {content.reveals.map((r) => (
          <RevealChip key={r.label} label={r.label} forceToken={forceToken}>
            <ConclusionBadge tone="yes">{r.text}</ConclusionBadge>
          </RevealChip>
        ))}
      </div>

      {content.note && (
        <RevealChip label="Reveal note on intermolecular forces" forceToken={forceToken}>
          <p className="max-w-xl text-sm text-[var(--color-ink-soft)]">{content.note}</p>
        </RevealChip>
      )}

      <div className="border-t border-[var(--color-line)] pt-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Macro &harr; particle connection</p>
        <div className="flex flex-col gap-2">
          {content.connections.map((c) => (
            <div key={c.cause} className="flex items-center gap-3 text-sm">
              <span className="text-[var(--color-ink-soft)]">{c.cause}</span>
              <span className="text-[var(--color-ink-faint)]">&rarr;</span>
              <span className="font-medium text-[var(--color-ink)]">{c.effect}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
