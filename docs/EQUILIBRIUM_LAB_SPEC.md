# CLAUDE MASTER IMPLEMENTATION PROMPT
# e-Lab.school — EQUILIBRIUM LAB: DYNAMIC BALANCE

## Project Scope

Build a complete, scientifically accurate, visually engaging interactive simulation titled:

**Equilibrium Lab — Dynamic Balance**

This is for the existing e-Lab.school chemistry learning platform.

The simulation must teach:

1. The meaning of reversible reactions.
2. Forward and reverse reaction rates.
3. How dynamic equilibrium is established.
4. Why equal rates do not mean equal concentrations.
5. Equilibrium position: reactant-favored, balanced, product-favored.
6. How disturbances affect an established equilibrium.
7. Le Chatelier's principle.
8. Reaction-rate and concentration–time graphs.
9. Equilibrium constants and reaction quotients.
10. The effects of concentration, temperature, pressure, volume and catalysts.

**This must be one integrated simulation block, not multiple disconnected applications.**

Students must be able to choose between a simple everyday analogy and a detailed chemical model.

The everyday analogy introduces the concepts through two cities and two buses. The chemical model provides the actual chemistry, molecular structures, quantitative calculations and graphs.

Do not simply reproduce the attached reference image. It is a visual design guide. The implementation must be interactive, responsive and scientifically validated.

---

# PART 1 — OVERALL INTERFACE

## Main layout

Use a clean, premium e-Lab.school design with a light background, subtle lavender accents, rounded panels and clear typography.

Do not create an unnecessarily dark or cluttered dashboard.

The central visualization must occupy most of the available screen.

At the top, display:

**Equilibrium Lab — Dynamic Balance**

Subtitle:

"Discover how forward and reverse processes continue at equal rates, and how equilibrium responds to change."

Below the heading, provide a prominent mode selector:

**Everyday Analogy | Chemical Model | Compare Both**

These modes must be available inside the same simulation component.

When a teacher embeds the simulation into a lesson, students must be able to choose the mode without leaving the page.

Also support an optional initial mode setting so the teacher can decide whether the simulation opens in Everyday Analogy, Chemical Model or Compare Both.

The teacher must not need to create separate simulation blocks.

### General controls

- Start
- Pause
- Resume
- Reset
- Replay
- Step Forward
- Animation speed: 0.5×, 1×, 2×
- Show/Hide Graph
- Show/Hide Explanation
- Simple Wording

All controls must work.

Reset must restore the original initial conditions and clear the simulation history.

Pause must freeze the simulation state and graphs without resetting anything.

The selected mode and settings should remain stable when appropriate.

---

# PART 2 — EVERYDAY ANALOGY: TWO CITIES, TWO BUSES

## Purpose

Students must first understand equilibrium through a familiar situation.

Do not introduce complex chemical equations immediately.

The everyday analogy should be simple, enjoyable and easy to understand.

## Visual scene

Create two small city stations:

**City A — Left**

**City B — Right**

Connect them with a two-way road.

Use one blue bus traveling from A to B.

Use one orange/red bus traveling from B to A.

Each city has a clearly visible group of people waiting.

Use small, recognizable human figures.

Avoid excessively detailed scenery, unnecessary buildings, complex traffic or decorative objects.

The two stations, people and buses must be the focus.

People should be visually countable in small groups. For larger populations, use representative figures plus an accurate numerical counter.

### Initial state

Default initial population:

City A = 100 people.

City B = 0 people.

Total population = 100.

The blue bus begins transferring people from A to B.

The orange bus initially has no passengers because nobody is in B.

As B gains people, the reverse transfer begins.

The animation must show that both directions eventually become active.

Do not artificially delay the reverse process once people become available in B.

The reverse rate should emerge naturally from the model.

---

# PART 3 — MATHEMATICAL MODEL FOR THE EVERYDAY ANALOGY

The everyday analogy must be governed by an actual reversible-transfer model.

Let:

