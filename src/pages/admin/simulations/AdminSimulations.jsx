import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Lock, ShieldAlert, Star } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useAccessConfig } from "../../../lib/access/AccessConfigContext.jsx";
import { fetchAdminAccessConfig, fetchSimulationOverrides, saveAccessConfig, saveSimulationOverride } from "../../../lib/access/accessConfigService.js";
import { DEFAULT_ACCESS_CONFIG, TIERS } from "../../../lib/access/accessPolicy.js";
import { SIMULATION_CATALOGUE, applyAccessOverrides, getLiveSimulations } from "../../../data/simulationCatalogue.js";
import Button from "../../../components/ui/Button.jsx";
import LockToggle from "../../../components/admin/LockToggle.jsx";

function Switch({ checked, onChange, disabled, label, description, id }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-medium text-[var(--color-ink)]">{label}</p>
        <p id={`${id}-desc`} className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span aria-hidden="true" className="text-xs font-semibold uppercase text-[var(--color-ink-faint)]">{checked ? "On" : "Off"}</span>
        <button
          type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={`${id}-desc`} disabled={disabled}
          onClick={() => onChange(!checked)} data-switch={id}
          className={`relative h-6 w-11 shrink-0 rounded-full border border-[var(--color-ink)]/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[#2647C4]" : "bg-[var(--color-line)]"}`}
        >
          <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} style={{ height: 18, width: 18 }} />
        </button>
      </div>
    </div>
  );
}

/** /admin/simulations -- master switches + per-simulation access level and Featured flag.  Everything is optional /
 *  graceful: with the draft SQL not applied the page explains that and disables its controls. */
