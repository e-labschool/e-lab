# Claude — Verify and Correct Molecular Polarity and Dipole Vector Addition

Please inspect the existing **Polarity Playground → Molecular Polarity** implementation in e-Lab.school.

Do not rebuild the simulation unnecessarily. First check whether the existing molecular geometry, bond dipoles, vector addition, resultant dipoles, partial charges and polarity classifications are scientifically correct. **Only correct what is missing, inaccurate or misleading.**

Use the attached reference image for the intended visual presentation, but use the scientific rules below as the authoritative implementation requirements.

## 1. Correct Vector Addition

For each molecule:

1. Determine the actual 3D molecular geometry.
2. Identify the polarity and direction of each bond dipole.
3. Assign bond-dipole vectors using the bond directions and appropriate relative magnitudes.
4. Calculate their vector sum in three dimensions.
5. Display the resultant molecular dipole, or zero if the vectors cancel.

Use the chemistry dipole-arrow convention: crossed tail at the positive end, arrowhead towards the negative end.

For two bond dipoles, the parallelogram method should be used for visual teaching. Both vectors originate from the same point, dashed lines complete the parallelogram, and the resultant extends from the common origin to the opposite corner.

For molecules with three or more bond dipoles, use a genuine sequential head-to-tail construction or a 3D vector-sum animation. Do not force all molecules into a two-vector parallelogram.

**Important:** The molecular model may display bond arrows directly on the bonds, but the vector-addition panel must reposition copies of those vectors to a common origin or head-to-tail configuration without changing their magnitudes or directions.

## 2. Verify Every Existing Molecule

The selector currently includes:

| Molecule | Expected molecular polarity |
|---|---|
| H₂ | Non-polar |
| HCl | Polar, towards Cl |
| CO₂ | Non-polar; opposing dipoles cancel |
| H₂O | Polar, towards O |
| BF₃ | Non-polar; trigonal planar cancellation |
| NH₃ | Polar, towards N |
| CH₄ | Non-polar |
| CH₃Cl | Polar, generally towards Cl |
| CCl₄ | Non-polar; tetrahedral cancellation |
| SO₂ | Polar, along the angle bisector towards the oxygen side |
| HF | Polar, towards F |
| HBr | Polar, towards Br |
| CH₂Cl₂ | Polar |
| CHCl₃ | Polar |
| PCl₃ | Polar |
| BeCl₂ | Non-polar; linear cancellation |
| SF₆ | Non-polar; octahedral cancellation |
| XeF₄ | Non-polar; square planar cancellation |
| O₃ | Polar; bent geometry |
| cis-C₂H₂Cl₂ | Polar |
| trans-C₂H₂Cl₂ | Non-polar; dipole cancellation |

Also verify any other molecules already included in the code.

Do not remove correctly implemented molecules.

## 3. Molecular Geometry

Verify the correct VSEPR geometry, 3D coordinates and bond angles.

Examples include:

- H₂O: bent, approximately 104.5°.
- NH₃: trigonal pyramidal, approximately 107°.
- CO₂: linear, 180°.
- BF₃: trigonal planar, 120°.
- CH₄ and CCl₄: tetrahedral, approximately 109.5°.
- SO₂: bent, approximately 119°.
- PCl₃: trigonal pyramidal.
- SF₆: octahedral.
- XeF₄: square planar.
- O₃: bent.

Do not assume that all molecules with the same VSEPR shape have identical measured bond angles.

## 4. Resultant Dipole Display

For polar molecules, show:

- Individual bond dipoles in yellow.
- Resultant molecular dipole in pink.
- A scientifically correct arrow direction.
- The label **Net dipole moment, μ ≠ 0**.
- A short explanation of why the vectors do not cancel.

For non-polar molecules, show:

- Individual bond dipoles where present.
- Their vector cancellation.
- **Net dipole moment, μ = 0**.
- No permanent resultant dipole arrow.

Do not draw a pink resultant arrow for a molecule whose net dipole is zero.

Use a numerical tolerance for vector cancellation rather than relying on exact floating-point equality.

## 5. Animation Sequence

The Resultant Dipole view should animate the process in this order:

**Step 1:** Show the molecular geometry and partial charges.

**Step 2:** Reveal individual bond-dipole arrows.

**Step 3:** Move copies of the arrows into the appropriate vector-addition construction.

**Step 4:** Complete the parallelogram or sequential vector sum.

**Step 5:** Reveal the final resultant or show cancellation.

**Step 6:** Display the molecular polarity classification and explanation.

Allow Replay and Reset.

The animation must remain scientifically correct when the user rotates the molecular model.

## 6. Important Scientific Checks

- Do not confuse bond polarity with molecular polarity.
- Do not classify molecules as polar solely because they contain polar bonds.
- Do not determine molecular dipoles using electronegativity differences alone; bond dipole magnitude also depends on charge separation and bonding.
- Do not draw molecular dipoles in the wrong direction because of camera rotation or reversed coordinate systems.
- Do not confuse the standard chemistry dipole arrow with the opposite-direction electric dipole moment vector used in physics.
- Treat bond-dipole vector addition as a pedagogical model; actual molecular dipole moments depend on the complete electron-density distribution, including lone-pair and other electronic contributions.
- For molecules such as O₃, do not infer the direction or magnitude simply from electronegativity differences between bonded atoms. Use an appropriate molecular dipole model or reliable molecular data.
- Verify that all δ+ and δ− labels are chemically justified.

## 7. Preserve Existing Functionality

Check the current implementation before modifying anything.

If the existing geometry, dipoles, calculations and animations are already correct, leave them unchanged.

If any molecule has an incorrect vector construction, arrow direction, partial-charge label, geometry, polarity classification or resultant, correct only the affected implementation.

Preserve the current molecule selector, tabs, responsive layout, styling and other working features.

Finally, test all listed molecules and provide a concise report showing which were already correct, which required correction and how the scientific accuracy was verified.

**The goal is not a redesign. The goal is a scientifically accurate, visually clear and consistent molecular polarity simulation across every molecule.**