A(t) = number of people in City A.

B(t) = number of people in City B.

N = A + B = 100, unless people are added or removed.

Define the forward transfer rate:

r_f = k_f A

Define the reverse transfer rate:

r_r = k_r B

The population changes according to:

dA/dt = −k_f A + k_r B

dB/dt = k_f A − k_r B

At equilibrium:

k_f A_eq = k_r B_eq

Therefore:

B_eq / A_eq = k_f / k_r

The simulation must use these relationships consistently.

For the introductory analogy, explain rates as people transferred per unit time.

Do not imply that bus velocity is the same as reaction rate.

## Discrete passenger animation

The buses are a visual representation of transfer events.

The underlying mathematical model determines the number of people transferred.

Use an event-based or stochastic transfer model with transition probabilities based on the current populations and rate constants.

A suitable approach is to simulate forward and reverse transfer events with propensities:

a_f = k_f A

a_r = k_r B

For a discrete model, use a suitable stochastic simulation algorithm or an appropriately controlled tau-leaping approximation.

Never transfer more people than are available.

The visual animation must follow the calculated transfer events, not control the chemistry model.

### Bus behavior

Only two buses should be visible.

The blue bus represents forward transfer.

The orange bus represents reverse transfer.

Their travel animation may use a fixed visual trip duration.

The number of passengers transferred per unit time is controlled by the mathematical model.

For large transfer rates, aggregate multiple transfer events into the visible bus animation.

Do not allow the physical seating capacity of the illustrated bus to distort the mathematical rate.

The bus must not appear to carry an impossible number of visible passengers.

Use a representative occupancy display if required.

---

# PART 4 — EQUILIBRIUM POSITION SELECTOR

Provide three prominent selectable options:

**Towards A | Center | Towards B**

Students should be able to explore how equilibrium can be established with different population distributions.

Use the following presets for the introductory 100-person model:

| Preset | k_f | k_r | Expected A_eq | Expected B_eq |
|---|---:|---:|---:|---:|
| Towards A | 0.25 | 1.00 | 80 | 20 |
| Center | 1.00 | 1.00 | 50 | 50 |
| Towards B | 1.00 | 0.25 | 20 | 80 |

The rate constants are expressed in consistent inverse-time units.

All presets begin with 100 people in A and zero in B unless the student explicitly changes the initial conditions.

The simulation must animate the approach to equilibrium rather than immediately placing people in their final positions.

### Important teaching principle

At equilibrium, the populations do not have to be equal.

For example:

A = 80, B = 20.

Forward rate = 0.25 × 80 = 20 people per unit time.

Reverse rate = 1.00 × 20 = 20 people per unit time.

The rates are equal despite the different populations.

Use this example to reinforce that equal rates do not mean equal amounts.

### Equilibrium indicator

Provide a small visual indicator:

- Approaching equilibrium
- Near equilibrium
- Dynamic equilibrium attained

For a deterministic model, identify equilibrium when the forward and reverse rates agree within a specified numerical tolerance.

For the stochastic passenger model, the instantaneous transfer counts will fluctuate.

Therefore, use time-averaged rates or the underlying equilibrium condition to determine the displayed status.

Do not claim that exactly equal numbers of passengers must be transferred during every individual trip.

When equilibrium is reached, show:

**Dynamic equilibrium attained!**

"People continue moving in both directions, but the average transfer rates are equal. The populations remain constant on average."

Use a subtle success animation, not a distracting celebration.

---

# PART 5 — LIVE RATE GRAPH

In Everyday Mode, display one simple graph by default:

**Transfer Rate vs Time**

X-axis: Time.

Y-axis: People transferred per unit time.

Blue curve: A → B.

Orange/red curve: B → A.

Initially:

Forward rate is high.

Reverse rate is zero.

As time progresses:

Forward rate decreases.

Reverse rate increases.

Eventually:

Both rates approach the same value.

Show the point or region where equilibrium is attained.

Label:

**Forward rate = Reverse rate**

