// Ion kinematics of an idealised mass spectrometer. PURE, SI units. Formulas (z = charge number, e = elementary charge, V = accelerating p.d.):
//   acceleration from rest        Ek = z e V                    (independent of the ion's mass)
//   speed                         v = sqrt(2 z e V / m)         (v is proportional to 1/sqrt(m))
//   radius in a uniform field B   r = m v / (z e B)             (B perpendicular to v)  =  (1/B) sqrt(2 m V / (z e))
//   m/z from the radius           m/z = e B^2 r^2 / (2 V)       (kg per unit charge number; divide by u for the usual number)
//   time of flight over L         t = L / v = L sqrt(m / (2 z e V))
// Ideal model: ions start from rest, V is uniform over the gap, no collisions, no space charge, no relativity (v << c; at 20 kV and m/z 1 it is 0.2 % of c).
import { E_CHARGE, U_KG, mzToMassKg } from "./constants.js";

export const kineticEnergyJ = (z, V) => z * E_CHARGE * V;
export const speedMs = (massKg, z, V) => Math.sqrt((2 * z * E_CHARGE * V) / massKg);
export const speedFromMz = (mz, V, z = 1) => speedMs(mzToMassKg(mz, z), z, V);
/** radius of the circular path (m) of an ion of the given mass (kg) accelerated through V and moving in the field B (T). */
export const radiusFromMass = (massKg, z, V, B) => (massKg * speedMs(massKg, z, V)) / (z * E_CHARGE * B);
export const radiusFromMz = (mz, V, B, z = 1) => radiusFromMass(mzToMassKg(mz, z), z, V, B);
/** the same radius straight from m/z (= sqrt(2 (m/z) V / e) / B, with m/z in kg per charge number) - a second route used to cross-check in the tests. */
export const radiusClosedForm = (mz, V, B) => Math.sqrt((2 * (mz * U_KG) * V) / E_CHARGE) / B;
/** m/z (a number: mass in u per unit charge number) of the ion that follows a path of radius r (m) in the field B (T) after acceleration through V. */
export const mzFromRadius = (r, B, V) => (E_CHARGE * B * B * r * r) / (2 * V) / U_KG;
/** magnetic field (T) that bends ions of the given m/z (accelerated through V) onto the radius r. */
export const fieldForMz = (mz, V, r) => Math.sqrt((2 * (mz * U_KG) * V) / E_CHARGE) / r;
/** accelerating voltage (V) that sends ions of the given m/z onto the radius r in the field B. */
export const voltageForMz = (mz, B, r) => (E_CHARGE * B * B * r * r) / (2 * mz * U_KG);
export const flightTimeS = (mz, V, L, z = 1) => L * Math.sqrt(mzToMassKg(mz, z) / (2 * z * E_CHARGE * V));
/** uniform acceleration across a gap d (m): a = z e V / (m d); time to cross t = sqrt(2 d / a); position x(t) = a t^2 / 2 (until x = d). */
export const gapAcceleration = (mz, V, d, z = 1) => (z * E_CHARGE * V) / (mzToMassKg(mz, z) * d);
export const gapCrossingTime = (mz, V, d, z = 1) => Math.sqrt((2 * d) / gapAcceleration(mz, V, d, z));
export const gapPosition = (mz, V, d, t, z = 1) => Math.min(d, 0.5 * gapAcceleration(mz, V, d, z) * t * t);
