/**
 * fx-570EX ClassWiz - Shared Polynomial Solver Module
 * 
 * Used by both EQN (Equation) and INEQ (Inequality) modes.
 * Implements analytical root finding for degrees 2, 3, and 4:
 * - Quadratic: Standard quadratic formula
 * - Cubic: Cardano / trigonometric closed-form formula
 * - Quartic: Ferrari's method with resolvent cubic & Newton-Raphson refinement
 * - Real root extraction with duplicate clustering within tolerance
 * - Exact polynomial inequality interval testing & merging
 */

export function cleanNumber(val: number): string {
  if (Math.abs(val) < 1e-11) return '0';
  if (Math.abs(val - Math.round(val)) < 1e-9) {
    return Math.round(val).toString();
  }
  const fixed = val.toFixed(10);
  const clean = parseFloat(fixed).toString();
  return clean === '-0' ? '0' : clean;
}

export function evalPoly(coeffs: number[], x: number): number {
  let res = 0;
  for (let i = 0; i < coeffs.length; i++) {
    res = res * x + coeffs[i];
  }
  return res;
}

// ==========================================
// 1. Quadratic Equation Solver (Degree 2)
// ==========================================

export function solveQuadratic(a: number, b: number, c: number): string[] {
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) {
      return ['No Solution'];
    }
    const x = -c / b;
    return [`x = ${cleanNumber(x)}`];
  }

  const disc = b * b - 4 * a * c;
  if (Math.abs(disc) < 1e-12) {
    const x = -b / (2 * a);
    return [`x₁ = ${cleanNumber(x)}`, `x₂ = ${cleanNumber(x)}`];
  } else if (disc > 0) {
    const sqrtDisc = Math.sqrt(disc);
    const x1 = (-b + sqrtDisc) / (2 * a);
    const x2 = (-b - sqrtDisc) / (2 * a);
    return [`x₁ = ${cleanNumber(x1)}`, `x₂ = ${cleanNumber(x2)}`];
  } else {
    const real = -b / (2 * a);
    const imag = Math.sqrt(-disc) / (2 * a);
    const imagAbs = Math.abs(imag);
    return [
      `x₁ = ${cleanNumber(real)} + ${cleanNumber(imagAbs)}i`,
      `x₂ = ${cleanNumber(real)} - ${cleanNumber(imagAbs)}i`,
    ];
  }
}

// ==========================================
// 2. Cubic Equation Solver (Degree 3)
// ==========================================

