import { Children, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { BarChart3, Info, Lock, Maximize2, Minus, Plus, RotateCcw, Settings } from "lucide-react";
import { useSimulationPresentation } from "../interactive-shell/SimulationPresentation.js";
import { useFullscreen } from "../interactive-shell/useFullscreen.js";
import SimulationActions from "../interactive-shell/SimulationActions.jsx";
import { classifyDashboard } from "./dashboardLayout.js";
import "./SimulationDashboard.css";

// SIMULATION DASHBOARD LAYOUT -- the shared compact landscape layout every
// e-Lab simulation should use. See docs/SIMULATION_DASHBOARD_LAYOUT.md.
//
//   header   Title | Mode selector | Show Graph | Reset | Settings (+ frame actions)
//   main     Compact controls | Large experiment visual | Optional graph (animated column)
//   bottom   Live-value strip + Predict button | one-line explanation (+ info)
//
// The layout is driven by the dashboard's OWN measured box (ResizeObserver),
// never by window width, so it behaves identically inside the narrow Learn
// column, in real fullscreen and on the /simulation/:id route.

function useBoxClass(ref) {
  const [cls, setCls] = useState(() => classifyDashboard(1000, 700));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = classifyDashboard(r.width, r.height);
      setCls((c) => (c.layout === next.layout && c.header === next.header && c.w === next.w && c.density === next.density && c.scale === next.scale ? c : next));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return cls;
}

/**
 * The dashboard shell.
 *  props: title, subtitle(+Long), tabs (mode selector node), onReset, graphShown / onGraphToggle
 *         (header Show/Hide Graph button), settings (node shown in the header Settings popover;
 *         settingsOpen / onSettingsOpenChange optional), controls, chamber, graph, live (LiveStrip),
 *         predict (PredictPopover), explain (ExplainLine), role/ariaLabel/testId/id for the root.
 */
export default function SimulationDashboard({
  title, subtitle, subtitleLong, tabs, onReset, headerExtra,
  graphShown = false, graphWide = false, onGraphToggle, graphId = "sd-graph",
  settings, settingsLabel = "Settings", onSettingsOpenChange,
  controls, chamber, graph, live, predict, explain,
  role, ariaLabel, testId = "workspace", id,
}) {
  const rootRef = useRef(null);
  const { isViewport, frameRef, simulationId } = useSimulationPresentation();
  const { layout, header, w, density, scale } = useBoxClass(rootRef);
  const fallbackRef = useRef(null);
  const target = frameRef ?? fallbackRef;
  const { isSupported, toggle } = useFullscreen(target);
  const wide = layout === "wide";

  return (
    <div
      ref={rootRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      className="sd-root"
      data-testid={testId}
      data-layout={layout}
      data-header={header}
      data-w={w}
      data-density={density}
      data-graph={graphShown ? "shown" : "hidden"}
      style={{ "--sd-s": scale }}
      data-viewport={isViewport ? "true" : "false"}
      data-embedded={isViewport ? "false" : "true"}
    >
      <div className="sd-header" data-testid="sd-header">
        <div className="sd-title-block">
          <h2 className="sd-title">{title}</h2>
          {subtitle && (
            <p className="sd-subtitle" title={subtitleLong ?? subtitle} data-testid="sd-subtitle">
              <span className={subtitleLong ? "sd-only-one" : undefined}>{subtitle}</span>
              {subtitleLong && <span className="sd-only-two">{subtitleLong}</span>}
            </p>
          )}
        </div>
        {tabs && <div className="sd-header-tabs">{tabs}</div>}
        <div className="sd-header-actions">
          {headerExtra}
          {onGraphToggle && (
            <button
              type="button" className="sd-btn sd-btn--toggle" onClick={onGraphToggle}
              aria-pressed={graphShown} aria-controls={graphId} data-testid="graph-toggle"
              title={graphShown ? "Hide the graph" : "Show the graph beside the experiment"}
            >
              <BarChart3 size={14} aria-hidden="true" /> {graphShown ? "Hide Graph" : "Show Graph"}
            </button>
          )}
          {onReset && (
            <button type="button" className="sd-btn" onClick={onReset} data-testid="reset" aria-label="Reset the simulation to the default conditions" title="Reset to the default conditions">
              <RotateCcw size={14} aria-hidden="true" /> Reset
            </button>
          )}
          {settings && (
            <HeaderPopover
              label={settingsLabel} icon={<Settings size={14} aria-hidden="true" />} testId="settings" panelTestId="settings-panel"
              onOpenChange={onSettingsOpenChange} width={340}
            >
              {settings}
            </HeaderPopover>
          )}
          <SimulationActions targetRef={target} simulationId={simulationId} iconOnly={w !== "xl"} />
        </div>
      </div>

      {!wide && !isViewport && isSupported && (
        <div className="sd-expand-hint" data-testid="expand-hint">
          <span>This area is narrow, so the dashboard is stacked. Expand for the full side-by-side view.</span>
          <button type="button" className="sd-btn sd-btn--sm" onClick={toggle}>
            <Maximize2 size={13} aria-hidden="true" /> Expand
          </button>
        </div>
      )}

      <div className="sd-main" data-testid="sd-main" data-graph={graphShown ? "shown" : "hidden"} data-graph-wide={graphWide ? "true" : "false"}>
        <div className="sd-col sd-col--controls" data-testid="col-controls">{controls}</div>
        <div className="sd-col sd-col--chamber" data-testid="col-chamber">{chamber}</div>
        <div className="sd-col sd-col--graph" id={graphId} data-testid="col-graph" aria-hidden={graphShown ? undefined : "true"} inert={graphShown ? undefined : true}>
          {graphShown && graph}
        </div>
      </div>

      <div className="sd-bottom" data-testid="sd-bottom">
        <div className="sd-bottom-row">
          {live}
          {predict}
        </div>
        {explain}
      </div>
    </div>
  );
}

/* ---- Building blocks ------------------------------------------------------ */

/** A card. `grow` = fills the remaining column height, `fixed` = natural height. */
export function DashPanel({ title, icon, aside, children, className = "", grow = false, fixed = false, tint = false, style, bodyClassName = "", ariaLabel, testId, noBody = false, ...rest }) {
  return (
    <section
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
      data-testid={testId}
      style={style}
      className={`sd-panel ${grow ? "sd-panel--grow" : ""} ${fixed ? "sd-panel--fixed" : ""} ${tint ? "sd-panel--tint" : ""} ${className}`}
      {...rest}
    >
      {(title || aside) && (
        <div className="sd-panel-head">
          {title && <h3 className="sd-panel-title">{icon}{title}</h3>}
          {aside}
        </div>
      )}
      {noBody ? children : <div className={`sd-panel-body ${bodyClassName}`}>{children}</div>}
    </section>
  );
}

/** One legend line for the Controls column, e.g. [lock "Kept constant", swatch "You change", swatch "Calculated"]. */
export function ControlLegend({ items }) {
  return (
    <div className="sd-legend" data-testid="control-legend">
      {items.map((it) => (
        <span key={it.text} className={"sd-legend-item" + (it.strong ? " sd-legend-item--strong" : "")}>
          {it.lock && <Lock size={12} aria-hidden="true" />}
          {it.color && <span className="sd-swatch" style={{ background: it.color }} aria-hidden="true" />}
          {it.text}
        </span>
      ))}
    </div>
  );
}

/**
 * Compact slider row (~50 px): name+symbol, lock icon, optional extra control and coloured value badge
 * on the first line; min label, slider, max label on the second. tone: "active" (you change it) |
 * "edit" (initial-condition editing) | "locked".
 */
export function SliderRow({
  id, label, symbol, value, min, max, step, onChange, tone = "active", color, badgeBg, badgeText,
  minText, maxText, valueText, labelExtra, slideStart, slideEnd, note, noteTone, lockTitle = "Kept constant", testId, rowTestId, describedBy,
}) {
  const disabled = tone === "locked";
  const clamped = Math.min(max, Math.max(min, value));
  const fill = ((clamped - min) / (max - min)) * 100;
  return (
    <div className={`sd-row sd-row--${tone}${labelExtra ? " sd-row--extra" : ""}`} style={{ "--sd-color": color }} data-role={tone} data-testid={rowTestId}>
      <div className="sd-row-top">
        <label htmlFor={id} className="sd-row-label" id={`${id}-label`}>
          {label}{symbol && <small>({symbol})</small>}
          {disabled && <Lock size={13} aria-label={lockTitle} role="img" />}
        </label>
        <span className="sd-row-spacer" />
        {labelExtra}
        <span className="sd-badge" style={{ background: badgeBg }} aria-hidden="true" data-testid={testId ? `chip-${testId}` : undefined}>{badgeText}</span>
      </div>
      <div className="sd-row-slider">
        {slideStart}
        <span className="sd-end sd-end--min" aria-hidden="true">{minText}</span>
        <input
          id={id}
          type="range"
          className="sd-range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-valuetext={valueText}
          onChange={(e) => onChange?.(Number(e.target.value))}
          style={{ "--sd-color": color, "--sd-fill": `${fill}%` }}
          data-testid={testId ? `slider-${testId}` : undefined}
        />
        <span className="sd-end sd-end--max" aria-hidden="true">{maxText}</span>
        {slideEnd}
      </div>
      {note && <p className={"sd-note " + (noteTone === "info" ? "sd-note--info" : "")} data-testid={testId ? `limit-${testId}` : undefined}>{note}</p>}
    </div>
  );
}

/** One round fine-adjust button (+ / -) for the ends of a slider (SliderRow slideStart / slideEnd). */
export function StepButton({ dir, onClick, label, testId }) {
  const Icon = dir < 0 ? Minus : Plus;
  return (
    <button type="button" className="sd-step" onClick={onClick} aria-label={label} data-testid={testId}>
      <Icon size={12} aria-hidden="true" />
    </button>
  );
}

/** Compact read-only (calculated) value row (~34 px). */
export function ReadOnlyRow({ label, symbol, badgeText, badgeBg, color, hint, testId, rowTestId, tooltip }) {
  return (
    <div className="sd-row sd-row--calc" style={{ "--sd-color": color }} data-role="calc" data-testid={rowTestId} title={tooltip}>
      <span className="sd-row-label">
        {label}{symbol && <small>({symbol})</small>}
        <span className="sd-calc-note">{hint}</span>
      </span>
      <span className="sd-badge" style={{ background: badgeBg }} data-testid={testId ? `chip-${testId}` : undefined}>{badgeText}</span>
    </div>
  );
}

/** Small segmented switch (radiogroup), e.g. Moles | Molecules. */
export function MiniSwitch({ options, value, onChange, ariaLabel, testId, large = false, fill = false, titles = {} }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={"sd-switch" + (large ? " sd-switch--lg" : "") + (fill ? " sd-switch--fill" : "")} data-testid={testId}>
      {options.map((o, i) => {
        const sel = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            title={titles[o.id] ?? o.title}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              onChange(options[(i + d + options.length) % options.length].id);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Header tabs / segmented control with roving tabindex and arrow-key support. */
export function DashboardTabs({ tabs, value, onChange, ariaLabel, role = "tab", segmented = false, idPrefix = "sd-tab", controls, testId }) {
  const isTab = role === "tab";
  const go = (i, d) => {
    const next = tabs[(i + d + tabs.length) % tabs.length];
    onChange(next.id);
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-${next.id}`)?.focus());
  };
  return (
    <div
      role={isTab ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      className={"sd-tabs" + (segmented ? " sd-tabs--segmented" : "")}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, ${segmented ? "auto" : "minmax(0,1fr)"})` }}
      data-testid={testId}
    >
      {tabs.map((t, i) => {
        const sel = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            id={`${idPrefix}-${t.id}`}
            type="button"
            role={role}
            {...(isTab ? { "aria-selected": sel, "aria-controls": controls } : { "aria-checked": sel })}
            tabIndex={sel ? 0 : -1}
            title={t.title}
            data-testid={t.testId}
            className="sd-tab"
            style={segmented ? undefined : sel ? { background: t.solid, borderColor: t.solid, color: "#fff" } : { background: t.soft, borderColor: t.border, color: t.text }}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || (!isTab && e.key === "ArrowDown")) { e.preventDefault(); go(i, 1); }
              else if (e.key === "ArrowLeft" || (!isTab && e.key === "ArrowUp")) { e.preventDefault(); go(i, -1); }
              else if (isTab && e.key === "Home") { e.preventDefault(); go(i, -i); }
              else if (isTab && e.key === "End") { e.preventDefault(); go(i, tabs.length - 1 - i); }
            }}
          >
            {Icon && <Icon size={16} aria-hidden="true" className="shrink-0" />}
            <span className="sd-tab-text">
              <span className="sd-tab-main">{t.label}</span>
              {t.sub && <span className="sd-tab-sub">{t.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** One button of the chamber toolbar: short label + tooltip. `pressed` makes it a toggle. */
export function ToolButton({ icon, label, title, pressed, onClick, primary = false, disabled = false, testId, ariaLabel }) {
  return (
    <button
      type="button"
      className={"sd-tool" + (primary ? " sd-tool--primary" : "")}
      onClick={onClick}
      title={title ?? label}
      aria-label={ariaLabel ?? title ?? label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled}
      data-testid={testId}
    >
      {icon}
      <span className="sd-tool-label">{label}</span>
    </button>
  );
}

export function ChamberToolbar({ children }) {
  return <div className="sd-toolbar" role="toolbar" aria-label="Simulation options" data-n={Children.count(children)} data-testid="chamber-toolbar">{children}</div>;
}

/** One-line strip of small coloured live values. items: [{id,label,value,bg,testId}] */
export function LiveStrip({ items, ariaLabel = "Live values" }) {
  return (
    <dl className="sd-strip" aria-label={ariaLabel} data-testid="live-strip">
      {items.map((t) => (
        <div key={t.id} className="sd-chip" style={{ background: t.bg }} data-testid={t.testId} title={t.title}>
          <dt>{t.label}</dt>
          <dd>{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Compact read-only row of the variables kept constant: "Temperature: 300 K [lock] | Amount: 1.00 mol [lock]". */
export function ConstantsRow({ items, label = "Kept constant", testId = "constants-row" }) {
  return (
    <div className="sd-const" role="group" aria-label={label} data-testid={testId}>
      {items.map((it) => (
        <span key={it.id} className="sd-const-item" style={{ "--sd-color": it.color }} data-testid={`const-${it.id}`}>
          <span className="sd-const-name">{it.label}:</span>
          <b>{it.value}</b>
          <Lock size={12} role="img" aria-label="kept constant" />
        </span>
      ))}
    </div>
  );
}

/** The single short dynamic explanation (one line) with an optional information popover for the detail. */
export function ExplainLine({ text, details, testId = "what-is-happening", detailsLabel = "More detail" }) {
  return (
    <div className="sd-explain" data-testid="explain-line">
      <p className="sd-explain-text" aria-live="polite" aria-atomic="true" data-testid={testId} title={text}>{text}</p>
      {details && (
        <HeaderPopover label={detailsLabel} iconOnly icon={<Info size={15} aria-hidden="true" />} placement="up" width={360} testId="explain-info" panelTestId="explain-info-panel">
          {details}
        </HeaderPopover>
      )}
    </div>
  );
}

/** Small optional Predict button with a floating panel (the dashboard height never changes). */
export function PredictPopover({ question, answer, revealed, onToggle, onOpenChange }) {
  return (
    <HeaderPopover label="Predict" icon={<Info size={14} aria-hidden="true" />} placement="up" width={340} testId="predict-toggle" panelTestId="predict" onOpenChange={onOpenChange} small>
      <div aria-live="polite">
        <p className="sd-pop-q" data-testid="predict-question">{question}</p>
        {revealed && <p className="sd-pop-a" data-testid="predict-answer"><strong>Answer: </strong>{answer}</p>}
      </div>
      <button type="button" className="sd-btn sd-btn--sm" onClick={onToggle} aria-expanded={revealed} data-testid="show-answer">
        {revealed ? "Hide answer" : "Show answer"}
      </button>
    </HeaderPopover>
  );
}

/** A titled group inside a popover. */
export function PopoverSection({ title, children, testId }) {
  return (
    <section className="sd-pop-section" data-testid={testId}>
      {title && <h4 className="sd-pop-title">{title}</h4>}
      {children}
    </section>
  );
}

/** A labelled switch row inside Settings. */
export function SettingToggle({ id, label, hint, checked, onChange, disabled = false, testId }) {
  return (
    <label className={"sd-setting" + (disabled ? " sd-setting--off" : "")} htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span className="sd-setting-text"><span>{label}</span>{hint && <small>{hint}</small>}</span>
    </label>
  );
}

/**
 * A header button that opens a small floating panel (Settings, Predict, info).
 * Closes on Escape (focus returns to the button) and on a press outside. The panel is rendered
 * INSIDE the dashboard so it also works in fullscreen. `children` may be a function receiving { close }.
 */
export function HeaderPopover({ label, icon, children, testId, panelTestId, onOpenChange, width = 320, placement = "down", iconOnly = false, small = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelId = useId();
  const set = useCallback((v) => { setOpen(v); onOpenChange?.(v); }, [onOpenChange]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) set(false); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); set(false); btnRef.current?.focus(); } };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onDown, true); document.removeEventListener("keydown", onKey, true); };
  }, [open, set]);
  const close = useCallback(() => set(false), [set]);
  return (
    <div className="sd-pop" ref={wrapRef} data-open={open ? "true" : "false"}>
      <button
        ref={btnRef} type="button" className={"sd-btn" + (small ? " sd-btn--sm" : "") + (iconOnly ? " sd-btn--icon" : "")}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
        aria-label={iconOnly ? label : undefined} title={label} onClick={() => set(!open)} data-testid={testId}
      >
        {icon}{!iconOnly && <span>{label}</span>}
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-label={label} className="sd-pop-panel" data-placement={placement} style={{ width }} data-testid={panelTestId}>
          {typeof children === "function" ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}
