// The parts of the simplified mass spectrometer (labels shared by the ribbon, the stage-2 drawing and the texts). PURE DATA.
export const MS_PARTS = [
  { id: "inlet", label: "Sample inlet", short: "Inlet", sub: "sample in" },
  { id: "ionisation", label: "Electron-ionization source", short: "Source", sub: "electrons make ions" },
  { id: "fragmentation", label: "Fragmentation region", short: "Fragments", sub: "ions break up" },
  { id: "accelerator", label: "Extraction and acceleration", short: "Accelerate", sub: "potential difference V" },
  { id: "analyser", label: "Mass analyser", short: "Analyser", sub: "separates by m/z" },
  { id: "detector", label: "Detector", short: "Detector", sub: "counts ions" },
  { id: "spectrum", label: "Mass spectrum", short: "Spectrum", sub: "computer display" },
];
/** parts emphasised in each of the six stages */
export const PARTS_BY_STAGE = { 1: ["inlet"], 2: ["ionisation"], 3: ["fragmentation"], 4: ["accelerator", "analyser"], 5: ["analyser", "detector", "spectrum"], 6: ["spectrum"] };
export const INSTRUMENT_NOTES = {
  ei: "This module uses electron ionisation (EI) with a gas-phase sample. Electrospray ionisation (ESI) is a different, much gentler process in which ions are formed from a solution; instruments differ in their ionisation methods and analysers.",
  sample: "Samples are introduced in the way that suits the ionisation method: a gas for the EI model used here, but other methods can ionise liquids or solids directly, so a sample does not always have to be vaporised first.",
  vacuum: "The whole path from the ion source to the detector is held under high vacuum so that ions do not collide with air molecules.",
  illustrative: "Illustrative instrument model: simplified, not to scale.",
};
