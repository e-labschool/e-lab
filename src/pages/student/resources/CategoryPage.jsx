import { useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { CATEGORIES, getResourcesByCategory, filterResources, RESOURCE_TYPE_FILTERS } from "./lib/resourceUtils.js";
import { useVisibleResources } from "../../../lib/useVisibleResources.js";
import staticResources from "../../../data/student-resources.js";
import Container from "../../../components/ui/Container.jsx";
import EmptyStatePanel from "../../../components/ui/EmptyStatePanel.jsx";
import ResourceCard from "./components/ResourceCard.jsx";
import { FolderOpen } from "lucide-react";

export default function CategoryPage() {
  const { categoryId } = useParams();
  const category = CATEGORIES[categoryId];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const { resources: supabaseResources, loading, error } = useVisibleResources();

  const allResources = useMemo(
    () => [...staticResources, ...supabaseResources.filter((r) => r.audience === "student" || r.audience === "both")],
    [supabaseResources]
  );
  const categoryResources = useMemo(
    () => (category ? getResourcesByCategory(categoryId, allResources) : []),
    [category, categoryId, allResources]
  );
  const filtered = useMemo(() => filterResources(categoryResources, { search, filter }), [categoryResources, search, filter]);

  if (!category) return <Navigate to=".." replace />;

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <Link to="../.." relative="path" className="text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
          &larr; Resources
        </Link>
        <h1 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          {category.label}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">{category.description}</p>
      </div>

      {error && <p className="mt-6 text-sm text-[var(--color-coral)]">Some resources couldn't be loaded: {error}</p>}

      {loading ? (
        <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : categoryResources.length === 0 ? (
        <div className="mt-12">
          <EmptyStatePanel icon={FolderOpen} title="Resources will be added here soon." />
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources"
                className="w-56 rounded-md border border-[var(--color-line)] bg-transparent py-2 pl-8 pr-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-ink)]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {RESOURCE_TYPE_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    filter === f
                      ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                      : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {filtered.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-[var(--color-ink-faint)]">No resources match your search.</p>
            )}
          </div>
        </>
      )}
    </Container>
  );
}
