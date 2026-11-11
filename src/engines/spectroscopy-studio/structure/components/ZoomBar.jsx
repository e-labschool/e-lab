import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

/** Zoom in / out / reset (+ pan when zoomed) for a spectrum. `extra` is rendered after the zoom buttons (view-specific toggles). */
export default function ZoomBar({ zoomed, canIn = true, canOut = true, onIn, onOut, onReset, onPan, extra, label = "Spectrum controls" }) {
  return (
    <div className="st-toolbar" role="group" aria-label={label} data-testid="zoom-bar">
      <div className="st-btnrow">
        <button type="button" className="sim-btn st-tbtn" onClick={onIn} disabled={!canIn} aria-label="Zoom in" title="Zoom in" data-testid="zoom-in"><ZoomIn size={15} aria-hidden="true" /> <span>Zoom in</span></button>
        <button type="button" className="sim-btn st-tbtn" onClick={onOut} disabled={!canOut} aria-label="Zoom out" title="Zoom out" data-testid="zoom-out"><ZoomOut size={15} aria-hidden="true" /> <span>Zoom out</span></button>
        <button type="button" className="sim-btn st-tbtn" onClick={onReset} disabled={!zoomed} aria-label="Reset zoom" title="Reset zoom to the full spectrum" data-testid="zoom-reset"><RotateCcw size={15} aria-hidden="true" /> <span>Reset zoom</span></button>
        {zoomed && (
          <>
            <button type="button" className="sim-btn st-tbtn st-tbtn--icon" onClick={() => onPan(-0.25)} aria-label="Pan left" title="Pan left" data-testid="pan-left"><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" className="sim-btn st-tbtn st-tbtn--icon" onClick={() => onPan(0.25)} aria-label="Pan right" title="Pan right" data-testid="pan-right"><ChevronRight size={16} aria-hidden="true" /></button>
          </>
        )}
      </div>
      {extra}
    </div>
  );
}
