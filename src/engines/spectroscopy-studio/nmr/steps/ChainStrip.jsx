import { CHAIN, chainState } from "./chain.js";

/** Compact inline chain: Applied field → Energy splitting → Matching RF energy → Resonance → Absorption, with the current link highlighted. */
export default function ChainStrip({ region }) {
  return (
    <ol className="ss-chain" aria-label="Cause and effect: applied field, energy splitting, matching RF energy, resonance, absorption" data-testid="chain" data-region={region}>
      {CHAIN.map((l, i) => {
        const st = chainState(region, i);
        return (
          <li key={l.id} className={`ss-chain-link is-${st}${st === "current" && region === "near" ? " is-partial" : ""}`} data-link={l.id} data-state={st} aria-current={st === "current" ? "step" : undefined} data-testid={`chain-${l.id}`}>
            <span className="ss-chain-mark" aria-hidden="true">{st === "done" ? "✓" : i + 1}</span>
            <span>{l.label}</span>
            {i < CHAIN.length - 1 && <span className="ss-chain-arrow" aria-hidden="true">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
