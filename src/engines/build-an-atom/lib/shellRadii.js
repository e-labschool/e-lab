// Up to 4 shells use the radii below. 37-40 electrons (anions only) have a real
// 5th shell (2,8,18,8,1 ...): then, and only then, the rings are spaced slightly
// closer so a 5th ring fits inside the viewBox (outer edge 208 + 12 < 230).
const SHELL_RADII = [100, 132, 164, 196];
const SHELL_RADII_FIVE = [100, 127, 154, 181, 208];
export const shellRadii = (shellCount) => (shellCount > 4 ? SHELL_RADII_FIVE : SHELL_RADII);
