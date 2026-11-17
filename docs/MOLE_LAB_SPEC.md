# CLAUDE MASTER DEVELOPMENT INSTRUCTION
# e-Lab.school | MOLE LAB — THE MOLE IN ACTION

## PRIMARY INSTRUCTION

Develop a complete, premium-quality, scientifically accurate, highly interactive Mole Lab within the existing e-Lab.school project.

You already have the project source code. Inspect the existing architecture, components, routing, simulation registration, design system and dependencies before making any changes.

**Do not build a separate application. Do not replace existing functionality. Do not create a basic prototype and present it as finished.**

The simulation must be production-quality, visually convincing, educationally meaningful and fully functional.

The central teaching principle is:

**One mole is a fixed quantity of entities. The same mole-packet model connects particle counting, mass, concentration, gas volume, stoichiometry and limiting reagents.**

Implement all six stages as one connected simulation, with shared substance data, scientific calculations, packet components and interaction systems.

---

# PART A — NON-NEGOTIABLE SCIENTIFIC RULES

## A1. Definition of the mole

Use the exact Avogadro constant internally:

Nₐ = 6.02214076 × 10²³ mol⁻¹.

Display:

**1 mole = 6.022 × 10²³ specified entities**

The entities may be atoms, molecules, ions, formula units or other specified particles.

Do not imply that one mole always means molecules.

One mole of Fe means one mole of Fe atoms.

One mole of H₂O means one mole of H₂O molecules.

One mole of NaOH means one mole of NaOH formula units.

## A2. The mole packet is a conceptual model

Every transparent zip-lock bag has a fixed reference capacity of one mole.

This does not mean that one mole of every substance occupies the same physical volume.

The bags are a visual counting analogy.

**Do not imply that the bag dimensions represent actual molar volume, density or physical packing.**

A permanent information panel must explain this distinction.

The displayed marbles are representative entities, not a literal count of 6.022 × 10²³ particles.

## A3. Molecular and ionic structures

Use chemically appropriate representations.

H₂O: bent molecular geometry, approximately 104.5°.

CO₂: linear, 180°.

NH₃: trigonal pyramidal.

CH₄: tetrahedral.

H₂, O₂ and N₂: diatomic molecules.

NaCl(s): ionic lattice of Na⁺ and Cl⁻.

NaOH(s): ionic solid containing Na⁺ and OH⁻.

NaOH(aq): hydrated Na⁺ and OH⁻ ions.

Mg and Fe: metallic atomic arrangements, not isolated molecular compounds.

For molecular substances, the packet may contain repeated molecular models. For ionic or metallic substances, use representative lattice fragments or appropriate entity models.

Clearly label all simplifications.

## A4. Distinguish counting from chemical reactions

When students separate H₂O molecules into hydrogen and oxygen atoms in Stage 1, label this as **Formula Composition / Counting View**.

This is a conceptual separation for counting atoms, not a spontaneous chemical decomposition of water.

For one mole of H₂O:

- 1 mol H₂O molecules.
- 2 mol H atoms.
- 1 mol O atoms.
- 3 mol atoms in total.

Do not show two moles of H₂ molecules or one mole of O₂ molecules as the direct result of this counting operation.

Likewise, the reverse operation should restore the original counting model, not imply that free atoms spontaneously react under ordinary conditions.

## A5. Molar masses

Use a consistent atomic-mass data source and appropriate significant figures.

For teaching examples, allow simplified values when explicitly labeled.

Mg = 24.0 g mol⁻¹ (simplified teaching value).

NaOH = 40.00 g mol⁻¹.

H₂O ≈ 18.02 g mol⁻¹.

The scientific engine should not silently switch between rounded and more precise values.

## A6. Conservation and numerical integrity

All transfers must conserve the amount of substance.

Splitting a packet must not create or destroy entities.

Pouring must subtract the transferred amount from the source and add it to the destination.

Reaction animations must conserve atoms.

Where relevant, conserve charge.

Use numerical tolerances to avoid floating-point artifacts such as 0.30000000000000004.

Never derive chemistry calculations from rendered particle counts.

---

# PART B — PREMIUM 3D PACKET SYSTEM

## B1. Standard bag

