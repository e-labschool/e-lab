# e-Lab.school — Universal Simulation Audit, Fullscreen Fixes and Functional Improvements

Claude, I want you to perform a **complete, universal audit and correction of all interactive simulations across e-Lab.school**, including the earliest simulations developed under Structure 1 and the latest simulations developed for spectroscopy.

This is a website-wide improvement, not a request to redesign individual simulations.

**Important: The latest simulations, particularly the spectroscopy simulations, are generally functioning well. Preserve their existing design and functionality. Focus especially on correcting older simulations, while ensuring that every simulation follows the same standards.**

## TASK 1 — Fix Fullscreen Layout Issues Across All Simulations

Some of the earlier simulations have serious layout problems when expanded into fullscreen mode.

For example, in the **Building an Atom** simulation, the main atom visualization occupies too much space. The side controls for adding protons, neutrons and electrons become partially hidden behind the atom visualization or are pushed outside the visible screen.

This makes the simulation difficult or impossible to operate.

### Required corrections

1. Audit every simulation in the website, including Structure 1, Reactivity units and spectroscopy.
2. Ensure that all controls, tabs, sliders, buttons, dropdowns, labels, legends and explanatory panels remain fully visible and accessible in fullscreen mode.
3. The main visualization must never overlap, cover or push control panels outside the viewport.
4. Use responsive layouts that automatically adjust to the available screen dimensions.
5. On desktop screens, arrange the simulation and its control panels proportionately. For example, the visualization can occupy approximately 65–70% of the available width, while the controls occupy the remaining 30–35%, where appropriate.
6. On smaller screens, automatically rearrange the layout so that controls remain accessible.
7. If the content exceeds the available height, enable scrolling within the appropriate panel rather than hiding controls.
8. Ensure that no controls are covered by sticky headers, navigation bars or other elements.
9. Avoid horizontal scrolling wherever possible.
10. Test both normal embedded mode and fullscreen mode.

**Critical requirement:** The visualization must resize to fit the available space. It must not force the control panel to shrink, disappear or become inaccessible.

Use appropriate responsive CSS, flexbox/grid layouts, minimum-width constraints and overflow handling.

For canvas-based, SVG-based and WebGL-based simulations, ensure that the rendering area recalculates its dimensions correctly whenever fullscreen mode is entered or exited.

Do not simply reduce the entire simulation using CSS scaling, as this can make labels and controls unreadable.

## TASK 2 — Implement Fullscreen and Open-in-New-Tab Options Universally

Some older simulations, particularly those developed initially under **Structure 1**, do not have an option to expand the simulation into fullscreen mode or open it in a separate browser tab.

I want these options available consistently across every simulation on e-Lab.school.

### Required controls

Every simulation should have two clearly identifiable controls:

**1. Fullscreen**

- Expands the simulation to occupy the available screen.
- Preserves all interactive controls.
- Allows the user to exit fullscreen easily.
- Supports the Escape key where browser fullscreen is used.
- Automatically adjusts the simulation layout.
- Does not reset the simulation state unnecessarily.

**2. Open in New Tab**

- Opens the same simulation in a dedicated browser tab.
- Uses the maximum available browser viewport.
- Displays the complete simulation with all its controls.
- Does not require the user to navigate through the lesson editor.
- Allows the simulation to function independently of the lesson page.

Use compact, recognizable icons with tooltips such as "Fullscreen" and "Open in New Tab".

### Implementation requirements

Create a reusable simulation wrapper or shared component that provides these controls consistently.

Apply this wrapper to every existing and future simulation, including older Structure 1 simulations.

Avoid individually rewriting every simulation when a shared solution is possible.

If a simulation already has functioning fullscreen controls, preserve or integrate them without creating duplicate buttons.

Ensure that simulations continue to work correctly when embedded inside a Learn lesson, opened in a new tab or expanded to fullscreen.

## TASK 3 — Building an Atom: Independent Particle Controls

The Building an Atom simulation currently has a functional issue.

When I add a proton, a neutron is sometimes added automatically.

I do not want this to happen by default.

Students should be able to add or remove protons, neutrons and electrons independently so that they can investigate atomic structure, isotopes and ions.

### Required correction

Provide three independent particle controls:

- Protons: + / −
- Neutrons: + / −
- Electrons: + / −

When the automatic balancing option is disabled, changing one particle count must not automatically change the other two counts.

For example:

- Adding one proton should increase the proton count by exactly one.
- Adding one neutron should increase only the neutron count.
- Adding one electron should increase only the electron count.

### Add a checkbox

**☐ Auto-balance particles**

The checkbox must be unchecked by default.

**When unchecked:**

Allow complete independent control of proton, neutron and electron counts.

Students must be able to create neutral atoms, ions and isotopes manually.

**When checked:**

Automatically adjust the electron count to match the proton count, maintaining a neutral atom.

For neutron balancing, use an appropriate reference isotope only when reliable isotope data is available. Do not assume that the neutron count always equals the proton count.

If automatic neutron selection is supported, clearly identify which isotope is being selected and allow the user to change it manually when auto-balance is disabled.

### Scientific accuracy

The simulation must update the following values dynamically:

- Atomic number = number of protons
- Mass number = protons + neutrons
- Net charge = protons − electrons
- Element identity determined by proton count
- Isotope identity determined by proton and neutron counts

Do not automatically convert the atom into a different isotope merely because a proton is added while auto-balance is off.

When particle counts correspond to an unstable or uncommon isotope, the simulation may display an informative indication without preventing students from exploring the structure.

### Layout correction

