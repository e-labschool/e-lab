import { useId, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Download, ImageDown, Plus, Trash2, X } from "lucide-react";
import ReadingPlot, { PLOT_H, PLOT_W } from "./ReadingPlot.jsx";
import { REASON_TEXT, buildPlot, fileStem, headerOf, shown, toCSV } from "./readingsModel.js";
import { downloadBlob, downloadCSV, svgMarkupToPngBlob } from "./readingsExport.js";
import "./readings.css";

/**
 * Shared "Readings" panel: record the simulation's current values into a table, plot the student's OWN points, delete or
 * clear rows, export CSV and PNG. Reusable by any simulation; it owns no physics.
 *
 * props
 *   columns     [{ key, label, unit, decimals, symbol? }]   every column is stored and shown (derived columns included)
 *   rows        [{ id, values }]                              from readingsModel (the engine owns the state)
 *   onRecord()  -> { ok, reason }                             engine reads its live state and calls addReading
 *   onDelete(id), onClear()
 *   axes        { x, y }                                      default plotted columns; the student can change them
 *   plotColumns optional subset of column keys offered for the axes (default: all)
 *   theory      (xKey, yKey) => [{x,y}] | null                optional model line; only offered when it returns points
 *   fitFor      (xKey, yKey) => boolean                       optional: offer a best-fit line for these axes (default true)
 *   includeOrigin (xKey, yKey) => boolean                     optional: force the origin into the axes
 *   title, meta[], fileStem                                   used in the plot title and CSV header lines
 */