Both curves must remain at a positive value when the system has a nonzero dynamic equilibrium.

Do not draw the rates falling to zero at equilibrium.

The graph must use actual calculated values from the simulation.

Do not use decorative, prerecorded curves.

### Optional population graph

Provide a Show Population Graph toggle.

Display:

Population in A vs Time.

Population in B vs Time.

The populations should approach constant values.

Do not force the curves to intersect when the equilibrium populations are unequal.

---

# PART 6 — LE CHATELIER'S PRINCIPLE IN EVERYDAY MODE

Keep this section simple.

Provide four buttons:

**Add People to A**

**Remove People from A**

**Add People to B**

**Remove People from B**

Only enable these controls after the simulation has started, and allow their effects to be explored both before and after equilibrium.

### Example: Add people to A

Suppose the system is initially at equilibrium.

The student presses Add People to A.

Immediately:

A increases.

The forward transfer rate increases.

The reverse transfer rate is initially unchanged.

The system is no longer at equilibrium.

As additional people transfer from A to B:

The forward rate decreases from its disturbed value.

The reverse rate increases.

Eventually:

The two rates become equal again.

Display:

"Equilibrium disturbed."

"Forward transfer temporarily exceeds reverse transfer."

"System readjusting."

"New dynamic equilibrium attained."

The same logic must apply to adding or removing people from either city.

Do not simply play a fixed animation that ignores the actual populations.

### Important limitation

The everyday analogy represents a simple reversible transfer system.

It is not intended to explain chemical temperature effects, gas pressure or catalysts.

Do not introduce scientifically misleading bus-speed explanations for these factors.

Those controls belong in Chemical Model mode.

---

# PART 7 — CHEMICAL MODEL

## Purpose

This mode must be suitable for serious chemistry learning, including IB DP Chemistry and comparable advanced secondary curricula.

It must be scientifically rigorous while remaining understandable.

Students should see the relationship between:

- Reactant and product particles.
- Forward and reverse reactions.
- Concentration.
- Reaction rates.
- Equilibrium position.
- Equilibrium constants.
- Le Chatelier's principle.

## Reaction selector

Include at least these systems:

### Reaction 1 — Simple reversible model

A(g) ⇌ B(g)

This is the introductory chemical model.

Use two distinguishable particle types.

Provide adjustable k_f and k_r values.

This model connects directly to the two-city analogy.

### Reaction 2 — Nitrogen dioxide/dinitrogen tetroxide

N₂O₄(g) ⇌ 2NO₂(g)

N₂O₄ is comparatively colorless.

NO₂ is brown.

The forward dissociation is endothermic.

This reaction is particularly useful for exploring temperature, pressure and molecular stoichiometry.

### Reaction 3 — Haber process

N₂(g) + 3H₂(g) ⇌ 2NH₃(g)

Forward reaction is exothermic.

Use correct molecular structures and stoichiometry.

### Reaction 4 — Hydrogen iodide formation

H₂(g) + I₂(g) ⇌ 2HI(g)

Use this to illustrate a gaseous equilibrium with equal total gaseous stoichiometric coefficients on both sides.

### Reaction 5 — Iron(III) thiocyanate equilibrium

Fe³⁺(aq) + SCN⁻(aq) ⇌ FeSCN²⁺(aq)

Use a simplified aqueous-species model.

Show the characteristic red complex qualitatively.

Use this reaction primarily for concentration-change experiments.

Do not apply gas-pressure controls to the aqueous system.

---

# PART 8 — MOLECULAR VISUALIZATION

Use a large transparent reaction vessel.

Particles must have scientifically correct molecular compositions.

For N₂O₄:

Show two nitrogen atoms and four oxygen atoms in the correct connectivity.

For NO₂:

Show one nitrogen and two oxygen atoms in a bent arrangement.

For the Haber process:

N₂ must be diatomic.

H₂ must be diatomic.

NH₃ must have trigonal pyramidal geometry.

