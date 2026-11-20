// Temperature dependence of the equilibrium constant (van 't Hoff) and of the rate constants (Arrhenius), with the
// constraint kr = kf / Kc at EVERY temperature so the kinetic ratio always equals the equilibrium constant.
//
//   ln K(T) = ln K(T0) - (dH / R) (1/T - 1/T0)                    van 't Hoff, constant dH over the stated range
//   Kc = K_std * (R_L_BAR * T / P_STD)^(-dn_gas)                 for gases: K_std uses partial pressures in bar, Kc uses mol dm-3
//   kf(T) = kfRef * exp(-Ea/R * (1/T - 1/Tk)) * catalyst(T)       Arrhenius
//   kr(T) = kf(T) / Kc(T)                                         consistency
//   catalyst(T) = exp(dEa / (R T))                                lowers Ea of BOTH directions by the same amount dEa
import { R, R_L_BAR, P_STD } from "./constants.js";

/** Reference K (K_std for gases with thermo.kind "kstd", Kc otherwise) at T0. */
export function referenceK(rx, params = {}) {
  const th = rx.thermo;
  if (rx.id === "ab") return (params.kfRef ?? rx.kinetics.kfRef) / (params.krRef ?? rx.kinetics.krRef);
  if (th.K0 != null) return th.K0;
  return Math.exp(-th.dG0 / (R * th.T0));
}

/** K at temperature T in the model's own convention (dimensionless K-standard for kstd, Kc for kc). */
export function kStandard(rx, T, params = {}) {
  const th = rx.thermo; const K0 = referenceK(rx, params);
  if (th.temperatureFixed) return K0;
  return K0 * Math.exp(-(th.dH / R) * (1 / T - 1 / th.T0));
}

/** The concentration equilibrium constant Kc (units mol dm-3 ^ dn). */
export function kc(rx, T, params = {}) {
  const K = kStandard(rx, T, params);
  if (rx.thermo.kind !== "kstd" || rx.dnGas === 0) return K;
  return K * Math.pow((R_L_BAR * T) / P_STD, -rx.dnGas);
}

/** Pressure equilibrium constant Kp in bar^dn (gas reactions only):  Kp = Kc (R T)^dn. */
export function kp(rx, T, params = {}) {
  if (!rx.gas) return null;
  return kc(rx, T, params) * Math.pow(R_L_BAR * T, rx.dnGas);
}

export const catalystFactor = (rx, T, on) => (on ? Math.exp(rx.kinetics.catalystDEa / (R * T)) : 1);

/** Forward rate constant at T (with optional catalyst). */
export function kfAt(rx, T, catalyst = false, params = {}) {
  const k = rx.kinetics;
  const kfRef = params.kfRef ?? k.kfRef;
  return kfRef * Math.exp(-(k.Ea / R) * (1 / T - 1 / k.Tk)) * catalystFactor(rx, T, catalyst);
}

/** {kf, kr, Kc} at T.  kr = kf / Kc always. */
export function rateConstants(rx, T, catalyst = false, params = {}) {
  const Kc = kc(rx, T, params); const kf = kfAt(rx, T, catalyst, params);
  return { kf, kr: kf / Kc, Kc };
}

/** Which way does heating shift? sign of dH: endothermic (dH>0) -> K rises with T. */
export const heatDirection = (rx) => (rx.thermo.dH > 0 ? "endothermic" : "exothermic");
