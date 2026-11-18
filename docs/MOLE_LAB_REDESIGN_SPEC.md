# CLAUDE — FINAL MOLE LAB REDESIGN AND IMPLEMENTATION

## Project: e-Lab.school
## Simulation: Mole Lab — The Mole in Action

I have uploaded several reference images showing exactly how I want the redesigned Mole Lab to look.

**Study ALL the reference images carefully before changing any code.** They are the primary visual design references for the simulation.

The existing Mole Lab is already implemented in my e-Lab.school project, but I am not satisfied with its appearance or complexity. It currently resembles an outdated 3D computer game, with too many controls, panels, predictions, sliders and unnecessary interactions.

I want you to **redesign and refine the existing simulation**, not create another application.

My expectation is simple:

**A premium, realistic, interactive 3D chemistry laboratory that I can use as a teacher to explain the mole concept clearly, one idea at a time.**

The student should understand the concept primarily by looking at and interacting with the visual—not by reading long explanations or operating complicated controls.

---

# 1. FIRST PRIORITY — MATCH THE REFERENCE IMAGES

The uploaded images establish the expected visual quality.

Follow their overall composition, object proportions, transparent materials, laboratory environment, lighting, typography, packet arrangement and minimal interface.

Do not simply insert the reference images into the simulation. Recreate the objects as functional, interactive 3D elements.

### Visual expectations

- Premium, realistic 3D laboratory appearance.
- Bright, elegant, softly blurred laboratory background.
- Realistic transparent zip-lock plastic.
- Small, densely packed, shiny molecular particles.
- Subtle reflections, highlights and soft shadows.
- Realistic digital balance and laboratory glassware.
- Smooth, natural animations.
- Clean and spacious layout.
- Large central objects that are easy to observe.
- Professional typography and restrained colors.
- Minimal controls.

Avoid the existing dark-gray, polygonal, video-game appearance.

Avoid oversized 3D objects with flat colors, primitive wireframes, harsh lighting, cartoonish particle models and distracting glowing effects.

The laboratory should look like a modern, high-quality educational visualization.

**Visual realism and conceptual clarity are more important than adding extra features.**

---

# 2. THE UNIVERSAL ONE-MOLE PACKET — MOST IMPORTANT REQUIREMENT

Every stage must use the same standard transparent zip-lock bag.

**ONE FULL PACKET = ONE MOLE.**

This rule must never change.

### Packet quantities

- 0.25 mol → one quarter-filled packet.
- 0.50 mol → one half-filled packet.
- 0.75 mol → one three-quarter-filled packet.
- 1.00 mol → one completely filled packet.
- 1.50 mol → one full packet and one half-filled packet.
- 2.00 mol → two full packets.
- 2.50 mol → two full packets and one half-filled packet.
- 3.00 mol → three full packets.

Never represent three moles using three large molecules inside a single packet.

Never make the packet physically smaller to represent a smaller amount.

All bags must have identical reference dimensions.

For a partially filled packet, the unused plastic should appear empty and naturally folded or rolled down.

### Particle appearance

This is extremely important.

I do not want 20–30 large balls inside each packet.

I want **hundreds of very small, glossy, densely packed representative particles**, like the original mole-packet reference image.

The particles should look like tiny polished marbles.

For individual atoms, use small spheres.

For molecules, use connected spheres with scientifically correct atomic composition.

Examples:

- H₂: many tiny pairs of joined hydrogen spheres.
- O₂: many tiny pairs of joined oxygen spheres.
- H₂O: many tiny bent groups of two hydrogen spheres and one oxygen sphere.
- CO₂: many tiny linear O–C–O groups.
- NH₃: many tiny trigonal-pyramidal molecular groups.
- CH₄: many tiny tetrahedral molecular groups.

Molecules must remain distinguishable when zoomed in, even though they appear densely packed from the normal camera view.

Use efficient rendering, such as instanced meshes, so the browser remains smooth.

A full packet should preferably contain approximately 300–600 representative molecular groups, with automatic quality adjustment for device performance.

These are visual models, not the literal number of particles in a mole.

### Labels

Each packet should have a small, neat sticker showing the substance formula.

Below each packet, display its mole quantity.

Examples:

H₂ — 1.00 mol

O₂ — 1.00 mol

H₂O — 0.50 mol

Keep labels readable but visually unobtrusive.

Display Avogadro's constant only once in a small reference section:

**1 mol = 6.022 × 10²³ specified entities**

Include a short explanation that the packets are a counting analogy, not actual molar-volume containers.

---

# 3. SIMPLIFY THE ENTIRE USER INTERFACE

Remove the current excessive controls.

I do not want:

