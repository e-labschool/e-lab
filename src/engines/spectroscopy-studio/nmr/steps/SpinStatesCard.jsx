import { useMemo } from "react";
import { groupSpinStates, comboAria, comboLabel } from "../molecular/model/spinStates.js";
import { MULT_NAMES, neighbourSpins } from "../molecular/model/spectrum.js";

/**
 * Optional "why does it split?" card: the real counting of the spin states (alpha = up, beta = down) of the neighbouring hydrogens, grouped by the
 * line they produce. n = 1, 2, 3 give 1:1, 1:2:1, 1:3:3:1; the combinations are enumerated (2^n), not typed in. Up to three neighbours show
 * every combination as glyphs; more show the counts only.
 */
export default function SpinStatesCard({ molecule, envId }) {
  const env = molecule.environments.find((e) => e.id === envId);
  const spins = useMemo(() => (envId ? neighbourSpins(molecule, envId) : []), [molecule, envId]);
  const groups = useMemo(() => groupSpinStates(spins), [spins]);
  if (!env) return <p className="ss-note" data-testid="spin-states">Select a signal to see the spin states of its neighbours.</p>;
  if (env.exchangeable) return <p className="ss-note" data-testid="spin-states">{env.label}: the O–H hydrogen exchanges rapidly, so it does not split its neighbours and they do not split it.</p>;
  const n = spins.length;
  if (n === 0) return <p className="ss-note" data-testid="spin-states" data-n="0">{env.label} has no neighbouring hydrogens on adjacent atoms, so there is only one combination (nothing to count): a singlet.</p>;
  const total = groups.reduce((s, g) => s + g.count, 0);
  const ratio = groups.map((g) => g.count).join(" : ");
  const equal = spins.every((s) => s.J === spins[0].J);
  const glyphs = n <= 3;
  return (
    <figure className="ss-spinstates" data-testid="spin-states" data-n={n} data-ratio={ratio} aria-label={`Spin states of the ${n} neighbouring hydrogen${n > 1 ? "s" : ""}: ${total} combinations in ${groups.length} groups with ratio ${ratio}`}>
      <figcaption>
        <b>{n} neighbouring H</b>, each α (↑) or β (↓): 2<sup>{n}</sup> = {total} equally likely combinations. Each group gives one line.
      </figcaption>
      <div className="ss-ss-cols">
        {groups.map((g, i) => (
          <div key={i} className="ss-ss-col" data-testid={`spin-col-${i}`} data-count={g.count}>
            <div className="ss-ss-combos">
              {glyphs ? g.combos.map((c, k) => <span key={k} className="ss-ss-combo" role="img" aria-label={comboAria(c)}>{comboLabel(c)}</span>) : <span className="ss-ss-combo" aria-hidden="true">{g.nAlpha != null ? `${g.nAlpha}↑ ${n - g.nAlpha}↓` : "mixed"}</span>}
            </div>
            <div className="ss-ss-bar" style={{ height: `${6 + (g.count / Math.max(...groups.map((x) => x.count))) * 22}px` }} aria-hidden="true" />
            <div className="ss-ss-count">{g.count}</div>
          </div>
        ))}
      </div>
      <p className="ss-note" data-testid="spin-ratio">Counting gives the line intensities <b>{ratio}</b>{equal ? ` (${MULT_NAMES[n] ?? "multiplet"}, Pascal's triangle)` : " (different J values: not the simple n + 1 pattern)"}.</p>
    </figure>
  );
}
