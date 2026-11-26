/**
 * fx-570EX ClassWiz - Mode 7: DIST (Distribution) Module
 *
 * Mode ID: DIST
 * Indicator: 'DIST'
 * Supports:
 * - Page 1/2: 1: Normal PD, 2: Normal CD, 3: Inverse Normal, 4: Binomial PD
 * - Page 2/2: 1: Binomial CD, 2: Poisson PD, 3: Poisson CD
 * - List & Variable modes for Binomial PD/CD and Poisson PD/CD
 * - High-precision erf/erfc (Cody), Inverse Normal (Acklam + Newton refinement),
 *   log-gamma / regularized incomplete beta & gamma for overflow-safe Binomial/Poisson.
 * - Full Ans integration, Norm1/Norm2/Fix/Sci formatting, OPTN submenu, and Math ERROR screens.
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext, SubMenuPage } from './types';
import { evaluateMathExpression, formatResult, toSuperscript } from '../calcEngine';

export type DistType =
  | 'NORMAL_PD'
  | 'NORMAL_CD'
  | 'INV_NORMAL'
  | 'BINOM_PD'
  | 'BINOM_CD'
  | 'POISSON_PD'
  | 'POISSON_CD';

export type DistInputMode = 'LIST' | 'VAR';

export interface DistMenuItem {
  type: DistType;
  label: string;
  page: 0 | 1;
  key: string;
  needsInputMode: boolean;
}

export const DIST_MENU_ITEMS: DistMenuItem[] = [
  { type: 'NORMAL_PD', label: 'Normal PD', page: 0, key: '1', needsInputMode: false },
  { type: 'NORMAL_CD', label: 'Normal CD', page: 0, key: '2', needsInputMode: false },
  { type: 'INV_NORMAL', label: 'Inverse Normal', page: 0, key: '3', needsInputMode: false },
  { type: 'BINOM_PD', label: 'Binomial PD', page: 0, key: '4', needsInputMode: true },
  { type: 'BINOM_CD', label: 'Binomial CD', page: 1, key: '1', needsInputMode: true },
  { type: 'POISSON_PD', label: 'Poisson PD', page: 1, key: '2', needsInputMode: true },
  { type: 'POISSON_CD', label: 'Poisson CD', page: 1, key: '3', needsInputMode: true },
];

export interface DistParamDef {
  key: string;
  label: string;
  defaultRaw: string;
  defaultVal: number;
}

export interface DistFieldValue {
  raw: string;
  val: number;
}

export interface DistListResultRow {
  xRaw: string;
  xVal: number;
  pVal: number;
}

export interface DistData {
  distType: DistType;
  menuCursorIdx: number; // 0..6 in DIST_MENU_ITEMS
  inputMode: DistInputMode;
  inputModeCursor: number; // 0 = List, 1 = Variable
  params: Record<string, DistFieldValue>;
  activeFieldIdx: number; // 0..fields.length (fields.length === Execute row)
  inputBuffer: string;
  listItems: DistFieldValue[];
  currentListRow: number; // 0..listItems.length (trailing empty row)
  resultValue: number | null;
  resultLabel: 'p' | 'x';
  listResults: DistListResultRow[];
  resultListRow: number;
  error?: string;
  errorReturnScreen?: string;
  prevScreenBeforeSubMenu?: string;
  subMenuCursorIdx?: number;
}

export function getDistParamsDef(distType: DistType, inputMode: DistInputMode): DistParamDef[] {
  switch (distType) {
    case 'NORMAL_PD':
      return [
        { key: 'x', label: 'x', defaultRaw: '0', defaultVal: 0 },
        { key: 'sigma', label: 'σ', defaultRaw: '1', defaultVal: 1 },
        { key: 'mu', label: 'μ', defaultRaw: '0', defaultVal: 0 },
      ];
    case 'NORMAL_CD':
      return [
        { key: 'lower', label: 'Lower', defaultRaw: '0', defaultVal: 0 },
        { key: 'upper', label: 'Upper', defaultRaw: '0', defaultVal: 0 },
        { key: 'sigma', label: 'σ', defaultRaw: '1', defaultVal: 1 },
        { key: 'mu', label: 'μ', defaultRaw: '0', defaultVal: 0 },
      ];
    case 'INV_NORMAL':
      return [
        { key: 'area', label: 'Area', defaultRaw: '', defaultVal: NaN },
        { key: 'sigma', label: 'σ', defaultRaw: '1', defaultVal: 1 },
        { key: 'mu', label: 'μ', defaultRaw: '0', defaultVal: 0 },
      ];
    case 'BINOM_PD':
    case 'BINOM_CD':
      return inputMode === 'LIST'
        ? [
            { key: 'N', label: 'N', defaultRaw: '', defaultVal: NaN },
            { key: 'p', label: 'p', defaultRaw: '', defaultVal: NaN },
          ]
        : [
            { key: 'x', label: 'x', defaultRaw: '', defaultVal: NaN },
            { key: 'N', label: 'N', defaultRaw: '', defaultVal: NaN },
            { key: 'p', label: 'p', defaultRaw: '', defaultVal: NaN },
          ];
    case 'POISSON_PD':
    case 'POISSON_CD':
      return inputMode === 'LIST'
        ? [{ key: 'lambda', label: 'λ', defaultRaw: '', defaultVal: NaN }]
        : [
            { key: 'x', label: 'x', defaultRaw: '', defaultVal: NaN },
            { key: 'lambda', label: 'λ', defaultRaw: '', defaultVal: NaN },
          ];
  }
}

export function createDefaultParams(distType: DistType, inputMode: DistInputMode): Record<string, DistFieldValue> {
  const defs = getDistParamsDef(distType, inputMode);
  const out: Record<string, DistFieldValue> = {};
  for (const d of defs) {
    out[d.key] = { raw: d.defaultRaw, val: d.defaultVal };
  }
  return out;
}

export function getDistTitle(distType: DistType): string {
  return DIST_MENU_ITEMS.find((m) => m.type === distType)?.label || 'Distribution';
}

// =========================================================================
// High-Precision Numerical Distribution Algorithms
// =========================================================================

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const SQRT_1_2 = Math.SQRT1_2;

/**
 * Cody's rational Chebyshev approximation for erf(x) and erfc(x) (~15 digits accuracy).
 */
