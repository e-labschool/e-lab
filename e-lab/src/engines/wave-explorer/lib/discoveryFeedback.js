// Generates the "What Did You Discover?" message from the ACTUAL
// previous/next state of whichever control the student just touched --
// never a generic templated message, matching the same discipline used
// for Build an Atom's "What Changed" feedback.
export function describeWaveChange(changedControl, prevValue, nextValue, waveType) {
  if (waveType === "longitudinal" && changedControl !== "waveType") {
    return "Particles oscillate parallel to the direction in which the wave travels.";
  }
  if (changedControl === "wavelength") {
    return nextValue < prevValue
      ? "You shortened the wavelength. Since the speed of light is constant, the frequency increased."
      : "You increased the wavelength. The frequency therefore decreased.";
  }
  if (changedControl === "amplitude") {
    return "You changed the amplitude. The wavelength and frequency remain unchanged.";
  }
  if (changedControl === "waveType") {
    return waveType === "longitudinal"
      ? "Particles oscillate parallel to the direction in which the wave travels."
      : "Particles oscillate perpendicular to the direction in which the wave travels.";
  }
  return null;
}