- Large prediction panels permanently occupying the screen.
- Multiple numerical input fields for the same quantity.
- Numerous sliders and step-size buttons.
- Repeated instructions.
- Separate Inspect, Split, Combine and Open Zipper buttons everywhere.
- Complicated procedural sequences.
- Excessive cards and side panels.
- Large calculation sections always visible.

Use only the controls necessary for the selected concept.

### Recommended layout

**Top:** Mole Lab title and six simple navigation tabs.

**Center:** One large, realistic interactive experiment.

**Side or bottom:** A compact substance selector and a few quantity choices.

**Bottom:** One concise explanation or calculation.

Allow students to expand additional explanations when needed.

The experiment should occupy approximately 75–85% of the main visual workspace wherever screen dimensions permit.

Do not sacrifice the experiment's visibility to accommodate unnecessary interface elements.

The simulation should work comfortably at normal desktop size, not only in fullscreen mode.

---

# 4. STAGE 1 — EXPLORE THE MOLE

This should be the simplest and most visually impressive stage.

### Initial appearance

Show one large transparent zip-lock packet filled with hundreds of tiny, shiny particles.

Default substance: H₂O.

Provide a simple substance dropdown and mole-quantity selection.

### Suggested substances

Include at least:

1. H₂O
2. CO₂
3. NH₃
4. CH₄
5. H₂
6. O₂
7. Mg
8. Fe
9. NaCl
10. NaOH

Use chemically appropriate molecular or lattice representations.

### Quantity choices

Provide simple choices:

0.25 mol | 0.50 mol | 1.00 mol | 1.50 mol | 2.50 mol | 3.00 mol

When a quantity is selected, the packet arrangement should change smoothly.

For example, selecting 2.50 mol should immediately show two full bags and one half-filled bag.

Students should understand the quantity by looking at the bags.

### Optional inspection

Allow the student to click or zoom into the packet to see the molecular structure more clearly.

Do not require a complicated inspection sequence.

For compounds, provide a small optional explanation of formula composition.

For example:

1 mol H₂O contains 2 mol H atoms and 1 mol O atoms.

Keep the primary screen visually simple.

---

# 5. STAGE 2 — MASS ↔ MOLES

Follow the uploaded premium digital-balance reference image.

### Appearance

Show one or more realistic mole packets resting on a high-quality digital laboratory balance.

The balance must have realistic geometry, glass or metal materials, soft reflections and a clearly readable digital display.

### Substance library

Include ten examples:

Mg, Ca, Fe, Al, Cu, Zn, C, S, Na and Ag.

### Interaction

The student selects a substance and a mole quantity.

The balance immediately displays the corresponding mass.

Examples using rounded teaching values:

**Magnesium**

1 mol ≈ 24.3 g

0.5 mol ≈ 12.2 g

2 mol ≈ 48.6 g

**Calcium**

1 mol ≈ 40.1 g

0.5 mol ≈ 20.0 g

2 mol ≈ 80.2 g

Use consistent molar masses internally and round displayed results appropriately.

### Visual distinction

Use appropriate color-coded glossy particles for different elements.

Calcium particles may appear slightly larger than magnesium particles as a visual design convention, but this must not imply that atomic size determines molar mass.

### Calculation

Display only the relevant relationship:

m = n × M

or

n = m / M

Do not fill the interface with multiple calculation controls.

Include a simple optional toggle to switch between calculating mass from moles and calculating moles from mass.

The digital balance should update smoothly.

---

# 6. STAGE 3 — CONCENTRATION

Retain the existing scientific calculation engine, but redesign the interface to match the premium visual style.

### Appearance

Use realistic glass beakers, transparent liquids, mole packets and a volumetric flask.

### Main interaction

The student selects a solute amount.

For example:

10 g NaOH = 0.25 mol.

A quarter-filled packet appears.

The student drags the packet toward the beaker and pours the particles into water.

Use a realistic, controlled pouring animation.

Show the particles dissolving.

For NaOH, represent Na⁺ and OH⁻ ions in the microscopic view.

The student selects a final solution volume.

The simulation displays the concentration.

Example:

10 g NaOH = 0.25 mol.

Final solution volume = 100 mL.

Concentration = 2.50 mol dm⁻³.

### Comparison

Allow two beakers to appear side by side.

For the same final volume:

10 g NaOH → 2.50 mol dm⁻³.

20 g NaOH → 5.00 mol dm⁻³.

The second beaker should show a higher density of dissolved ions.

### Dilution

Keep the amount of solute constant and increase the final solution volume.

The microscopic view should show the same number of representative solute ions spread through a larger volume.

### Important

Use final solution volume, not simply the initial water volume.