export function erfc(x: number): number {
  if (isNaN(x)) return NaN;
  const ax = Math.abs(x);

  if (ax < 0.46875) {
    // Evaluate erf(x) on |x| < 0.46875 then 1 - erf(x)
    const a = [
      3.1611237438705656e0,
      1.13864154151050156e2,
      3.77485237685302021e2,
      3.20937758913846947e3,
      1.85777706184603153e-1,
    ];
    const b = [
      2.36012909523441209e1,
      2.44024637934444173e2,
      1.28261652607737228e3,
      2.84423683343917062e3,
    ];
    const xsq = x * x;
    let num = a[4] * xsq;
    let den = xsq;
    for (let i = 0; i < 3; i++) {
      num = (num + a[i]) * xsq;
      den = (den + b[i]) * xsq;
    }
    const erfVal = (x * (num + a[3])) / (den + b[3]);
    return 1 - erfVal;
  }

  if (ax <= 4.0) {
    const c = [
      5.64188496988670089e-1,
      8.88314979438837594e0,
      6.61191906371416295e1,
      2.98635138197400131e2,
      8.8195222124176909e2,
      1.71204761263407058e3,
      2.05107837782607147e3,
      1.23033935479799725e3,
      2.15311535474403846e-8,
    ];
    const d = [
      1.57449261107098347e1,
      1.17693950891312499e2,
      5.37181101862009858e2,
      1.62138957456669019e3,
      3.29079923573345963e3,
      4.36261909014324716e3,
      3.43936767414372164e3,
      1.23033935480374942e3,
    ];
    let num = c[8] * ax;
    let den = ax;
    for (let i = 0; i < 7; i++) {
      num = (num + c[i]) * ax;
      den = (den + d[i]) * ax;
    }
    const ratio = (num + c[7]) / (den + d[7]);
    const ysq = Math.floor(ax * 16) / 16;
    const del = (ax - ysq) * (ax + ysq);
    let res = Math.exp(-ysq * ysq) * Math.exp(-del) * ratio;
    if (x < 0) res = 2 - res;
    return res;
  }

  // |x| > 4.0
  if (ax > 26.6) {
    return x < 0 ? 2 : 0;
  }

  const p = [
    3.05326634961232344e-1,
    3.60344899949804439e-1,
    1.25781726111229246e-1,
    1.60837851487422766e-2,
    6.58749161529837803e-4,
    1.63153871373020978e-2,
  ];
  const q = [
    2.56852019228982235e0,
    1.87295284992346047e0,
    5.27905102951428412e-1,
    6.05183413124413191e-2,
    2.33520497626869185e-3,
  ];
  const xsq = 1 / (ax * ax);
  let num = p[5] * xsq;
  let den = xsq;
  for (let i = 0; i < 4; i++) {
    num = (num + p[i]) * xsq;
    den = (den + q[i]) * xsq;
  }
  const ratio = (xsq * (num + p[4])) / (den + q[4]);
  const resRatio = (1 / Math.sqrt(Math.PI) - ratio) / ax;
  const ysq = Math.floor(ax * 16) / 16;
  const del = (ax - ysq) * (ax + ysq);
  let res = Math.exp(-ysq * ysq) * Math.exp(-del) * resRatio;
  if (x < 0) res = 2 - res;
  return res;
}

export function normalPdf(x: number, sigma: number, mu: number): number {
  if (!isFinite(x) || !isFinite(sigma) || !isFinite(mu) || sigma <= 0) {
    throw new Error('Math ERROR');
  }
  const z = (x - mu) / sigma;
  const exponent = -0.5 * z * z;
  if (exponent < -745) return 0;
  return Math.exp(exponent) / (SQRT_2PI * sigma);
}

export function normalCd(lower: number, upper: number, sigma: number, mu: number): number {
  if (!isFinite(lower) || !isFinite(upper) || !isFinite(sigma) || !isFinite(mu) || sigma <= 0) {
    throw new Error('Math ERROR');
  }
  if (lower > upper) return 0;
  const z1 = (lower - mu) / sigma;
  const z2 = (upper - mu) / sigma;
  let prob: number;
  if (z1 >= 0) {
    prob = 0.5 * (erfc(z1 * SQRT_1_2) - erfc(z2 * SQRT_1_2));
  } else if (z2 <= 0) {
    prob = 0.5 * (erfc(-z2 * SQRT_1_2) - erfc(-z1 * SQRT_1_2));
  } else {
    prob = 1 - 0.5 * erfc(-z1 * SQRT_1_2) - 0.5 * erfc(z2 * SQRT_1_2);
  }
  return Math.max(0, Math.min(1, prob));
}

/**
 * Acklam's algorithm for inverse standard normal CDF + 2 Newton refinement steps via erfc.
 */
export function inverseNormal(area: number, sigma: number, mu: number): number {
  if (!isFinite(area) || !isFinite(sigma) || !isFinite(mu) || sigma <= 0 || area <= 0 || area >= 1) {
    throw new Error('Math ERROR');
  }

  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.383577518672690e2,
    -3.066479806614716e1,
    2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838e0,
    -2.549732539343734e0,
    4.374664141464968e0,
    2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let z: number;

  if (area < pLow) {
    const q = Math.sqrt(-2 * Math.log(area));
    z =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (area <= pHigh) {
    const q = area - 0.5;
    const r = q * q;
    z =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - area));
    z =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // Refine with 2 Halley/Newton steps using high-precision erfc
  for (let iter = 0; iter < 2; iter++) {
    const pdf = Math.exp(-0.5 * z * z) / SQRT_2PI;
    if (pdf === 0) break;
    let err: number;
    if (z <= 0) {
      err = 0.5 * erfc(-z * SQRT_1_2) - area;
    } else {
      err = (1 - area) - 0.5 * erfc(z * SQRT_1_2);
    }
    z -= err / pdf;
  }

  const out = mu + sigma * z;
  return Math.abs(out) < 1e-15 ? 0 : out;
}

const LANCZOS_G = 7;
const LANCZOS_COEFFS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function logGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const shifted = z - 1;
  let x = LANCZOS_COEFFS[0];
  for (let i = 1; i < LANCZOS_COEFFS.length; i++) {
    x += LANCZOS_COEFFS[i] / (shifted + i);
  }
  const t = shifted + LANCZOS_G + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

const SMALL_LOG_FACT: number[] = (() => {
  const arr = [0];
  for (let i = 1; i <= 32; i++) {
    arr.push(arr[i - 1] + Math.log(i));
  }
  return arr;
})();

export function logFactorial(n: number): number {
  if (n <= 32) return SMALL_LOG_FACT[n];
  return logGamma(n + 1);
}

function logBinomialCoeff(n: number, k: number): number {
  if (k <= 0 || k >= n) return 0;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

function toSafeNonNegInt(val: number): number {
  if (!isFinite(val) || val < -1e-12) {
    throw new Error('Math ERROR');
  }
  const rounded = Math.round(val);
  if (Math.abs(val - rounded) > 1e-10 || rounded < 0) {
    throw new Error('Math ERROR');
  }
  return rounded;
}

/**
 * Continued-fraction regularized incomplete beta I_x(a, b) for large-N Binomial CD.
 */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/**
 * Regularized upper incomplete gamma Q(a, x) for large-x Poisson CD.
 */
function regularizedGammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const gln = logGamma(a);

  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 500; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    const pVal = sum * Math.exp(-x + a * Math.log(x) - gln);
    return Math.max(0, Math.min(1, 1 - pVal));
  }

  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  const qVal = Math.exp(-x + a * Math.log(x) - gln) * h;
  return Math.max(0, Math.min(1, qVal));
}

export function binomialPd(xRaw: number, nRaw: number, p: number): number {
  const n = toSafeNonNegInt(nRaw);
  const x = toSafeNonNegInt(xRaw);
  if (!isFinite(p) || p < 0 || p > 1) {
    throw new Error('Math ERROR');
  }
  if (x > n) return 0;
  if (p === 0) return x === 0 ? 1 : 0;
  if (p === 1) return x === n ? 1 : 0;
  const logP = logBinomialCoeff(n, x) + x * Math.log(p) + (n - x) * Math.log(1 - p);
  if (logP < -745) return 0;
  return Math.max(0, Math.min(1, Math.exp(logP)));
}

export function binomialCd(xRaw: number, nRaw: number, p: number): number {
  const n = toSafeNonNegInt(nRaw);
  const x = toSafeNonNegInt(xRaw);
  if (!isFinite(p) || p < 0 || p > 1) {
    throw new Error('Math ERROR');
  }
  if (x >= n) return 1;
  if (p === 0) return 1;
  if (p === 1) return 0;

  if (n <= 2000) {
    if (x <= n / 2) {
      let sum = 0;
      for (let k = 0; k <= x; k++) {
        sum += binomialPd(k, n, p);
      }
      return Math.max(0, Math.min(1, sum));
    }
    let tail = 0;
    for (let k = x + 1; k <= n; k++) {
      tail += binomialPd(k, n, p);
    }
    return Math.max(0, Math.min(1, 1 - tail));
  }

  // P(X <= x) = I_{1 - p}(n - x, x + 1)
  return Math.max(0, Math.min(1, regularizedBeta(n - x, x + 1, 1 - p)));
}

