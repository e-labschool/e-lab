# CLAUDE — FINAL CORRECTION COMMAND
## e-Lab.school | Collision Theory Visualizer — Reaction Rates

Inspect and correct the **existing Collision Theory Visualizer** in the e-Lab.school source code. Do not rebuild the simulation or change its overall design unnecessarily.

The existing simulation has three major problems:

1. The reaction-rate graph fluctuates excessively instead of clearly showing the decreasing rate as reactants are consumed.
2. Products automatically convert back into reactants, making an irreversible reaction appear reversible.
3. The Maxwell–Boltzmann distribution is poorly scaled, and both graphs contain unwanted vertical histogram bars.

**I want only smooth, continuous curve graphs. Remove the vertical bars completely. Do not retain them as optional toggles.**

## 1. Correct the reaction mechanism

Locate the existing collision engine, particularly:

`src/engines/collision-theory-visualizer/lib/collisionEngine.js`

The current implementation uses a steady/replenishment mechanism that automatically restores products to reactants.

Remove this behavior from the standard simulation.

The default reaction must be irreversible:

**A + B → C + D**

A successful collision occurs only when:

- The collision has sufficient energy.
- The reactive sites are correctly oriented.

Once products C and D form, they must remain products throughout the experiment.

Do not automatically regenerate A or B from products.

Ensure that the total number of modeled particle units is conserved.

As the reaction proceeds, A and B should gradually decrease, while C and D increase.

If a limiting reactant becomes exhausted, product formation must stop.

Apply the appropriate irreversible-reaction logic to the solid A + B mode as well.

## 2. Correct the reaction-rate graph

Locate:

`components/RateGraph.jsx`

The existing graph displays large fluctuations resembling an ECG.

Replace this presentation with a clean, smooth, continuous reaction-rate curve.

For the standard irreversible closed-system reaction, the expected overall behavior is:

- Relatively high initial reaction rate.
- Gradual decrease as reactants are consumed.
- A smooth downward curve.
- Rate approaching zero as the reaction approaches completion.

The graph must be scientifically calculated from the simulation's changing reactant populations and reaction conditions.

**Do not hardcode an exponential curve or artificially force the graph to decline.**

Use a suitable rate calculation and smoothing approach that reflects the underlying model.

If using a simple bimolecular model, the reaction-rate tendency should depend on the availability of both A and B, alongside temperature, activation energy, collision orientation and any catalyst effects.

### Graph requirements

- X-axis: Time (s).
- Y-axis: Reaction rate (reactions s⁻¹), or another clearly defined consistent unit.
- One smooth blue reaction-rate curve.
- No vertical bars.
- No histogram.
- No background columns.
- No raw one-second reaction-count bars.
- No unnecessary spikes.
- No artificially imposed curve shape.

If the existing graph has a Products option, preserve it as a separate line-graph view.

The Products graph should show cumulative product formation increasing and gradually leveling off.

Use a proper cumulative count or amount on the Products graph, not the reaction-rate axis.

The reaction-rate and product-formation curves must remain synchronized with the actual particle simulation.

## 3. Remove all vertical bars from the graphs

This is a mandatory design change.

**Remove vertical histogram bars completely from BOTH graphs.**

### Reaction-rate graph

Remove the existing vertical bars representing successful reactions per time interval.

Display only the continuous reaction-rate curve.

### Maxwell–Boltzmann graph

Remove the vertical histogram bars representing sampled molecular kinetic energies.

Display only:

- The smooth theoretical Maxwell–Boltzmann distribution curve.
- A clearly labeled activation-energy threshold line.
- A subtle shaded region under the curve beyond the activation-energy threshold.
- Appropriate axis labels and units.

Do not add a toggle to bring back the histogram bars.

Do not retain the bars as a hidden advanced option.

They are not required for this simulation.

## 4. Correct the Maxwell–Boltzmann distribution

Locate:

`components/MbGraph.jsx`

Inspect the existing Maxwell–Boltzmann calculations and graph scaling.

For the three-dimensional translational kinetic-energy distribution, the curve must:

1. Begin at zero when kinetic energy is zero.
2. Rise smoothly to a maximum.
3. Gradually decrease.
4. Have a longer tail extending towards higher energies.
5. Have a total normalized area of one.

The curve must not be artificially symmetrical.

Use the scientifically correct kinetic-energy distribution.

At temperature T, the most probable translational kinetic energy is:

