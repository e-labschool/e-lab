// Layer 1 — core concepts for the "reaction-mechanisms" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const reactionMechanismsConcepts = [
  {
    id: "radical-substitution-mechanism",
    subject: "chemistry",
    domain: "reaction-mechanisms",
    title: "Radical Substitution Mechanism",
    description: "A chain mechanism proceeding through initiation, propagation and termination steps.",
    relatedConcepts: ["electrophiles-and-nucleophiles"],
  },
  {
    id: "electrophiles-and-nucleophiles",
    subject: "chemistry",
    domain: "reaction-mechanisms",
    title: "Electrophiles and Nucleophiles",
    description: "Classifying reactive species by whether they accept or donate an electron pair.",
    relatedConcepts: ["radical-substitution-mechanism","nucleophilic-substitution-mechanism"],
  },
  {
    id: "reaction-mechanism-representation",
    subject: "chemistry",
    domain: "reaction-mechanisms",
    title: "Reaction Mechanism Representation",
    description: "Using curly arrows to show the movement of electron pairs during a reaction.",
    relatedConcepts: ["electrophiles-and-nucleophiles"],
  },
  {
    id: "nucleophilic-substitution-mechanism",
    subject: "chemistry",
    domain: "reaction-mechanisms",
    title: "Nucleophilic Substitution Mechanism",
    description: "How a nucleophile displaces a leaving group, and the factors that affect the pathway taken.",
    relatedConcepts: ["electrophiles-and-nucleophiles","reaction-mechanism-representation"],
  },
  {
    id: "addition-reactions",
    subject: "chemistry",
    domain: "reaction-mechanisms",
    title: "Addition Reactions",
    description: "Mechanisms where atoms are added across a multiple bond.",
    relatedConcepts: ["reaction-mechanism-representation"],
  },
  {
    id: "elimination-reactions",
    subject: "chemistry",
    domain: "reaction-mechanisms",
    title: "Elimination Reactions",
    description: "Mechanisms where atoms are removed to form a new multiple bond.",
    relatedConcepts: ["addition-reactions"],
  },
];

export default reactionMechanismsConcepts;