Create a reusable 3D transparent zip-lock packet.

Every packet has exactly the same standard geometry and maximum conceptual capacity of one mole.

The bag must include:

- Clear flexible-looking plastic.
- Realistic folds and subtle wrinkles.
- Transparent front and back.
- Red/blue resealable zipper.
- Soft reflections and highlights.
- Subtle shadow on the laboratory surface.
- Small substance sticker.
- Quantity label below the packet.
- Realistic tiny, glossy, color-coded particles.

Use an efficient 3D rendering approach, preferably React Three Fiber and Three.js where compatible with the existing project.

Avoid excessive reflections or transparency effects that make the particles difficult to see.

## B2. Packet filling rules

The standard packet must never be resized to represent different mole quantities.

For a quantity n:

Full packets = floor(n).

Partial packet = fractional remainder of n, if nonzero.

Examples:

0 mol: empty packet or no packet, depending on context.

0.25 mol: one quarter-filled packet.

0.50 mol: one half-filled packet.

0.75 mol: one three-quarter-filled packet.

1.00 mol: one full packet.

1.50 mol: one full packet plus one half-filled packet.

2.50 mol: two full packets plus one half-filled packet.

3.75 mol: three full packets plus one three-quarter-filled packet.

For non-round values such as 0.333 mol, display a proportional filling and the actual amount.

**Important:** The filling fraction must represent the fraction of the packet's conceptual one-mole capacity. Do not calculate a physical fill height from the actual substance density.

The bag can fold or roll as it empties, but its original one-mole reference dimensions must remain identifiable.

## B3. Representative particle rendering

Use many small particles, not oversized marbles.

Use instanced rendering where possible.

The particle population should scale visually with the packet's fractional amount.

For molecular substances, use molecular groups with correct atomic composition rather than replacing a molecule with a single unlabeled sphere.

Allow the particle-rendering system to adapt its detail level to device performance.

Do not attempt to render Avogadro's number literally.

Do not use randomly changing particle counts that imply changes in the underlying amount.

## B4. Packet manipulation

Students must be able to:

- Select a packet.
- Drag it.
- Release it.
- Open the zipper.
- Close the zipper.
- Tilt it.
- Pour from it.
- Inspect its contents.
- Split its amount.
- Combine compatible quantities.
- Reset its position.

Dragging should have visual feedback, including slight lifting, shadow changes and target highlighting.

Do not allow a closed packet to pour.

Do not allow incompatible particles to be combined into a packet without an explicitly defined mixture operation.

Do not allow the amount in a packet to exceed one mole. Overflow must create additional packets.

## B5. Transfer mechanics

Use a proper interaction state machine:

Idle → Selected → Dragging → Target Detected → Open → Tilting → Pouring → Transfer Complete.

A failed drop should return the bag safely to its previous position.

Dragging outside the experiment area must not lose or delete a packet.

During pouring:

1. Validate the destination.
2. Confirm that the bag is open.
3. Animate the tilt.
4. Begin particle transfer.
5. Update the source and destination amounts together.
6. Animate the remaining particles settling.
7. Display the resulting quantity and calculation.

A cancelled or interrupted animation must leave the chemistry state consistent.

Do not allow double-clicking, repeated drops or rapid interactions to duplicate material.

Provide an accessible **Pour** button as an alternative to dragging.

---

# PART C — SIMULATION LAYOUT

Use a premium virtual laboratory design.

Top navigation:

1. Explore the Mole
2. Mass ↔ Moles
3. Concentration
4. Gas Volume
5. Chemical Equations
6. Limiting Reagents

Only one stage should be displayed at a time.

The central 3D laboratory workspace should occupy most of the available area.

Keep controls in a compact contextual panel.

Keep calculations in a separate expandable panel.

Provide a small persistent mole-reference panel.

Use clear, contrasting labels and readable typography.

Do not place unnecessary text over laboratory objects.

Support fullscreen mode.

On tablets and mobile devices, reorganize controls without clipping the experiment.

Use the existing e-Lab.school visual language while giving this simulation a polished laboratory appearance.

---

# PART D — SIX FULLY FUNCTIONAL STAGES