export function poissonPd(xRaw: number, lambda: number): number {
  const x = toSafeNonNegInt(xRaw);
  if (!isFinite(lambda) || lambda <= 0) {
    throw new Error('Math ERROR');
  }
  const logP = x * Math.log(lambda) - lambda - logFactorial(x);
  if (logP < -745) return 0;
  return Math.max(0, Math.min(1, Math.exp(logP)));
}

export function poissonCd(xRaw: number, lambda: number): number {
  const x = toSafeNonNegInt(xRaw);
  if (!isFinite(lambda) || lambda <= 0) {
    throw new Error('Math ERROR');
  }
  if (x <= 2000) {
    let sum = 0;
    const logLam = Math.log(lambda);
    for (let k = 0; k <= x; k++) {
      const logP = k * logLam - lambda - logFactorial(k);
      if (logP >= -745) sum += Math.exp(logP);
    }
    return Math.max(0, Math.min(1, sum));
  }
  // P(X <= x) = Q(x + 1, lambda)
  return regularizedGammaQ(x + 1, lambda);
}

// =========================================================================
// Expression Parsing & Format Helpers
// =========================================================================

function preprocessSciNotation(raw: string): string {
  // Rewrite embedded scientific notation like `-1E99` or `2.5e-4` into `-1×10^(99)` / `2.5×10^(-4)`
  // while leaving `Ans` and bare `e` untouched. Also normalize bare leading `×10^(`.
  let out = raw.replace(/(\d(?:\.\d+)?)[eE]([+-]?\d+)/g, '$1×10^($2)');
  out = out.replace(/(^|[+\-×÷(])×10\^\(/g, '$11×10^(');
  return out;
}

function evalDistExpression(raw: string, ctx: ModeContext): { ok: true; val: number } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };

  const prepped = preprocessSciNotation(trimmed);
  try {
    const res = evaluateMathExpression(
      prepped,
      ctx.angleMode,
      { ...ctx.sharedMemory },
      ctx.sharedMemory.Ans
    );
    if (res && res.success && typeof res.result === 'number' && isFinite(res.result)) {
      return { ok: true, val: res.result };
    }
  } catch {
    // Fallback below
  }

  const num = Number(trimmed);
  if (!isNaN(num) && isFinite(num)) {
    return { ok: true, val: num };
  }
  return { ok: false };
}

function formatDistNumber(val: number, ctx: ModeContext): string {
  if (!isFinite(val)) return 'Math ERROR';
  if (val === 0) return '0';
  const abs = Math.abs(val);
  if ((ctx.displayFormat === 'NORM1' || ctx.displayFormat === 'NORM2') && abs < 1e-15) {
    let exp = Math.floor(Math.log10(abs));
    let mantissa = val / Math.pow(10, exp);
    let roundedMantissa = parseFloat(mantissa.toPrecision(10));
    if (Math.abs(roundedMantissa) >= 10) {
      roundedMantissa /= 10;
      exp += 1;
    }
    return `${roundedMantissa}×10${toSuperscript(exp)}`;
  }
  return formatResult(val, ctx.displayFormat, ctx.fixDigits ?? 2, ctx.sciDigits ?? 3, 0);
}

function mapKeyToBufferAppend(key: string): string | null {
  if (/^[0-9.]$/.test(key)) return key;
  if (key === '+' || key === '-' || key === '(' || key === ')' || key === '^' || key === '!') return key;
  if (key === '×' || key === '*') return '×';
  if (key === '÷' || key === '/' || key === '■/□') return '/';
  if (key === '(-' || key === '(-)' || key === '(−)') return '-';
  if (key === '×10^(') return '×10^(';
  if (key === 'e^(') return 'e^(';
  if (key === '10^(') return '10^(';
  if (key === '√' || key === 'sqrt') return '√(';
  if (key === 'x²') return '^2';
  if (key === 'x³') return '^3';
  if (key === 'x⁻¹') return '^(-1)';
  if (key === 'π' || key === 'pi') return 'π';
  if (key === 'e') return 'e';
  if (key === 'Ans') return 'Ans';
  if (key === 'ln(' || key === 'log(' || key === 'sin(' || key === 'cos(' || key === 'tan(') return key;
  if (/^[A-FMXY]$/.test(key)) return key;
  return null;
}

// =========================================================================
// Execution Helpers
// =========================================================================