export default function AdminSimulations() {
  const { isConfigured } = useAuth();
  const { refresh } = useAccessConfig();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ ...DEFAULT_ACCESS_CONFIG });
  const [configAvailable, setConfigAvailable] = useState(false);
  const [downloadSwitchAvailable, setDownloadSwitchAvailable] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [overridesAvailable, setOverridesAvailable] = useState(false);
  const [error, setError] = useState(null);
  const [rowError, setRowError] = useState({});
  const [saving, setSaving] = useState(null);
  const [confirmPremium, setConfirmPremium] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchAdminAccessConfig(), fetchSimulationOverrides()]).then(([c, o]) => {
      if (!alive) return;
      setConfig(c.config); setConfigAvailable(c.available); setDownloadSwitchAvailable(Boolean(c.downloadSwitchAvailable));
      setOverrides(o.overrides); setOverridesAvailable(o.available);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => applyAccessOverrides(SIMULATION_CATALOGUE, overrides).filter((e) => e.status === "live"), [overrides]);
  const liveCount = getLiveSimulations().length;
  const featuredCount = rows.filter((r) => r.featured).length;
  const premiumOn = config.premiumEnabled;
  const controlsOff = !isConfigured;

  const saveConfig = useCallback(async (patch) => {
    setError(null); setSaving("config");
    const before = config;
    setConfig((c) => ({ ...c, ...patch }));
    try {
      const next = await saveAccessConfig(patch);
      setConfig(next); await refresh();
    } catch (e) {
      setConfig(before); setError(e?.message || "Couldn't save the setting.");
    } finally { setSaving(null); }
  }, [config, refresh]);

  const saveRow = useCallback(async (row, patch) => {
    setRowError((r) => ({ ...r, [row.id]: null })); setSaving(row.id);
    const before = overrides[row.id];
    const merged = { tier: row.tier, featured: row.featured, ...patch }; // always send both so a new row never resets the other field
    setOverrides((o) => ({ ...o, [row.id]: merged }));
    try {
      await saveSimulationOverride(row.id, merged);
      await refresh();
    } catch (e) {
      setOverrides((o) => { const n = { ...o }; if (before) n[row.id] = before; else delete n[row.id]; return n; });
      setRowError((r) => ({ ...r, [row.id]: e?.message || "Couldn't save." }));
    } finally { setSaving(null); }
  }, [overrides, refresh]);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Simulation access</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Lock a simulation for Premium and choose which ones the home page features. {liveCount} live simulations.</p>

      {!premiumOn ? (
        <div role="status" data-banner="all-free" className="mt-5 flex items-start gap-2.5 rounded-lg border border-[var(--color-teal)]/40 bg-[var(--color-teal-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--color-teal)]" aria-hidden="true" />
          <p><strong>Everything is currently free for everyone.</strong> Premium is switched off, so no Premium badges, locks or upgrade prompts appear anywhere on the site. Locks you set below are saved but have no effect until Premium is switched on.</p>
        </div>
      ) : (
        <div role="status" data-banner="premium-on" className="mt-5 flex items-start gap-2.5 rounded-lg border border-[var(--color-amber)]/50 bg-[var(--color-amber-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[var(--color-amber)]" aria-hidden="true" />
          <p><strong>Premium is switched on.</strong> Premium simulations now show badges and a locked screen. This is a display rule only: the simulations themselves are not protected by the database yet (see docs/PLATFORM_ACCESS_MODEL.md).</p>
        </div>
      )}

      {controlsOff && <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-[var(--color-ink-soft)]"><Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> Supabase is not connected, so these settings cannot be read or saved. The controls are disabled.</p>}
      {!controlsOff && !configAvailable && (
        <p role="alert" data-notice="config-missing" className="mt-4 flex items-start gap-2 rounded-md border border-[var(--color-amber)]/40 bg-[var(--color-amber-soft)] px-3 py-2 text-sm text-[var(--color-ink)]"><Info size={15} className="mt-0.5 shrink-0 text-[var(--color-amber)]" aria-hidden="true" /> The site access settings have not been created in the database yet (draft: docs/platform-sql/001_site_access_config.sql). The two switches below are disabled and the site keeps behaving as everything free.</p>
      )}
      {!controlsOff && configAvailable && !downloadSwitchAvailable && (
        <p role="alert" data-notice="download-switch-missing" className="mt-3 flex items-start gap-2 rounded-md border border-[var(--color-amber)]/40 bg-[var(--color-amber-soft)] px-3 py-2 text-sm text-[var(--color-ink)]"><Info size={15} className="mt-0.5 shrink-0 text-[var(--color-amber)]" aria-hidden="true" /> The download setting has not been created in the database yet (draft: docs/platform-sql/011_download_requires_premium.sql). The "Downloads are Premium-only" switch is disabled and downloads stay free for everyone.</p>
      )}
      {!controlsOff && !overridesAvailable && (
        <p role="alert" data-notice="table-missing" className="mt-3 flex items-start gap-2 rounded-md border border-[var(--color-amber)]/40 bg-[var(--color-amber-soft)] px-3 py-2 text-sm text-[var(--color-ink)]"><Info size={15} className="mt-0.5 shrink-0 text-[var(--color-amber)]" aria-hidden="true" /> The per-simulation access table has not been created yet (draft: docs/platform-sql/002_simulation_access.sql). The lock toggles and Featured are disabled; every simulation uses its catalogue default (unlocked / free, with the built-in featured set).</p>
      )}

      <section aria-labelledby="master-switches" className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2 sm:px-5">
        <h2 id="master-switches" className="sr-only">Master switches</h2>
        <div className="divide-y divide-[var(--color-line)]">
          <Switch id="premium-enabled" checked={config.premiumEnabled} disabled={controlsOff || !configAvailable || saving === "config"}
            onChange={(v) => (v ? setConfirmPremium(true) : saveConfig({ premiumEnabled: false }))}
            label="Premium (master switch)" description="OFF now: everything is free and no Premium badge, lock, plan card or upgrade prompt is shown anywhere. Turn ON only when you launch Premium." />
          <Switch id="require-login" checked={config.requireLoginForSimulations} disabled={controlsOff || !configAvailable || saving === "config"}
            onChange={(v) => saveConfig({ requireLoginForSimulations: v })}
            label="Require login for simulations" description="OFF now: everyone can open everything, exactly as today. When ON, simulations other than Demo ask visitors to log in first." />
          <Switch id="download-requires-premium" checked={config.downloadRequiresPremium} disabled={controlsOff || !configAvailable || !downloadSwitchAvailable || saving === "config"}
            onChange={(v) => saveConfig({ downloadRequiresPremium: v })}
            label="Downloads are Premium-only"
            description={`Only takes effect when Premium (the master switch above) is ON; right now everything is free and everyone can view and download resource files. When both are ON, viewing a file in the browser stays free but the Download button asks for Premium. This hides the button only: a file that is open in a browser can still be saved from the browser's own toolbar.${config.downloadRequiresPremium && !premiumOn ? " Saved; no effect while Premium is off." : ""}`} />
        </div>
        {error && <p role="alert" className="pb-3 text-xs text-[var(--color-coral)]">{error}</p>}
      </section>

      <p className="mt-6 flex items-start gap-2 text-xs text-[var(--color-ink-soft)]" data-testid="lock-help">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Use the padlock to lock a simulation for Premium (or unlock it to keep it free). Locks only take effect when Premium is switched on with the master switch above; right now everything is free for everyone.</span>
      </p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        <table className="w-full min-w-[20rem] text-left text-sm" data-sim-table>
          <caption className="sr-only">Premium lock and home page feature flag for each live simulation</caption>
          <thead className="bg-[var(--color-paper)] text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Simulation</th>
              <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">Topic</th>
              <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">Syllabus</th>
              <th scope="col" className="hidden px-3 py-3 font-semibold sm:table-cell">Status</th>
              <th scope="col" className="px-3 py-3 font-semibold">Premium lock</th>
              <th scope="col" className="px-3 py-3 text-center font-semibold">Home page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {rows.map((row) => {
              const disabled = controlsOff || !overridesAvailable || saving === row.id;
              return (
                <tr key={row.id} data-sim-row={row.id}>
                  <th scope="row" className="px-4 py-2.5 font-medium text-[var(--color-ink)]">{row.label}</th>
                  <td className="hidden px-3 py-2.5 text-[var(--color-ink-soft)] md:table-cell">{row.topic}</td>
                  <td className="hidden px-3 py-2.5 text-[var(--color-ink-soft)] lg:table-cell">{row.syllabus.join(", ") || "—"}</td>
                  <td className="hidden px-3 py-2.5 sm:table-cell"><span className="rounded-full bg-[var(--color-teal-soft)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--color-teal)]">Live</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <LockToggle id={`lock-${row.id}`} name={row.label} locked={row.tier === TIERS.PREMIUM} disabled={disabled}
                        onChange={(on) => saveRow(row, { tier: on ? TIERS.PREMIUM : TIERS.FREE })} />
                      <span className="text-xs text-[var(--color-ink-soft)]">{row.tier === TIERS.PREMIUM ? "Locked" : row.tier === TIERS.DEMO ? "Free demo" : "Free"}</span>
                    </div>
                    {row.tier === TIERS.PREMIUM && !premiumOn && <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Saved; open to everyone while Premium is off.</p>}
                    {rowError[row.id] && <p role="alert" className="mt-1 text-[11px] text-[var(--color-coral)]">{rowError[row.id]}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button type="button" aria-pressed={row.featured} disabled={disabled} onClick={() => saveRow(row, { featured: !row.featured })}
                      aria-label={`${row.featured ? "Remove" : "Feature"} ${row.label} ${row.featured ? "from" : "on"} the home page`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-[var(--color-ink)] hover:bg-[var(--color-line)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] disabled:cursor-not-allowed disabled:opacity-50">
                      <Star size={16} aria-hidden="true" className={row.featured ? "fill-[#C96A21] text-[#C96A21]" : ""} />
                      <span className="hidden sm:inline">{row.featured ? "Featured" : ""}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--color-ink-faint)]">{featuredCount} featured. The home page shows the featured simulations in catalogue order (first four in the showcase; the live demo uses the first four featured that can run in a browser).</p>

      {confirmPremium && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-premium-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmPremium(false)}>
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
            <p id="confirm-premium-title" className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]"><ShieldAlert size={15} className="text-[var(--color-amber)]" aria-hidden="true" /> Turn Premium ON?</p>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Premium badges, lock screens and plan cards will appear for every visitor immediately, for simulations set to Premium. This does not protect content in the database.</p>
            <div className="mt-4 flex gap-3">
              <Button variant="danger" onClick={() => { setConfirmPremium(false); saveConfig({ premiumEnabled: true }); }}>Turn on</Button>
              <Button variant="ghost" onClick={() => setConfirmPremium(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