## STAGE 1 — EXPLORE THE MOLE

### Purpose

Understand the mole as a counting unit and connect chemical formulas to particle composition.

### Initial scene

Show a single transparent one-mole packet on a laboratory table.

Provide a substance selector.

Start with H₂O.

The packet should contain many small, representative water molecules.

### Interaction sequence

1. Student selects a substance.
2. The packet updates with the appropriate particles.
3. Student opens Inspect.
4. Camera zooms into representative particles.
5. Student selects an individual molecule or formula unit.
6. The structure enlarges with element labels.
7. Student selects Count Constituent Atoms.
8. The composition is displayed.
9. Student selects Separate into Counting Packets.
10. New labeled packets appear with the corresponding mole quantities.

For 1 mol H₂O:

2 mol H atoms → two full H packets.

1 mol O atoms → one full O packet.

Allow the student to change the original quantity to 0.5 mol or 1.5 mol and repeat the calculation.

For 0.5 mol H₂O:

1 mol H atoms and 0.5 mol O atoms.

For 1.5 mol H₂O:

3 mol H atoms and 1.5 mol O atoms.

The results must always follow the chemical formula.

For ionic substances, describe the composition in terms of formula units and constituent ions.

### Educational explanation

Explain that the subscript indicates the number of atoms of an element per molecule or formula unit, while the coefficient or mole quantity determines how many such entities are present.

Do not confuse subscripts with stoichiometric coefficients.

---

## STAGE 2 — MASS ↔ MOLES

### Purpose

Connect mass, molar mass and amount of substance.

### Initial scene

Show a digital balance, substance selector, standard mole packet and calculation panel.

Start with magnesium.

### Interactive controls

- Substance selector.
- Mass input.
- Mass slider.
- Add/remove mass buttons.
- Reverse conversion toggle.
- Split packet.
- Combine packets.
- Reset.

### Example

Mg molar mass = 24.0 g mol⁻¹.

6 g → 0.25 mol.

12 g → 0.50 mol.

24 g → 1.00 mol.

36 g → 1.50 mol.

60 g → 2.50 mol.

### Visual behavior

As mass increases, the packet fills progressively.

When the amount exceeds one mole, create additional packets.

When the amount decreases, empty the last packet first.

Use smooth transitions rather than instantly replacing the scene.

Show:

n = m / M

and

m = nM

Provide a live explanation of the calculation.

### Validation

Reject negative masses.

Handle zero correctly.

Handle decimal values.

Reject nonnumeric inputs.

Avoid division by zero.

Support reasonable mass ranges without generating hundreds of 3D packets; for very large amounts, use an expandable grouped-packet representation with an exact numerical label.

---

## STAGE 3 — CONCENTRATION LABORATORY

### Purpose

Prepare, compare and dilute solutions.

This stage must have especially detailed interactions.

### Laboratory objects

- Digital balance.
- Standard NaOH mole packets.
- Glass beakers.
- Water source.
- Measuring cylinder.
- Volumetric flask.
- Stirring tool.
- Solution-volume controls.
- Microscopic particle viewer.
- Two-beaker comparison mode.

### Experiment 1 — Prepare a solution

Select 10.0 g NaOH.

M = 40.00 g mol⁻¹.

n = 0.250 mol.

Display one quarter-filled NaOH packet.

Student drags the packet to the beaker.

Student opens the zipper.

Student tilts the packet.

NaOH solid particles fall into water.

Show dissolution into hydrated Na⁺ and OH⁻ ions.

The student stirs the solution.

Then the student transfers or prepares the solution to a final volume of 100 mL using the volumetric flask.

Calculate:

C = 0.250 / 0.100 = 2.50 mol dm⁻³.

### Critical distinction

The final solution volume is 100 mL.

Do not automatically assume that adding solute to 100 mL of water produces exactly 100 mL of solution.

The volumetric flask should demonstrate making a solution up to the calibration mark.

### Experiment 2 — Increase solute amount

Use 20.0 g NaOH.

n = 0.500 mol.

Final volume = 100 mL.

C = 5.00 mol dm⁻³.

Display a half-filled packet.

Show more dissolved ions per unit volume in the microscopic view.

### Experiment 3 — Change volume

