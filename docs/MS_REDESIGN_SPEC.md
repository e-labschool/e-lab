# e-Lab.school — Mass Spectrometry Simulation Redesign

## Objective

Refactor the existing Mass Spectrometry simulation in e-Lab.school from 13 separate instructional stages into **one continuous, interactive mass spectrometry experiment organized into six teaching stages**.

This is a redesign of the existing implementation, not a request to build another simulation.

The existing scientifically accurate components, physics models, spectrum calculations and interactive features must be preserved wherever appropriate.

The primary goal is to help students understand how a population of molecules produces a mass spectrum.

**The student must see the entire journey:**

Sample molecules → Ionization → Molecular fragmentation → Acceleration → Mass analysis → Detection → Spectrum formation.

Keep this journey visually connected.

The implementation must remain scientifically accurate, curriculum-neutral, easy to navigate, visually polished and suitable for teacher-led classroom demonstrations.

---

## 1. IMPORTANT — Inspect the existing project first

Examine the current Mass Spectrometry implementation, particularly:

- `src/engines/spectroscopy-studio/ms/MsWorkbench.jsx`
- `src/engines/spectroscopy-studio/ms/state/msState.js`
- `src/engines/spectroscopy-studio/ms/state/MsContext.jsx`
- `src/engines/spectroscopy-studio/ms/components/InstrumentScene.jsx`
- `src/engines/spectroscopy-studio/ms/components/IonisationScene.jsx`
- `src/engines/spectroscopy-studio/ms/components/FragmentScene.jsx`
- `src/engines/spectroscopy-studio/ms/components/AccelerationScene.jsx`
- `src/engines/spectroscopy-studio/ms/components/SectorScene.jsx`
- `src/engines/spectroscopy-studio/ms/components/TofScene.jsx`
- `src/engines/spectroscopy-studio/ms/components/DetectScene.jsx`
- `src/engines/spectroscopy-studio/ms/components/MsSpectrum.jsx`
- `src/engines/spectroscopy-studio/ms/data/fragmentation.js`
- `src/engines/spectroscopy-studio/ms/data/spectra.js`

Preserve existing working functionality and review the associated physical calculations.

Do not unnecessarily rewrite established components.

## 2. New six-stage teaching sequence

Replace the current 13-stage learner navigation with:

1. **Instrument & Sample**
2. **Ionization**
3. **Fragmentation**
4. **Acceleration & Separation**
5. **Detection & Spectrum**
6. **Interpretation**

All six stages must appear under the existing Mass Spectrometry tab.

Provide Previous and Next buttons, allowing students to progress naturally through the experiment.

Keep one large, persistent simulation workspace.

When moving between stages, change the focus of the visualization rather than replacing the entire instrument with disconnected diagrams.

Preserve the current sample and scientifically relevant experimental state.

Do not display excessive controls, unrelated graphs or side panels.

---

## 3. Main continuous instrument view

Create one large, visually clear mass spectrometer with the following components:

- Sample inlet
- Electron-ionization source
- Fragmentation region
- Ion extraction and acceleration
- Mass analyser
- Detector
- Connected mass spectrum

The instrument should initially appear in a simplified external view.

As students advance, relevant sections become transparent or highlighted.

Use smooth camera movement or contextual zooming to show the current process.

The instrument layout must correspond to the selected analyser.

Do not show a magnetic-sector analyser and a time-of-flight analyser operating consecutively in a single instrument.

Use the existing magnetic-sector implementation as the default analyser if it is functioning correctly. Retain time-of-flight as a selectable alternative demonstration.

Where the magnetic-sector model is used, accurately represent the relationship between ion mass, charge, accelerating voltage, magnetic field and trajectory.

---

## 4. Stage 1 — Introduce a population of identical molecules

This is a major improvement.

Do not begin with only one molecule.

Show several identical molecules entering the instrument.

For example, use a validated introductory molecule such as propanone or butan-2-one, where different fragmentation pathways can be meaningfully demonstrated.

Initially show approximately 8–15 molecules for visual clarity.

