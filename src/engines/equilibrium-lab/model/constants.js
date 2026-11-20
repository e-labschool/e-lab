// Physical constants and numerical tolerances.  Every number the engine uses that is not a chemical parameter lives here.
export const R = 8.314462618;            // J mol^-1 K^-1 (CODATA 2018 exact)
export const R_L_BAR = 0.08314462618;    // L bar mol^-1 K^-1
export const P_STD = 1;                  // bar (standard pressure, IUPAC 1982 / 2016)
export const T_STD = 298.15;             // K

/** Equilibrium indicator thresholds on the relative rate mismatch |rf - rr| / max(rf, rr). */
export const EQ_TOL_NEAR = 0.10;         // "Near equilibrium" below 10 %
export const EQ_TOL_ATTAINED = 0.01;     // "Dynamic equilibrium attained" below 1 %
/** Q ~ K when |ln(Q/K)| is below this (about 1 %). */
export const Q_EQ_TOL = 0.01;

/** ODE solver tolerances (adaptive Dormand-Prince RK45). */
export const ODE_RTOL = 1e-9;
export const ODE_ATOL = 1e-13;
export const ODE_MAX_STEPS = 200000;
/** Concentrations below this magnitude are treated as exactly zero (they are numerical noise, never chemistry). */
export const C_ZERO = 1e-14;

/** Stochastic passenger model: above this expected number of events per tick the exact SSA is replaced by binomial tau-leaping. */
export const SSA_MAX_EVENTS = 4000;
export const TAU_LEAP_MAX_FRACTION = 0.05;   // one leap changes any propensity by at most ~5 %