Do not use two identical spheres to represent chemically different polyatomic molecules.

Use distinct, consistent atom colors.

The molecular models should be smooth, clearly recognizable and appropriately sized.

### Molecular motion

Particles should move naturally inside the vessel.

Forward reaction events convert reactant molecules into products.

Reverse reaction events convert product molecules into reactants.

Conserve atoms during every reaction event.

For N₂O₄ ⇌ 2NO₂:

One N₂O₄ molecule produces two NO₂ molecules.

Two NO₂ molecules recombine to form one N₂O₄ molecule.

For the Haber process:

One N₂ and three H₂ molecules produce two NH₃ molecules.

The reverse process must conserve the same atoms.

Do not show arbitrary molecule transformations that violate stoichiometry.

### Scientific representation

The molecular animation is a simplified kinetic visualization.

Do not imply that every visible collision automatically causes a reaction.

If reaction events are displayed as collisions, ensure that the reaction probability is compatible with the selected kinetic model.

For complex reactions, distinguish the overall chemical equation from a literal elementary molecular mechanism.

Do not portray an overall multistep reaction as a verified single-step mechanism without justification.

---

# PART 9 — CHEMICAL KINETICS ENGINE

The underlying scientific model must be separate from the visual animation.

Do not use hardcoded graph curves.

For the simple elementary reversible reaction:

A ⇌ B

Use:

r_f = k_f[A]

r_r = k_r[B]

d[A]/dt = −r_f + r_r

d[B]/dt = r_f − r_r

For other reactions, use appropriate validated kinetic models.

Do not assume that every overall balanced equation directly determines the experimentally observed rate law.

Where a simplified mass-action model is used for an overall reaction, clearly label it as a teaching approximation.

The numerical integration must be stable, conserve atoms and avoid negative concentrations.

Use an appropriate ODE solver with controlled numerical error.

The simulation should maintain a single authoritative state from which particle counts, concentrations, rates, graphs and equilibrium indicators are derived.

---

# PART 10 — CONCENTRATION–TIME GRAPH

Display a concentration–time graph synchronized with the molecular simulation.

X-axis: Time.

Y-axis: Concentration (mol dm⁻³).

Each species should have a distinct, consistent color.

The graph must show:

- Initial concentrations.
- Changes during reaction.
- Approach to equilibrium.
- Constant equilibrium concentrations.
- Immediate disturbances when species are added or removed.
- Subsequent readjustment to a new equilibrium.

Do not automatically make reactant and product concentrations equal at equilibrium.

For N₂O₄ ⇌ 2NO₂, concentration changes must respect the 1:2 stoichiometric relationship.

For the Haber process, changes must respect the 1:3:2 stoichiometric relationship.

---

# PART 11 — REACTION RATE–TIME GRAPH

Display a separate graph for:

Forward reaction rate.

Reverse reaction rate.

Both curves must be calculated from the actual current state.

Initially, if only reactants are present:

Forward rate is positive.

Reverse rate is zero.

As products form, the reverse rate increases.

At equilibrium:

r_f = r_r.

Both rates generally remain nonzero.

When a disturbance occurs, show the appropriate immediate rate changes and the subsequent approach to a new common rate.

Do not force the new equilibrium rate to equal the previous equilibrium rate.

### Graph interactions

Allow:

- Hover to inspect values.
- Pause at a selected time.
- Replay.
- Reset.
- Show/hide individual curves.
- Mark equilibrium.
- Mark disturbances.
- Compare before and after a disturbance.

Use real data generated by the model.

---

# PART 12 — EQUILIBRIUM CONSTANT AND REACTION QUOTIENT

Provide an optional advanced panel.

For the simple reaction:

A ⇌ B

K_c = [B]_eq / [A]_eq

For N₂O₄ ⇌ 2NO₂:

K_c = [NO₂]² / [N₂O₄]

For the Haber process:

K_c = [NH₃]² / ([N₂][H₂]³)

Use equilibrium concentrations in the appropriate expressions.

