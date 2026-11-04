import { Trash2, X } from "lucide-react";
import { ELEMENTS, TOOLBOX_ATOMS } from "../model/elements.js";

/** Small floating editor for the selected bond / lone pair / central atom (change order, change element, remove). */
export default function SelectionBar({ model, selectedId, dispatch, onClose, onClearAll }) {
  if (!selectedId) return null;
  const isCentral = selectedId === "central";
  const dom = isCentral ? null : model.domains.find((d) => d.id === selectedId);
  if (!isCentral && !dom) return null;
  const elementSelect = (value, onChange, label) => (
    <label className="vx-sel"><span className="vx-sr">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label} data-testid="sel-element">
        {value == null && <option value="" disabled>Atom…</option>}
        {TOOLBOX_ATOMS.map((s) => <option key={s} value={s}>{s} · {ELEMENTS[s].name}</option>)}
      </select>
    </label>
  );
  return (
    <div className="vx-selbar" role="group" aria-label="Selected item" data-testid="selection-bar">
      {isCentral && (<><b>Central atom</b>{elementSelect(model.central, (s) => dispatch({ type: "setCentral", symbol: s }), "Central atom element")}
        <button type="button" className="vx-sb-btn is-danger" onClick={onClearAll} data-testid="sel-remove" title="Remove the central atom (clears the workspace; you can undo)"><Trash2 size={13} aria-hidden="true" /> Clear all</button></>)}
      {dom?.kind === "bond" && (<>
        <b>Bond</b>
        <span className="vx-orders" role="radiogroup" aria-label="Bond order">
          {[1, 2, 3].map((o) => <button key={o} type="button" role="radio" aria-checked={dom.order === o} className="vx-sb-btn" onClick={() => dispatch({ type: "setOrder", id: dom.id, order: o })} title={["Single", "Double", "Triple"][o - 1] + " bond (still one electron domain)"} data-testid={`sel-order-${o}`}>{o === 1 ? "—" : o === 2 ? "=" : "≡"}</button>)}
        </span>
        {elementSelect(dom.symbol, (s) => dispatch({ type: "setSymbol", id: dom.id, symbol: s }), "Surrounding atom element")}
        <button type="button" className="vx-sb-btn is-danger" onClick={() => dispatch({ type: "remove", id: dom.id })} data-testid="sel-remove" title="Remove this bond and its atom"><Trash2 size={13} aria-hidden="true" /> Remove</button>
      </>)}
      {dom?.kind === "lp" && (<><b>Lone pair</b><button type="button" className="vx-sb-btn is-danger" onClick={() => dispatch({ type: "remove", id: dom.id })} data-testid="sel-remove" title="Remove this lone pair"><Trash2 size={13} aria-hidden="true" /> Remove</button></>)}
      <button type="button" className="vx-sb-btn vx-sb-close" onClick={onClose} aria-label="Close" title="Deselect (Esc)" data-testid="sel-close"><X size={14} aria-hidden="true" /></button>
    </div>
  );
}