function executeVariableCalculation(
  distType: DistType,
  params: Record<string, DistFieldValue>,
  ctx: ModeContext
): { ok: true; value: number; label: 'p' | 'x' } | { ok: false; error: string } {
  try {
    const getVal = (k: string): number => {
      const f = params[k];
      if (!f || f.raw.trim() === '' || isNaN(f.val) || !isFinite(f.val)) {
        throw new Error('Math ERROR');
      }
      return f.val;
    };

    switch (distType) {
      case 'NORMAL_PD': {
        const val = normalPdf(getVal('x'), getVal('sigma'), getVal('mu'));
        return { ok: true, value: val, label: 'p' };
      }
      case 'NORMAL_CD': {
        const val = normalCd(getVal('lower'), getVal('upper'), getVal('sigma'), getVal('mu'));
        return { ok: true, value: val, label: 'p' };
      }
      case 'INV_NORMAL': {
        const val = inverseNormal(getVal('area'), getVal('sigma'), getVal('mu'));
        return { ok: true, value: val, label: 'x' };
      }
      case 'BINOM_PD': {
        const val = binomialPd(getVal('x'), getVal('N'), getVal('p'));
        return { ok: true, value: val, label: 'p' };
      }
      case 'BINOM_CD': {
        const val = binomialCd(getVal('x'), getVal('N'), getVal('p'));
        return { ok: true, value: val, label: 'p' };
      }
      case 'POISSON_PD': {
        const val = poissonPd(getVal('x'), getVal('lambda'));
        return { ok: true, value: val, label: 'p' };
      }
      case 'POISSON_CD': {
        const val = poissonCd(getVal('x'), getVal('lambda'));
        return { ok: true, value: val, label: 'p' };
      }
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Math ERROR' };
  }
}

function executeListCalculation(
  distType: DistType,
  listItems: DistFieldValue[],
  params: Record<string, DistFieldValue>
): { ok: true; rows: DistListResultRow[] } | { ok: false; error: string } {
  try {
    if (!listItems || listItems.length === 0) {
      throw new Error('Math ERROR');
    }
    const getVal = (k: string): number => {
      const f = params[k];
      if (!f || f.raw.trim() === '' || isNaN(f.val) || !isFinite(f.val)) {
        throw new Error('Math ERROR');
      }
      return f.val;
    };

    const rows: DistListResultRow[] = [];
    if (distType === 'BINOM_PD' || distType === 'BINOM_CD') {
      const nVal = getVal('N');
      const pVal = getVal('p');
      for (const item of listItems) {
        const prob =
          distType === 'BINOM_PD'
            ? binomialPd(item.val, nVal, pVal)
            : binomialCd(item.val, nVal, pVal);
        rows.push({ xRaw: item.raw, xVal: item.val, pVal: prob });
      }
    } else if (distType === 'POISSON_PD' || distType === 'POISSON_CD') {
      const lam = getVal('lambda');
      for (const item of listItems) {
        const prob =
          distType === 'POISSON_PD'
            ? poissonPd(item.val, lam)
            : poissonCd(item.val, lam);
        rows.push({ xRaw: item.raw, xVal: item.val, pVal: prob });
      }
    } else {
      throw new Error('Math ERROR');
    }

    return { ok: true, rows };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Math ERROR' };
  }
}

// =========================================================================
// OPTN Sub-Menu Definition
// =========================================================================

export const DIST_SUBMENU_PAGES: SubMenuPage[] = [
  {
    title: 'Distribution',
    items: [
      {
        id: 1,
        key: '1',
        name: 'Select Type',
        action: (ctx) => {
          ctx.setModeState((prev) => ({
            ...prev,
            screen: 'SELECT_DIST',
            data: { ...prev.data, menuCursorIdx: 0, inputBuffer: '', error: undefined },
          }));
        },
      },
      {
        id: 2,
        key: '2',
        name: 'Parameter',
        action: (ctx) => {
          ctx.setModeState((prev) => {
            const d = (prev.data || {}) as DistData;
            const item = DIST_MENU_ITEMS.find((m) => m.type === d.distType);
            const targetScreen =
              item?.needsInputMode && d.inputMode === 'LIST' && d.prevScreenBeforeSubMenu === 'LIST_INPUT'
                ? 'LIST_INPUT'
                : 'PARAM_INPUT';
            return {
              ...prev,
              screen: targetScreen,
              data: { ...d, inputBuffer: '', error: undefined },
            };
          });
        },
      },
    ],
  },
];

// =========================================================================
// Mode Module Export
// =========================================================================

export const distModeModule: ModeModule = {
  id: 'DIST',
  code: 'DIST',
  name: 'Distribution',
  shortName: 'Distribution',
  menuNumber: 7,
  isImplemented: true,

  getIndicator: () => 'DIST',

  keymap: {
    overrides: {
      OPTN: {
        label: 'OPTN',
        description: 'Distribution Options',
        action: (ctx) => {
          ctx.setModeState((prev) => {
            const d = (prev.data || {}) as DistData;
            if (prev.screen === 'SUBMENU') {
              return {
                ...prev,
                screen: d.prevScreenBeforeSubMenu || 'SELECT_DIST',
                data: { ...d, subMenuCursorIdx: 0 },
              };
            }
            return {
              ...prev,
              screen: 'SUBMENU',
              data: {
                ...d,
                prevScreenBeforeSubMenu: prev.screen,
                subMenuCursorIdx: 0,
              },
            };
          });
        },
      },
    },
  },

  getInitialState: (): ModeState => ({
    mode: 'DIST',
    screen: 'SELECT_DIST',
    data: {
      distType: 'NORMAL_PD',
      menuCursorIdx: 0,
      inputMode: 'VAR',
      inputModeCursor: 1,
      params: createDefaultParams('NORMAL_PD', 'VAR'),
      activeFieldIdx: 0,
      inputBuffer: '',
      listItems: [],
      currentListRow: 0,
      resultValue: null,
      resultLabel: 'p',
      listResults: [],
      resultListRow: 0,
      subMenuCursorIdx: 0,
    } as DistData,
  }),

  getSubMenu: () => DIST_SUBMENU_PAGES,

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;
    const data = (modeState.data || {}) as DistData;

    const selectDistribution = (item: DistMenuItem, itemIdx: number) => {
      if (item.needsInputMode) {
        setModeState((prev) => ({
          ...prev,
          screen: 'SELECT_INPUT_MODE',
          data: {
            ...prev.data,
            distType: item.type,
            menuCursorIdx: itemIdx,
            inputModeCursor: 0, // 1: List highlighted first, matching fx-570EX
            inputBuffer: '',
            error: undefined,
          },
        }));
      } else {
        setModeState((prev) => ({
          ...prev,
          screen: 'PARAM_INPUT',
          data: {
            ...prev.data,
            distType: item.type,
            menuCursorIdx: itemIdx,
            inputMode: 'VAR',
            params: createDefaultParams(item.type, 'VAR'),
            activeFieldIdx: 0,
            inputBuffer: '',
            error: undefined,
          },
        }));
      }
    };

    const runCalculation = (
      distType: DistType,
      inputMode: DistInputMode,
      params: Record<string, DistFieldValue>,
      listItems: DistFieldValue[]
    ) => {
      if (inputMode === 'LIST' && (distType === 'BINOM_PD' || distType === 'BINOM_CD' || distType === 'POISSON_PD' || distType === 'POISSON_CD')) {
        const res = executeListCalculation(distType, listItems, params);
        if (!res.ok) {
          setModeState((prev) => ({
            ...prev,
            screen: 'ERROR',
            data: {
              ...prev.data,
              params,
              listItems,
              inputBuffer: '',
              error: res.error,
              errorReturnScreen: 'PARAM_INPUT',
            },
          }));
          return;
        }
        const firstP = res.rows[0]?.pVal;
        if (typeof firstP === 'number' && isFinite(firstP)) {
          ctx.setSharedMemory((prev) => ({ ...prev, Ans: firstP }));
        }
        setModeState((prev) => ({
          ...prev,
          screen: 'LIST_RESULT',
          data: {
            ...prev.data,
            params,
            listItems,
            listResults: res.rows,
            resultListRow: 0,
            inputBuffer: '',
            error: undefined,
          },
        }));
      } else {
        const res = executeVariableCalculation(distType, params, ctx);
        if (!res.ok) {
          setModeState((prev) => ({
            ...prev,
            screen: 'ERROR',
            data: {
              ...prev.data,
              params,
              inputBuffer: '',
              error: res.error,
              errorReturnScreen: 'PARAM_INPUT',
            },
          }));
          return;
        }
        ctx.setSharedMemory((prev) => ({ ...prev, Ans: res.value }));
        setModeState((prev) => ({
          ...prev,
          screen: 'RESULT',
          data: {
            ...prev.data,
            params,
            resultValue: res.value,
            resultLabel: res.label,
            inputBuffer: '',
            error: undefined,
          },
        }));
      }
    };

    // ==========================================
    // OPTN Shortcut
    // ==========================================
    if (key === 'OPTN') {
      distModeModule.keymap.overrides.OPTN.action(ctx);
      return true;
    }

    // ==========================================
    // 0. ERROR Screen (Math ERROR)
    // ==========================================
    if (modeState.screen === 'ERROR') {
      if (key === 'AC' || key === 'ON' || key === 'LEFT' || key === '◄' || key === 'RIGHT' || key === '►' || key === '=') {
        setModeState((prev) => ({
          ...prev,
          screen: data.errorReturnScreen || 'PARAM_INPUT',
          data: {
            ...prev.data,
            error: undefined,
            inputBuffer: '',
          },
        }));
        return true;
      }
      return true;
    }

    // ==========================================
    // 1. SUBMENU Screen (OPTN: 1: Select Type, 2: Parameter)
    // ==========================================
    if (modeState.screen === 'SUBMENU') {
      const curIdx = data.subMenuCursorIdx || 0;
      if (key === 'AC' || key === 'ON') {
        setModeState((prev) => ({
          ...prev,
          screen: data.prevScreenBeforeSubMenu || 'SELECT_DIST',
          data: { ...prev.data, subMenuCursorIdx: 0 },
        }));
        return true;
      }
      if (key === 'UP' || key === '▲' || key === 'DOWN' || key === '▼') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, subMenuCursorIdx: curIdx === 0 ? 1 : 0 },
        }));
        return true;
      }
      const items = DIST_SUBMENU_PAGES[0].items;
      if (key === '1' || key === '2') {
        const match = items.find((it) => it.key === key);
        if (match) match.action(ctx);
        return true;
      }
      if (key === '=') {
        items[curIdx]?.action(ctx);
        return true;
      }
      return true;
    }

    // ==========================================
    // 2. SELECT_DIST Screen (2-Page Distribution Menu)
    // ==========================================
    if (modeState.screen === 'SELECT_DIST') {
      const curIdx = typeof data.menuCursorIdx === 'number' ? data.menuCursorIdx : 0;
      const curPage = DIST_MENU_ITEMS[curIdx]?.page ?? 0;

      if (key === 'AC' || key === 'ON') {
        ctx.exitToCalc();
        return true;
      }

      if (key === 'DOWN' || key === '▼') {
        const nextIdx = (curIdx + 1) % DIST_MENU_ITEMS.length;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, menuCursorIdx: nextIdx },
        }));
        return true;
      }

      if (key === 'UP' || key === '▲') {
        const nextIdx = (curIdx - 1 + DIST_MENU_ITEMS.length) % DIST_MENU_ITEMS.length;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, menuCursorIdx: nextIdx },
        }));
        return true;
      }

      if (key === 'RIGHT' || key === '►' || key === 'LEFT' || key === '◄') {
        const nextPage = curPage === 0 ? 1 : 0;
        const pageItems = DIST_MENU_ITEMS.filter((it) => it.page === nextPage);
        const firstOnPage = DIST_MENU_ITEMS.indexOf(pageItems[0]);
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, menuCursorIdx: firstOnPage },
        }));
        return true;
      }

      const pageItems = DIST_MENU_ITEMS.filter((it) => it.page === curPage);
      const numMatch = pageItems.find((it) => it.key === key);
      if (numMatch) {
        selectDistribution(numMatch, DIST_MENU_ITEMS.indexOf(numMatch));
        return true;
      }

      if (key === '=') {
        const chosen = DIST_MENU_ITEMS[curIdx] || DIST_MENU_ITEMS[0];
        selectDistribution(chosen, curIdx);
        return true;
      }

      return true;
    }

    // ==========================================
    // 3. SELECT_INPUT_MODE Screen (1: List, 2: Variable)
    // ==========================================
    if (modeState.screen === 'SELECT_INPUT_MODE') {
      const cur = data.inputModeCursor ?? 0;
      if (key === 'AC' || key === 'ON') {
        setModeState((prev) => ({
          ...prev,
          screen: 'SELECT_DIST',
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'UP' || key === '▲' || key === 'DOWN' || key === '▼') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputModeCursor: cur === 0 ? 1 : 0 },
        }));
        return true;
      }

      let chosenMode: DistInputMode | null = null;
      if (key === '1') chosenMode = 'LIST';
      else if (key === '2') chosenMode = 'VAR';
      else if (key === '=') chosenMode = cur === 0 ? 'LIST' : 'VAR';

      if (chosenMode) {
        if (chosenMode === 'LIST') {
          setModeState((prev) => ({
            ...prev,
            screen: 'LIST_INPUT',
            data: {
              ...prev.data,
              inputMode: 'LIST',
              params: createDefaultParams(data.distType, 'LIST'),
              listItems: [],
              currentListRow: 0,
              activeFieldIdx: 0,
              inputBuffer: '',
              error: undefined,
            },
          }));
        } else {
          setModeState((prev) => ({
            ...prev,
            screen: 'PARAM_INPUT',
            data: {
              ...prev.data,
              inputMode: 'VAR',
              params: createDefaultParams(data.distType, 'VAR'),
              activeFieldIdx: 0,
              inputBuffer: '',
              error: undefined,
            },
          }));
        }
        return true;
      }

      return true;
    }

    // ==========================================
    // 4. LIST_INPUT Screen (1-Column x Data Table)
    // ==========================================
    if (modeState.screen === 'LIST_INPUT') {
      const list = [...(data.listItems || [])];
      const curRow = Math.min(Math.max(0, data.currentListRow || 0), list.length);
      const buf = data.inputBuffer || '';

      if (key === 'AC' || key === 'ON') {
        if (buf.length > 0) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: '' },
          }));
          return true;
        }
        setModeState((prev) => ({
          ...prev,
          screen: 'SELECT_INPUT_MODE',
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }

      const commitListCell = (rawBuf: string): boolean => {
        if (rawBuf.trim() === '') return true;
        const parsed = evalDistExpression(rawBuf, ctx);
        if (!parsed.ok) return false;
        const entry: DistFieldValue = { raw: rawBuf, val: parsed.val };
        if (curRow < list.length) {
          list[curRow] = entry;
        } else {
          list.push(entry);
        }
        return true;
      };

      if (key === 'UP' || key === '▲') {
        if (buf !== '' && !commitListCell(buf)) {
          setModeState((prev) => ({
            ...prev,
            screen: 'ERROR',
            data: { ...prev.data, error: 'Math ERROR', errorReturnScreen: 'LIST_INPUT', inputBuffer: '' },
          }));
          return true;
        }
        const nextRow = curRow > 0 ? curRow - 1 : list.length;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, listItems: list, currentListRow: nextRow, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'DOWN' || key === '▼') {
        if (buf !== '' && !commitListCell(buf)) {
          setModeState((prev) => ({
            ...prev,
            screen: 'ERROR',
            data: { ...prev.data, error: 'Math ERROR', errorReturnScreen: 'LIST_INPUT', inputBuffer: '' },
          }));
          return true;
        }
        const nextRow = curRow < list.length ? curRow + 1 : 0;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, listItems: list, currentListRow: nextRow, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'RIGHT' || key === '►') {
        if (buf !== '' && !commitListCell(buf)) {
          setModeState((prev) => ({
            ...prev,
            screen: 'ERROR',
            data: { ...prev.data, error: 'Math ERROR', errorReturnScreen: 'LIST_INPUT', inputBuffer: '' },
          }));
          return true;
        }
        if (list.length > 0) {
          setModeState((prev) => ({
            ...prev,
            screen: 'PARAM_INPUT',
            data: { ...prev.data, listItems: list, activeFieldIdx: 0, inputBuffer: '' },
          }));
        }
        return true;
      }

      if (key === 'DEL') {
        if (buf.length > 0) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: buf.slice(0, -1) },
          }));
        } else if (curRow < list.length) {
          list.splice(curRow, 1);
          setModeState((prev) => ({
            ...prev,
            data: {
              ...prev.data,
              listItems: list,
              currentListRow: Math.min(curRow, list.length),
            },
          }));
        }
        return true;
      }

      if (key === '=') {
        if (buf.trim() !== '') {
          if (!commitListCell(buf)) {
            setModeState((prev) => ({
              ...prev,
              screen: 'ERROR',
              data: { ...prev.data, error: 'Math ERROR', errorReturnScreen: 'LIST_INPUT', inputBuffer: '' },
            }));
            return true;
          }
          const nextRow = Math.min(curRow + 1, list.length);
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, listItems: list, currentListRow: nextRow, inputBuffer: '' },
          }));
          return true;
        }

        // Empty buffer: if on empty trailing row (or if user presses = with populated list), proceed to parameters
        if (list.length > 0 && curRow === list.length) {
          setModeState((prev) => ({
            ...prev,
            screen: 'PARAM_INPUT',
            data: { ...prev.data, listItems: list, activeFieldIdx: 0, inputBuffer: '' },
          }));
          return true;
        }
        if (curRow < list.length) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, currentListRow: curRow + 1, inputBuffer: '' },
          }));
        }
        return true;
      }

      const appendStr = mapKeyToBufferAppend(key);
      if (appendStr !== null) {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: buf + appendStr },
        }));
        return true;
      }

      return false;
    }

    // ==========================================
    // 5. PARAM_INPUT Screen
    // ==========================================
    if (modeState.screen === 'PARAM_INPUT') {
      const fields = getDistParamsDef(data.distType, data.inputMode);
      const totalRows = fields.length + 1; // fields + Execute row
      const curIdx = Math.min(Math.max(0, data.activeFieldIdx || 0), fields.length);
      const params: Record<string, DistFieldValue> = { ...(data.params || createDefaultParams(data.distType, data.inputMode)) };
      const buf = data.inputBuffer || '';

      if (key === 'AC' || key === 'ON') {
        if (buf.length > 0) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: '' },
          }));
          return true;
        }
        const item = DIST_MENU_ITEMS.find((m) => m.type === data.distType);
        const backScreen = item?.needsInputMode
          ? data.inputMode === 'LIST'
            ? 'LIST_INPUT'
            : 'SELECT_INPUT_MODE'
          : 'SELECT_DIST';
        setModeState((prev) => ({
          ...prev,
          screen: backScreen,
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }

      const commitActiveField = (): boolean => {
        if (curIdx >= fields.length) return true;
        if (buf.trim() === '') return true;
        const parsed = evalDistExpression(buf, ctx);
        if (!parsed.ok) return false;
        const fieldKey = fields[curIdx].key;
        params[fieldKey] = { raw: buf, val: parsed.val };
        return true;
      };

      if (key === 'UP' || key === '▲') {
        if (!commitActiveField()) {
          setModeState((prev) => ({
            ...prev,
            screen: 'ERROR',
            data: { ...prev.data, error: 'Math ERROR', errorReturnScreen: 'PARAM_INPUT', inputBuffer: '' },
          }));
          return true;
        }
        const nextIdx = (curIdx - 1 + totalRows) % totalRows;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, params, activeFieldIdx: nextIdx, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'DOWN' || key === '▼') {
        if (!commitActiveField()) {
          setModeState((prev) => ({
            ...prev,
            screen: 'ERROR',
            data: { ...prev.data, error: 'Math ERROR', errorReturnScreen: 'PARAM_INPUT', inputBuffer: '' },
          }));
          return true;
        }
        const nextIdx = (curIdx + 1) % totalRows;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, params, activeFieldIdx: nextIdx, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'DEL') {
        if (buf.length > 0) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: buf.slice(0, -1) },
          }));
        } else if (curIdx < fields.length) {
          const fieldKey = fields[curIdx].key;
          params[fieldKey] = { raw: '', val: NaN };
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, params },
          }));
        }
        return true;
      }

      if (key === '=') {
        if (!commitActiveField()) {
          setModeState((prev) => ({
            ...prev,
            screen: 'ERROR',
            data: { ...prev.data, error: 'Math ERROR', errorReturnScreen: 'PARAM_INPUT', inputBuffer: '' },
          }));
          return true;
        }

        // Pressing '=' on the final field or on Execute triggers calculation
        if (curIdx >= fields.length - 1) {
          runCalculation(data.distType, data.inputMode, params, data.listItems || []);
          return true;
        }

        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, params, activeFieldIdx: curIdx + 1, inputBuffer: '' },
        }));
        return true;
      }

      // If user starts typing while focused on Execute row, move back to first field or absorb
      if (curIdx < fields.length) {
        const appendStr = mapKeyToBufferAppend(key);
        if (appendStr !== null) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: buf + appendStr },
          }));
          return true;
        }
      }

      return false;
    }

    // ==========================================
    // 6. RESULT Screen (Variable Mode Output)
    // ==========================================
    if (modeState.screen === 'RESULT') {
      if (key === 'AC' || key === 'ON' || key === '=') {
        setModeState((prev) => ({
          ...prev,
          screen: 'PARAM_INPUT',
          data: { ...prev.data, inputBuffer: '', error: undefined },
        }));
        return true;
      }
      return true;
    }

    // ==========================================
    // 7. LIST_RESULT Screen (List Mode x | P Table)
    // ==========================================
    if (modeState.screen === 'LIST_RESULT') {
      const rows = data.listResults || [];
      const curRow = data.resultListRow || 0;

      if (key === 'AC' || key === 'ON' || key === '=') {
        setModeState((prev) => ({
          ...prev,
          screen: 'PARAM_INPUT',
          data: { ...prev.data, inputBuffer: '', error: undefined },
        }));
        return true;
      }

      if (key === 'UP' || key === '▲') {
        if (rows.length > 0) {
          const nextRow = curRow > 0 ? curRow - 1 : rows.length - 1;
          const pVal = rows[nextRow]?.pVal;
          if (typeof pVal === 'number' && isFinite(pVal)) {
            ctx.setSharedMemory((prev) => ({ ...prev, Ans: pVal }));
          }
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, resultListRow: nextRow },
          }));
        }
        return true;
      }

      if (key === 'DOWN' || key === '▼') {
        if (rows.length > 0) {
          const nextRow = curRow < rows.length - 1 ? curRow + 1 : 0;
          const pVal = rows[nextRow]?.pVal;
          if (typeof pVal === 'number' && isFinite(pVal)) {
            ctx.setSharedMemory((prev) => ({ ...prev, Ans: pVal }));
          }
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, resultListRow: nextRow },
          }));
        }
        return true;
      }

      return true;
    }

    return false;
  },

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;
    const data = (modeState.data || {}) as DistData;

    // --------------------------------------------------
    // 0. Math ERROR Screen
    // --------------------------------------------------
    if (modeState.screen === 'ERROR') {
      return React.createElement(
        'div',
        {
          'data-testid': 'dist-error',
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, getDistTitle(data.distType)),
          React.createElement('span', { className: 'text-[10px] font-normal text-[var(--display-muted)] tracking-wider' }, 'DIST')
        ),
        React.createElement(
          'div',
          { className: 'my-auto text-center space-y-1.5' },
          React.createElement(
            'div',
            { className: 'text-base font-bold text-[var(--ui-danger)] tracking-wide' },
            data.error || 'Math ERROR'
          ),
          React.createElement(
            'div',
            { className: 'text-[11px] text-[var(--display-muted)]' },
            'Check domain / parameters'
          )
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between',
          },
          React.createElement('span', null, '[AC] / [◄] / [►]: Return'),
          React.createElement('span', null, '[OPTN]: Options')
        )
      );
    }

    // --------------------------------------------------
    // 1. OPTN SUBMENU Screen
    // --------------------------------------------------
    if (modeState.screen === 'SUBMENU') {
      const curIdx = data.subMenuCursorIdx || 0;
      const items = DIST_SUBMENU_PAGES[0].items;
      return React.createElement(
        'div',
        {
          'data-testid': 'dist-submenu',
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, 'Distribution'),
          React.createElement('span', { className: 'text-[10px] font-normal text-[var(--display-muted)]' }, 'OPTN')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5 my-auto' },
          items.map((it, idx) => {
            const isSel = curIdx === idx;
            return React.createElement(
              'div',
              {
                key: it.id,
                className: `flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs border ${
                  isSel
                    ? 'bg-[var(--ui-accent-tonal)] border-[var(--ui-accent)] text-[var(--ui-accent)] font-semibold'
                    : 'bg-[var(--display-surface)] border-[var(--display-divider)] text-[var(--display-text)]'
                }`,
              },
              React.createElement(
                'span',
                {
                  className: `font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                    isSel
                      ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)]'
                      : 'border-[var(--display-divider)] bg-[var(--display-bg)] text-[var(--display-muted)]'
                  }`,
                },
                it.key
              ),
              React.createElement('span', null, it.name)
            );
          })
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between',
          },
          React.createElement('span', null, '[1]-[2] or [=]: Select'),
          React.createElement('span', null, '[AC]: Back')
        )
      );
    }

    // --------------------------------------------------
    // 2. SELECT_DIST Screen (2 Pages)
    // --------------------------------------------------
    if (modeState.screen === 'SELECT_DIST') {
      const curIdx = typeof data.menuCursorIdx === 'number' ? data.menuCursorIdx : 0;
      const curPage = DIST_MENU_ITEMS[curIdx]?.page ?? 0;
      const pageItems = DIST_MENU_ITEMS.filter((it) => it.page === curPage);

      return React.createElement(
        'div',
        {
          'data-testid': 'dist-select-menu',
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, 'Distribution'),
          React.createElement(
            'span',
            { className: 'text-[10px] font-normal text-[var(--display-muted)]' },
            `Page ${curPage + 1}/2`
          )
        ),
        React.createElement(
          'div',
          { className: 'space-y-1 my-auto' },
          pageItems.map((item) => {
            const globalIdx = DIST_MENU_ITEMS.indexOf(item);
            const isSelected = globalIdx === curIdx;
            return React.createElement(
              'div',
              {
                key: item.type,
                className: `flex items-center gap-2.5 px-2.5 py-1 rounded-xl border ${
                  isSelected
                    ? 'bg-[var(--ui-accent-tonal)] border-[var(--ui-accent)] text-[var(--ui-accent)] font-semibold'
                    : 'bg-[var(--display-surface)] border-[var(--display-divider)] text-[var(--display-text)]'
                }`,
              },
              React.createElement(
                'span',
                {
                  className: `font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                    isSelected
                      ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)]'
                      : 'border-[var(--display-divider)] bg-[var(--display-bg)] text-[var(--display-muted)]'
                  }`,
                },
                item.key
              ),
              React.createElement('span', { className: 'text-xs sm:text-sm' }, item.label)
            );
          })
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between',
          },
          React.createElement('span', null, curPage === 0 ? '[1]-[4]  [▼]: Page 2' : '[1]-[3]  [▲]: Page 1'),
          React.createElement('span', null, '[=]: OK')
        )
      );
    }

    // --------------------------------------------------
    // 3. SELECT_INPUT_MODE Screen (1: List, 2: Variable)
    // --------------------------------------------------
    if (modeState.screen === 'SELECT_INPUT_MODE') {
      const cur = data.inputModeCursor ?? 0;
      const options = [
        { num: '1', label: 'List', idx: 0 },
        { num: '2', label: 'Variable', idx: 1 },
      ];

      return React.createElement(
        'div',
        {
          'data-testid': 'dist-input-mode',
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, getDistTitle(data.distType)),
          React.createElement('span', { className: 'text-[10px] font-normal text-[var(--display-muted)]' }, 'Input Mode')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5 my-auto' },
          options.map((opt) => {
            const isSel = cur === opt.idx;
            return React.createElement(
              'div',
              {
                key: opt.num,
                className: `flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border ${
                  isSel
                    ? 'bg-[var(--ui-accent-tonal)] border-[var(--ui-accent)] text-[var(--ui-accent)] font-semibold'
                    : 'bg-[var(--display-surface)] border-[var(--display-divider)] text-[var(--display-text)]'
                }`,
              },
              React.createElement(
                'span',
                {
                  className: `font-bold px-2 py-0.5 rounded text-xs border ${
                    isSel
                      ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)]'
                      : 'border-[var(--display-divider)] bg-[var(--display-bg)] text-[var(--display-muted)]'
                  }`,
                },
                opt.num
              ),
              React.createElement('span', { className: 'text-sm' }, opt.label)
            );
          })
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between',
          },
          React.createElement('span', null, '[1]: List  [2]: Variable'),
          React.createElement('span', null, '[AC]: Back')
        )
      );
    }

    // --------------------------------------------------
    // 4. LIST_INPUT Screen (1-Column x List Editor)
    // --------------------------------------------------
    if (modeState.screen === 'LIST_INPUT') {
      const list = data.listItems || [];
      const curRow = Math.min(Math.max(0, data.currentListRow || 0), list.length);
      const buf = data.inputBuffer || '';

      const totalVisibleSlots = list.length + 1;
      const MAX_ROWS = 4;
      const startIdx = Math.max(0, Math.min(curRow - MAX_ROWS + 1, Math.max(0, totalVisibleSlots - MAX_ROWS)));
      const visibleIndices = Array.from(
        { length: Math.min(MAX_ROWS, totalVisibleSlots - startIdx) },
        (_, k) => startIdx + k
      );

      const activeDisplayVal =
        buf !== '' ? buf : curRow < list.length ? list[curRow].raw : '';

      return React.createElement(
        'div',
        {
          'data-testid': 'dist-list-table',
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, `${getDistTitle(data.distType)} (List)`),
          React.createElement('span', { className: 'text-[10px] font-normal text-[var(--display-muted)]' }, `n=${list.length}`)
        ),
        React.createElement(
          'div',
          { className: 'my-auto w-full border border-[var(--display-divider)] rounded-xl bg-[var(--display-surface)] overflow-hidden text-xs' },
          React.createElement(
            'div',
            {
              className:
                'grid grid-cols-[2.2rem_1fr] bg-[var(--display-bg)] border-b border-[var(--display-divider)] px-2 py-0.5 text-[10px] font-bold text-[var(--ui-accent)]',
            },
            React.createElement('span', null, '#'),
            React.createElement('span', { className: 'text-right' }, 'x')
          ),
          visibleIndices.map((idx) => {
            const isSel = idx === curRow;
            const entry = list[idx];
            const cellText =
              isSel && buf !== ''
                ? buf
                : entry
                ? entry.raw
                : isSel
                ? '_'
                : '';
            return React.createElement(
              'div',
              {
                key: idx,
                className: `grid grid-cols-[2.2rem_1fr] px-2 py-0.5 tabular-nums border-b border-[var(--display-divider)] last:border-b-0 ${
                  isSel
                    ? 'bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold'
                    : 'text-[var(--display-text)]'
                }`,
              },
              React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] self-center' }, String(idx + 1)),
              React.createElement('span', { className: 'text-right truncate' }, cellText)
            );
          })
        ),
        React.createElement(
          'div',
          { className: 'space-y-0.5' },
          React.createElement(
            'div',
            {
              className:
                'text-xs font-bold flex items-center justify-between px-2 py-0.5 rounded-lg bg-[var(--display-surface)] border border-[var(--display-divider)]',
            },
            React.createElement('span', { className: 'text-[var(--ui-accent)]' }, `x${curRow + 1} =`),
            React.createElement('span', { className: 'truncate max-w-[210px] tabular-nums' }, activeDisplayVal || ' ')
          ),
          React.createElement(
            'div',
            {
              className:
                'text-[10px] text-[var(--display-muted)] pt-0.5 border-t border-[var(--display-divider)] flex justify-between',
            },
            React.createElement('span', null, list.length > 0 && buf === '' && curRow === list.length ? '[=]: Next Params' : '[=]: Store x'),
            React.createElement('span', null, list.length > 0 ? '[►]: Params  [DEL]: Del' : '[OPTN]: Type')
          )
        )
      );
    }

    // --------------------------------------------------
    // 5. PARAM_INPUT Screen
    // --------------------------------------------------
    if (modeState.screen === 'PARAM_INPUT') {
      const fields = getDistParamsDef(data.distType, data.inputMode);
      const curIdx = Math.min(Math.max(0, data.activeFieldIdx || 0), fields.length);
      const params = data.params || createDefaultParams(data.distType, data.inputMode);
      const buf = data.inputBuffer || '';
      const isExecuteFocused = curIdx === fields.length;

      const activeFieldDef = !isExecuteFocused ? fields[curIdx] : null;
      const activePreviewText = activeFieldDef
        ? buf !== ''
          ? buf
          : params[activeFieldDef.key]?.raw || ''
        : 'Press [=] to Calculate';

      return React.createElement(
        'div',
        {
          'data-testid': 'dist-param-form',
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement(
            'span',
            null,
            data.inputMode === 'LIST' ? `${getDistTitle(data.distType)} (List)` : getDistTitle(data.distType)
          ),
          React.createElement('span', { className: 'text-[10px] font-normal text-[var(--display-muted)]' }, 'DIST')
        ),

        // Parameter rows
        React.createElement(
          'div',
          { className: 'my-auto space-y-0.5 w-full' },
          fields.map((f, idx) => {
            const isSel = idx === curIdx;
            const fieldState = params[f.key];
            const displayVal =
              isSel && buf !== ''
                ? buf
                : fieldState && fieldState.raw !== ''
                ? fieldState.raw
                : isSel
                ? '_'
                : '□';
            return React.createElement(
              'div',
              {
                key: f.key,
                'data-testid': `dist-param-${f.key}`,
                className: `flex items-center justify-between px-2.5 py-0.5 rounded-lg text-xs border ${
                  isSel
                    ? 'bg-[var(--ui-accent-tonal)] border-[var(--ui-accent)] text-[var(--ui-accent)] font-bold'
                    : 'bg-[var(--display-surface)] border-[var(--display-divider)] text-[var(--display-text)]'
                }`,
              },
              React.createElement('span', { className: 'font-math-serif' }, `${f.label} :`),
              React.createElement(
                'span',
                { className: 'tabular-nums truncate max-w-[190px] text-right' },
                displayVal
              )
            );
          }),
          // Execute row
          React.createElement(
            'div',
            {
              'data-testid': 'dist-param-execute',
              className: `flex items-center justify-between px-2.5 py-0.5 rounded-lg text-xs border ${
                isExecuteFocused
                  ? 'bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold border-[var(--ui-accent)]'
                  : 'bg-[var(--display-surface)] border-[var(--display-divider)] text-[var(--display-muted)]'
              }`,
            },
            React.createElement('span', null, 'Execute'),
            React.createElement('span', { className: 'text-[10px]' }, '[=]')
          )
        ),

        // Bottom active editor bar + instructions
        React.createElement(
          'div',
          { className: 'space-y-0.5' },
          React.createElement(
            'div',
            {
              className:
                'text-[11px] font-bold flex items-center justify-between px-2 py-0.5 rounded-lg bg-[var(--display-surface)] border border-[var(--display-divider)]',
            },
            React.createElement(
              'span',
              { className: 'text-[var(--ui-accent)] font-math-serif' },
              activeFieldDef ? `${activeFieldDef.label} =` : 'Execute'
            ),
            React.createElement('span', { className: 'truncate max-w-[200px] tabular-nums' }, activePreviewText || ' ')
          ),
          React.createElement(
            'div',
            {
              className:
                'text-[10px] text-[var(--display-muted)] pt-0.5 border-t border-[var(--display-divider)] flex justify-between',
            },
            React.createElement('span', null, '[▲▼]: Field  [=]: Next/Run'),
            React.createElement('span', null, '[OPTN]: Type')
          )
        )
      );
    }

    // --------------------------------------------------
    // 6. RESULT Screen (Variable Mode)
    // --------------------------------------------------
    if (modeState.screen === 'RESULT') {
      const val = typeof data.resultValue === 'number' ? data.resultValue : NaN;
      const formatted = formatDistNumber(val, ctx);
      const label = data.resultLabel || 'p';

      return React.createElement(
        'div',
        {
          'data-testid': 'dist-result',
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, getDistTitle(data.distType)),
          React.createElement('span', { className: 'text-[10px] font-normal text-[var(--display-muted)] tracking-wider' }, 'DIST')
        ),
        React.createElement(
          'div',
          { className: 'my-auto py-1 flex flex-col justify-center items-end space-y-1' },
          React.createElement(
            'div',
            { className: 'text-sm text-[var(--display-muted)] font-normal font-math-serif' },
            `${label} =`
          ),
          React.createElement(
            'div',
            {
              'data-testid': 'dist-result-value',
              className:
                'text-right text-3xl sm:text-4xl font-light tracking-tight tabular-nums text-[var(--display-text)] select-text break-all',
            },
            `${label} = ${formatted}`
          )
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between',
          },
          React.createElement('span', null, '[=] / [AC]: Edit Params'),
          React.createElement('span', null, '[OPTN]: Type')
        )
      );
    }

    // --------------------------------------------------
    // 7. LIST_RESULT Screen (x | P Table)
    // --------------------------------------------------
    if (modeState.screen === 'LIST_RESULT') {
      const rows = data.listResults || [];
      const curRow = Math.min(Math.max(0, data.resultListRow || 0), Math.max(0, rows.length - 1));
      const MAX_ROWS = 4;
      const startIdx = Math.max(0, Math.min(curRow - MAX_ROWS + 1, Math.max(0, rows.length - MAX_ROWS)));
      const visibleRows = rows.slice(startIdx, startIdx + MAX_ROWS);
      const selectedRow = rows[curRow];

      return React.createElement(
        'div',
        {
          'data-testid': 'dist-list-result',
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, `${getDistTitle(data.distType)} (List)`),
          React.createElement('span', { className: 'text-[10px] font-normal text-[var(--display-muted)]' }, `${curRow + 1}/${rows.length}`)
        ),
        React.createElement(
          'div',
          { className: 'my-auto w-full border border-[var(--display-divider)] rounded-xl bg-[var(--display-surface)] overflow-hidden text-xs' },
          React.createElement(
            'div',
            {
              className:
                'grid grid-cols-[1.8rem_1fr_1.6fr] bg-[var(--display-bg)] border-b border-[var(--display-divider)] px-2 py-0.5 text-[10px] font-bold text-[var(--ui-accent)]',
            },
            React.createElement('span', null, '#'),
            React.createElement('span', { className: 'text-right pr-2' }, 'x'),
            React.createElement('span', { className: 'text-right' }, 'P')
          ),
          visibleRows.map((row, k) => {
            const absIdx = startIdx + k;
            const isSel = absIdx === curRow;
            return React.createElement(
              'div',
              {
                key: absIdx,
                className: `grid grid-cols-[1.8rem_1fr_1.6fr] px-2 py-0.5 tabular-nums border-b border-[var(--display-divider)] last:border-b-0 ${
                  isSel
                    ? 'bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold'
                    : 'text-[var(--display-text)]'
                }`,
              },
              React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] self-center' }, String(absIdx + 1)),
              React.createElement('span', { className: 'text-right pr-2 truncate' }, row.xRaw),
              React.createElement('span', { className: 'text-right truncate' }, formatDistNumber(row.pVal, ctx))
            );
          })
        ),
        React.createElement(
          'div',
          { className: 'space-y-0.5' },
          selectedRow
            ? React.createElement(
                'div',
                {
                  className:
                    'text-[11px] font-bold flex items-center justify-between px-2 py-0.5 rounded-lg bg-[var(--display-surface)] border border-[var(--display-divider)] tabular-nums',
                },
                React.createElement('span', { className: 'text-[var(--ui-accent)]' }, `x=${selectedRow.xRaw}`),
                React.createElement('span', null, `P = ${formatDistNumber(selectedRow.pVal, ctx)}`)
              )
            : null,
          React.createElement(
            'div',
            {
              className:
                'text-[10px] text-[var(--display-muted)] pt-0.5 border-t border-[var(--display-divider)] flex justify-between',
            },
            React.createElement('span', null, '[▲▼]: Row  [=] / [AC]: Edit'),
            React.createElement('span', null, '[OPTN]: Type')
          )
        )
      );
    }

    return React.createElement('div', null);
  },
};
