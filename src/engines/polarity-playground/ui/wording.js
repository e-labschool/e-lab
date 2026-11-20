// Optional plain-language wording (for younger / IGCSE-style learners). The chemistry is unchanged: only the labels are simpler.
export const WORDS = (simple) => (simple ? {
  bondNon: "Non-polar bond", bondSlight: "Slightly polar bond", bondPolar: "Polar bond",
  bondQ: "Is the bond polar?", molQ: "Is the molecule polar?", yes: "Yes", no: "No",
  molPolar: "Polar molecule", molNon: "Non-polar molecule", shape: "Shape", mu: "Uneven charge?",
} : {
  bondNon: "Non-polar covalent bond", bondSlight: "Slightly polar covalent bond", bondPolar: "Polar covalent bond",
  bondQ: "Bond polarity", molQ: "Molecular polarity", yes: "Polar", no: "Non-polar",
  molPolar: "Polar", molNon: "Non-polar", shape: "Shape", mu: "Dipole moment",
});
/** One short plain-language sentence for a molecule. */
export const simpleExplain = (mol) => (mol.net.polar
  ? `The charge is spread unevenly (one side of the molecule is slightly positive, the other slightly negative), so ${mol.plain} is a polar molecule.`
  : mol.net.hasPolarBonds ? `${mol.plain} has polar bonds, but they pull equally in opposite directions, so the charge is spread evenly: it is a non-polar molecule.`
    : `${mol.plain} has no polar bonds, so the charge is spread evenly: it is a non-polar molecule.`);
