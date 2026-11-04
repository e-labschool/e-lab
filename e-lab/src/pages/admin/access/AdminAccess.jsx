import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Loader2, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { getAccessCounts, listAccessPage, ACCESS_PAGE_SIZE } from "../../../lib/accessService.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import AccessDetailDrawer from "./AccessDetailDrawer.jsx";

const PLAN_TONE = { free: "neutral", premium: "indigo", school: "teal" };
const STATUS_TONE = { active: "teal", expired: "coral", scheduled: "amber" };
const DEFAULT_FILTERS = { search: "", plan: "All", role: "All", accessStatus: "All" };

function initialsFor(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString() : "\u2014";
}

export default function AdminAccess() {
  const { isConfigured } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [counts, setCounts] = useState(null);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get("user"));
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isConfigured) return;
    getAccessCounts().then(setCounts).catch((err) => setError(err.message));
  }, [isConfigured, reloadToken]);

  useEffect(() => {
    if (!isConfigured) return;
    listAccessPage({ page, filters })
      .then(({ rows: r, totalCount: t }) => { setRows(r); setTotalCount(t); })
      .catch((err) => setError(err.message || "Couldn't load access records."))
      .finally(() => setLoading(false));
  }, [isConfigured, page, filters, reloadToken]);

  function updateFilters(patch) {
    setLoading(true);
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function openUser(userId) {
    setSelectedUserId(userId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("user", userId);
      return next;
    });
  }
  function closeDrawer() {
    setSelectedUserId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("user");
      return next;
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / ACCESS_PAGE_SIZE));
  const summaryCards = useMemo(() => ([
    { label: "Free Users", value: counts?.free },
    { label: "Premium Users", value: counts?.premium },
    { label: "School Users", value: counts?.school },
    { label: "Expiring Soon", value: counts?.expiringSoon },
  ]), [counts]);

  if (!isConfigured) {
    return <p className="p-10 text-sm text-[var(--color-ink-soft)]">Access management requires Supabase to be connected.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Access</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Manage platform access and future plans.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-lg border border-[var(--color-line)] p-4">
            <p className="text-2xl font-semibold text-[var(--color-ink)]">{c.value ?? <Loader2 size={18} className="animate-spin text-[var(--color-ink-faint)]" />}</p>
            <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
          <input
            type="text" placeholder="Search name, email, school" value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="w-64 rounded-md border border-[var(--color-line)] bg-transparent py-1.5 pl-7 pr-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
          />
        </div>
        <FilterSelect label="Plan" value={filters.plan} options={["All", "Free", "Premium", "School"]} onChange={(v) => updateFilters({ plan: v })} />
        <FilterSelect label="Role" value={filters.role} options={["All", "Student", "Teacher"]} onChange={(v) => updateFilters({ role: v })} />
        <FilterSelect label="Access" value={filters.accessStatus} options={["All", "Active", "Expired", "Scheduled"]} onChange={(v) => updateFilters({ accessStatus: v })} />
        {JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) && (
          <button type="button" onClick={() => updateFilters(DEFAULT_FILTERS)} className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-[var(--color-ink-faint)]">{totalCount} user{totalCount === 1 ? "" : "s"}</span>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--color-coral)]">{error}</p>}

      {loading ? (
        <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : rows.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <ShieldCheck size={20} className="text-[var(--color-ink-faint)]" />
          <p className="text-sm text-[var(--color-ink-faint)]">No users match these filters.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-[var(--color-line)] md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-ink-faint)]">
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Plan</th>
                  <th className="px-4 py-2.5 font-medium">Access Status</th>
                  <th className="px-4 py-2.5 font-medium">Start Date</th>
                  <th className="px-4 py-2.5 font-medium">Expiry Date</th>
                  <th className="px-4 py-2.5 font-medium">School</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.user_id} onClick={() => openUser(u.user_id)} className="cursor-pointer border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-line)]/15">
                    <td className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo)] text-[11px] font-semibold text-white">{initialsFor(u.full_name)}</span>
                      <span className="font-medium text-[var(--color-ink)]">{u.full_name}</span>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-[var(--color-ink-soft)]">{u.role}</td>
                    <td className="px-4 py-2.5"><Badge tone={PLAN_TONE[u.plan]}>{u.plan}</Badge></td>
                    <td className="px-4 py-2.5"><Badge tone={STATUS_TONE[u.access_status] ?? "neutral"}>{u.access_status}</Badge></td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-faint)]">{formatDate(u.starts_at)}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-faint)]">{formatDate(u.expires_at)}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{u.school || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-2 md:hidden">
            {rows.map((u) => (
              <button key={u.user_id} type="button" onClick={() => openUser(u.user_id)} className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] p-3.5 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo)] text-xs font-semibold text-white">{initialsFor(u.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-ink)]">{u.full_name}</p>
                  <p className="truncate text-xs text-[var(--color-ink-faint)]">{u.role} &middot; expires {formatDate(u.expires_at)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={PLAN_TONE[u.plan]}>{u.plan}</Badge>
                    <Badge tone={STATUS_TONE[u.access_status] ?? "neutral"}>{u.access_status}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-ink-faint)]">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1.5">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-line)] disabled:opacity-40"><ChevronLeft size={13} /></button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-line)] disabled:opacity-40"><ChevronRight size={13} /></button>
            </div>
          </div>
        </>
      )}

      {selectedUserId && (
        <AccessDetailDrawer
          userId={selectedUserId}
          onClose={closeDrawer}
          onSaved={() => { closeDrawer(); setReloadToken((t) => t + 1); }}
        />
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-xs text-[var(--color-ink-soft)] focus:border-[var(--color-ink)]">
      {options.map((o) => <option key={o} value={o}>{o === "All" ? `${label}: All` : o}</option>)}
    </select>
  );
}