Include the reaction quotient Q using current concentrations.

Compare Q with K.

If Q is less than K, the net reaction proceeds forward.

If Q is greater than K, the net reaction proceeds in reverse.

If Q equals K, the system is at equilibrium.

Use the correct convention for equilibrium constants, including standard-state treatment when presenting thermodynamic quantities.

For introductory learning, concentration-based expressions may be used with appropriate units and stated assumptions.

### Equilibrium position

For the simple A ⇌ B model, provide:

Towards reactants.

Balanced.

Towards products.

For complex reactions, do not equate K directly with a simple numerical ratio of molecule counts.

Explain that K describes the equilibrium relationship defined by the reaction expression.

A large K generally indicates a product-favored equilibrium in the appropriate thermodynamic sense.

A small K generally indicates a reactant-favored equilibrium.

---

# PART 13 — LE CHATELIER'S PRINCIPLE: CHEMICAL MODEL

This must be a fully functional section.

Provide controls for:

**Concentration**

Add reactant.

Remove reactant.

Add product.

Remove product.

**Temperature**

Increase temperature.

Decrease temperature.

**Pressure and Volume**

Increase pressure by decreasing volume.

Decrease pressure by increasing volume.

**Catalyst**

Add catalyst.

Remove catalyst.

Only display controls applicable to the selected reaction.

---

# PART 14 — CONCENTRATION DISTURBANCES

When a species is added or removed:

1. Apply the immediate concentration change.
2. Update the reaction quotient Q.
3. Recalculate the forward and reverse rates.
4. Show the direction of the resulting net reaction.
5. Animate the approach to the new equilibrium.
6. Update both graphs.
7. Display the final equilibrium concentrations.

At constant temperature, the equilibrium constant must remain unchanged.

### Example

For N₂O₄ ⇌ 2NO₂:

Adding N₂O₄ increases the forward tendency.

Removing NO₂ favors further NO₂ formation.

Adding NO₂ favors the reverse reaction.

The simulation must use actual Q and K calculations rather than only textual rules.

---

# PART 15 — TEMPERATURE CHANGES

Temperature must be modeled correctly.

For an endothermic forward reaction:

Increasing temperature favors products.

For an exothermic forward reaction:

Increasing temperature favors reactants.

However, do not implement this as a simple instantaneous switch.

Temperature affects reaction-rate constants and equilibrium constants.

Use thermodynamically consistent relationships.

For example, the van 't Hoff relationship may be used within a stated temperature range and with appropriate assumptions:

d(ln K)/dT = ΔH°/(RT²)

Use a suitable temperature dependence for forward and reverse kinetic constants.

Ensure their ratio remains consistent with the equilibrium constant for the modeled elementary reversible process.

If using an Arrhenius approximation, document the activation-energy assumptions.

Do not claim that increasing temperature always increases the forward rate more than the reverse rate.

The relative effects depend on the reaction energetics and kinetic parameters.

---

# PART 16 — PRESSURE AND VOLUME CHANGES

For ideal gaseous systems, changes in pressure caused by changes in volume can affect equilibrium composition.

The effect depends on the difference in gaseous stoichiometric coefficients.

### N₂O₄ ⇌ 2NO₂

Decreasing volume favors the side with fewer gas particles: N₂O₄.

Increasing volume favors the side with more gas particles: NO₂.

### Haber process

N₂ + 3H₂ ⇌ 2NH₃

Decreasing volume favors NH₃.

Increasing volume favors N₂ and H₂.

### H₂ + I₂ ⇌ 2HI

There is no change in total gaseous stoichiometric coefficients.

Under the ideal-gas model, changing volume does not change the equilibrium composition solely through the pressure effect.

### Implementation requirements

Use the ideal-gas relationships where appropriate.

Show the vessel physically expanding or contracting.

Update concentrations immediately after a volume change.

Recalculate Q and reaction rates.

Animate subsequent equilibration.

