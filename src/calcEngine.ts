/**
 * Casio fx-570 Scientific Calculator Engine
 * Handles expression parsing, natural display formatting, S<=>D conversion,
 * fractions, complex numbers, statistics, matrix, vector, and equations.
 */

export type AngleMode = 'DEG' | 'RAD' | 'GRA';
export type DisplayFormat = 'NORM1' | 'NORM2' | 'FIX' | 'SCI';

export interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  exactResult?: string;
  numericVal: number;
  timestamp: number;
}

export interface StatData {
  x: number[];
  y?: number[];
}

export interface MatrixData {
  rows: number;
  cols: number;
  data: number[][];
}

export interface VectorData {
  dim: 2 | 3;
  data: number[];
}

// Greatest Common Divisor
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b > 1e-9) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// Convert decimal number to rational fraction approximation (Continued Fraction Algorithm)
export function toFraction(val: number, tolerance = 1e-6): { num: number; den: number } | null {
  if (!isFinite(val) || isNaN(val)) return null;
  if (Math.abs(val) < 1e-12) return { num: 0, den: 1 };

  const sign = val < 0 ? -1 : 1;
  val = Math.abs(val);

  // If already an integer
  if (Math.abs(val - Math.round(val)) < tolerance) {
    return { num: sign * Math.round(val), den: 1 };
  }

  // Check common pi multiples
  const piRatio = val / Math.PI;
  if (Math.abs(piRatio - Math.round(piRatio)) < tolerance) {
    return { num: sign * Math.round(piRatio), den: 1 }; // Represents num * π
  }

  // Continued fraction representation
  let h1 = 1, h2 = 0;
  let k1 = 0, k2 = 1;
  let b = val;

  for (let i = 0; i < 15; i++) {
    const a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;

    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;

    if (k1 > 100000) break; // Avoid excessively large denominators
    const currentDiff = Math.abs(val - h1 / k1);
    if (currentDiff < tolerance || Math.abs(b - a) < 1e-12) {
      return { num: sign * h1, den: k1 };
    }
    b = 1 / (b - a);
  }

  if (k1 <= 10000) {
    return { num: sign * h1, den: k1 };
  }
  return null;
}

// Convert to exact radical or pi symbolic string if recognized (e.g. sin(60) = √3/2)
export function recognizeExactSurd(val: number, tolerance = 1e-5): string | null {
  if (!isFinite(val) || Math.abs(val) < 1e-9) return null;
  const sign = val < 0 ? '-' : '';
  const absVal = Math.abs(val);

  // Check multiples of π
  const piVal = absVal / Math.PI;
  const piFrac = toFraction(piVal, 1e-4);
  if (piFrac && piFrac.den <= 12 && piFrac.num <= 24) {
    if (piFrac.den === 1) {
      return (sign + (piFrac.num === 1 ? 'π' : `${piFrac.num}π`));
    }
    return `${sign}${piFrac.num === 1 ? 'π' : `${piFrac.num}π`}/${piFrac.den}`;
  }

  // Common square roots in trig: √2/2, √3/2, √3, √2, 1/√3
  const squared = absVal * absVal;
  const sqFrac = toFraction(squared, 1e-4);
  if (sqFrac && sqFrac.den <= 16 && sqFrac.num <= 36) {
    // If num is a square and den is a square, it's just a fraction
    const sqrtNum = Math.sqrt(sqFrac.num);
    const sqrtDen = Math.sqrt(sqFrac.den);
    const isNumSquare = Math.abs(sqrtNum - Math.round(sqrtNum)) < 1e-6;
    const isDenSquare = Math.abs(sqrtDen - Math.round(sqrtDen)) < 1e-6;

    if (!isNumSquare && isDenSquare) {
      const denInt = Math.round(sqrtDen);
      if (denInt === 1) {
        return `${sign}√${sqFrac.num}`;
      }
      return `${sign}√${sqFrac.num}/${denInt}`;
    }
  }

  return null;
}

// Engineering notation (powers of 3)
export function toEngineering(val: number): string {
  if (!isFinite(val) || val === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(val)));
  const engExp = Math.floor(exp / 3) * 3;
  const mantissa = val / Math.pow(10, engExp);
  const roundedMantissa = Math.round(mantissa * 1e8) / 1e8;
  if (engExp === 0) return `${roundedMantissa}`;
  return `${roundedMantissa}×10^(${engExp})`;
}