Keep 10.0 g NaOH.

Compare final volumes of 100 mL and 200 mL.

The calculated concentrations should be 2.50 and 1.25 mol dm⁻³.

The amount of solute remains constant.

### Experiment 4 — Dilution

Allow students to take a measured aliquot from a stock solution and dilute it to a new final volume.

Use:

C₁V₁ = C₂V₂.

Track the moles transferred with the aliquot.

Do not confuse transferring an aliquot with transferring the entire stock solution.

### Experiment 5 — Compare two solutions

Provide two independent beakers.

Students can vary solute mass and final solution volume separately.

Show both concentrations and microscopic particle distributions.

Use the same visualization scale when comparing particle densities.

### Scientific safeguards

Represent aqueous NaOH as hydrated ions.

Do not show intact NaOH molecules floating in solution.

Do not use arbitrary liquid darkness to represent NaOH concentration.

Do not model dissolving NaOH as instantaneous in a way that implies no thermal effect. Include a brief note that NaOH dissolution is exothermic, while keeping the main calculation model at specified conditions.

Use a virtual-laboratory safety note because concentrated NaOH is corrosive.

For the initial version, restrict the supported solution substances to validated, soluble examples with clearly defined dissolution behavior.

---

## STAGE 4 — GAS VOLUME LABORATORY

### Purpose

Connect the amount of gas to its volume.

### Scene

A transparent gas container with moving molecular particles, a movable piston or expandable chamber, temperature display, pressure display and mole packets.

### Interaction

1. Select gas.
2. Select amount in moles.
3. Drag a packet to the gas chamber.
4. Release the represented gas into the chamber.
5. Observe the particles spreading throughout the container.
6. Observe the chamber volume changing at constant temperature and pressure.
7. Change the amount and compare.

### Default mode

Use the approximate IB room-temperature-and-pressure convention:

Vₘ ≈ 24.0 dm³ mol⁻¹.

0.5 mol → 12.0 dm³.

1.0 mol → 24.0 dm³.

2.0 mol → 48.0 dm³.

### Advanced mode

Use:

PV = nRT.

Temperature must be in kelvin.

Pressure and volume units must be consistent with the chosen value of R.

For example, use SI units internally with R = 8.314462618 J mol⁻¹ K⁻¹.

Clearly state the conditions used.

### Scientific safeguards

The particles must be in continuous random motion.

Do not show gas molecules settling at the bottom of the container.

Do not imply that all gases have the same density.

Do not imply that the volume remains 24 dm³ mol⁻¹ at all temperatures and pressures.

The gas packet remains a conceptual amount-of-substance model, not a literal compressed storage bag.

---

## STAGE 5 — CHEMICAL EQUATIONS

### Purpose

Visualize mole ratios from balanced equations.

### Initial reaction

2H₂ + O₂ → 2H₂O.

Start with this reaction because it is visually clear and avoids complications of aqueous ionic products.

### Interaction

1. Display a balanced equation.
2. Show reactant packets.
3. Student predicts product quantities.
4. Student drags reactant packets into a virtual reaction zone.
5. Validate reactant quantities.
6. Animate representative molecular rearrangement.
7. Display product packets.
8. Show the mole ratio.
9. Allow the student to repeat with scaled quantities.

For:

2 mol H₂ + 1 mol O₂

Produce:

2 mol H₂O.

For:

4 mol H₂ + 2 mol O₂

Produce:

4 mol H₂O.

### Additional supported reactions

N₂ + 3H₂ → 2NH₃.

2Mg + O₂ → 2MgO.

2Na + 2H₂O → 2NaOH + H₂.

### Scientific safeguards

Reactions must be atom-balanced.

Include state symbols where appropriate.

For sodium reacting with water, represent NaOH as an aqueous product, with Na⁺ and OH⁻ ions, and H₂ as a gas.

Do not show a dry packet of solid NaOH as the literal immediate product of sodium reacting in water.

A product packet can be used as a conceptual mole-quantity summary, but must be labeled as such.

Use appropriate notes explaining that actual reactions depend on conditions and may be hazardous.

The animations must represent atom rearrangement, not atoms appearing or disappearing.

---