export default function ReadingsPanel({
  columns, rows, onRecord, onDelete, onClear, axes, plotColumns, theory, fitFor, includeOrigin, title = "Readings", meta = [], stem = "readings", recordHint,
}) {
  const uid = useId();
  const keys = plotColumns ?? columns.map((c) => c.key);
  const [xKey, setXKey] = useState(axes?.x ?? keys[0]);
  const [yKey, setYKey] = useState(axes?.y ?? keys[1] ?? keys[0]);
  const [showTheory, setShowTheory] = useState(false);
  const [showFit, setShowFit] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  // follow the engine's suggested axes when it changes them (for example a new graph is chosen)
  const [lastAxes, setLastAxes] = useState(axes);
  if (axes && (axes.x !== lastAxes?.x || axes.y !== lastAxes?.y)) { setLastAxes(axes); setXKey(axes.x); setYKey(axes.y); }

  const col = (k) => columns.find((c) => c.key === k) ?? columns[0];
  const xCol = col(xKey); const yCol = col(yKey);
  const theoryPts = theory ? theory(xKey, yKey) : null;
  const canFit = fitFor ? fitFor(xKey, yKey) : true;
  const plot = useMemo(() => buildPlot(rows, xKey, yKey, { theory: showTheory ? theoryPts : null, includeOrigin: includeOrigin ? includeOrigin(xKey, yKey) : false, fit: showFit && canFit, columns }), [rows, xKey, yKey, showTheory, theoryPts, showFit, canFit, includeOrigin, columns]);
  const xLabel = headerOf(xCol); const yLabel = headerOf(yCol);
  const plotTitle = `${yCol.label} against ${xCol.label}`;
  const summary = `${plotTitle}: ${rows.length} recorded ${rows.length === 1 ? "reading" : "readings"}.${plot.fit && showFit ? ` Best-fit gradient ${Number(plot.fit.slope.toPrecision(4))}, intercept ${Number(plot.fit.intercept.toPrecision(3))}.` : ""}`;

  const record = () => { const r = onRecord?.(); if (r && !r.ok) setMsg(REASON_TEXT[r.reason] ?? "Not recorded."); else setMsg(`Reading ${rows.length + 1} recorded.`); };
  const exportCSV = () => downloadCSV(toCSV(columns, rows, [title, ...meta, `Exported ${new Date().toISOString().slice(0, 10)}`]), `${fileStem(stem, "readings")}.csv`);
  const exportPNG = async () => {
    try {
      const markup = renderToStaticMarkup(<ReadingPlot plot={plot} xLabel={xLabel} yLabel={yLabel} title={`${title}: ${plotTitle}`} showTheory={showTheory} showFit={showFit && canFit} width={PLOT_W} height={PLOT_H} exporting ariaLabel={summary} />);
      const blob = await svgMarkupToPngBlob(markup, PLOT_W, PLOT_H, { scale: 3 });
      downloadBlob(blob, `${fileStem(stem, yKey, "vs", xKey)}.png`);
      setMsg("Graph saved as a PNG (transparent background).");
    } catch { setMsg("The graph could not be exported in this browser."); }
  };
  const doClear = () => { if (rows.length > 2 && !confirmClear) { setConfirmClear(true); setMsg(`Press "Confirm clear" to delete all ${rows.length} readings.`); return; } setConfirmClear(false); onClear?.(); setMsg("All readings cleared."); };

  return (
    <div className="rd-root" data-testid="readings-panel" data-count={rows.length}>
      <div className="rd-bar">
        <button type="button" className="sd-btn sd-btn--primary sd-btn--sm" onClick={record} data-testid="record-reading" title={recordHint ?? "Add the current values to the table"}>
          <Plus size={13} aria-hidden="true" /> Record reading
        </button>
        <button type="button" className="sd-btn sd-btn--sm" onClick={exportCSV} disabled={!rows.length} data-testid="export-csv" title="Download the table as a CSV file (opens in Excel, Sheets)">
          <Download size={13} aria-hidden="true" /> CSV
        </button>
        <button type="button" className="sd-btn sd-btn--sm" onClick={exportPNG} disabled={!rows.length} data-testid="export-png" title="Download the graph as a PNG image">
          <ImageDown size={13} aria-hidden="true" /> PNG
        </button>
        <button type="button" className="sd-btn sd-btn--sm" onClick={doClear} onBlur={() => setConfirmClear(false)} disabled={!rows.length} data-testid="clear-readings" title="Delete every reading">
          <Trash2 size={13} aria-hidden="true" /> {confirmClear ? "Confirm clear" : "Clear"}
        </button>
        <span className="rd-count" data-testid="reading-count">{rows.length} reading{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div className="rd-axes">
        <label htmlFor={`${uid}-y`}>y-axis</label>
        <select id={`${uid}-y`} className="rd-select" value={yKey} onChange={(e) => setYKey(e.target.value)} data-testid="axis-y">
          {keys.map((k) => <option key={k} value={k}>{headerOf(col(k))}</option>)}
        </select>
        <label htmlFor={`${uid}-x`}>x-axis</label>
        <select id={`${uid}-x`} className="rd-select" value={xKey} onChange={(e) => setXKey(e.target.value)} data-testid="axis-x">
          {keys.map((k) => <option key={k} value={k}>{headerOf(col(k))}</option>)}
        </select>
        {theoryPts && (
          <label className="rd-check"><input type="checkbox" checked={showTheory} onChange={(e) => setShowTheory(e.target.checked)} data-testid="show-theory" /> Show theory</label>
        )}
        {canFit && (
          <label className="rd-check"><input type="checkbox" checked={showFit} onChange={(e) => setShowFit(e.target.checked)} data-testid="show-fit" /> Best-fit line</label>
        )}
      </div>

      <div className="rd-plot">
        <ReadingPlot plot={plot} xLabel={xLabel} yLabel={yLabel} showTheory={showTheory} showFit={showFit && canFit} ariaLabel={summary} />
        {showFit && canFit && (plot.fit
          ? <p className="rd-fit" data-testid="fit-text">Best fit: gradient {Number(plot.fit.slope.toPrecision(4))}, intercept {Number(plot.fit.intercept.toPrecision(3))}, R&sup2; = {plot.fit.r2.toFixed(4)}</p>
          : <p className="rd-fit" data-testid="fit-text">Record at least 2 different points to draw a best-fit line.</p>)}
      </div>

      <div className="rd-tablewrap" tabIndex={0} role="region" aria-label={`${title} table`}>
        <table className="rd-table" data-testid="readings-table">
          <caption className="rd-sr">{title}: one row per recorded reading</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              {columns.map((c) => <th scope="col" key={c.key}>{c.symbol ?? c.label}{c.unit ? <small> ({c.unit})</small> : null}</th>)}
              <th scope="col"><span className="rd-sr">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length + 2} className="rd-empty">No readings yet. Set up the gas, then press Record reading.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id} data-testid="reading-row">
                <th scope="row">{i + 1}</th>
                {columns.map((c) => <td key={c.key}>{Number.isFinite(r.values[c.key]) ? shown(c, r.values[c.key]).toFixed(c.decimals ?? 3).replace("-", "−") : "–"}</td>)}
                <td>
                  <button type="button" className="rd-del" onClick={() => { onDelete?.(r.id); setMsg(`Reading ${i + 1} deleted.`); }} aria-label={`Delete reading ${i + 1}`} data-testid="delete-reading"><X size={13} aria-hidden="true" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rd-live" role="status" aria-live="polite" data-testid="readings-status">{msg}</p>
    </div>
  );
}
