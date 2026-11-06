// Visual scale of the nucleus (see AtomVisualizer). Pure.
export const NUCLEUS_SCALE = 1.3;
export const NUCLEON_SPHERE_SIZE = 26; // ~13% smaller than the previous 30
// Largest allowed distance (viewBox units) from the centre to the outer edge
// of any nucleon: the first shell is at radius 100, so this keeps a ~22 unit
// gap. Up to 40 nucleons keep the original scale (1.3) exactly; heavier
// nuclei (up to Z = 36, N = 60) are packed tighter and drawn with smaller
// spheres so they never touch the first shell. Purely visual.
const NUCLEUS_MAX_EDGE = 78;

/** Visual scale + sphere size for a nucleus with this many protons / neutrons. */
export function nucleusScaling(protons, neutrons) {
  // buildNucleusLayout puts proton i at slot 2i and neutron i at slot 2i+1.
  const maxSlot = Math.max(protons > 0 ? 2 * (protons - 1) : 0, neutrons > 0 ? 2 * (neutrons - 1) + 1 : 0);
  const unit = 7.5 * Math.sqrt(maxSlot + 0.5); // radius of the outermost slot at scale 1
  let scale = NUCLEUS_SCALE;
  let sphere = NUCLEON_SPHERE_SIZE;
  if (unit > 0 && unit * scale + sphere / 2 > NUCLEUS_MAX_EDGE) {
    // solve unit*s + (26 * s / 1.3) / 2 = MAX  -> sphere shrinks with the scale
    scale = NUCLEUS_MAX_EDGE / (unit + NUCLEON_SPHERE_SIZE / (2 * NUCLEUS_SCALE));
    sphere = NUCLEON_SPHERE_SIZE * (scale / NUCLEUS_SCALE);
  }
  return { scale, sphere };
}