Do not make the concentration stage a complicated multi-step procedural game.

The student should be able to understand concentration through a few direct interactions.

---

# 7. STAGE 4 — GAS VOLUME

Follow the uploaded Gas Volume reference design.

### Appearance

Show a beautiful transparent gas chamber or cylinder with realistic glass materials and small moving gas molecules.

Avoid primitive wireframe boxes.

### Gas library

Include ten gases:

H₂, O₂, N₂, CO₂, NH₃, CH₄, He, Ne, Ar and CO.

### Main concept

At the same temperature and pressure, equal amounts of ideal gases occupy equal volumes.

Use the approximate IB RTP convention:

1 mol ≈ 24 dm³.

### Interaction

Select a gas and mole quantity.

Examples:

0.5 mol → 12 dm³.

1 mol → 24 dm³.

2 mol → 48 dm³.

The chamber should visibly change volume when the mole quantity changes.

When the student switches between H₂, O₂ and CO₂ while keeping the amount at 1 mol, the chamber volume should remain the same.

Only the molecular models should change.

This is the most important visual observation.

Use small, realistic, continuously moving gas molecules.

### Scientific note

Display the selected temperature and pressure conditions.

Explain that the approximate 24 dm³ mol⁻¹ relationship applies under the selected RTP convention and is not universal.

An advanced gas-law calculation may remain available behind an optional control, but it must not clutter the default interface.

---

# 8. STAGE 5 — CHEMICAL EQUATIONS

Follow the uploaded Chemical Equations reference image closely.

### Default reaction

2H₂(g) + O₂(g) → 2H₂O(l)

### Initial display

**Reactants**

Two full packets of H₂.

One full packet of O₂.

**Products**

Two full packets of H₂O.

Every packet has the same reference capacity.

Every full packet contains hundreds of tiny, glossy representative molecular groups.

### Interaction

Provide a simple **Run Reaction** button.

When clicked:

1. The reactant packets are highlighted.
2. The representative molecules animate toward the reaction area.
3. The molecular arrangement changes to represent product formation.
4. The product packets appear.
5. The mole ratio is displayed.

Show:

2 mol H₂ + 1 mol O₂ → 2 mol H₂O.

The student should understand the balanced equation visually.

### Additional reactions

Provide a dropdown containing ten scientifically validated balanced reactions.

Include water formation, ammonia synthesis, magnesium combustion, methane combustion, iron oxidation and sodium reacting with water.

For each reaction, ensure correct formulas, coefficients, physical states and products.

The product packets represent mole quantities; they must not imply that aqueous products are literally isolated dry substances.

### Keep it simple

Do not display numerous independent packet controls.

Use:

Reaction selector | Run Reaction | Reset

Optionally include a Step button for observing the process.

The mole ratio should be visually obvious without extensive explanation.

---

# 9. STAGE 6 — LIMITING REAGENTS

Follow the uploaded Limiting Reagents reference image closely.

### Default reaction

2H₂ + O₂ → 2H₂O.

### Example

Initial amounts:

3 mol H₂.

1 mol O₂.

Display:

Three full H₂ packets.

One full O₂ packet.

### After running the reaction

Show:

**Products formed**

Two full H₂O packets.

**Remaining unreacted**

One full H₂ packet.

### Result

Limiting reagent: O₂.

Excess reagent: H₂.

Product formed: 2 mol H₂O.

H₂ remaining: 1 mol.

### Interaction

Allow students to change the initial reactant quantities using simple mole selectors.

Provide:

Run Reaction | Reset

The simulation should automatically calculate the limiting reagent and remaining amounts.

Use the existing reaction engine where scientifically correct.

For fractional amounts, use partially filled packets.

### Important

Do not show three moles as three molecules inside one bag.

Three moles must always appear as three full one-mole packets.

The result must be visually obvious through the packet arrangement.

Avoid complicated controls, large prediction panels and excessive explanatory text.

---

# 10. SHARED VISUAL SYSTEM

All six tabs must use the same:

- Zip-lock bag design.
- Bag dimensions.
- Particle rendering style.
- Substance color conventions.
- Lighting system.
- Laboratory environment.
- Label styling.
- Camera quality.
- Animation quality.
- Typography.
- UI components.

Do not create six unrelated visual designs.

The simulation should feel like one coherent premium educational product.

---

# 11. TECHNICAL IMPLEMENTATION

Use the existing React and Three.js/React Three Fiber architecture.

Reuse scientifically correct calculation code.

Refactor overly complicated UI components where necessary.

Separate:

- Chemistry calculations.
- Substance data.
- Mole packet rendering.
- Particle rendering.
- Laboratory equipment.
- Animation logic.
- User interaction.
- Stage-specific content.