The molecules should be independently animated rather than moving as one rigid group.

Allow students to:

- Select a molecule.
- Inspect its structure.
- See its molecular formula and molecular mass.
- Start sample introduction.
- Pause the experiment.

Explain that a real mass spectrum represents the behaviour of an enormous population of molecules and ions.

The small number displayed is a teaching representation, not the actual number present in the instrument.

Keep labels minimal.

---

## 5. Stage 2 — Ionization

When students click **Ionize**, show an electron beam interacting with the gaseous molecules in the ionization source.

For electron ionization, depict electron removal correctly:

M + e⁻ → M⁺• + 2e⁻

Show the formation of molecular radical cations.

Students should observe that different sample molecules may undergo different subsequent outcomes.

Some molecular ions survive, while others undergo fragmentation.

Any un-ionized molecules remain neutral and must not be represented as accelerated or deflected ions.

Use clear visual distinctions:

- Neutral molecule
- Positive molecular ion
- Charged fragment
- Neutral fragment

Do not imply that ionization necessarily results in immediate fragmentation of every molecule.

Display charges correctly.

For optional advanced exploration, allow comparison of ions with +1 and +2 charge, using physically appropriate mass-to-charge calculations and clear qualification that doubly charged ions are not necessarily common under the chosen conditions.

---

## 6. Stage 3 — Molecular fragmentation

This should become one of the most visually impressive and educationally valuable parts of the entire simulation.

### Core requirement

**Show several copies of the same molecular ion undergoing different plausible fragmentation pathways.**

For example:

- One molecular ion survives without fragmenting.
- Another produces one characteristic fragment ion.
- Another produces a different fragment ion.
- Several produce the same characteristic fragment ion.

Animate the process by showing the relevant bonds breaking or rearrangements occurring.

After fragmentation, clearly distinguish the detected ionic product from any neutral species.

Students must understand that neutral fragments do not contribute peaks directly to the positive-ion mass spectrum.

### Interaction

Allow students to select a molecular ion and choose from verified fragmentation pathways.

When a pathway is selected:

1. Highlight the involved atoms and bonds.
2. Animate bond cleavage or rearrangement.
3. Separate the resulting products.
4. Identify the charged fragment.
5. Display its chemical formula, charge and m/z.
6. Show the corresponding position on the mass spectrum.

Only offer chemically plausible fragmentation pathways supported by the selected molecule and ionization method.

For particularly useful fragments, allow students to replay the process in slow motion.

### Repeated fragments

This is especially important.

Show that several identical parent molecules can produce the same fragment ion.

These ions contribute to the same m/z signal.

The accumulation of many ions with the same m/z should be represented through increasing detector counts and a corresponding peak.

Do not imply that the number of visible particles in the educational animation is sufficient to reproduce experimental relative abundances precisely.

Use validated relative abundances or an explicitly labelled illustrative statistical model.

### Molecular survival

Retain some surviving molecular ions where scientifically appropriate.

These contribute to the molecular-ion peak.

Explain that a weak or absent molecular-ion peak is possible for some compounds because of extensive fragmentation.

---

## 7. Stage 4 — Acceleration and separation

Once the ions have formed, animate their movement through the acceleration region.

Show the influence of an electric potential difference on charged ions.

The animation should clearly demonstrate that neutral species do not follow the charged-ion beam.

### Mass-to-charge ratio

Introduce:

m/z = ion mass / charge number

Explain this with an interactive example.

Students should be able to select a singly charged ion and compare it with an appropriately defined doubly charged ion.

Explain that ions with the same mass but different charge states have different m/z values.

### Magnetic-sector analyser

For the default magnetic-sector model, show different ions experiencing different curvature under the selected field and accelerating conditions.

Do not oversimplify the behaviour to say that all lighter ions always bend more regardless of charge and accelerating conditions.

Allow a magnetic-field slider when this is the active learning focus.

Students should see which m/z reaches the detector under the selected settings.

Explain that a scanning magnetic-sector instrument changes operating conditions to transmit different m/z values to the detector over time.

