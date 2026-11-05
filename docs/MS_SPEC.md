# e-Lab.school – Interactive Mass Spectrometry Visualizer

## Development Prompt: IB DP Chemistry – Analytical Techniques

Create a scientifically accurate, visually engaging and fully interactive **Mass Spectrometry Visualizer** for the e-Lab.school Chemistry platform.

Use the same dark-blue theme, smooth animations and progressive teaching approach established in the NMR and IR spectroscopy modules.

**The entire Mass Spectrometry learning experience must remain within ONE tab, on ONE page, using sequential Next/Back navigation.**

Do not create multiple subpages, unnecessary dashboards or overcrowded information panels.

The objective is to help students understand how a mass spectrometer works, why ions are separated, how mass spectra are generated and how molecular and isotopic information can be obtained.

## Stage 1 – Introduction: What Does Mass Spectrometry Measure?

Start with a large, visually appealing 3D molecular model.

Display a simple sample such as methane (CH₄).

Allow the molecule to rotate slowly, showing atoms as coloured spheres connected by bonds.

Introduce the question:

**"How can we determine the masses of atoms and molecules?"**

Explain that a mass spectrometer converts sample particles into ions and measures their mass-to-charge ratios (m/z).

Display:

\[
m/z=\frac{\text{mass of ion}}{\text{charge number}}
\]

Clarify that mass spectra conventionally use m/z, with mass expressed relative to the unified atomic mass unit and charge expressed as a multiple of the elementary charge.

Introduce the stages:

Sample introduction → Ionization → Ion separation → Detection → Mass spectrum

Use a prominent Next button to begin the process.

## Stage 2 – Sample Introduction

Display a simplified mass spectrometer with a visible sample inlet.

Animate sample molecules entering the instrument.

Use methane initially.

Show molecules moving through the inlet toward the ionization chamber.

Explain that samples must be introduced under conditions compatible with the chosen ionization method.

Avoid suggesting that all samples must be vaporized before every type of mass spectrometry.

For the introductory electron ionization (EI) model, use a gas-phase sample.

**Interaction:** Students click "Introduce Sample" to release molecules into the ionization chamber.

## Stage 3 – Ionization: Formation of Positive Ions

This stage must include a detailed molecular animation.

Show a methane molecule moving into an electron ionization chamber.

Animate an energetic electron approaching the molecule.

Show an electron being removed from the molecule, forming a positive molecular ion.

Display:

\[
CH_4+e^-\rightarrow CH_4^{+\bullet}+2e^-
\]

Clearly show:

- The original neutral methane molecule.
- An incoming high-energy electron.
- Removal of an electron.
- Formation of the positive molecular radical cation.

Use a distinct colour to highlight the resulting molecular ion.

**Interaction:** Students click "Ionize" to trigger the process.

Allow Replay to observe the animation again.

Explain that electron ionization can also cause fragmentation of molecular ions.

Do not incorrectly show a proton attaching to methane during electron ionization.

## Stage 4 – Fragmentation of Molecular Ions

Show the newly formed molecular radical cation.

Explain that excess internal energy can cause bonds to break, producing smaller ions and neutral fragments.

Animate representative fragmentation pathways.

For methane, show an illustrative pathway:

\[
CH_4^{+\bullet}\rightarrow CH_3^++H^\bullet
\]

Clearly distinguish charged fragments from neutral fragments.

Only charged particles should continue through the mass analyser and contribute to the measured mass spectrum.

**Interaction:** Students select a fragmentation pathway and observe the products.

Include a short explanation:

"Fragmentation patterns provide information about molecular structure."

Do not imply that every fragmentation pathway occurs with equal probability.

## Stage 5 – Acceleration of Positive Ions

Display two accelerating electrodes and the electric potential difference between them.

Animate positive ions accelerating through the electric field.

Show the ions gaining kinetic energy.

For a simplified model where ions begin with negligible kinetic energy, display:

\[
E_k=zeV
\]

where:

- \(z\) = positive charge number
- \(e\) = elementary charge
- \(V\) = accelerating potential difference

Animate ions moving more rapidly as they accelerate.

**Interaction:** Provide one voltage slider.