Distinguish pressure changes caused by changing volume from pressure changes caused by adding an inert gas.

Do not treat all pressure increases as equivalent.

At constant volume, adding an ideal inert gas does not shift the equilibrium of ideal reacting gases.

At constant pressure, adding inert gas may affect equilibrium through volume expansion.

Include this distinction in the advanced explanation if inert-gas controls are implemented.

---

# PART 17 — CATALYST

When a catalyst is added:

Show an increased rate of both forward and reverse reactions.

The system should approach equilibrium faster.

At constant temperature, the catalyst must not change:

- The equilibrium constant.
- The equilibrium position.
- The final equilibrium composition.

If the system is already at equilibrium, the forward and reverse rates may both increase, but they remain equal.

The equilibrium concentrations remain unchanged.

Do not show a catalyst shifting equilibrium towards products.

---

# PART 18 — INTERACTIVE LEARNING SEQUENCE

The simulation should guide students through a logical progression.

### Stage 1 — Observe

Begin with only reactants.

Watch the forward process.

### Stage 2 — Reverse Process

Observe products forming and the reverse process beginning.

### Stage 3 — Approaching Equilibrium

Watch forward and reverse rates converge.

### Stage 4 — Dynamic Equilibrium

Observe equal rates and constant average populations or concentrations.

### Stage 5 — Equilibrium Position

Compare reactant-favored, balanced and product-favored systems.

### Stage 6 — Disturb Equilibrium

Add or remove reactants/products.

### Stage 7 — Chemical Conditions

Explore temperature, pressure, volume and catalysts.

### Stage 8 — Explain

Students predict and explain the changes using rates, Q, K and Le Chatelier's principle.

The stages should guide learning without locking students into a rigid sequence.

Students must be able to explore freely.

---

# PART 19 — COMPARE BOTH MODE

Provide an optional side-by-side comparison.

Left:

Everyday Analogy.

Right:

Simple A ⇌ B Chemical Model.

Synchronize their underlying reversible-transfer behavior.

Both should show:

- Forward process.
- Reverse process.
- Approach to equilibrium.
- Equal rates.
- Constant populations or concentrations.

Use consistent visual colors.

Do not pretend that the analogy represents all aspects of real chemical reactions.

When comparing, clearly identify what the analogy explains and what it does not.

The detailed chemical model remains authoritative.

---

# PART 20 — VISUAL DESIGN REQUIREMENTS

Use the attached reference image for general layout and visual direction.

However, simplify the interface.

### Everyday Mode

The main focus must be:

Two stations.

Two buses.

People.

Live transfer rates.

One small graph.

Simple equilibrium-position controls.

Four disturbance buttons.

Avoid excessive cards and panels.

### Chemical Mode

The main focus must be:

Large molecular vessel.

Reaction equation.

Condition controls.

Concentration graph.

Reaction-rate graph.

Live equilibrium data.

### Colors

Use a consistent color scheme across the simulation.

Blue for the forward process.

Orange/red for the reverse process.

Use a separate clearly distinguishable color for other chemical species when required.

Use accessible contrast and avoid relying only on color.

### Animations

Smooth, natural and scientifically meaningful.

No random particle transformations.

No excessive particle trails.

No unnecessary bouncing or exaggerated effects.

Maintain good performance on typical school computers.

---

# PART 21 — RESPONSIVE AND EMBEDDED BEHAVIOR

The simulation must work within the existing e-Lab.school simulation block.

Do not create a separate standalone website.

Do not interfere with existing lesson content, navigation, authentication or progress tracking.

Support desktop, laptop and tablet layouts.

On smaller screens, stack graphs below the main visualization.

Avoid horizontal scrolling for primary controls.

Provide fullscreen functionality if supported by the existing simulation framework.

The simulation must load reliably inside the lesson editor and student lesson view.

---

# PART 22 — SCIENTIFIC AND TECHNICAL VALIDATION

Before reporting completion, verify the following.

## Everyday Model