## STAGE 6 — LIMITING REAGENTS

### Purpose

Understand limiting reactants, excess reactants and theoretical yield.

### Default reaction

2H₂ + O₂ → 2H₂O.

### Example

Provide:

3 mol H₂.

1 mol O₂.

O₂ is limiting.

2 mol H₂ is consumed.

1 mol H₂ remains.

2 mol H₂O is produced.

### Interaction

Students adjust reactant amounts independently.

Show the correct full and partially filled packets.

Allow the student to predict which reactant will be limiting.

Then run the reaction.

Animate the appropriate reactant quantities being consumed.

Show the excess amount remaining.

Display product quantities.

### Reaction calculation

Use the general reaction extent method.

For each reactant:

available moles / stoichiometric coefficient.

The smallest value determines the maximum reaction extent.

Calculate reactant consumption and product formation from that value.

### Advanced features

Allow fractional mole quantities.

Allow the user to enter reactant masses instead of moles.

Calculate theoretical product mass.

Include a clearly separated optional percentage-yield extension, where actual yield is explicitly supplied rather than assumed.

### Edge cases

Handle zero reactant quantity.

Handle exactly stoichiometric quantities.

Handle equal limiting-ratio values without falsely identifying only one reactant as limiting.

Handle large excess amounts.

Prevent negative leftover quantities caused by floating-point errors.

---

# PART E — SHARED CHEMISTRY ENGINE

Create independent, unit-tested modules for:

1. Substance data.
2. Formula composition.
3. Mole and mass calculations.
4. Packet decomposition.
5. Particle visualization mapping.
6. Solution calculations.
7. Dilution calculations.
8. Gas calculations.
9. Reaction stoichiometry.
10. Limiting reagent calculations.

The visual components must read from these models.

Do not hardcode calculations into individual animations.

Do not duplicate scientific formulas across six different UI components.

Use a single authoritative experiment state.

Changes must be deterministic and reproducible.

Store exact numerical quantities separately from formatted display strings.

---

# PART F — VISUAL AND INTERACTION QUALITY

The simulation must look like a polished, modern virtual laboratory.

Use a restrained premium color palette consistent with e-Lab.school.

Keep the experiment visually dominant.

The 3D objects should be convincing from the chosen viewing angle.

The transparent bags must remain readable against the background.

Use realistic lighting, but avoid excessive glow, distracting neon outlines or cartoonish effects.

All particle colors should remain consistent across the stages.

Use smooth animations for:

- Packet filling.
- Packet emptying.
- Opening and closing the zipper.
- Dragging and dropping.
- Pouring.
- Dissolution.
- Particle dispersion.
- Gas expansion.
- Molecular rearrangement.
- Packet splitting and combining.

Provide pause, replay and reset where useful.

Animations must never override scientific state.

If an animation is skipped or interrupted, the final quantities must remain correct.

---

# PART G — EDUCATIONAL DESIGN

The simulation must behave like a personal tutor guiding students through the mole concept.

Each stage should follow:

**Predict → Interact → Observe → Explain → Apply**

Students should encounter a brief question before revealing a calculation.

Allow them to explore freely without forcing a rigid tutorial every time.

Provide optional guided mode and free-exploration mode.

In guided mode, introduce controls progressively.

In free mode, make all valid controls available.

Include concise feedback explaining why a prediction is correct or incorrect.

Avoid overwhelming students with long paragraphs.

Show equations when they become relevant to the student's actions.

Use appropriate IB DP Chemistry terminology, but keep the interface curriculum-neutral.

---

# PART H — PERFORMANCE AND RELIABILITY

Optimize for school laptops with integrated graphics and approximately 8 GB RAM.

Use instanced meshes, efficient materials and controlled particle counts.

Avoid unnecessary soft-body physics.

Reduce graphical detail automatically on less capable devices.

Support mouse, touch and keyboard interactions.

Ensure controls are accessible on tablets.

Provide reduced-motion support.

Handle WebGL failure gracefully.

Prevent memory leaks when changing stages.

Clean up animation loops, event listeners, geometries and materials when components unmount.

Ensure switching tabs does not accidentally carry over incompatible experiment state.