When students increase the accelerating voltage, show the corresponding increase in ion kinetic energy.

Make it clear that ions with different masses but the same charge gain approximately the same kinetic energy under the same accelerating potential, not necessarily the same speed.

## Stage 6 – Separation According to Mass-to-Charge Ratio

This should be one of the most visually impressive and interactive stages.

Introduce a **magnetic-sector mass analyser** as the first model.

Display ions entering a uniform magnetic field perpendicular to their direction of motion.

Show ions travelling along curved trajectories.

For ions accelerated through the same potential difference, illustrate how their paths depend on m/z.

Display:

\[
r=\frac{mv}{zeB}
\]

and, for ions accelerated from rest through potential \(V\),

\[
\frac{m}{z}=\frac{eB^2r^2}{2V}
\]

Use distinct animated ion paths representing different mass-to-charge ratios.

Explain:

- Ions with different m/z values follow different trajectories under the selected conditions.
- Greater m/z corresponds to a larger radius for ions accelerated through the same voltage and entering the same magnetic field.
- Changing the magnetic field or acceleration voltage changes which ions reach a fixed detector.

**Interaction:** Provide an m/z selector to compare ion trajectories.

Show the selected ion's path and numerical m/z clearly.

Do not depict ions merely separating into straight parallel lines in a magnetic-sector analyser.

## Stage 7 – Time-of-Flight Mass Spectrometry

Introduce a second analyser type without creating another tab.

Show ions accelerated into a field-free flight tube.

Animate multiple singly charged ions beginning their flight simultaneously after acceleration.

Use coloured particles representing lighter and heavier ions.

Explain that, at equal accelerating voltage and charge, lighter ions travel faster and generally arrive at the detector sooner.

Display:

\[
t=L\sqrt{\frac{m}{2zeV}}
\]

where \(L\) is the field-free flight distance in the idealized model.

**Interaction:** Students select Start Flight and watch ions race toward the detector.

Display arrival times and identify the ions in order of detection.

Allow students to adjust the mass of one ion and observe changes in flight time.

Clearly distinguish TOF separation from magnetic-sector separation.

## Stage 8 – Detection: How Does a Peak Form?

Show ions reaching the detector.

Animate individual ion arrivals and their conversion into an electrical signal.

Introduce the idea that detector response is used to measure ion abundance.

**Interaction:** Each detected ion population contributes to a mass-spectrum peak.

Synchronize the detector and spectrum:

Ion reaches detector → Signal recorded → Peak appears at the corresponding m/z.

Show larger peaks for greater detected ion abundance.

Explain that peak intensity depends on ion abundance and detector response, rather than on the mass of an individual ion.

## Stage 9 – Constructing a Mass Spectrum

Display a large, interactive mass spectrum.

- X-axis: Mass-to-charge ratio (m/z)
- Y-axis: Relative intensity (%)
- Highest peak normalized to 100%

Introduce the terms:

**Molecular ion peak:** A peak due to the intact ionized molecule, if present.

**Base peak:** The most intense peak in the spectrum.

**Fragment ion peaks:** Peaks arising from smaller charged fragments.

Use a simplified methane EI mass spectrum with appropriately labelled molecular and fragment ions.

Animate peaks appearing as ions are detected.

**Interaction:** When students click a peak:

- Highlight the corresponding ion.
- Display its m/z.
- Show its chemical formula where assigned.
- Explain its possible origin.

Use representative or sourced relative intensities rather than inventing measured intensities and presenting them as experimental data.

## Stage 10 – Isotopes and Relative Atomic Mass

Introduce a sample of chlorine atoms.

Show two isotope models:

- Chlorine-35
- Chlorine-37

Explain that both isotopes have 17 protons but different numbers of neutrons.

Show a conceptual isotope distribution of approximately:

- 75% chlorine-35
- 25% chlorine-37

Then display a simplified mass spectrum with two peaks at m/z 35 and 37 for singly charged chlorine ions.

Animate the formation of the peaks.

**Interaction:** Allow students to adjust isotope abundance and observe the corresponding change in relative peak intensity.

Display the weighted mean calculation:

\[
A_r\approx\frac{(35\times75)+(37\times25)}{100}=35.5
\]