Therefore, the completed mass spectrum should not misleadingly appear as though every ion of every m/z reaches one fixed detector simultaneously during a single unchanging magnetic-field setting.

### Optional time-of-flight analyser

Keep the existing TOF visualization as an optional comparison within this stage.

Clearly explain the relevant flight-time relationship under appropriate equal-kinetic-energy assumptions.

Do not require students to complete both analyser models before progressing.

---

## 8. Stage 5 — Detection and spectrum formation

Connect the selected analyser directly to the detector and mass spectrum.

The detector should show ions arriving in a clear, visible way.

As ions are detected, the spectrum should develop.

For a scanning magnetic-sector model, animate repeated analyser settings and the accumulation of detector counts for the selected m/z values.

For TOF, use the appropriate time-resolved detection process.

### Peak formation

When many ions corresponding to one m/z are detected, the associated signal becomes more intense.

Show the difference between:

- Molecular-ion peak
- Fragment-ion peaks
- Base peak
- Isotope peaks

The base peak is the most intense peak and is assigned 100% relative intensity.

The molecular-ion peak is not necessarily the base peak.

### Interactive peak selection

When students click a peak:

- Highlight its m/z.
- Display its relative intensity.
- Identify plausible contributing ion structures.
- Highlight the corresponding fragment in the molecular visualization.
- Allow replay of the appropriate fragmentation pathway.

Where multiple fragment structures can contribute to the same nominal m/z, do not falsely claim that one selected structure is uniquely established.

### Population-to-spectrum visualization

Include a simple optional counter showing illustrative ions produced or detected.

This should help students understand that peaks represent populations.

Do not overcrowd the main interface with statistical dashboards.

---

## 9. Stage 6 — Interpretation

Provide an interactive mass spectrum and a selected unknown molecule challenge.

Students should identify:

- Molecular-ion evidence
- Molecular mass
- Base peak
- Significant fragment ions
- Possible structural features
- Relevant isotopic patterns

Allow them to click peaks and record short deductions.

Keep explanations concise and connected to the selected evidence.

Provide optional hints and reveal controls.

Use the existing unknown-compound challenge functionality where practical.

The full combined MS–IR–NMR investigation should remain in the separate Structure Investigation tab.

Do not duplicate the complete structure investigation in the Mass Spectrometry tab.

---

## 10. Preserve isotopes and analyser comparisons

Do not delete the scientific content currently presented in the former isotope and analyser stages.

Reorganize it.

The isotopic abundance and relative atomic mass activity can become an optional foundation or revision activity.

The molecular isotope pattern activity should be accessible from spectrum interpretation.

For example, students can compare characteristic chlorine and bromine isotope patterns using correctly calculated isotope distributions.

Keep the magnetic-sector and TOF demonstrations as selectable analyser modes.

These additional activities should not inflate the number of mandatory learning stages.

---

## 11. Important interface behaviour

Maintain one main animation region throughout the six-stage sequence.

Use contextual emphasis rather than changing pages unnecessarily.

Include:

- Play
- Pause
- Reset
- Step Forward
- Step Back
- Animation Speed
- Replay Fragmentation
- Show / Hide Charges
- Show / Hide Ion Labels
- Full-screen view

Only reveal controls relevant to the current stage.

When students select an ion, its identity and colour should remain consistent between the molecular view, analyser animation and spectrum.

Provide clear, accessible alternative labels so colour is not the only means of identification.

Avoid decorative moving particles that do not correspond to actual scientific events.

---

## 12. Molecular data and scientific validation

Create or extend a validated molecule data model that includes:

- Stable molecule ID
- Correct chemical formula
- Molecular mass
- Molecular structure
- Electron-ionization molecular ion
- Plausible charged fragmentation products
- Associated neutral products
- Fragmentation pathways
- Ion formulas and charge states
- m/z values
- Representative or reference relative intensities
- Isotopic information where relevant

Initially, use a small group of well-validated molecules rather than a large collection with incorrect fragmentation patterns.