### Rendering quality

Use physically based materials, appropriate environment lighting, antialiasing and soft shadows.

Use realistic transparent materials without excessive GPU cost.

Use instanced meshes for densely packed particles.

Keep labels sharp and readable.

Use a carefully chosen camera angle.

Avoid excessive bloom, unrealistic glow and unnecessary graphical effects.

### Performance

The simulation must run smoothly on ordinary school laptops.

Use adaptive quality settings.

Avoid expensive full soft-body simulations.

Use controlled animations that look physically convincing.

Do not sacrifice scientific accuracy for animation.

---

# 12. IMPORTANT SCIENTIFIC REQUIREMENTS

The simulation must not introduce misconceptions.

1. One mole is a quantity of specified entities, not a fixed physical volume.
2. Packet dimensions are conceptual and identical for every substance.
3. The visible particles are representative models.
4. Molecular geometry and atomic composition must be correct.
5. Ionic compounds must not be represented as ordinary discrete molecules.
6. Mass calculations must use correct molar masses.
7. Concentration must use final solution volume.
8. NaOH(aq) must be represented as dissolved ions.
9. Equal gas volumes apply at the same temperature and pressure under the ideal-gas approximation.
10. Balanced chemical equations must conserve atoms.
11. Limiting-reagent calculations must follow stoichiometric ratios.
12. Product and leftover packet quantities must match the calculations exactly.

---

# 13. WHAT TO REMOVE FROM THE CURRENT SIMULATION

Remove unnecessary complexity from the default student experience.

Specifically simplify or remove:

- Permanently visible prediction quizzes.
- Large right-hand control panels.
- Duplicate numerical inputs.
- Excessive sliders.
- Multiple step-size controls.
- Repeated explanatory paragraphs.
- Complicated drag-and-drop procedures.
- Unnecessary packet-management buttons.
- Primitive wireframe containers.
- Dark, game-like laboratory environments.
- Oversized particles.
- Empty-looking packets with only a few molecules.
- Large unused spaces in the 3D scene.

Preserve useful scientific functionality internally where appropriate.

The objective is not to delete the chemistry engine but to present it more effectively.

---

# 14. VISUAL VERIFICATION — MANDATORY

Before declaring the redesign complete, compare the implemented simulation against every uploaded reference image.

Check:

- Does the laboratory look premium and realistic?
- Are the packets large and clearly visible?
- Is the plastic convincingly transparent?
- Are there hundreds of tiny, shiny particles?
- Are molecular groups chemically correct?
- Are all bags identical in standard capacity?
- Do partial packets appear partially filled and rolled?
- Does 2.5 mol show two full packets and one half packet?
- Does the digital balance look realistic?
- Does the gas chamber look like glass rather than a wireframe?
- Are the chemical equation packet ratios correct?
- Are the limiting-reagent results visually correct?
- Is the interface significantly simpler than before?
- Can a student understand the main concept without reading a long explanation?

Take screenshots of all six completed stages and inspect them at normal desktop resolution.

If the implementation still looks like the previous game-style version, continue improving the materials, lighting, geometry, camera, background and layout.

Do not consider a successful build alone proof of visual quality.

---

# 15. DEVELOPMENT AND COMPLETION

Inspect the existing code first.

Preserve the correct scientific calculation engine.

Refactor the presentation and interaction layers.

Implement the shared premium packet component before updating individual stages.

Then update all six stages consistently.

Run the existing tests, new scientific tests, type checks and production build.

Verify that the simulation works within the existing e-Lab.school platform without breaking other lessons or simulations.

Do not claim a feature works unless it has been implemented and tested.

If a visual effect cannot be reproduced exactly, use the closest performant 3D approximation and clearly identify the limitation.

## FINAL EXPECTATION

I am not asking for more functionality.

I am asking for **better visual quality, better scientific communication and a much simpler learning experience**.

The uploaded reference images are the visual standard.

The transparent one-mole zip-lock packet is the central concept.

One packet = one mole.

A full packet must look densely filled with hundreds of tiny, shiny representative particles.

Two moles = two full packets.

Three moles = three full packets.

Half a mole = one half-filled, partly rolled packet.

Apply this consistently to all six stages.

**Build something that looks like a premium, professionally designed 3D chemistry learning experience—not a complex simulation game.**

The final result should be beautiful enough for classroom projection, simple enough for students to understand immediately, scientifically accurate enough for IB DP Chemistry, and efficient enough to run on normal school computers.

Do not add new controls or complexity unless they directly improve understanding.

**Redesign the existing Mole Lab accordingly, verify all six stages, and only then report completion.**