Explain that 35 and 37 are mass numbers used here as approximations; precise relative atomic masses use actual isotopic masses and abundances.

## Stage 11 – Molecular Isotope Patterns

Use chlorine-containing molecules to demonstrate characteristic isotope patterns.

Begin with Cl₂.

Show three isotopic combinations:

- ³⁵Cl–³⁵Cl
- ³⁵Cl–³⁷Cl
- ³⁷Cl–³⁷Cl

For an approximately 3:1 isotope abundance ratio, display the molecular-ion isotope cluster:

| m/z | Approximate relative intensity |
|---|---|
| 70 | 9 |
| 72 | 6 |
| 74 | 1 |

Animate the formation of the three peaks.

Allow students to compare compounds containing one chlorine atom and two chlorine atoms.

Include a bromine-containing example illustrating the approximately 1:1 M and M+2 molecular-ion pattern for a compound containing one bromine atom.

Clarify that these are simplified nominal-mass patterns and that fragmentation and other isotopes may produce additional peaks.

## Stage 12 – Identify Unknown Compounds

Develop an interactive spectrum interpretation activity.

Present one unknown spectrum at a time.

Suitable introductory examples:

- Methane
- Ethanol
- Propanone
- Chloromethane
- Bromomethane

Provide molecular formula choices.

Ask students to identify:

1. The likely molecular ion.
2. The base peak.
3. Significant fragment ions.
4. Any characteristic isotope pattern.
5. The most likely compound.

Students should be able to click peaks for guided hints.

After submission, reveal a concise explanation connecting the spectral features to the selected molecule.

Do not rely on molecular ion mass alone when different compounds could have the same nominal mass.

## Stage 13 – Compare Mass Spectrometry with IR and NMR

Finish with a simple interactive comparison.

| Technique | Main information obtained |
|---|---|
| Mass spectrometry | m/z values, ion abundances, isotopic composition, molecular and fragment ions |
| IR spectroscopy | Bond vibrations and functional-group evidence |
| ¹H NMR spectroscopy | Hydrogen environments, relative numbers of hydrogens and neighbouring hydrogen patterns |

Show how multiple techniques can be combined to identify an unknown organic compound.

Allow students to view the three types of evidence for a selected example compound.

Do not present any one technique as universally sufficient for complete molecular structure determination.

## Core Design and Animation Requirements

- One Mass Spectrometry tab and one continuous step-by-step learning journey.
- Persistent main animation area, Next/Back controls and Replay.
- Attractive spherical atom models with clearly visible chemical bonds.
- Smooth animated electron removal during ionization.
- Realistic fragmentation showing charged and neutral species separately.
- Distinct magnetic-sector and time-of-flight analyser models.
- Moving ions, visible detectors and synchronized spectrum generation.
- Accurate chemical labels, formulas and isotope notation.
- Large, legible spectra with clickable peaks.
- Responsive layout suitable for classroom projection and student laptops.
- Avoid unnecessary panels, repeated explanations or excessively long text.
- Use only the interaction relevant to the current stage.
- Maintain scientific accuracy while making abstract concepts visually understandable.

## Essential Scientific Accuracy Requirements

Mass spectrometry does not directly measure neutral molecules. It detects ions and determines their m/z values.

Do not imply that all mass spectrometers use the same analyser or ionization method.

Electron ionization and electrospray ionization are different processes. The primary visualization uses electron ionization for introductory molecular and fragmentation concepts.

Do not represent molecular ions as necessarily present in every mass spectrum.

Do not confuse the molecular ion peak with the base peak.

Do not confuse mass number, isotopic mass, relative atomic mass and m/z.

Ensure the spectrum updates correctly when students change isotope abundances, ion masses or other relevant parameters.

## Expected Learning Journey

**Sample → Ionization → Fragmentation → Acceleration → Separation → Detection → Spectrum → Isotope analysis → Molecular identification**

The final product must help students understand the actual mechanism of mass spectrometry, not simply memorize the instrument's stages.

The visualizer should feel like a virtual scientific instrument that students can operate and explore, while maintaining the clarity and simplicity of the existing e-Lab.school NMR and IR spectroscopy modules.