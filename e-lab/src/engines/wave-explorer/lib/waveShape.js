// Geometry for the two wave visuals -- verified numerically before use
// (see the session's working notes): for a longitudinal wave modeled as
// displacement(x0) = A*sin(k*x0 - phase), the point of maximum particle
// bunching (compression) occurs at x0 = wavelength/2 + phase*wavelength/2pi,
// confirmed against an actual particle-density simulation, not just the
// symbolic derivative.

/** Sample points for a transverse sine wave, for building an SVG path.
 * x runs 0..width in pixel space; wavelength/amplitude are in the SAME
 * pixel space (the caller maps physical wavelength to a display scale
 * separately -- this function only draws the shape).
 *
 * The y-offset is NEGATED relative to a plain sin(kx-phase): SVG's y
 * axis increases DOWNWARD, so without the negation, the point where
 * crestPositions() below defines a "crest" (sin=+1) would render as
 * the visual BOTTOM of the wave, not the top -- verified numerically
 * before fixing (a plain +amplitude*sin(...) put the labeled crest 40px
 * below the midline instead of 40px above it). */
export function transverseWavePoints(width, amplitude, wavelengthPx, phase, numPoints = 120) {
  const k = (2 * Math.PI) / wavelengthPx;
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * width;
    const y = -amplitude * Math.sin(k * x - phase);
    points.push({ x, y });
  }
  return points;
}

export function pointsToSvgPath(points) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

/** Actual (displaced) x-position of a longitudinal-wave particle whose
 * REST position is x0 -- displacement is along the same axis the wave
 * travels, never used to change particle SIZE (amplitude must only
 * affect displacement, matching the instruction not to represent
 * amplitude as particle size). */
export function longitudinalDisplacement(x0, amplitude, wavelengthPx, phase) {
  const k = (2 * Math.PI) / wavelengthPx;
  return amplitude * Math.sin(k * x0 - phase);
}

/** Rest x-positions of `count` particles evenly spaced across `width`,
 * for the longitudinal wave's particle field. */
export function restPositions(count, width) {
  if (count <= 0) return [];
  const spacing = width / (count - 1 || 1);
  return Array.from({ length: count }, (_, i) => i * spacing);
}

/** x-positions of every wave crest visible within [0, width] (plus a
 * small margin) for the current phase -- verified numerically before
 * use: consecutive crests are always exactly wavelengthPx apart at any
 * phase, which is what lets the amplitude/wavelength measurement
 * arrows track a real crest as the wave animates, rather than sitting
 * at a fixed x that drifts out of alignment with the actual wave. */
export function crestPositions(wavelengthPx, phase, width) {
  const k = (2 * Math.PI) / wavelengthPx;
  const crests = [];
  const firstN = Math.ceil((-Math.PI / 2 - phase) / (2 * Math.PI) - 0.5);
  for (let n = firstN; crests.length < 8; n++) {
    const x = (Math.PI / 2 + phase + 2 * Math.PI * n) / k;
    if (x > width + wavelengthPx) break;
    crests.push(x);
  }
  return crests.filter((x) => x >= -1 && x <= width + 1);
}

/** The rest-position x0 (within [0, wavelengthPx)) of the nearest
 * compression centre, and the rarefaction centre exactly half a
 * wavelength away -- verified against a direct particle-density
 * simulation before use, not derived and trusted blindly. */
export function compressionRarefactionCentres(wavelengthPx, phase) {
  const compressionX0 = (wavelengthPx / 2 + (phase * wavelengthPx) / (2 * Math.PI)) % wavelengthPx;
  const normalizedCompression = ((compressionX0 % wavelengthPx) + wavelengthPx) % wavelengthPx;
  const rarefactionX0 = (normalizedCompression + wavelengthPx / 2) % wavelengthPx;
  return { compressionX0: normalizedCompression, rarefactionX0 };
}
