// Bond polarity and molecular polarity (IB DP S2.2: data-booklet Pauling electronegativities, delta-EN, dipoles that cancel by shape).
// The implementation lives in the shared Lewis engine (src/lib/lewis/polarity.js) so the covalent mode, the molecule recogniser and the tests all
// read ONE electronegativity table; this module keeps the names the Bonding Visualizer already imports.
export {
  ELECTRONEGATIVITY, NONPOLAR_MAX, SLIGHT_MAX, IONIC_MIN, round1, bondPolarity, bondTable, netDipole, polarityStatement, atomPartials,
} from "../../../lib/lewis/polarity.js";