export function solveCubicRealRoots(a: number, b: number, c: number, d: number): number[] {
  if (Math.abs(a) < 1e-12) {
    // Falls back to quadratic
    const disc = c * c - 4 * b * d;
    if (Math.abs(b) < 1e-12) {
      return Math.abs(c) > 1e-12 ? [-d / c] : [];
    }
    if (disc > 1e-12) {
      const s = Math.sqrt(disc);
      return [(-c + s) / (2 * b), (-c - s) / (2 * b)];
    } else if (Math.abs(disc) <= 1e-12) {
      return [-c / (2 * b)];
    }
    return [];
  }

  const B = b / a;
  const C = c / a;
  const D = d / a;
  const shift = B / 3;

  const p = C - (B * B) / 3;
  const q = (2 * B * B * B) / 27 - (B * C) / 3 + D;
  const delta = (q * q) / 4 + (p * p * p) / 27;

  if (Math.abs(delta) < 1e-12) {
    if (Math.abs(p) < 1e-12 && Math.abs(q) < 1e-12) {
      return [-shift, -shift, -shift];
    }
    const u = Math.cbrt(-q / 2);
    return [2 * u - shift, -u - shift, -u - shift];
  } else if (delta < 0) {
    const r = Math.sqrt(-(p * p * p) / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const factor = 2 * Math.sqrt(-p / 3);
    return [
      factor * Math.cos(phi / 3) - shift,
      factor * Math.cos((phi + 2 * Math.PI) / 3) - shift,
      factor * Math.cos((phi + 4 * Math.PI) / 3) - shift,
    ];
  } else {
    const sqrtDelta = Math.sqrt(delta);
    const u = Math.cbrt(-q / 2 + sqrtDelta);
    const v = Math.cbrt(-q / 2 - sqrtDelta);
    return [u + v - shift];
  }
}

export function solveCubic(a: number, b: number, c: number, d: number): string[] {
  if (Math.abs(a) < 1e-12) {
    return solveQuadratic(b, c, d);
  }

  const B = b / a;
  const C = c / a;
  const D = d / a;
  const shift = B / 3;

  const p = C - (B * B) / 3;
  const q = (2 * B * B * B) / 27 - (B * C) / 3 + D;
  const delta = (q * q) / 4 + (p * p * p) / 27;

  if (Math.abs(delta) < 1e-12) {
    if (Math.abs(p) < 1e-12 && Math.abs(q) < 1e-12) {
      const x = -shift;
      return [
        `x₁ = ${cleanNumber(x)}`,
        `x₂ = ${cleanNumber(x)}`,
        `x₃ = ${cleanNumber(x)}`,
      ];
    }
    const u = Math.cbrt(-q / 2);
    const x1 = 2 * u - shift;
    const x2 = -u - shift;
    const x3 = -u - shift;
    return [
      `x₁ = ${cleanNumber(x1)}`,
      `x₂ = ${cleanNumber(x2)}`,
      `x₃ = ${cleanNumber(x3)}`,
    ];
  } else if (delta < 0) {
    const r = Math.sqrt(-(p * p * p) / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const factor = 2 * Math.sqrt(-p / 3);

    const t1 = factor * Math.cos(phi / 3);
    const t2 = factor * Math.cos((phi + 2 * Math.PI) / 3);
    const t3 = factor * Math.cos((phi + 4 * Math.PI) / 3);

    const roots = [t1 - shift, t2 - shift, t3 - shift].sort((m, n) => n - m);
    return [
      `x₁ = ${cleanNumber(roots[0])}`,
      `x₂ = ${cleanNumber(roots[1])}`,
      `x₃ = ${cleanNumber(roots[2])}`,
    ];
  } else {
    const sqrtDelta = Math.sqrt(delta);
    const u = Math.cbrt(-q / 2 + sqrtDelta);
    const v = Math.cbrt(-q / 2 - sqrtDelta);

    const x1 = u + v - shift;
    const realPart = -(u + v) / 2 - shift;
    const imagPart = Math.abs((Math.sqrt(3) * (u - v)) / 2);

    return [
      `x₁ = ${cleanNumber(x1)}`,
      `x₂ = ${cleanNumber(realPart)} + ${cleanNumber(imagPart)}i`,
      `x₃ = ${cleanNumber(realPart)} - ${cleanNumber(imagPart)}i`,
    ];
  }
}

// ==========================================
// 3. Quartic Equation Solver (Degree 4)
// ==========================================

export function solveQuarticRealRoots(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number
): number[] {
  if (Math.abs(a) < 1e-12) {
    return solveCubicRealRoots(b, c, d, e);
  }

  const B = b / a;
  const C = c / a;
  const D = d / a;
  const E = e / a;
  const shift = B / 4;

  const P = C - (3 * B * B) / 8;
  const Q = (B * B * B) / 8 - (B * C) / 2 + D;
  const R = (-3 * B * B * B * B) / 256 + (B * B * C) / 16 - (B * D) / 4 + E;

  const yRoots: number[] = [];

  if (Math.abs(Q) < 1e-11) {
    // Biquadratic: y^4 + P y^2 + R = 0 -> z^2 + P z + R = 0
    const disc = P * P - 4 * R;
    if (disc >= -1e-12) {
      const s = Math.sqrt(Math.max(0, disc));
      const z1 = (-P + s) / 2;
      const z2 = (-P - s) / 2;
      if (z1 >= -1e-11) {
        const sq1 = Math.sqrt(Math.max(0, z1));
        yRoots.push(sq1, -sq1);
      }
      if (z2 >= -1e-11) {
        const sq2 = Math.sqrt(Math.max(0, z2));
        yRoots.push(sq2, -sq2);
      }
    }
  } else {
    // Resolvent cubic in m: 8m^3 + 8Pm^2 + (2P^2 - 8R)m - Q^2 = 0
    // Substitute m = z / 2 -> z^3 + 2P z^2 + (P^2 - 4R)z - Q^2 = 0
    const cubRoots = solveCubicRealRoots(1, 2 * P, P * P - 4 * R, -Q * Q);
    let bestZ: number | null = null;
    for (const z of cubRoots) {
      if (2 * z + P >= -1e-9) {
        if (bestZ === null || z > bestZ) bestZ = z;
      }
    }
    if (bestZ === null) {
      bestZ = Math.max(...cubRoots);
    }

    const sqrt2zP = Math.sqrt(Math.max(0, 2 * bestZ + P));
    if (sqrt2zP >= 1e-11) {
      const c1 = bestZ - Q / (2 * sqrt2zP);
      const disc1 = 2 * bestZ + P - 4 * c1;
      if (disc1 >= -1e-11) {
        const s1 = Math.sqrt(Math.max(0, disc1));
        yRoots.push((-sqrt2zP + s1) / 2, (-sqrt2zP - s1) / 2);
      }
      const c2 = bestZ + Q / (2 * sqrt2zP);
      const disc2 = 2 * bestZ + P - 4 * c2;
      if (disc2 >= -1e-11) {
        const s2 = Math.sqrt(Math.max(0, disc2));
        yRoots.push((sqrt2zP + s2) / 2, (sqrt2zP - s2) / 2);
      }
    }
  }

  const roots = yRoots.map((y) => y - shift);

  // Refine each root with Newton-Raphson
  const refined = roots.map((r) => {
    let x = r;
    for (let iter = 0; iter < 5; iter++) {
      const f = evalPoly([a, b, c, d, e], x);
      const fPrime = 4 * a * x * x * x + 3 * b * x * x + 2 * c * x + d;
      if (Math.abs(fPrime) > 1e-12) {
        x = x - f / fPrime;
      }
    }
    return Math.abs(x - Math.round(x)) < 1e-8 ? Math.round(x) : x;
  });

  return refined;
}

export function solveQuartic(a: number, b: number, c: number, d: number, e: number): string[] {
  const realRoots = solveQuarticRealRoots(a, b, c, d, e);
  if (realRoots.length === 0) {
    return ['No Real Roots'];
  }
  realRoots.sort((m, n) => n - m);
  return realRoots.map((r, idx) => `x${idx + 1} = ${cleanNumber(r)}`);
}

// ==========================================
// 4. Real Root Finder for Polynomials (Degree 1 to 4)
// ==========================================

export function findPolynomialRealRoots(coeffs: number[]): number[] | null {
  if (coeffs.length === 0 || Math.abs(coeffs[0]) < 1e-12) {
    return null; // Leading coefficient is zero -> Math ERROR
  }

  const deg = coeffs.length - 1;
  let raw: number[] = [];

  if (deg === 1) {
    raw = [-coeffs[1] / coeffs[0]];
  } else if (deg === 2) {
    const [a, b, c] = coeffs;
    const disc = b * b - 4 * a * c;
    if (disc > 1e-12) {
      const s = Math.sqrt(disc);
      raw = [(-b - s) / (2 * a), (-b + s) / (2 * a)];
    } else if (Math.abs(disc) <= 1e-12) {
      raw = [-b / (2 * a)];
    }
  } else if (deg === 3) {
    raw = solveCubicRealRoots(coeffs[0], coeffs[1], coeffs[2], coeffs[3]);
  } else if (deg === 4) {
    raw = solveQuarticRealRoots(coeffs[0], coeffs[1], coeffs[2], coeffs[3], coeffs[4]);
  }

  // Refine integer rounding and cluster duplicates within 1e-6
  const cleaned = raw.map((x) =>
    Math.abs(x - Math.round(x)) < 1e-8 ? Math.round(x) : x
  );
  cleaned.sort((m, n) => m - n);

  const unique: number[] = [];
  for (const x of cleaned) {
    if (unique.length === 0 || Math.abs(x - unique[unique.length - 1]) > 1e-6) {
      unique.push(x);
    }
  }

  return unique;
}

// ==========================================
// 5. Complete Polynomial Inequality Solver
// ==========================================

export function solveInequality(coeffs: number[], comp: string): string {
  // 1. Leading coefficient = 0 -> Math ERROR
  if (!coeffs || coeffs.length === 0 || Math.abs(coeffs[0]) < 1e-12) {
    return 'Math ERROR';
  }

  const normalizedComp = comp.trim();
  const isGt =
    normalizedComp === '>' || normalizedComp === '>=' || normalizedComp === '≥';
  const isStrict = normalizedComp === '>' || normalizedComp === '<';

  const roots = findPolynomialRealRoots(coeffs);
  if (roots === null) {
    return 'Math ERROR';
  }

  const satisfies = (val: number): boolean => {
    if (Math.abs(val) < 1e-11) {
      return !isStrict;
    }
    return isGt ? val > 0 : val < 0;
  };

  // Case: No real roots
  if (roots.length === 0) {
    const testVal = evalPoly(coeffs, 0);
    return satisfies(testVal) ? 'All real numbers' : 'No solution';
  }

  const n = roots.length;
  const intSat: boolean[] = [];
  for (let i = 0; i <= n; i++) {
    let sample: number;
    if (i === 0) {
      sample = roots[0] - 1;
    } else if (i === n) {
      sample = roots[n - 1] + 1;
    } else {
      sample = (roots[i - 1] + roots[i]) / 2;
    }
    intSat.push(satisfies(evalPoly(coeffs, sample)));
  }

  const ptSat = roots.map((r) => satisfies(evalPoly(coeffs, r)));

  // If all intervals and points satisfy: All real numbers
  if (intSat.every(Boolean) && ptSat.every(Boolean)) {
    return 'All real numbers';
  }

  // If no intervals and no points satisfy: No solution
  if (intSat.every((v) => !v) && ptSat.every((v) => !v)) {
    return 'No solution';
  }

  // Isolated points satisfying (e.g. (x-1)^2 <= 0 -> x = 1)
  if (intSat.every((v) => !v)) {
    const isolated = roots.filter((_, idx) => ptSat[idx]);
    if (isolated.length === 1) {
      return `x = ${cleanNumber(isolated[0])}`;
    }
    if (isolated.length > 1) {
      return isolated.map((r) => `x = ${cleanNumber(r)}`).join(', ');
    }
    return 'No solution';
  }

  // Build interval list
  interface IntervalItem {
    left: number;
    right: number;
    leftClosed: boolean;
    rightClosed: boolean;
    isPoint?: boolean;
  }

  const intervals: IntervalItem[] = [];
  for (let i = 0; i <= n; i++) {
    if (intSat[i]) {
      const left = i === 0 ? -Infinity : roots[i - 1];
      const right = i === n ? Infinity : roots[i];
      const leftClosed = !isStrict && isFinite(left) && ptSat[i - 1];
      const rightClosed = !isStrict && isFinite(right) && ptSat[i];
      intervals.push({ left, right, leftClosed, rightClosed });
    }
  }

  // Merge adjacent intervals
  const merged: IntervalItem[] = [];
  for (let i = 0; i < intervals.length; i++) {
    if (merged.length === 0) {
      merged.push({ ...intervals[i] });
    } else {
      const last = merged[merged.length - 1];
      const cur = intervals[i];
      const boundaryIdx = roots.findIndex((r) => Math.abs(r - cur.left) < 1e-6);
      if (last.right === cur.left && boundaryIdx !== -1 && ptSat[boundaryIdx]) {
        last.right = cur.right;
        last.rightClosed = cur.rightClosed;
      } else {
        merged.push({ ...cur });
      }
    }
  }

  // Add any isolated points
  for (let idx = 0; idx < n; idx++) {
    if (ptSat[idx]) {
      const r = roots[idx];
      const covered = merged.some(
        (iv) =>
          (iv.left < r || (iv.left === r && iv.leftClosed)) &&
          (iv.right > r || (iv.right === r && iv.rightClosed))
      );
      if (!covered) {
        merged.push({
          left: r,
          right: r,
          leftClosed: true,
          rightClosed: true,
          isPoint: true,
        });
      }
    }
  }

  merged.sort((a, b) => a.left - b.left);

  if (
    merged.length === 1 &&
    merged[0].left === -Infinity &&
    merged[0].right === Infinity
  ) {
    return 'All real numbers';
  }

  const parts: string[] = [];
  for (const iv of merged) {
    if (iv.isPoint || (iv.left === iv.right && isFinite(iv.left))) {
      parts.push(`x = ${cleanNumber(iv.left)}`);
    } else if (iv.left === -Infinity) {
      parts.push(`x ${iv.rightClosed ? '<=' : '<'} ${cleanNumber(iv.right)}`);
    } else if (iv.right === Infinity) {
      parts.push(`x ${iv.leftClosed ? '>=' : '>'} ${cleanNumber(iv.left)}`);
    } else {
      const lOp = iv.leftClosed ? '<=' : '<';
      const rOp = iv.rightClosed ? '<=' : '<';
      parts.push(`${cleanNumber(iv.left)} ${lOp} x ${rOp} ${cleanNumber(iv.right)}`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'No solution';
}
