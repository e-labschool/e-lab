# e-Lab.school — Structural Investigation Visualizer

## Objective

Claude, enhance the **existing Structural Investigation tab** within Spectroscopy Studio to create a scientifically accurate, interactive structure-elucidation experience for IB DP Chemistry AHL students.

**Do not create another tab, separate page or duplicate visualizer.** Preserve the existing Mass Spectrometry, IR and NMR tabs and their functionality.

The purpose is to help students combine analytical evidence to identify an unknown organic compound, rather than simply memorize characteristic peaks.

## 1. Investigation interface

Present students with an unknown organic compound and a clear question:

**"Can you identify the unknown molecule using spectroscopic evidence?"**

Use one main investigation workspace with a compact top navigation:

**Sample → Mass Spectrum → IR Spectrum → ¹H NMR → Identify Structure**

Students should be able to revisit evidence without losing their progress.

Avoid crowded dashboards, excessive text and multiple nested panels. Keep the main visualization large and interactive.

## 2. Unknown sample

Each investigation should begin with a sample card containing:

- Sample ID, such as Unknown A01.
- Molecular formula, when appropriate to the challenge.
- Available analytical evidence.
- A short investigation objective.

Provide a **Start Investigation** button.

Include multiple predefined compounds with verified, internally consistent spectral data.

Use familiar organic compounds initially, such as ethanol, propan-2-ol, propanal, propanone, ethanoic acid and ethyl ethanoate.

Do not generate random spectra that contradict the molecular structure.

## 3. Mass spectrometry investigation

Display an interactive mass spectrum with:

- Relative abundance on the Y-axis.
- m/z on the X-axis.
- Molecular-ion peak where applicable.
- Significant fragment peaks.
- Base peak.
- Appropriate isotope patterns where relevant.

Students should be able to select peaks to inspect their m/z values.

Provide optional prompts:

"What might the molecular-ion peak tell you?"

"Which fragment could explain the base peak?"

Allow students to record an estimated molecular mass and possible fragments in an evidence notebook.

Do not automatically reveal the correct molecular structure.

## 4. IR spectroscopy investigation

Display the IR spectrum of the same unknown compound.

Students should be able to:

- Hover over or select absorption bands.
- Read approximate wavenumbers.
- Identify possible functional groups.
- Record evidence for or against particular structures.

Include scientifically appropriate peak positions, widths and intensities.

For example, represent broad O–H absorption differently from sharp C=O absorption.

Do not display functional-group labels directly on the spectrum before students attempt interpretation.

Provide a **Reference Table** button for characteristic IR absorption ranges.

## 5. ¹H NMR investigation

Display a realistic, interpretable proton NMR spectrum of the same unknown compound.

Include:

- Chemical shift in ppm, decreasing from left to right.
- Correct numbers of proton environments.
- Relative integration.
- Appropriate splitting patterns.
- Coupling constants where relevant.
- TMS reference at 0 ppm when appropriate.

Students should be able to click individual signals to inspect their chemical shift, integration and multiplicity.

Allow students to record their interpretation in a compact table.

| Signal | Chemical shift | Integration | Splitting | Possible assignment |
|---|---|---|---|---|

Students should be able to toggle integration curves and expand multiplets.

Ensure that the spectral data are chemically consistent. Account for exchangeable protons, which may not show reliable splitting or integration under all experimental conditions.

## 6. Evidence notebook

Provide a small, collapsible **Evidence Notebook** that remains accessible throughout the investigation.

It should collect the student's observations from the three techniques.

Organize evidence into:

- Molecular mass and fragmentation
- Functional groups
- Proton environments
- Integration and splitting
- Possible molecular structures

Students should be able to edit their observations.

Do not fill the notebook automatically with correct answers.

## 7. Identify the molecular structure

After reviewing the evidence, students proceed to the identification stage.

Display four possible molecular structures as clear skeletal or displayed structural formulas.

Students select the structure they believe matches the evidence.

Use chemically plausible distractors, ideally structural isomers with the same molecular formula.

Avoid presenting structures that can be rejected immediately because they have incompatible molecular formulas, unless the challenge is explicitly designed to assess molecular-formula reasoning.

### Submit and evaluate

After submission, provide feedback based on the student's choice.

If incorrect, identify which spectral evidence conflicts with the selected structure, without immediately revealing the answer.

Allow students to return to the spectra and reconsider.

After a correct answer, or when the student explicitly requests the solution, provide a complete explanation connecting the MS, IR and NMR evidence to the structure.

## 8. Difficulty levels

Include three levels:

**Foundation**

- Molecular formula provided.
- Clear characteristic peaks.
- Four structural choices.
- Guided questions and hints.

**Intermediate**

- More complex molecules.
- Less guidance.
- Greater emphasis on interpreting integration and splitting.
- Plausible structural isomers.

**Advanced**

- Combined evidence requiring several deductions.
- More complex fragmentation.
- Overlapping NMR signals where appropriate.
- Minimal hints.
- Written justification before final submission.

Use verified examples appropriate to the IB DP Chemistry AHL syllabus.

## 9. Interactive spectrum controls

For each spectrum, provide:

- Hover/click peak inspection.
- Zoom in and out.
- Reset zoom.
- Clear axis labels.
- Responsive resizing.
- Optional reference information.

Avoid unnecessary animation.

The goal is to interpret authentic-looking spectral evidence, not simply watch decorative effects.

## 10. Scientific data integrity

This is a critical requirement.

Every unknown compound must have one shared underlying molecular identity and a consistent set of MS, IR and NMR data.

For every compound, verify:

- Molecular formula and molar mass.
- Degree of unsaturation, where relevant.
- Molecular-ion and fragment assignments.
- Functional-group absorption ranges.
- Number of distinct proton environments.
- Integration ratios.
- Multiplicities and coupling relationships.
- Correct structural formulas.

Use curated reference spectra where available. If using educational approximations, identify them as simulated spectra and ensure that the approximations remain chemically valid.

Do not fabricate precise experimental peaks and present them as measured data.

## 11. Design and usability

Follow the existing e-Lab visual identity.

Use:

- Clean, uncluttered layouts.
- Consistent typography.
- Subtle colors.
- Clearly differentiated spectral peaks.
- Compact buttons.
- Readable graph axes.
- Responsive panels.

Support fullscreen and open-in-new-tab functionality using the website's shared simulation controls.

All controls must remain visible and accessible in fullscreen mode.

The interface should work on desktop and tablet screens without overlapping panels.

## 12. Preserve existing Spectroscopy Studio

Do not alter the working principles, animations, instrument visualizations or learning sequences in the existing Mass, IR and NMR tabs.

The Structural Investigation tab should reuse existing spectrum components where practical, without introducing regressions into the individual technique visualizers.

Do not reset existing lesson content, saved progress or other simulations.

## 13. Final verification

Before declaring the work complete, test at least one complete investigation at each difficulty level.

Verify that:

1. The same molecule is used consistently across all three spectra.
2. Peak values and structural options are scientifically correct.
3. Students can navigate backward and forward without losing evidence.
4. Hints do not accidentally reveal the solution.
5. Incorrect submissions produce meaningful feedback.
6. Correct submissions produce a complete explanation.
7. All spectra remain usable in fullscreen mode.
8. Existing spectroscopy tabs continue functioning correctly.

Provide a short implementation report listing the compounds included, the components changed and the tests actually completed.

**Final expectation:** The Structural Investigation tab should function as an engaging, scientifically rigorous, student-led chemistry investigation in which students interpret evidence, make deductions, test hypotheses and justify the identity of an unknown organic compound.