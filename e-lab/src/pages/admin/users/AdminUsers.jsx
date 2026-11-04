import { useState, useEffect, useMemo } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight, Users as UsersIcon } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getUserCounts, listUsersPage, PAGE_SIZE } from "../../../lib/userService.js";
import Badge from "../../../components/ui/Badge.jsx";
import UserDetailDrawer from "./UserDetailDrawer.jsx";

const ROLE_TONE = { student: "indigo", teacher: "amber", admin: "neutral" };
const STATUS_TONE = { active: "teal", suspended: "coral" };
const DEFAULT_FILTERS = { search: "", role: "All", level: "All" };

function initialsFor(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function AdminUsers() {
  const { isConfigured, user: currentUser } = useAuth();
  const [counts, setCounts] = useState(null);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isConfigured) return;
    getUserCounts().then(setCounts).catch((err) => setError(err.message));
  }, [isConfigured, reloadToken]);

  useEffect(() => {
    if (!isConfigured) return;
    listUsersPage({ page, filters })
      .then(({ rows: r, totalCount: t }) => { setRows(r); setTotalCount(t); })
      .catch((err) => setError(err.message || "Couldn't load users."))
      .finally(() => setLoading(false));
  }, [isConfigured, page, filters, reloadToken]);

  // Filters changing should reset to page 1 — otherwise a narrower filter
  // could leave the view stranded on an out-of-range page.
  function updateFilters(patch) {
    setLoading(true);
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const summaryCards = useMemo(() => ([
    { label: "Total Users", value: counts?.total },
    { label: "Students", value: counts?.student },
    { label: "Teachers", value: counts?.teacher },
    { label: "Admins", value: counts?.admin },
  ]), [counts]);

  if (!isConfigured) {
    return <p className="p-10 text-sm text-[var(--color-ink-soft)]">User management requires Supabase to be connected.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Users</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">View and manage platform users.</p>

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
        <FilterSelect label="Role" value={filters.role} options={["All", "Student", "Teacher", "Admin"]} onChange={(v) => updateFilters({ role: v })} />
        <FilterSelect label="Level" value={filters.level} options={["All", "SL", "HL", "SL & HL"]} onChange={(v) => updateFilters({ level: v })} />
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
          <UsersIcon size={20} className="text-[var(--color-ink-faint)]" />
          <p className="text-sm text-[var(--color-ink-faint)]">No users match these filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-[var(--color-line)] md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-ink-faint)]">
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">School</th>
                  <th className="px-4 py-2.5 font-medium">Country</th>
                  <th className="px-4 py-2.5 font-medium">Level</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="cursor-pointer border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-line)]/15"
                  >
                    <td className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo)] text-[11px] font-semibold text-white">
                        {initialsFor(u.full_name)}
                      </span>
                      <span className="font-medium text-[var(--color-ink)]">{u.full_name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{u.email}</td>
                    <td className="px-4 py-2.5"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{u.school || "\u2014"}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{u.country || "\u2014"}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{u.level || "\u2014"}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-faint)]">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "\u2014"}</td>
                    <td className="px-4 py-2.5"><Badge tone={STATUS_TONE[u.status] ?? "neutral"}>{u.status ?? "active"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet cards */}
          <div className="mt-6 flex flex-col gap-2 md:hidden">
            {rows.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUser(u)}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] p-3.5 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo)] text-xs font-semibold text-white">
                  {initialsFor(u.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-ink)]">{u.full_name}</p>
                  <p className="truncate text-xs text-[var(--color-ink-faint)]">{u.email}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                    <Badge tone={STATUS_TONE[u.status] ?? "neutral"}>{u.status ?? "active"}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-ink-faint)]">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1.5">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-line)] disabled:opacity-40">
                <ChevronLeft size={13} />
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-line)] disabled:opacity-40">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </>
      )}

      {selectedUser && (
        <UserDetailDrawer
          targetUser={selectedUser}
          currentUserId={currentUser?.id}
          onClose={() => setSelectedUser(null)}
          onSaved={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setSelectedUser(null);
            setReloadToken((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-xs text-[var(--color-ink-soft)] focus:border-[var(--color-ink)]"
    >
      {options.map((o) => <option key={o} value={o}>{o === "All" ? `${label}: All` : o}</option>)}
    </select>
  );
}