E_mode = RT/2

when energy is expressed per mole.

At 400 K, this is approximately 1.66 kJ mol⁻¹.

The existing fixed 0–70 kJ mol⁻¹ axis compresses the peak near the left side of the graph.

Implement appropriate adaptive scaling so the peak and tail are clearly visible.

If the activation-energy threshold is outside the main displayed energy range, provide a clearly labeled zoom or full-range option.

Do not distort the distribution to fit the threshold.

### Temperature behavior

Increasing temperature should:

- Broaden the energy distribution.
- Reduce its peak height.
- Shift the peak towards higher energies.
- Increase the fraction of molecules above a fixed activation-energy threshold.

Decreasing temperature should produce the opposite changes.

The total area under the curve must remain one.

### Catalyst behavior

Adding a catalyst must not alter the Maxwell–Boltzmann distribution at constant temperature.

Instead, show a lower effective activation-energy threshold for the catalyzed pathway.

Ensure that the curve, threshold and shaded region update correctly.

## 5. Maintain scientific consistency

Inspect the relationship between the collision engine, reaction-rate calculations and displayed graphs.

The simulation must distinguish:

- Molecular kinetic energy.
- Relative collision energy.
- Activation-energy requirements.
- Collision orientation.
- Successful collision frequency.
- Reaction rate.

Do not imply that every collision above the displayed molecular energy threshold necessarily results in a reaction.

The orientation requirement must remain relevant.

Ensure the rate curve responds correctly when students change:

- Temperature.
- Concentration.
- Activation energy.
- Reactive-site width.
- Catalyst.
- Surface area in solid-reactant mode.

Changing these conditions must affect the actual reaction calculation, not merely the graph appearance.

## 6. Preserve existing functionality

Keep the existing:

- A + B collision mode.
- Solid A + B mode.
- Particle animations.
- Temperature slider.
- Concentration slider.
- Activation-energy slider.
- Reactive-site orientation slider.
- Catalyst control.
- Successful/unsuccessful collision feedback.
- Reaction event viewer.
- Pause, Step, Replay and Reset.
- Simulation-speed controls.
- Rate/Products graph selector.
- Existing e-Lab.school visual styling.

Do not modify unrelated simulations.

## 7. Testing and verification

Test the following before reporting completion:

1. Products remain products and never revert automatically.
2. Reactant counts decrease as successful collisions occur.
3. Product counts increase monotonically.
4. The average reaction rate decreases as reactants become depleted under unchanged conditions.
5. The rate approaches zero when a limiting reactant is exhausted.
6. The Products graph approaches a plateau.
7. Neither graph contains vertical histogram bars.
8. The Maxwell–Boltzmann curve begins at zero, rises to a peak and declines with a right-hand tail.
9. The energy distribution remains correctly normalized.
10. Temperature changes produce the correct distribution behavior.
11. Catalyst changes affect the effective activation-energy threshold without altering the distribution at fixed temperature.
12. The rate curve responds to concentration, temperature, orientation and surface-area changes.
13. The graphs and particle simulation use consistent data.
14. Reset correctly restores the initial reactants and clears previous graph data.
15. The simulation works correctly in fullscreen and embedded lesson views.
16. Existing tests and the production build pass.

## 8. Final implementation instructions

Inspect these existing files and any related dependencies:

- `lib/collisionEngine.js`
- `lib/rateMetrics.js`
- `lib/maxwellBoltzmann.js`
- `components/RateGraph.jsx`
- `components/MbGraph.jsx`
- `CollisionTheoryVisualizer.jsx`

Make targeted corrections rather than rebuilding working components.

Remove obsolete histogram-rendering logic, unused imports, unused state and obsolete replenishment controls where applicable.

Do not introduce duplicate graph components or unnecessary new dependencies.

After implementing, report:

- Files modified.
- Reaction-model corrections.
- Graph corrections.
- Maxwell–Boltzmann corrections.
- Scientific validation results.
- Build/test results.

**FINAL EXPECTATION**

The simulation must show an irreversible reaction where successful collisions produce stable products, reactants are gradually consumed, and the reaction-rate curve clearly demonstrates the decrease in average reaction rate over time.

Both graphs must use clean, continuous curves without vertical bars.

The Maxwell–Boltzmann distribution must be mathematically correct, properly scaled and visually understandable.

Scientific accuracy, clear student understanding and preservation of existing functionality are mandatory.