Ensure the particle controls remain clearly visible alongside the atom visualization in fullscreen mode.

The atom must resize to fit its available display area rather than covering the controls.

## TASK 4 — Heating and Cooling Curve Simulation

Review the existing Heating Curve simulation under Structure 1.

I want this simulation to support **both heating and cooling**, while maintaining a clear connection between the temperature graph and the behavior of particles.

### Layout

Use a split-screen layout:

**Left panel — Particle Visualization**

Show particles inside a container, illustrating the behavior of matter during the selected process.

**Right panel — Temperature–Time Graph**

Show the corresponding heating or cooling curve.

The particle visualization and graph must remain synchronized.

### Add a mode selector

Provide two modes:

**Heating | Cooling**

### Heating Mode

Show the transition:

Solid → Liquid → Gas

The heating curve should include:

1. Heating the solid
2. Melting plateau
3. Heating the liquid
4. Boiling plateau
5. Heating the gas

The particle animation should show appropriate changes in arrangement, motion and separation.

During melting and boiling plateaus, the temperature remains constant for a pure substance at constant pressure while energy is absorbed during the phase change.

### Cooling Mode

Show the reverse transition:

Gas → Liquid → Solid

The cooling curve should include:

1. Cooling the gas
2. Condensation plateau
3. Cooling the liquid
4. Freezing plateau
5. Cooling the solid

During condensation and freezing, energy is released while the temperature remains constant during the phase change under the same idealized conditions.

### Synchronization

The graph and particle model must respond to the same simulation state.

For example:

- When the graph reaches the melting plateau, the particle model should gradually change from solid-like to liquid-like behavior.
- When the graph reaches the boiling plateau, the particle model should gradually change from liquid-like to gas-like behavior.
- During cooling, the corresponding reverse changes should occur.
- A moving marker should indicate the current position on the graph.

### Interactive controls

Include:

- Play / Pause
- Reset
- Heating / Cooling selector
- Progress slider to move through the curve manually
- Optional animation-speed control, only if it does not clutter the interface

Students should be able to move the slider backward and forward and observe the corresponding particle behavior and graph position.

Use one common progress state so that the graph and particle model cannot become desynchronized.

### Scientific accuracy

Particle animations should illustrate the kinetic particle model accurately.

Do not imply that particles themselves expand or shrink during heating or cooling.

During a phase-change plateau, show the gradual change in particle arrangement rather than incorrectly increasing the temperature.

For an idealized heating/cooling curve, label the axes clearly:

- Y-axis: Temperature
- X-axis: Time

If the simulation assumes constant heating or cooling power, make that assumption clear.

Use an appropriate example substance and consistent melting/boiling temperatures. Do not apply water's transition temperatures to every substance.

### Fullscreen layout

Both the particle visualization and temperature graph must remain fully visible in fullscreen mode.

On smaller screens, stack the panels vertically if needed.

Do not allow either panel to overlap the other.

## TASK 5 — Universal Functional and Responsive Testing

After implementing the corrections, perform a systematic audit of every existing simulation.

Check the following:

**Display and layout**
- Embedded lesson view
- Fullscreen view
- Open-in-new-tab view
- Desktop and laptop resolutions
- Smaller tablet and mobile viewports
- Browser zoom at 100%, 125% and 150%

**Controls**
- Buttons remain clickable.
- Sliders respond correctly.
- Dropdowns and tabs remain visible.
- Labels do not overlap.
- No controls disappear behind the visualization.
- Reset functions correctly.
- Fullscreen exit works correctly.

**Simulation behavior**
- Particle counts update accurately.
- Animations remain synchronized with graphs.
- State changes are reflected immediately.
- Switching between modes does not cause rendering errors.
- No unintended automatic changes occur.
- Simulations remain scientifically accurate.

**Technical stability**
- Check for JavaScript errors.
- Check for console warnings related to rendering.
- Ensure fullscreen transitions do not cause layout failures.
- Prevent event-listener duplication or memory leaks.
- Avoid unnecessary rerenders that reduce animation performance.

## TASK 6 — Preserve Existing Work

This is especially important.

Do not redesign or unnecessarily modify simulations that are already working correctly.

The latest spectroscopy simulations have more refined layouts and interactions. Use their successful responsive behavior as a reference where appropriate.

Preserve:

- Existing scientific content
- Existing animations
- Existing simulation functionality
- Existing lesson links
- Existing student progress and saved data
- Existing e-Lab visual identity
- Existing working controls and navigation

Do not delete, replace or reset existing simulations.

Use targeted corrections and reusable shared components wherever possible.

## TASK 7 — Deliver a Verification Report

After completing the implementation, provide a concise report containing:

1. Total number of simulations audited.
2. Simulations that were missing fullscreen or new-tab controls.
3. Simulations where layout issues were identified and fixed.
4. Confirmation of independent proton, neutron and electron controls.
5. Confirmation that the Auto-balance checkbox works correctly.
6. Confirmation that both heating and cooling modes work correctly.
7. Any simulations requiring further attention.

Do not claim a simulation has been tested unless it has actually been opened and verified.

## Final Expectation

**Every simulation on e-Lab.school must be fully functional, responsive, scientifically accurate and accessible in embedded mode, fullscreen mode and a separate browser tab.**

No simulation should have hidden controls, overlapping panels, inaccessible buttons or clipped content.

The Building an Atom simulation must support independent particle manipulation with optional automatic balancing.

The Heating Curve simulation must become a synchronized Heating and Cooling Curve simulation with accurate particle behavior and temperature graphs.

Implement these changes universally without compromising the existing website, student experience or simulations that already work correctly.