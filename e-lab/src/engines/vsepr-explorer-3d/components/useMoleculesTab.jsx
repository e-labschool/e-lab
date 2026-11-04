import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import ViewerPanel from "./ViewerPanel.jsx";
import ViewOptions from "./ViewOptions.jsx";
import StructureCard from "./StructureCard.jsx";
import { useViewState } from "./useBuilderWorkspace.jsx";
import { classify, historyReducer, createHistory, modelFromPreset } from "../model/builder.js";
import { PRESET_BY_ID, PRESET_GROUPS, searchPresets } from "../model/presets.js";
import { ED_NAMES } from "../model/geometry.js";

const MOLECULE_VIEW = { mode: "ed", showDomains: true, showLP: true, showRepulsion: false, showAngles: true };
const modelOf = (id) => historyReducer(createHistory(), { type: "load", ...modelFromPreset(PRESET_BY_ID[id]) }).present;

/** Molecules tab: searchable, grouped library (by electron-domain count / geometry), viewer, compact info panel. */
export default function useMoleculesTab({ onOpenInBuild, optionItems }) {
  const [id, setId] = useState("ch4");
  const [query, setQuery] = useState("");
  const viewState = useViewState(MOLECULE_VIEW);
  const stageRef = useRef(null);
  const model = useMemo(() => modelOf(id), [id]);
  const cls = classify(model);
  const { view, patch } = viewState;
  const hits = useMemo(() => new Set(searchPresets(query).map((p) => p.id)), [query]);
  const total = hits.size;

  const controls = (
    <div className="vx-library" data-testid="molecule-library">
      <h3 className="vx-h">Molecules</h3>
      <label className="vx-search"><Search size={14} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search molecules" aria-label="Search molecules" data-testid="molecule-search" autoComplete="off" />
      </label>
      <div className="vx-lib-scroll">
        {PRESET_GROUPS.map((g) => {
          const items = g.presets.filter((p) => hits.has(p.id)); if (!items.length) return null;
          return (
            <section key={g.id} className="vx-lib-group" aria-label={`${g.domains} electron domains, ${g.ed}`} data-testid={`group-${g.id}`}>
              <h4>{g.domains} domains <span>· {ED_NAMES[g.domains]}</span></h4>
              <ul>{items.map((p) => (
                <li key={p.id}><button type="button" className="vx-mol" aria-pressed={id === p.id} onClick={() => setId(p.id)} data-testid={`mol-${p.id}`} title={`${p.name}: ${p.axe}, ${p.mg.toLowerCase()}`}>
                  <b>{p.display}</b><small>{p.mg}</small>
                </button></li>
              ))}</ul>
            </section>
          );
        })}
        {total === 0 && <p className="vx-empty-note" data-testid="library-empty">No molecule matches “{query}”.</p>}
      </div>
    </div>
  );
  const chamber = (
    <ViewerPanel
      stageRef={stageRef} model={model} resetKey={id} view={view} setMode={(mode) => patch({ mode })} angleEntries={cls.angles?.entries ?? []}
      selectedId={null} interactive ariaLabel={`3D model of ${PRESET_BY_ID[id].name}`}
      hint="Drag an atom to disturb it, then let go. Drag empty space to rotate; scroll or pinch to zoom."
    />
  );
  const graph = (
    <div className="vx-side">
      <section className="vx-card" aria-label="View options"><h3 className="vx-h">View options</h3><ViewOptions items={optionItems(view, patch)} /></section>
      <StructureCard model={model} cls={cls} view={view} resetKey={id} />
      <button type="button" className="vx-btn vx-btn--wide" onClick={() => onOpenInBuild(id)} data-testid="open-in-build" title="Copy this molecule into the Build tab, where you can drag and change it">Open in Build tab</button>
    </div>
  );
  const p = PRESET_BY_ID[id];
  const explain = `${p.display} (${p.name}): ${p.axe}, ${p.ed.toLowerCase()} electron domains, ${p.mg.toLowerCase()} molecular geometry.`;
  return { controls, chamber, graph, explain, reset: () => { setId("ch4"); setQuery(""); viewState.reset(); }, selected: id };
}
