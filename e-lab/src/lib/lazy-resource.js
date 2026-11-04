import { lazy } from "react";

// A stable cache of lazy-loaded components keyed by resource ID. Both
// ConceptPage (compact preview) and InteractivePage (full view) need to turn
// a resource's `component` loader into a React.lazy component; caching here
// guarantees the same component reference is returned across renders and
// across the two pages, rather than constructing a fresh lazy() on each
// render (which would remount the interactive and reset its state).
const cache = new Map();

export function getLazyResourceComponent(resource) {
  if (!resource?.component) return null;
  if (!cache.has(resource.id)) {
    cache.set(resource.id, lazy(resource.component));
  }
  return cache.get(resource.id);
}
