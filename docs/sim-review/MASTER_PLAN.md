# e-Lab simulations: combined review and improvement plan

Source: four read-only reviews (atomic.md, gases-states.md, acids-kinetics.md, bonding-spectroscopy.md in this folder). Nothing was changed in the app. Scores are the reviewers' premium-readiness scores out of 10, from running each simulation in headless Chromium and reading its code. Not tested: real GPU speed, touch devices, Safari/Firefox, screen readers.

Overall: 25 simulations, average about 5.3/10. None is ready to sell as Premium as it stands except, with small fixes, the best of them (about 7).

## Scores (best first)
| Simulation | Score | Biggest problem |
|---|---|---|
| Spectroscopy Lab (NMR/IR/MS/Structure) | 7.5 | cosmetic; small content banks |
| VSEPR Explorer 3D | 7 | molecule list invisible on phones/tablets; no ions |
| Hybridisation Explorer 3D | 7 | offers hybrids outside the IB course; few molecules |
| Phase Change & Heating Curve | 7 | water only; layout clash at small window height |
| Titration pH Curve | 6.5 | controls off-screen at 1366x768; no predict mode |
| Ideal Gas | 6.5 | not in IB units (kPa, dm3); opens at 30 atm |
| Intermolecular Forces | 6.5 | no boiling-point ranking task |
| Gas Laws | 6 | no data table; false "Limit reached"; no 273 K |
| pH Calculator | 6 | silently changes out-of-range input |
| Bonding Visualizer | 6 | thin library (CO2 refused); no polarity |
| Ionization Energy | 5.5 | answer shown up front; no first-IE trend |
| Build an Atom | 5 | wrong ion configurations; neutron limit meaningless |
| Atomic Spectra Lab | 5 | cold hydrogen shown with wrong dark lines |
| Equivalence Point | 5 | says "approaching" when past equivalence |
| Buffer Action | 5 | stray H+ stays in buffer; unbounded particles |
| Neutralization Particles | 4.5 | particles overlap; fixed 4+4 ions |
| Orbital Explorer | 4.5 | all elements use hydrogen-scale orbitals |
| Particle Model | 4.5 | no temperature control; particle count changes |
| Collision Theory | 4.5 | % above Ea figure wrong; no controls |
| Electron Configuration | 4 | leaks the answer; no ions; no Hund/Pauli |
| Wave Explorer | 4 | wavelength locked; amplitude 0 still draws a wave |
| Chocolate Wrapping | 4 | inputs reject 15/10/100; rate disagrees with graph |
| Explore Matter & States | 4 | pictures contradict captions; wrong sample data |
| H+/OH- Balance | 3.5 | wrong chemistry (each drop multiplies [H+] by 5) |
| Mixture Separation | 2.5 | shows PLACEHOLDER art; wrong labels; console errors |

## Wrong science that must be fixed first
1. Build an Atom: d-block ion configurations wrong (Ga3+, Cu+, Fe2+); neutron cap of 60 for every element.
2. H+/OH- Balance: chemistry model wrong.
3. Collision Theory: % of particles above Ea wrong.
4. Atomic Spectra Lab: unexcited hydrogen shown with Balmer absorption lines.
5. Equivalence Point and Titration: "approaching equivalence" shown past it.
6. Buffer Action: leftover H+ after H+ then OH-.
7. Explore Matter: solid/liquid pictures contradict captions; wrong masses.
8. Mixture Separation: placeholder art, wrong labels.

## Proposed order
Phase 0, quick (small fixes, low risk): hide Mixture Separation until rebuilt; clamp/validation messages that explain why; VSEPR list on phones; "approaching" bug; off-screen controls; Chocolate Wrapping inputs; false "Limit reached"; Wave Explorer amplitude 0; dialog Escape/roles.
Phase 1, shared foundations (fixes many sims at once): one atomic data layer (isotopes, ions, constants); one acid-base module (reuse the correct titration solver); IB units and conventions; a shared "record readings, plot, export" panel; a shared predict-observe-explain component; WebGL lost-context fallback, reduced motion, keyboard alternatives for 3D.
Phase 2, rebuilds in priority: Build an Atom; Electron Configuration (with ions, Hund/Pauli); Collision Theory (real collisions + temperature/concentration/surface area/catalyst controls); H+/OH- Balance; Buffer Action; Ionization Energy; Atomic Spectra; Particle Model + Explore Matter on one shared particle core; Mixture Separation as a task-based lab.
Phase 3, content depth: more molecules/ions, ranking tasks, challenge modes, automated tests for the 8 acid/kinetics sims that have none.

## Front page and Premium
Show only simulations scoring about 7 on the landing page until others are fixed: VSEPR, Heating Curve, Hybridisation, then Titration. Feature Collision Theory, Buffer and Bonding after their rebuilds. Lock for Premium only what has been brought up to standard.

## Questions for the owner
IB units (kPa, dm3) throughout? Audience: DP only or IGCSE too? How realistic should isotope limits be (use real stable/known nuclide range)? How far to rebuild Mixture Separation? Should data export carry the school logo? See each report for more.