Do not introduce global CSS changes that affect other e-Lab.school simulations.

---

# PART I — INTEGRATION REQUIREMENTS

Register Mole Lab within the existing simulation library.

Reuse existing routing and access-control patterns.

Preserve the current Learn editor and lesson content.

Preserve existing authentication and user progress.

Do not change unrelated Supabase policies or database tables.

Do not add unnecessary packages.

If an existing package can perform the task, use it.

Keep the implementation modular and maintainable.

Use consistent naming conventions and TypeScript types where the project supports them.

---

# PART J — MANDATORY TEST CASES

Before calling the project complete, test at least the following.

### Packet quantities

0.25 mol → one quarter packet.

0.50 mol → one half packet.

1.00 mol → one full packet.

1.50 mol → one full and one half packet.

2.50 mol → two full and one half packet.

0 mol → no material.

### Formula composition

1 mol H₂O → 2 mol H atoms + 1 mol O atoms.

0.5 mol H₂O → 1 mol H atoms + 0.5 mol O atoms.

1 mol CO₂ → 1 mol C atoms + 2 mol O atoms.

1 mol NH₃ → 1 mol N atoms + 3 mol H atoms.

### Mass conversion

12 g Mg / 24 g mol⁻¹ = 0.50 mol.

36 g Mg / 24 g mol⁻¹ = 1.50 mol.

10 g NaOH / 40 g mol⁻¹ = 0.25 mol.

### Concentration

10 g NaOH, final volume 100 mL → 2.50 mol dm⁻³.

20 g NaOH, final volume 100 mL → 5.00 mol dm⁻³.

10 g NaOH, final volume 200 mL → 1.25 mol dm⁻³.

### Dilution

50 mL of 2.0 mol dm⁻³ stock solution diluted to 200 mL final volume → 0.50 mol dm⁻³.

### Gas volume

1 mol at the stated RTP approximation → 24 dm³.

0.5 mol → 12 dm³.

2 mol → 48 dm³.

### Limiting reagent

3 mol H₂ + 1 mol O₂ → 2 mol H₂O, with 1 mol H₂ remaining.

3 mol Na + 2 mol H₂O → 2 mol NaOH and 1 mol H₂, with 1 mol Na remaining.

### Interaction tests

Dragging must work.

Opening must work.

Closed bags must not pour.

Pouring must conserve quantities.

Splitting must conserve quantities.

Combining must conserve quantities.

Reset must restore the initial state.

Repeated clicks must not duplicate material.

Changing stages must not corrupt the experiment.

Touch and keyboard alternatives must function.

### Integration tests

Run the existing project build.

Run TypeScript checks.

Run existing automated tests.

Run the new scientific tests.

Verify the simulation registration and navigation.

Check responsive layouts.

Verify that unrelated simulations still load.

---

# PART K — DEFINITION OF COMPLETE

Do not declare Mole Lab complete simply because all six tabs are visible.

A stage is complete only when:

1. Its experiment renders correctly.
2. Its controls work.
3. Its scientific calculations are correct.
4. Its animations reflect those calculations.
5. Its educational explanations are accurate.
6. Its reset and error handling work.
7. It is usable on supported devices.
8. Relevant tests pass.

If any feature is incomplete, identify it explicitly rather than presenting it as finished.

Do not substitute static images or decorative animations for required interactions.

Do not use placeholder scientific calculations.

Do not silently remove features because they are difficult.

If a particular physical effect is too computationally expensive, use a scientifically faithful and visually convincing approximation and document the simplification.

---

# FINAL DEVELOPMENT DIRECTIVE

Build Mole Lab as a flagship e-Lab.school simulation.

It should feel like students are manipulating real laboratory objects while learning an abstract chemical quantity.

The fixed one-mole transparent zip-lock packet is the unifying visual concept.

Every stage must reuse that concept consistently.

Prioritize:

**Scientific accuracy → Functional interaction → Educational clarity → Premium visual quality → Performance → Integration stability.**

Implement the full simulation, inspect the results, run the required tests, correct identified issues and provide a precise completion report.

The final report must distinguish implemented and tested features from any remaining limitations.

Do not mark the work complete until all six stages meet the acceptance criteria.