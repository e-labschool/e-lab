// Simple, consistent icon set — a few SVG shapes, not illustrations, to
// keep the simulation clean rather than cartoonish.
export function ChocolateIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="4" width="16" height="12" rx="2.5" fill="#8B5A2B" />
      <rect x="2" y="4" width="16" height="4" rx="2" fill="#A5713A" />
    </svg>
  );
}

export function WrapperIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="6" width="14" height="8" rx="1.5" fill="var(--color-indigo)" opacity="0.85" />
      <path d="M3 10 L0 7 L0 13 Z" fill="var(--color-indigo)" opacity="0.6" />
      <path d="M17 10 L20 7 L20 13 Z" fill="var(--color-indigo)" opacity="0.6" />
    </svg>
  );
}

export function PackIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="3" fill="var(--color-teal)" />
      <path d="M2 9 L6 4 M22 9 L18 4" stroke="var(--color-teal-soft)" strokeWidth="1.5" />
      <rect x="9" y="4" width="6" height="16" fill="var(--color-teal-soft)" opacity="0.5" />
    </svg>
  );
}
