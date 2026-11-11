import { PROMPTS } from "../model/evaluate.js";

/** Optional guided questions. The guidance is a way of thinking, never the answer; it is revealed on request and the choice is remembered. */
export default function Prompts({ tech, store, work, open }) {
  const list = PROMPTS[tech]; const shown = work[tech].shown;
  return (
    <details className="st-prompts" open={open} data-testid="prompts">
      <summary>Optional prompts</summary>
      {list.map((p, i) => {
        const key = `p${i}`; const on = shown.includes(key);
        return (
          <div key={key} className="st-prompt" data-testid={`prompt-${i}`}>
            <p className="ss-prompt">{p.q}</p>
            <button type="button" className="sim-btn st-tbtn" onClick={() => (on ? store.hide(tech, key) : store.reveal(tech, key))} aria-expanded={on} data-testid={`prompt-${i}-toggle`}>{on ? "Hide guidance" : "Think about it"}</button>
            {on && <p className="st-guidance" data-testid={`prompt-${i}-text`}>{p.a}</p>}
          </div>
        );
      })}
    </details>
  );
}
