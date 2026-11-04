// Asset configuration for the filtration reference implementation --
// every apparatus piece as a plain data object (position/size in
// percentages of the stage, rotation, named anchors). The images
// referenced below are CLEARLY-WATERMARKED PLACEHOLDERS generated only
// to prove the asset-driven pipeline works end-to-end -- they are not
// final artwork and must be replaced (see the project's final report
// for exact specifications of what's needed).
const BASE = "/simulations/separation/filtration";

export const RETORT_STAND = {
  id: "retort-stand",
  src: `${BASE}/retort-stand.png`,
  x: 62, y: 8, width: 14, height: 31.36,
  zIndex: 1,
};

export const CLAMP = {
  id: "clamp",
  src: `${BASE}/clamp.png`,
  x: 47, y: 20, width: 9, height: 6.5,
  zIndex: 2,
};

export const FUNNEL = {
  id: "funnel",
  src: `${BASE}/funnel.png`,
  x: 44, y: 22, width: 15, height: 20.3,
  zIndex: 3,
  anchors: {
    opening: { fx: 0.5, fy: 0.04 },
    stemEnd: { fx: 0.5, fy: 0.97 },
  },
};

export const FILTER_PAPER = {
  id: "filter-paper",
  src: `${BASE}/filter-paper.png`,
  x: 45.3, y: 23.5, width: 12.4, height: 14.4,
  zIndex: 4,
};

export const RECEIVING_BEAKER = {
  id: "receiving-beaker",
  src: `${BASE}/beaker-receiver.png`,
  x: 43, y: 44, width: 14, height: 18.09,
  zIndex: 2,
  anchors: {
    interiorTopLeft: { fx: 0.14, fy: 0.05 },
    interiorBottomRight: { fx: 0.86, fy: 0.98 },
  },
};

// The mixture (source) beaker's start and pour-ready positions --
// interpolated by the simulation as it "arrives", then only its
// rotation changes while pouring. transformOrigin is set to the
// pour-side base, matching the verified tilt geometry from the SVG
// version: a beaker must pivot near its own base on the SAME side as
// its pour lip for the lip to swing DOWN AND TOWARD the target rather
// than away from it.
export function mixtureBeakerConfig({ x, y, rotation = 0 }) {
  return {
    id: "mixture-beaker",
    src: `${BASE}/beaker-source.png`,
    x, y, width: 16, height: 20.8,
    rotation,
    transformOrigin: { fx: 0.85, fy: 1 },
    zIndex: 5,
    anchors: {
      lip: { fx: 0.92, fy: 0.02 },
      interiorTopLeft: { fx: 0.12, fy: 0.05 },
      interiorBottomRight: { fx: 0.88, fy: 0.97 },
    },
  };
}

export const MIXTURE_BEAKER_START = { x: 8, y: 30 };
export const MIXTURE_BEAKER_POUR_POS = { x: 27, y: 12 };
export const MAX_TILT_DEGREES = 45;
