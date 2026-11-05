# Next Spectroscopy Module – Interactive Infrared (IR) Spectroscopy Visualizer

Develop a fully interactive **Infrared (IR) Spectroscopy Visualizer** for the e-Lab.school IB DP Chemistry platform.

Follow the same design principles as the corrected NMR visualizer: a single IR spectroscopy tab, one primary animation area, sequential Next/Back navigation, minimal text, clear molecular animations, and scientifically accurate interactions.

**Do not create multiple subpages or overcrowded dashboards.** Each stage should introduce one key concept through an animation and an appropriate student interaction.

## Stage 1 – How Molecules Vibrate

Begin with a 3D animated molecule such as HCl.

- Represent atoms as coloured spheres joined by a visible bond.
- Animate bond stretching and compression continuously.
- Clearly show the atoms moving back and forth about their equilibrium positions.
- Introduce molecular vibrations and their frequencies.
- Explain that molecules have quantized vibrational energy levels.

Allow students to switch between HCl, H₂O and CO₂ to observe different molecular vibrations.

## Stage 2 – Types of Molecular Vibrations

Use animated molecular models to demonstrate:

- Symmetric stretching
- Asymmetric stretching
- Bending

Students should see atoms physically moving, with clear arrows indicating the directions of displacement.

Include a vibration selection control that changes the animation without changing the page.

Explain that different vibrational modes have different characteristic frequencies.

## Stage 3 – Interaction with Infrared Radiation

Show an animated infrared electromagnetic wave approaching a vibrating molecule.

Explain that IR radiation can be absorbed when:

1. Its frequency matches an allowed molecular vibrational transition.
2. The vibration involves a change in the molecular dipole moment.

Display:

\[
\Delta E=h\nu
\]

Show vibrational energy levels and animate a transition from a lower to a higher vibrational state when matching IR radiation is absorbed.

For a nonmatching frequency, show little or no resonant absorption.

**Important scientific correction:** Not every molecular vibration is IR active. For example, the symmetric stretching vibration of CO₂ is IR inactive in the ideal isolated molecule, whereas its asymmetric stretching and bending modes are IR active.

## Stage 4 – Interactive Molecular Vibration Explorer

Provide a large central molecular animation.

Include a molecule selector with:

- H₂O
- CO₂
- HCl
- CH₄
- Ethanol

When students select a molecule, display relevant vibrational modes and animate the actual atomic displacements.

For every selected mode, indicate whether it is IR active.

Use simplified normal-mode representations that remain scientifically correct.

Avoid arbitrary vibrating or rotating atoms that do not represent the selected vibrational mode.

## Stage 5 – How an IR Spectrometer Works

Create a simple animated representation of a Fourier-transform infrared (FTIR) spectrometer.

Show the process sequentially:

IR source → Interferometer → Sample → Detector → Computer → IR spectrum

Animate radiation moving through the instrument.

Students should understand that the instrument measures IR absorption and converts the recorded signal into a spectrum.

Do not incorrectly depict an FTIR spectrometer as merely scanning one IR frequency at a time. Explain that an FTIR instrument records an interferogram, which is Fourier-transformed to obtain the spectrum.

## Stage 6 – Building an IR Spectrum

Introduce a large, clearly labelled IR spectrum.

- X-axis: Wavenumber (cm⁻¹), displayed conventionally from 4000 on the left to approximately 400 on the right.
- Y-axis: Transmittance (%), with 100% at the top.

When a molecule absorbs a particular IR frequency, animate the corresponding downward absorption band appearing in the transmittance spectrum.

Synchronize three elements:

1. Molecular vibration
2. IR absorption
3. Corresponding spectral band

Students should immediately understand why particular peaks or bands appear.

## Stage 7 – Functional Group Identification

Introduce characteristic IR absorption ranges.

| Bond or group | Approximate absorption range |
|---|---|
| O–H (alcohol) | 3200–3600 cm⁻¹, broad |
| O–H (carboxylic acid) | 2500–3300 cm⁻¹, very broad |
| N–H | 3300–3500 cm⁻¹ |
| C–H (sp³) | 2850–3000 cm⁻¹ |
| C≡N | 2210–2260 cm⁻¹ |
| C=O | 1650–1750 cm⁻¹ |
| C=C | 1620–1680 cm⁻¹ |

Use representative values and realistic spectral shapes. Explain that exact positions depend on molecular structure and environment.

When students click a characteristic absorption band:

- Highlight the relevant bond or functional group in the molecule.
- Animate the corresponding vibration.
- Display the approximate wavenumber and its assignment.

## Stage 8 – Interactive Spectrum Interpretation

Provide a guided practice activity using realistic spectra of simple organic compounds.

Examples:

- Ethanol
- Ethanal
- Propanone
- Ethanoic acid
- Ethyl ethanoate

Students should be able to click spectral bands, identify possible functional groups, and compare their answers with the corresponding molecular structures.

Introduce the fingerprint region below approximately 1500 cm⁻¹ and explain its role in distinguishing compounds.

Do not claim that one absorption band alone definitively identifies an entire compound.

## Stage 9 – Unknown Compound Challenge

Display an unknown IR spectrum.

Provide three or four possible molecular structures.

Ask students to identify the most likely compound using the major diagnostic bands.

Reveal feedback progressively:

- Which functional groups are present?
- Which expected bands are absent?
- Which structure is most consistent with the spectrum?

Include a short explanation of why the other options are less suitable.

## Overall Design Requirements

- Use the existing dark-blue e-Lab simulation theme.
- Maintain a single IR spectroscopy tab.
- Use large, animated 3D-style molecular models.
- Retain persistent Next/Back controls.
- Reveal only the controls relevant to the current stage.
- Keep molecular animations, energy diagrams and spectrum responses synchronized.
- Use realistic bond vibrations and scientifically accurate functional-group assignments.
- Make the experience suitable for IB DP Chemistry SL and HL students.
- Use short explanations rather than long paragraphs.
- Provide an option to pause or replay animations.

**Expected learning journey:**

Molecular vibrations → IR-active vibrations → Infrared absorption → FTIR instrument → Formation of IR spectrum → Functional-group identification → Unknown compound analysis.

The aim is for students to understand **how and why an IR spectrum is produced**, not merely memorize absorption ranges.

Implement this as the next spectroscopy visualizer without modifying or disrupting the corrected NMR module.