- Starts with 100 people in A and zero in B.
- Forward transfer begins immediately.
- Reverse transfer emerges when B gains people.
- Total population is conserved unless people are deliberately added or removed.
- Forward and reverse rates converge.
- Equal rates do not require equal populations.
- Left, center and right equilibrium presets produce the expected distributions.
- Adding/removing people causes the correct transient response.
- Stochastic fluctuations are handled correctly.
- Graphs correspond to actual transfer events or modeled rates.

## Chemical Model

- All chemical formulas are correct.
- Molecular structures are correct.
- Every reaction conserves atoms.
- Stoichiometric coefficients are respected.
- Rate equations match the selected kinetic assumptions.
- Concentrations remain nonnegative.
- Q and K are calculated correctly.
- Equilibrium occurs when forward and reverse rates match.
- Concentrations remain constant at equilibrium.
- Temperature effects are thermodynamically consistent.
- Pressure/volume effects respect gaseous stoichiometry.
- Catalysts do not change equilibrium composition.
- Graphs update correctly after disturbances.
- The equilibrium indicator uses numerical tolerances rather than exact floating-point equality.
- The simulation remains stable over long runs.

## Specific test cases

Test:

1. A ⇌ B with K = 0.25.
2. A ⇌ B with K = 1.
3. A ⇌ B with K = 4.
4. Addition of A at equilibrium.
5. Addition of B at equilibrium.
6. Removal of A and B.
7. N₂O₄ temperature increase.
8. N₂O₄ volume decrease.
9. Haber process volume decrease.
10. H₂ + I₂ ⇌ 2HI volume change.
11. Catalyst addition before equilibrium.
12. Catalyst addition at equilibrium.
13. Reset during a disturbance.
14. Switching between Everyday, Chemical and Compare Both modes.
15. Long-duration simulation stability.

---

# PART 23 — DEVELOPMENT INSTRUCTIONS

Inspect the existing e-Lab.school architecture and simulation components before implementing.

Reuse established styling, controls and infrastructure where appropriate.

Separate:

- Simulation state.
- Scientific calculation engine.
- Particle/bus animation.
- Graph rendering.
- User controls.
- Educational explanations.

Use a single authoritative simulation state.

Avoid duplicating scientific logic across components.

Use deterministic seeds for repeatable tests where stochastic simulation is used.

Make numerical parameters explicit and documented.

Use reasonable defaults.

Avoid unsupported numerical claims or invented experimental data.

Ensure that the implementation is maintainable and can later be extended to additional equilibrium systems.

---

# PART 24 — FINAL ACCEPTANCE CRITERIA

The implementation is complete only when:

1. Everyday Mode works independently.
2. Chemical Mode works independently.
3. Compare Both mode works.
4. Both buses animate continuously where transfer events occur.
5. The equilibrium-position selector functions correctly.
6. Forward and reverse rates are calculated correctly.
7. Equilibrium is identified correctly.
8. Disturbances cause physically appropriate responses.
9. All chemical equations and molecular structures are correct.
10. Reaction-rate and concentration graphs reflect the actual simulation.
11. Le Chatelier's principle is demonstrated correctly.
12. All controls work.
13. The simulation performs well inside e-Lab.school.
14. The production build passes.
15. Existing functionality remains intact.

Do not report completion based only on the interface appearing correct.

Test the scientific behavior, calculations, graphs and user interactions.

If a requested physical effect cannot be modeled reliably, identify the limitation rather than presenting a scientifically incorrect animation.

## FINAL DESIGN PHILOSOPHY

**First, let students experience equilibrium. Then let them understand the chemistry.**

Everyday Mode should make students discover that equilibrium is dynamic, not static.

Chemical Mode should show why forward and reverse rates become equal, why concentrations remain constant, and how a system responds to disturbances.

The final simulation must be intuitive enough for a beginner and scientifically meaningful enough for advanced chemistry students.

Build this as a polished, complete e-Lab.school learning experience, with scientific correctness taking priority over decorative visual effects.