// Format numbers according to fx-570 standard
export function formatResult(val: number, format: DisplayFormat = 'NORM1', fixDigits = 2, sciDigits = 5): string {
  if (isNaN(val)) return 'Math ERROR';
  if (!isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';

  if (Math.abs(val) < 1e-14) return '0';

  if (format === 'FIX') {
    return val.toFixed(Math.max(0, Math.min(9, fixDigits)));
  }

  if (format === 'SCI') {
    const s = val.toExponential(Math.max(1, Math.min(9, sciDigits)));
    const [m, e] = s.split('e');
    const expNum = parseInt(e, 10);
    return `${m}×10^(${expNum})`;
  }

  // NORM 1: Exponential for |val| < 1e-2 or |val| >= 1e10
  // NORM 2: Exponential for |val| < 1e-9 or |val| >= 1e10
  const threshold = format === 'NORM2' ? 1e-9 : 1e-2;
  const abs = Math.abs(val);

  if (abs >= 1e10 || (abs > 0 && abs < threshold)) {
    const s = val.toExponential(6);
    const [m, e] = s.split('e');
    const expNum = parseInt(e, 10);
    const cleanM = parseFloat(m).toString();
    return `${cleanM}×10^(${expNum})`;
  }

  // Clean decimal, max 10 digits
  const str = parseFloat(val.toPrecision(10)).toString();
  return str;
}

// Factorial calculation
export function factorial(n: number): number {
  if (n < 0 || Math.floor(n) !== n || n > 170) return NaN;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

// Permutations nPr
export function nPr(n: number, r: number): number {
  if (n < 0 || r < 0 || r > n || Math.floor(n) !== n || Math.floor(r) !== r) return NaN;
  return factorial(n) / factorial(n - r);
}

// Combinations nCr
export function nCr(n: number, r: number): number {
  if (n < 0 || r < 0 || r > n || Math.floor(n) !== n || Math.floor(r) !== r) return NaN;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

// Prime Factorization (Fact)
export function primeFactorization(n: number): string {
  n = Math.round(Math.abs(n));
  if (n <= 1) return `${n}`;
  if (n > 1e10) return `${n}`;

  const factors: { [p: number]: number } = {};
  let d = 2;
  while (d * d <= n) {
    while (n % d === 0) {
      factors[d] = (factors[d] || 0) + 1;
      n = Math.floor(n / d);
    }
    d += d === 2 ? 1 : 2;
  }
  if (n > 1) {
    factors[n] = (factors[n] || 0) + 1;
  }

  const parts = Object.keys(factors)
    .map(Number)
    .sort((a, b) => a - b)
    .map(p => (factors[p] === 1 ? `${p}` : `${p}^${factors[p]}`));
  return parts.join(' × ');
}

// Degrees to radians / radians to degrees conversion helpers
export function toRad(deg: number, mode: AngleMode): number {
  if (mode === 'DEG') return (deg * Math.PI) / 180;
  if (mode === 'GRA') return (deg * Math.PI) / 200;
  return deg; // already RAD
}

export function fromRad(rad: number, mode: AngleMode): number {
  if (mode === 'DEG') return (rad * 180) / Math.PI;
  if (mode === 'GRA') return (rad * 200) / Math.PI;
  return rad;
}

// Trigonometric with angle mode awareness
export function trigSin(x: number, mode: AngleMode): number {
  const rad = toRad(x, mode);
  // Accurate handling for exact zeros e.g. sin(180 deg) = 0
  if (mode === 'DEG' && Math.abs(x % 180) < 1e-10) return 0;
  return Math.sin(rad);
}

export function trigCos(x: number, mode: AngleMode): number {
  const rad = toRad(x, mode);
  if (mode === 'DEG' && Math.abs((x - 90) % 180) < 1e-10) return 0;
  return Math.cos(rad);
}

export function trigTan(x: number, mode: AngleMode): number {
  const rad = toRad(x, mode);
  if (mode === 'DEG' && Math.abs((x - 90) % 180) < 1e-10) return NaN; // undefined
  if (mode === 'DEG' && Math.abs(x % 180) < 1e-10) return 0;
  return Math.tan(rad);
}

export function trigAsin(x: number, mode: AngleMode): number {
  if (x < -1 || x > 1) return NaN;
  const rad = Math.asin(x);
  return fromRad(rad, mode);
}

export function trigAcos(x: number, mode: AngleMode): number {
  if (x < -1 || x > 1) return NaN;
  const rad = Math.acos(x);
  return fromRad(rad, mode);
}

export function trigAtan(x: number, mode: AngleMode): number {
  const rad = Math.atan(x);
  return fromRad(rad, mode);
}

// Parse Degree-Minute-Second string into decimal degrees
export function dmsToDecimal(d: number, m = 0, s = 0): number {
  return d + m / 60 + s / 3600;
}

// Decimal degrees to DMS string
export function decimalToDms(val: number): string {
  const sign = val < 0 ? '-' : '';
  val = Math.abs(val);
  const d = Math.floor(val);
  const remM = (val - d) * 60;
  const m = Math.floor(remM);
  const s = Math.round((remM - m) * 60 * 100) / 100;
  return `${sign}${d}° ${m}' ${s}"`;
}

// Physical Constants list (fx-570 standard library)
export const SCIENTIFIC_CONSTANTS = [
  { code: '01', sym: 'mp', name: 'Proton mass', val: 1.67262192369e-27, unit: 'kg' },
  { code: '02', sym: 'mn', name: 'Neutron mass', val: 1.67492749804e-27, unit: 'kg' },
  { code: '03', sym: 'me', name: 'Electron mass', val: 9.1093837015e-31, unit: 'kg' },
  { code: '04', sym: 'mu', name: 'Muon mass', val: 1.883531627e-28, unit: 'kg' },
  { code: '06', sym: 'h', name: 'Planck constant', val: 6.62607015e-34, unit: 'J·s' },
  { code: '07', sym: 'ħ', name: 'Reduced Planck', val: 1.054571817e-34, unit: 'J·s' },
  { code: '17', sym: 'u', name: 'Atomic mass const', val: 1.6605390666e-27, unit: 'kg' },
  { code: '23', sym: 'e', name: 'Elementary charge', val: 1.602176634e-19, unit: 'C' },
  { code: '28', sym: 'c', name: 'Speed of light', val: 299792458, unit: 'm/s' },
  { code: '33', sym: 'G', name: 'Gravitational const', val: 6.6743e-11, unit: 'm³/(kg·s²)' },
  { code: '35', sym: 'g', name: 'Standard gravity', val: 9.80665, unit: 'm/s²' },
  { code: '39', sym: 'G0', name: 'Conductance quantum', val: 7.748091729e-5, unit: 'S' },
  { code: '24', sym: 'NA', name: 'Avogadro constant', val: 6.02214076e23, unit: 'mol⁻¹' },
  { code: '25', sym: 'k', name: 'Boltzmann constant', val: 1.380649e-23, unit: 'J/K' },
  { code: '26', sym: 'Vm', name: 'Molar volume gas', val: 0.02271095464, unit: 'm³/mol' },
  { code: '27', sym: 'R', name: 'Molar gas constant', val: 8.314462618, unit: 'J/(mol·K)' },
  { code: '31', sym: 'ε0', name: 'Vacuum permittivity', val: 8.8541878128e-12, unit: 'F/m' },
  { code: '32', sym: 'μ0', name: 'Vacuum permeability', val: 1.25663706212e-6, unit: 'N/A²' },
  { code: '40', sym: 'atm', name: 'Standard atmosphere', val: 101325, unit: 'Pa' },
];

// Unit conversions list (fx-570 standard library)
export const METRIC_CONVERSIONS = [
  { code: '01', name: 'in ➔ cm', fn: (v: number) => v * 2.54 },
  { code: '02', name: 'cm ➔ in', fn: (v: number) => v / 2.54 },
  { code: '03', name: 'ft ➔ m', fn: (v: number) => v * 0.3048 },
  { code: '04', name: 'm ➔ ft', fn: (v: number) => v / 0.3048 },
  { code: '05', name: 'yd ➔ m', fn: (v: number) => v * 0.9144 },
  { code: '06', name: 'm ➔ yd', fn: (v: number) => v / 0.9144 },
  { code: '07', name: 'mile ➔ km', fn: (v: number) => v * 1.609344 },
  { code: '08', name: 'km ➔ mile', fn: (v: number) => v / 1.609344 },
  { code: '17', name: 'pc ➔ km', fn: (v: number) => v * 3.085677581e13 },
  { code: '19', name: 'km/h ➔ m/s', fn: (v: number) => v / 3.6 },
  { code: '20', name: 'm/s ➔ km/h', fn: (v: number) => v * 3.6 },
  { code: '23', name: 'lb ➔ kg', fn: (v: number) => v * 0.45359237 },
  { code: '24', name: 'kg ➔ lb', fn: (v: number) => v / 0.45359237 },
  { code: '25', name: 'oz ➔ g', fn: (v: number) => v * 28.349523125 },
  { code: '26', name: 'g ➔ oz', fn: (v: number) => v / 28.349523125 },
  { code: '33', name: 'atm ➔ Pa', fn: (v: number) => v * 101325 },
  { code: '34', name: 'Pa ➔ atm', fn: (v: number) => v / 101325 },
  { code: '35', name: 'bar ➔ Pa', fn: (v: number) => v * 100000 },
  { code: '37', name: '°F ➔ °C', fn: (v: number) => ((v - 32) * 5) / 9 },
  { code: '38', name: '°C ➔ °F', fn: (v: number) => (v * 9) / 5 + 32 },
  { code: '39', name: 'J ➔ cal', fn: (v: number) => v / 4.184 },
  { code: '40', name: 'cal ➔ J', fn: (v: number) => v * 4.184 },
];

// Helper to evaluate a mathematical sub-expression for a given value of variable x
export function evaluateSubExprForX(subExpr: string, xVal: number, angleMode: AngleMode = 'DEG'): number {
  const res = evaluateMathExpression(subExpr, angleMode, { x: xVal, X: xVal });
  return res.success && typeof res.result === 'number' ? res.result : NaN;
}

// Numerical Definite Integration using Simpson's 1/3 Rule
export function computeDefiniteIntegral(
  fExpr: string,
  a: number,
  b: number,
  angleMode: AngleMode = 'DEG',
  intervals = 200
): number {
  if (a === b) return 0;
  let sign = 1;
  if (b < a) {
    const tmp = a;
    a = b;
    b = tmp;
    sign = -1;
  }

  // Ensure intervals is even
  const n = intervals % 2 === 0 ? intervals : intervals + 1;
  const h = (b - a) / n;

  let sum = evaluateSubExprForX(fExpr, a, angleMode) + evaluateSubExprForX(fExpr, b, angleMode);
  if (isNaN(sum)) return NaN;

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    const y = evaluateSubExprForX(fExpr, x, angleMode);
    if (isNaN(y)) return NaN;
    sum += (i % 2 === 1 ? 4 : 2) * y;
  }

  return sign * (h / 3) * sum;
}

// Total Geometric Area under curve: ∫ |f(x)| dx from a to b
export function computeGeometricArea(
  fExpr: string,
  a: number,
  b: number,
  angleMode: AngleMode = 'DEG',
  intervals = 240
): number {
  if (a === b) return 0;
  const minX = Math.min(a, b);
  const maxX = Math.max(a, b);

  const n = intervals % 2 === 0 ? intervals : intervals + 1;
  const h = (maxX - minX) / n;

  const yA = Math.abs(evaluateSubExprForX(fExpr, minX, angleMode));
  const yB = Math.abs(evaluateSubExprForX(fExpr, maxX, angleMode));
  if (isNaN(yA) || isNaN(yB)) return NaN;

  let sum = yA + yB;
  for (let i = 1; i < n; i++) {
    const x = minX + i * h;
    const y = Math.abs(evaluateSubExprForX(fExpr, x, angleMode));
    if (isNaN(y)) return NaN;
    sum += (i % 2 === 1 ? 4 : 2) * y;
  }

  return (h / 3) * sum;
}

// Bounded Area between two curves: ∫ |f1(x) - f2(x)| dx from a to b
export function computeAreaBetweenCurves(
  f1Expr: string,
  f2Expr: string,
  a: number,
  b: number,
  angleMode: AngleMode = 'DEG',
  intervals = 240
): number {
  if (a === b) return 0;
  const minX = Math.min(a, b);
  const maxX = Math.max(a, b);

  const n = intervals % 2 === 0 ? intervals : intervals + 1;
  const h = (maxX - minX) / n;

  const yA = Math.abs(
    evaluateSubExprForX(f1Expr, minX, angleMode) - evaluateSubExprForX(f2Expr, minX, angleMode)
  );
  const yB = Math.abs(
    evaluateSubExprForX(f1Expr, maxX, angleMode) - evaluateSubExprForX(f2Expr, maxX, angleMode)
  );
  if (isNaN(yA) || isNaN(yB)) return NaN;

  let sum = yA + yB;
  for (let i = 1; i < n; i++) {
    const x = minX + i * h;
    const diff = Math.abs(
      evaluateSubExprForX(f1Expr, x, angleMode) - evaluateSubExprForX(f2Expr, x, angleMode)
    );
    if (isNaN(diff)) return NaN;
    sum += (i % 2 === 1 ? 4 : 2) * diff;
  }

  return (h / 3) * sum;
}

export interface CurvePoint {
  x: number;
  y: number;
  y2?: number;
}

// Samples points along the curve for visual area graph plotting
export function sampleFunctionCurve(
  fExpr: string,
  f2Expr: string | null,
  xMin: number,
  xMax: number,
  points = 120,
  angleMode: AngleMode = 'DEG'
): CurvePoint[] {
  const res: CurvePoint[] = [];
  const step = (xMax - xMin) / points;
  for (let i = 0; i <= points; i++) {
    const x = xMin + i * step;
    const yVal = evaluateSubExprForX(fExpr, x, angleMode);
    const pt: CurvePoint = { x, y: isNaN(yVal) ? 0 : yVal };
    if (f2Expr && f2Expr.trim() !== '') {
      const y2Val = evaluateSubExprForX(f2Expr, x, angleMode);
      pt.y2 = isNaN(y2Val) ? 0 : y2Val;
    }
    res.push(pt);
  }
  return res;
}

// Numerical Derivative at a point using 4-point central difference
export function computeDerivative(
  fExpr: string,
  x0: number,
  angleMode: AngleMode = 'DEG',
  h = 1e-5
): number {
  const f_plus_2h = evaluateSubExprForX(fExpr, x0 + 2 * h, angleMode);
  const f_plus_h = evaluateSubExprForX(fExpr, x0 + h, angleMode);
  const f_minus_h = evaluateSubExprForX(fExpr, x0 - h, angleMode);
  const f_minus_2h = evaluateSubExprForX(fExpr, x0 - 2 * h, angleMode);

  if (isNaN(f_plus_h) || isNaN(f_minus_h)) return NaN;

  // Fourth-order central difference
  const diff = (-f_plus_2h + 8 * f_plus_h - 8 * f_minus_h + f_minus_2h) / (12 * h);
  return diff;
}

// Numerical Summation: Σ(f(x), a, b)
export function computeSummation(
  fExpr: string,
  a: number,
  b: number,
  angleMode: AngleMode = 'DEG'
): number {
  const start = Math.round(a);
  const end = Math.round(b);
  if (end < start) return 0;
  if (end - start > 50000) return NaN; // Prevent infinite loops

  let sum = 0;
  for (let i = start; i <= end; i++) {
    const val = evaluateSubExprForX(fExpr, i, angleMode);
    if (isNaN(val)) return NaN;
    sum += val;
  }
  return sum;
}

// Numerical Root Solver: Newton-Raphson f(x) = 0
export function solveEquation(
  expr: string,
  angleMode: AngleMode = 'DEG',
  initialX = 1
): { success: boolean; root?: number; error?: string } {
  let x = initialX;
  const maxIter = 100;
  const tol = 1e-9;

  for (let i = 0; i < maxIter; i++) {
    const fx = evaluateSubExprForX(expr, x, angleMode);
    if (isNaN(fx)) break;
    if (Math.abs(fx) < tol) {
      return { success: true, root: parseFloat(x.toFixed(8)) };
    }
    const dfx = computeDerivative(expr, x, angleMode);
    if (isNaN(dfx) || Math.abs(dfx) < 1e-12) {
      // Perturb slightly if stuck at zero derivative
      x += 0.01;
      continue;
    }
    const nextX = x - fx / dfx;
    if (Math.abs(nextX - x) < tol) {
      return { success: true, root: parseFloat(nextX.toFixed(8)) };
    }
    x = nextX;
  }

  // Fallback to bisection around initial guess
  let a = initialX - 10;
  let b = initialX + 10;
  let fa = evaluateSubExprForX(expr, a, angleMode);
  let fb = evaluateSubExprForX(expr, b, angleMode);

  if (fa * fb < 0) {
    for (let i = 0; i < 60; i++) {
      const mid = (a + b) / 2;
      const fmid = evaluateSubExprForX(expr, mid, angleMode);
      if (Math.abs(fmid) < tol || (b - a) / 2 < tol) {
        return { success: true, root: parseFloat(mid.toFixed(8)) };
      }
      if (fa * fmid < 0) {
        b = mid;
        fb = fmid;
      } else {
        a = mid;
        fa = fmid;
      }
    }
  }

  return { success: false, error: "Can't Solve" };
}

/**
 * Expression Evaluator with custom token replacement
 */
export function evaluateMathExpression(
  expr: string,
  angleMode: AngleMode = 'DEG',
  variables: Record<string, number> = {},
  ans = 0
): { success: boolean; result?: number; error?: string } {
  if (!expr || expr.trim() === '') {
    return { success: true, result: 0 };
  }

  try {
    let clean = expr;

    // Substitute Ans
    clean = clean.replace(/Ans/g, `(${ans})`);

    // Handle Definite Integral syntax: ∫(f(x), a, b) or ∫(f(x),a,b)
    const integralRegex = /∫\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/g;
    let intMatch: RegExpExecArray | null;
    while ((intMatch = integralRegex.exec(clean)) !== null) {
      const fExpr = intMatch[1].trim();
      const aValRes = evaluateMathExpression(intMatch[2], angleMode, variables, ans);
      const bValRes = evaluateMathExpression(intMatch[3], angleMode, variables, ans);
      if (aValRes.success && bValRes.success && aValRes.result !== undefined && bValRes.result !== undefined) {
        const intVal = computeDefiniteIntegral(fExpr, aValRes.result, bValRes.result, angleMode);
        clean = clean.replace(intMatch[0], `(${intVal})`);
      } else {
        return { success: false, error: 'Math ERROR' };
      }
    }

    // Handle Area between two curves: Area(f1(x), f2(x), a, b)
    const areaBetweenRegex = /Area\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
    let areaBtwMatch: RegExpExecArray | null;
    while ((areaBtwMatch = areaBetweenRegex.exec(clean)) !== null) {
      const f1Expr = areaBtwMatch[1].trim();
      const f2Expr = areaBtwMatch[2].trim();
      const aValRes = evaluateMathExpression(areaBtwMatch[3], angleMode, variables, ans);
      const bValRes = evaluateMathExpression(areaBtwMatch[4], angleMode, variables, ans);
      if (aValRes.success && bValRes.success && aValRes.result !== undefined && bValRes.result !== undefined) {
        const areaVal = computeAreaBetweenCurves(f1Expr, f2Expr, aValRes.result, bValRes.result, angleMode);
        clean = clean.replace(areaBtwMatch[0], `(${areaVal})`);
      } else {
        return { success: false, error: 'Math ERROR' };
      }
    }

    // Handle Geometric Area under single curve: Area(f(x), a, b)
    const areaRegex = /Area\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
    let areaMatch: RegExpExecArray | null;
    while ((areaMatch = areaRegex.exec(clean)) !== null) {
      const fExpr = areaMatch[1].trim();
      const aValRes = evaluateMathExpression(areaMatch[2], angleMode, variables, ans);
      const bValRes = evaluateMathExpression(areaMatch[3], angleMode, variables, ans);
      if (aValRes.success && bValRes.success && aValRes.result !== undefined && bValRes.result !== undefined) {
        const areaVal = computeGeometricArea(fExpr, aValRes.result, bValRes.result, angleMode);
        clean = clean.replace(areaMatch[0], `(${areaVal})`);
      } else {
        return { success: false, error: 'Math ERROR' };
      }
    }

    // Handle Numerical Derivative syntax: d/dx(f(x), x0) or d/dx(f(x),x0)
    const diffRegex = /d\/dx\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g;
    let diffMatch: RegExpExecArray | null;
    while ((diffMatch = diffRegex.exec(clean)) !== null) {
      const fExpr = diffMatch[1].trim();
      const x0Res = evaluateMathExpression(diffMatch[2], angleMode, variables, ans);
      if (x0Res.success && x0Res.result !== undefined) {
        const diffVal = computeDerivative(fExpr, x0Res.result, angleMode);
        clean = clean.replace(diffMatch[0], `(${diffVal})`);
      } else {
        return { success: false, error: 'Math ERROR' };
      }
    }

    // Handle Summation syntax: Σ(f(x), a, b)
    const sumRegex = /Σ\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/g;
    let sumMatch: RegExpExecArray | null;
    while ((sumMatch = sumRegex.exec(clean)) !== null) {
      const fExpr = sumMatch[1].trim();
      const aRes = evaluateMathExpression(sumMatch[2], angleMode, variables, ans);
      const bRes = evaluateMathExpression(sumMatch[3], angleMode, variables, ans);
      if (aRes.success && bRes.success && aRes.result !== undefined && bRes.result !== undefined) {
        const sumVal = computeSummation(fExpr, aRes.result, bRes.result, angleMode);
        clean = clean.replace(sumMatch[0], `(${sumVal})`);
      } else {
        return { success: false, error: 'Math ERROR' };
      }
    }

    // Custom Base Logarithm: log_(b)(x) or log(b, x)
    clean = clean.replace(/log_\s*\(([^)]+)\)\s*\(([^)]+)\)/g, '(Math.log($2)/Math.log($1))');
    clean = clean.replace(/log\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, '(Math.log($2)/Math.log($1))');

    // Absolute value: Abs(x)
    clean = clean.replace(/Abs\(/gi, 'Math.abs(');

    // Substitute Variables A, B, C, D, E, F, X, Y, M if present as standalone tokens
    for (const [varName, varVal] of Object.entries(variables)) {
      const reg = new RegExp(`\\b${varName}\\b`, 'g');
      clean = clean.replace(reg, `(${varVal})`);
    }

    // Default standalone variable x/X to 0 if not provided
    if (!('x' in variables) && !('X' in variables)) {
      clean = clean.replace(/\bx\b/g, '(0)');
      clean = clean.replace(/\bX\b/g, '(0)');
    }

    // Substitute Constants
    clean = clean.replace(/π/g, `(${Math.PI})`);
    clean = clean.replace(/e\b/g, `(${Math.E})`);

    // Replace Scientific notation 10^x and ×10^(x) or ×10^x
    clean = clean.replace(/×10\^(\(-?\d+\)|\d+)/g, '*1e$1');
    clean = clean.replace(/×10\^/g, '*10^');
    clean = clean.replace(/×/g, '*');
    clean = clean.replace(/÷/g, '/');

    // Replace superscripts
    clean = clean.replace(/²/g, '^2');
    clean = clean.replace(/³/g, '^3');
    clean = clean.replace(/⁻¹/g, '^(-1)');

    // Percentage: a% = a / 100
    clean = clean.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // Preprocessing functions:
    // Pol(x, y) = √(x² + y²), Rec(r, θ) = r * cos(θ)
    // Permutations & Combinations: nPr, nCr
    clean = clean.replace(/(\d+(?:\.\d+)?)\s*P\s*(\d+(?:\.\d+)?)/g, 'nPr($1,$2)');
    clean = clean.replace(/(\d+(?:\.\d+)?)\s*C\s*(\d+(?:\.\d+)?)/g, 'nCr($1,$2)');

    // Factorial postfix: n! -> fact(n)
    clean = clean.replace(/(\d+(?:\.\d+)?|\([^)]+\))!/g, 'fact($1)');

    // Handle implicit multiplication:
    // e.g. 2(3), (2)(3), 2sin(30), 2π, 2√4, 2x
    clean = clean.replace(/(\d)(\()/g, '$1*$2');
    clean = clean.replace(/(\))(\d)/g, '$1*$2');
    clean = clean.replace(/(\))(\()/g, '$1*$2');
    clean = clean.replace(/(\d)(sin|cos|tan|ln|log|√|³√|Math\.abs)/g, '$1*$2');
    clean = clean.replace(/(\))(sin|cos|tan|ln|log|√|³√|Math\.abs)/g, '$1*$2');
    clean = clean.replace(/(\d)([a-zA-Z])/g, '$1*$2');

    // Roots
    clean = clean.replace(/³√\(/g, 'cbrt(');
    clean = clean.replace(/³√(\d+(?:\.\d+)?)/g, 'cbrt($1)');
    clean = clean.replace(/√\(/g, 'sqrt(');
    clean = clean.replace(/√(\d+(?:\.\d+)?)/g, 'sqrt($1)');

    // Standard Logarithms (single argument log(x))
    clean = clean.replace(/ln\(/g, 'Math.log(');
    clean = clean.replace(/log\(/g, 'Math.log10(');

    // Hyperbolic
    clean = clean.replace(/sinh\(/g, 'Math.sinh(');
    clean = clean.replace(/cosh\(/g, 'Math.cosh(');
    clean = clean.replace(/tanh\(/g, 'Math.tanh(');

    // Inverse trig
    clean = clean.replace(/sin⁻¹\(/g, `asin_${angleMode}(`);
    clean = clean.replace(/cos⁻¹\(/g, `acos_${angleMode}(`);
    clean = clean.replace(/tan⁻¹\(/g, `atan_${angleMode}(`);

    // Standard trig
    clean = clean.replace(/sin\(/g, `sin_${angleMode}(`);
    clean = clean.replace(/cos\(/g, `cos_${angleMode}(`);
    clean = clean.replace(/tan\(/g, `tan_${angleMode}(`);

    // Powers ^ to **
    clean = clean.replace(/\^/g, '**');

    // Context execution environment
    const context = {
      Math,
      sin_DEG: (x: number) => trigSin(x, 'DEG'),
      cos_DEG: (x: number) => trigCos(x, 'DEG'),
      tan_DEG: (x: number) => trigTan(x, 'DEG'),
      asin_DEG: (x: number) => trigAsin(x, 'DEG'),
      acos_DEG: (x: number) => trigAcos(x, 'DEG'),
      atan_DEG: (x: number) => trigAtan(x, 'DEG'),

      sin_RAD: (x: number) => trigSin(x, 'RAD'),
      cos_RAD: (x: number) => trigCos(x, 'RAD'),
      tan_RAD: (x: number) => trigTan(x, 'RAD'),
      asin_RAD: (x: number) => trigAsin(x, 'RAD'),
      acos_RAD: (x: number) => trigAcos(x, 'RAD'),
      atan_RAD: (x: number) => trigAtan(x, 'RAD'),

      sin_GRA: (x: number) => trigSin(x, 'GRA'),
      cos_GRA: (x: number) => trigCos(x, 'GRA'),
      tan_GRA: (x: number) => trigTan(x, 'GRA'),
      asin_GRA: (x: number) => trigAsin(x, 'GRA'),
      acos_GRA: (x: number) => trigAcos(x, 'GRA'),
      atan_GRA: (x: number) => trigAtan(x, 'GRA'),

      sqrt: (x: number) => Math.sqrt(x),
      cbrt: (x: number) => Math.cbrt(x),
      abs: (x: number) => Math.abs(x),
      fact: (x: number) => factorial(x),
      nPr: (n: number, r: number) => nPr(n, r),
      nCr: (n: number, r: number) => nCr(n, r),
    };

    // Auto-balance closing parentheses
    const openParens = (clean.match(/\(/g) || []).length;
    const closeParens = (clean.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      clean += ')'.repeat(openParens - closeParens);
    }

    // Evaluate in safe function closure
    const fn = new Function(...Object.keys(context), `"use strict"; return (${clean});`);
    const val = fn(...Object.values(context));

    if (typeof val !== 'number') {
      return { success: false, error: 'Syntax ERROR' };
    }
    if (isNaN(val)) {
      return { success: false, error: 'Math ERROR' };
    }

    return { success: true, result: val };
  } catch (err) {
    return { success: false, error: 'Syntax ERROR' };
  }
}

// Statistics calculations
export function calculateStatistics(x: number[], y?: number[]) {
  const n = x.length;
  if (n === 0) return null;

  const sumX = x.reduce((a, b) => a + b, 0);
  const meanX = sumX / n;
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const varPopX = (sumX2 - (sumX * sumX) / n) / n;
  const sigmaX = Math.sqrt(Math.max(0, varPopX));
  const sX = n > 1 ? Math.sqrt(Math.max(0, (sumX2 - (sumX * sumX) / n) / (n - 1))) : 0;

  const sortedX = [...x].sort((a, b) => a - b);
  const minX = sortedX[0];
  const maxX = sortedX[n - 1];
  const medianX = n % 2 === 1 ? sortedX[Math.floor(n / 2)] : (sortedX[n / 2 - 1] + sortedX[n / 2]) / 2;

  let regression = null;
  if (y && y.length === n && n > 1) {
    const sumY = y.reduce((a, b) => a + b, 0);
    const meanY = sumY / n;
    const sumY2 = y.reduce((a, b) => a + b * b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);

    const sxx = sumX2 - (sumX * sumX) / n;
    const syy = sumY2 - (sumY * sumY) / n;
    const sxy = sumXY - (sumX * sumY) / n;

    const b = sxx !== 0 ? sxy / sxx : 0; // slope
    const a = meanY - b * meanX; // intercept
    const r = Math.sqrt(sxx * syy) !== 0 ? sxy / Math.sqrt(sxx * syy) : 0; // correlation

    regression = {
      a,
      b,
      r,
      r2: r * r,
      sumY,
      sumY2,
      sumXY,
    };
  }

  return {
    n,
    sumX,
    sumX2,
    meanX,
    sigmaX,
    sX,
    minX,
    maxX,
    medianX,
    regression,
  };
}

// Matrix Operations
export function matrixDet(m: number[][]): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (n === 3) {
    return (
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
  }
  return 0;
}

export function matrixInverse(m: number[][]): number[][] | null {
  const d = matrixDet(m);
  if (Math.abs(d) < 1e-12) return null; // singular

  const n = m.length;
  if (n === 2) {
    return [
      [m[1][1] / d, -m[0][1] / d],
      [-m[1][0] / d, m[0][0] / d],
    ];
  }
  if (n === 3) {
    const inv: number[][] = [
      [
        (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / d,
        -(m[0][1] * m[2][2] - m[0][2] * m[2][1]) / d,
        (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / d,
      ],
      [
        -(m[1][0] * m[2][2] - m[1][2] * m[2][0]) / d,
        (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / d,
        -(m[0][0] * m[1][2] - m[0][2] * m[1][0]) / d,
      ],
      [
        (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / d,
        -(m[0][0] * m[2][1] - m[0][1] * m[2][0]) / d,
        (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / d,
      ],
    ];
    return inv;
  }
  return null;
}

export function matrixTranspose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const res: number[][] = [];
  for (let c = 0; c < cols; c++) {
    res[c] = [];
    for (let r = 0; r < rows; r++) {
      res[c][r] = m[r][c];
    }
  }
  return res;
}

export function matrixMultiply(a: number[][], b: number[][]): number[][] | null {
  const rA = a.length;
  const cA = a[0].length;
  const rB = b.length;
  const cB = b[0].length;
  if (cA !== rB) return null;

  const res: number[][] = [];
  for (let r = 0; r < rA; r++) {
    res[r] = [];
    for (let c = 0; c < cB; c++) {
      let sum = 0;
      for (let k = 0; k < cA; k++) {
        sum += a[r][k] * b[k][c];
      }
      res[r][c] = sum;
    }
  }
  return res;
}

// Vector Operations
export function vectorDot(u: number[], v: number[]): number {
  return u.reduce((acc, ui, i) => acc + ui * (v[i] || 0), 0);
}

export function vectorMag(u: number[]): number {
  return Math.sqrt(u.reduce((acc, ui) => acc + ui * ui, 0));
}

export function vectorCross(u: number[], v: number[]): number[] {
  const u3 = [u[0] || 0, u[1] || 0, u[2] || 0];
  const v3 = [v[0] || 0, v[1] || 0, v[2] || 0];
  return [
    u3[1] * v3[2] - u3[2] * v3[1],
    u3[2] * v3[0] - u3[0] * v3[2],
    u3[0] * v3[1] - u3[1] * v3[0],
  ];
}

// Equation Solver: Quadratic ax² + bx + c = 0
export function solveQuadratic(a: number, b: number, c: number): { x1: string; x2: string; minMax?: string } {
  if (a === 0) {
    if (b === 0) return { x1: 'No Solution', x2: 'No Solution' };
    const root = -c / b;
    return { x1: `${root}`, x2: `${root}` };
  }

  const disc = b * b - 4 * a * c;
  const vertexX = -b / (2 * a);
  const vertexY = c - (b * b) / (4 * a);
  const minMaxType = a > 0 ? 'Minimum' : 'Maximum';
  const minMax = `${minMaxType} at (${parseFloat(vertexX.toFixed(5))}, ${parseFloat(vertexY.toFixed(5))})`;

  if (disc >= 0) {
    const x1 = (-b + Math.sqrt(disc)) / (2 * a);
    const x2 = (-b - Math.sqrt(disc)) / (2 * a);
    return {
      x1: `${parseFloat(x1.toFixed(7))}`,
      x2: `${parseFloat(x2.toFixed(7))}`,
      minMax,
    };
  } else {
    const real = -b / (2 * a);
    const imag = Math.sqrt(-disc) / (2 * a);
    const cleanReal = parseFloat(real.toFixed(6));
    const cleanImag = parseFloat(Math.abs(imag).toFixed(6));
    return {
      x1: `${cleanReal} + ${cleanImag}i`,
      x2: `${cleanReal} - ${cleanImag}i`,
      minMax,
    };
  }
}

// Simultaneous Linear equations 2 unknowns: a1*x + b1*y = c1, a2*x + b2*y = c2
export function solveSimultaneous2(
  a1: number,
  b1: number,
  c1: number,
  a2: number,
  b2: number,
  c2: number
): { x: number; y: number } | null {
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return null;
  const x = (c1 * b2 - c2 * b1) / det;
  const y = (a1 * c2 - a2 * c1) / det;
  return { x, y };
}