A suitable molecule library may include propane, propanone, butan-2-one, ethanol and other molecules for which sufficiently reliable spectral and fragmentation data are available.

Do not invent arbitrary fragment pathways simply to make the animation visually interesting.

Distinguish clearly between experimental reference spectra and pedagogical models.

Preserve scientifically valid data already present in the existing project.

---

## 13. Technical implementation

Refactor `MsWorkbench.jsx` and the MS navigation so that six learner-facing stages replace the existing 13.

Reuse existing scientific scene components.

Create a shared experiment controller for:

- Selected molecule
- Sample population
- Ionization events
- Molecular-ion survival
- Fragmentation pathways
- Ion identities
- Selected analyser
- Acceleration parameters
- Detector events
- Spectrum data
- Currently selected peak

Use deterministic, reproducible behaviour where appropriate so teachers can replay an experiment.

Ensure that the sample population displayed in the animation is consistent with the selected molecular model.

If the model produces illustrative detector counts, label them accordingly and do not claim they are experimentally measured.

Make the animations smooth, but prioritize correct event ordering and scientific logic over purely visual effects.

Preserve the existing application's routing, styling, user state and other spectroscopy modules.

Do not break IR, NMR or Structure Investigation.

---

## 14. Completion checklist

The implementation is complete only when a teacher can:

1. Select a molecule.
2. Introduce multiple identical sample molecules.
3. Ionize them.
4. Observe molecular-ion formation.
5. Show some ions surviving and others fragmenting.
6. Demonstrate several plausible fragmentation pathways.
7. Highlight repeated identical fragments from different parent molecules.
8. Distinguish charged from neutral fragments.
9. Accelerate positive ions.
10. Show scientifically correct m/z-dependent separation.
11. Demonstrate how ion transmission and detection occur.
12. Watch peaks develop from accumulated ion signals.
13. Click a peak and identify its possible molecular origin.
14. Explain the molecular-ion peak and base peak.
15. Explore isotope patterns.
16. Interpret an unknown spectrum.
17. Navigate the entire experiment in six clear stages without losing the current scientific context.

Test all navigation controls, scientific calculations, animation state changes and spectrum interactions.

Do not stop after modifying the step labels. The major requirement is a functioning **continuous experiment visualization**.

## Final expected result

The mass spectrometer should feel like one connected scientific instrument rather than thirteen separate slides.

Students should be able to watch several identical molecules enter the mass spectrometer, become ionized, undergo different fragmentation pathways, separate according to m/z, reach the detector and contribute to the final spectrum.

They should understand why some molecular ions survive, why the same fragment ion may be produced repeatedly, and why different m/z peaks have different intensities.

**One laboratory. Six teaching stages. One continuous molecular journey.**

Maintain the existing e-Lab.school standards of scientific accuracy, meaningful interactivity, pedagogical clarity, visual quality and technical reliability.

---

## ADDITIONAL MANDATORY REQUIREMENTS — CONTINUOUS MASS SPECTROMETRY VISUALIZATION

1. Keep a compact instrument overview visible during the entire experiment. Highlight the active instrument region as students progress through the six stages.
2. Provide a "Track This Molecule" interaction. When a student selects a parent molecule, follow its movement through ionization, fragmentation, acceleration, mass analysis and detection where applicable. If fragmentation occurs, allow the student to track the charged fragment and see what happens to the neutral product.
3. Provide slow-motion playback for bond cleavage, fragment separation and ion deflection.
4. Maintain consistent ion identities, chemical formulas, m/z values and colours throughout the instrument and corresponding mass spectrum.
5. Explicitly distinguish the small illustrative population of animated molecules from experimental relative abundances. Use validated data or clearly labelled educational probabilities to produce representative peak intensities.
6. Keep the scientific process visually continuous. Advancing between the six teaching stages must feel like following one experiment, not switching between unrelated animations.
7. Preserve the current instrument and spectrum visualization wherever possible, integrating these improvements without breaking existing functionality.

The most important visual experience is seeing many copies of the same molecule undergo different outcomes, with the resulting charged fragments contributing to their respective peaks in the spectrum.
