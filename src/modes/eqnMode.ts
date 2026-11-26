/**
 * fx-570EX ClassWiz - EQN (Equation/Func) Mode Module
 * 
 * Mode ID: EQN
 * Indicator: 'EQN'
 * Sub-Menu:
 * 1: Simul Equation (2 to 4 Unknowns)
 * 2: Polynomial (Degree 2 to 3)
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext } from './types';
import { evaluateMathExpression } from '../calcEngine';

// ==========================================
// 1. Exact Rational Arithmetic (BigInt Fraction)
// ==========================================

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b > 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export class SimulFrac {
  n: bigint;
  d: bigint;

  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error('Division by zero');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }

  add(o: SimulFrac): SimulFrac {
    return new SimulFrac(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(o: SimulFrac): SimulFrac {
    return new SimulFrac(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(o: SimulFrac): SimulFrac {
    return new SimulFrac(this.n * o.n, this.d * o.d);
  }

  div(o: SimulFrac): SimulFrac {
    if (o.n === 0n) throw new Error('Division by zero');
    return new SimulFrac(this.n * o.d, this.d * o.n);
  }

  isZero(): boolean {
    return this.n === 0n;
  }

  absCmp(o: SimulFrac): number {
    const a = this.n < 0n ? -this.n : this.n;
    const b = o.n < 0n ? -o.n : o.n;
    const l = a * o.d;
    const r = b * this.d;
    return l > r ? 1 : l < r ? -1 : 0;
  }

  toString(): string {
    if (this.d === 1n) return this.n.toString();
    return `${this.n.toString()}/${this.d.toString()}`;
  }

  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }
}

/**
 * Convert number or fraction string to SimulFrac.
 * Uses Farey approximation to recover clean fractions from floats if within tolerance.
 */
export function toSimulFrac(val: number | string): SimulFrac | null {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes('/')) {
      const [nStr, dStr] = trimmed.split('/');
      const n = BigInt(nStr.trim());
      const d = BigInt(dStr.trim());
      if (d !== 0n) return new SimulFrac(n, d);
    }
    const num = parseFloat(trimmed);
    if (isNaN(num)) return null;
    val = num;
  }

  if (!isFinite(val)) return null;

  // Suppress tiny float noise around integers
  if (Math.abs(val - Math.round(val)) < 1e-10) {
    return new SimulFrac(BigInt(Math.round(val)), 1n);
  }

  // Continued fraction expansion to find rational approximation p/q with q <= 100000
  let x = val;
  const sign = x < 0 ? -1n : 1n;
  x = Math.abs(x);

  let a = Math.floor(x);
  let p0 = 1n, p1 = BigInt(a);
  let q0 = 0n, q1 = 1n;

  let rem = x - a;
  let iter = 0;

  while (rem > 1e-12 && iter < 15) {
    iter++;
    const inv = 1 / rem;
    a = Math.floor(inv);
    rem = inv - a;

    const p2 = BigInt(a) * p1 + p0;
    const q2 = BigInt(a) * q1 + q0;

    if (q2 > 100000n) break;

    p0 = p1; p1 = p2;
    q0 = q1; q1 = q2;

    const approx = Number(p1) / Number(q1);
    if (Math.abs(approx - x) < 1e-10) {
      return new SimulFrac(sign * p1, q1);
    }
  }

  return new SimulFrac(sign * p1, q1);
}

// ==========================================
// 2. Simultaneous Equation Solver (Gaussian Elimination)
// ==========================================

export interface SimulVarSolution {
  varName: string;
  val: number;
  exactFraction: string;
  decimalStr: string;
  showFraction: boolean;
}

export interface SimulSolveResult {
  success: boolean;
  error?: string;
  solutions?: SimulVarSolution[];
}

export const VAR_NAMES_4 = ['x', 'y', 'z', 't'];

export function cleanNumber(val: number): string {
  if (Math.abs(val) < 1e-11) return '0';
  if (Math.abs(val - Math.round(val)) < 1e-10) {
    return Math.round(val).toString();
  }
  const fixed = val.toFixed(10);
  const clean = parseFloat(fixed).toString();
  return clean === '-0' ? '0' : clean;
}

/**
 * Solve system of linear equations using Gaussian elimination with partial pivoting.
 * Prefers exact rational arithmetic, detects singular/inconsistent systems with tolerance.
 */
export function solveSimultaneousEquations(
  rawMatrix: (number | string)[][],
  unknowns: 2 | 3 | 4
): SimulSolveResult {
  const n = unknowns;

  // Try exact rational Gaussian elimination first
  let allRational = true;
  const ratMat: SimulFrac[][] = [];

  for (let i = 0; i < n; i++) {
    ratMat[i] = [];
    for (let j = 0; j <= n; j++) {
      const frac = toSimulFrac(rawMatrix[i]?.[j] ?? 0);
      if (frac) {
        ratMat[i][j] = frac;
      } else {
        allRational = false;
        break;
      }
    }
    if (!allRational) break;
  }

  if (allRational) {
    const A = ratMat.map((r) => r.map((c) => new SimulFrac(c.n, c.d)));

    for (let k = 0; k < n; k++) {
      let pivotRow = k;
      for (let i = k + 1; i < n; i++) {
        if (A[i][k].absCmp(A[pivotRow][k]) > 0) {
          pivotRow = i;
        }
      }

      if (A[pivotRow][k].isZero()) {
        return { success: false, error: 'Math ERROR' };
      }

      if (pivotRow !== k) {
        const tmp = A[k];
        A[k] = A[pivotRow];
        A[pivotRow] = tmp;
      }

      for (let i = k + 1; i < n; i++) {
        const factor = A[i][k].div(A[k][k]);
        for (let j = k; j <= n; j++) {
          A[i][j] = A[i][j].sub(factor.mul(A[k][j]));
        }
      }
    }

    const solFracs: SimulFrac[] = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = A[i][n];
      for (let j = i + 1; j < n; j++) {
        sum = sum.sub(A[i][j].mul(solFracs[j]));
      }
      if (A[i][i].isZero()) {
        return { success: false, error: 'Math ERROR' };
      }
      solFracs[i] = sum.div(A[i][i]);
    }

    const solutions: SimulVarSolution[] = solFracs.map((f, idx) => {
      let numVal = f.toNumber();
      if (Math.abs(numVal - Math.round(numVal)) < 1e-10) {
        numVal = Math.round(numVal);
      }
      const exactFracStr = f.toString();
      const decStr = cleanNumber(numVal);
      return {
        varName: VAR_NAMES_4[idx] || `x${idx + 1}`,
        val: numVal,
        exactFraction: exactFracStr,
        decimalStr: decStr,
        showFraction: exactFracStr.includes('/'),
      };
    });

    return { success: true, solutions };
  }

  // Floating-point Gaussian elimination with partial pivoting & tolerance
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    A[i] = [];
    for (let j = 0; j <= n; j++) {
      const v = typeof rawMatrix[i]?.[j] === 'number'
        ? (rawMatrix[i][j] as number)
        : parseFloat(String(rawMatrix[i]?.[j] || '0'));
      A[i][j] = isNaN(v) ? 0 : v;
    }
  }

  for (let k = 0; k < n; k++) {
    let pivotRow = k;
    let maxVal = Math.abs(A[k][k]);

    for (let i = k + 1; i < n; i++) {
      const cur = Math.abs(A[i][k]);
      if (cur > maxVal) {
        maxVal = cur;
        pivotRow = i;
      }
    }

    if (maxVal < 1e-10) {
      return { success: false, error: 'Math ERROR' };
    }

    if (pivotRow !== k) {
      const tmp = A[k];
      A[k] = A[pivotRow];
      A[pivotRow] = tmp;
    }

    for (let i = k + 1; i < n; i++) {
      const factor = A[i][k] / A[k][k];
      for (let j = k; j <= n; j++) {
        A[i][j] -= factor * A[k][j];
      }
    }
  }

  const x: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = A[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * x[j];
    }
    if (Math.abs(A[i][i]) < 1e-10) {
      return { success: false, error: 'Math ERROR' };
    }
    x[i] = sum / A[i][i];
  }

  const solutions: SimulVarSolution[] = x.map((rawVal, idx) => {
    let val = rawVal;
    if (Math.abs(val - Math.round(val)) < 1e-9) {
      val = Math.round(val);
    }
    const frac = toSimulFrac(val);
    const exactFracStr = frac ? frac.toString() : cleanNumber(val);
    const decStr = cleanNumber(val);
    return {
      varName: VAR_NAMES_4[idx] || `x${idx + 1}`,
      val,
      exactFraction: exactFracStr,
      decimalStr: decStr,
      showFraction: exactFracStr.includes('/'),
    };
  });

  return { success: true, solutions };
}

// ==========================================
// 3. Polynomial Equation Solver (Degrees 2 & 3)
// Delegated to shared polySolver module
// ==========================================

import { solveQuadratic, solveCubic, solveQuartic } from './polySolver';
export { solveQuadratic, solveCubic, solveQuartic };


// ==========================================
// 4. Mode Module Implementation
// ==========================================

export interface CellEntry {
  raw: string;
  val: number;
}

export function createInitialSimulMatrix(n: 2 | 3 | 4): CellEntry[][] {
  if (n === 2) {
    // 2x + y = 5, x - y = 1 (Solution: x = 2, y = 1)
    return [
      [{ raw: '2', val: 2 }, { raw: '1', val: 1 }, { raw: '5', val: 5 }],
      [{ raw: '1', val: 1 }, { raw: '-1', val: -1 }, { raw: '1', val: 1 }],
    ];
  }
  if (n === 3) {
    // x + y + z = 6, 2y + 5z = -4, 2x + 5y - z = 27 (Solution: x = 5, y = 3, z = -2)
    return [
      [{ raw: '1', val: 1 }, { raw: '1', val: 1 }, { raw: '1', val: 1 }, { raw: '6', val: 6 }],
      [{ raw: '0', val: 0 }, { raw: '2', val: 2 }, { raw: '5', val: 5 }, { raw: '-4', val: -4 }],
      [{ raw: '2', val: 2 }, { raw: '5', val: 5 }, { raw: '-1', val: -1 }, { raw: '27', val: 27 }],
    ];
  }
  // 4 Unknowns
  return [
    [{ raw: '1', val: 1 }, { raw: '1', val: 1 }, { raw: '1', val: 1 }, { raw: '1', val: 1 }, { raw: '10', val: 10 }],
    [{ raw: '1', val: 1 }, { raw: '-1', val: -1 }, { raw: '2', val: 2 }, { raw: '-1', val: -1 }, { raw: '2', val: 2 }],
    [{ raw: '2', val: 2 }, { raw: '1', val: 1 }, { raw: '-1', val: -1 }, { raw: '2', val: 2 }, { raw: '11', val: 11 }],
    [{ raw: '3', val: 3 }, { raw: '2', val: 2 }, { raw: '1', val: 1 }, { raw: '-1', val: -1 }, { raw: '9', val: 9 }],
  ];
}

export const eqnModeModule: ModeModule = {
  id: 'EQN',
  code: 'EQN',
  name: 'Equation/Func',
  shortName: 'Equation',
  menuNumber: 10,
  isImplemented: true,

  getIndicator: () => 'EQN',

  keymap: {
    overrides: {
      OPTN: {
        label: 'OPTN',
        description: 'Equation options',
        action: (ctx) => ctx.setModeState((prev) => ({ ...prev, screen: 'SELECT_TYPE' })),
      },
    },
  },

  getInitialState: (): ModeState => ({
    mode: 'EQN',
    screen: 'SELECT_TYPE',
    data: {
      eqnType: 'SIMUL', // 'SIMUL' | 'POLY'
      unknowns: 2, // 2 | 3 | 4
      unknownsCursor: 2, // for display arrow selection
      simulMatrix: createInitialSimulMatrix(2),
      simulRow: 0,
      simulCol: 0,
      simulSolutions: null,
      simulSolIndex: 0,
      simulError: null,

      // Polynomial state
      degree: 2, // 2 | 3
      polyDegreeCursor: 2,
      polyCoeffs: [1, -5, 6],
      polyCoeffIdx: 0,
      polySolutions: null,
      polySolIndex: 0,

      inputBuffer: '',
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    // AC / ON global handling
    if (key === 'AC' || key === 'ON') {
      if (modeState.screen === 'SIMUL_SOLUTIONS') {
        // Return to coefficient input without losing values
        setModeState((prev) => ({
          ...prev,
          screen: 'SIMUL_COEFF_INPUT',
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }
      if (modeState.screen === 'SIMUL_COEFF_INPUT') {
        if (modeState.data.inputBuffer) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: '' },
          }));
          return true;
        }
        setModeState((prev) => ({ ...prev, screen: 'SIMUL_SELECT_UNKNOWNS' }));
        return true;
      }
      if (modeState.screen === 'SIMUL_SELECT_UNKNOWNS') {
        setModeState((prev) => ({ ...prev, screen: 'SELECT_TYPE' }));
        return true;
      }
      if (modeState.screen === 'SOLUTIONS') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, inputBuffer: '', polyCoeffIdx: 0 },
        }));
        return true;
      }
      if (modeState.screen === 'SELECT_DEGREE') {
        setModeState((prev) => ({ ...prev, screen: 'SELECT_TYPE' }));
        return true;
      }
      setModeState((prev) => ({ ...prev, screen: 'SELECT_TYPE' }));
      return true;
    }

    // 1. SELECT_TYPE screen
    if (modeState.screen === 'SELECT_TYPE') {
      if (key === '1') {
        setModeState((prev) => ({
          ...prev,
          screen: 'SIMUL_SELECT_UNKNOWNS',
          data: { ...prev.data, eqnType: 'SIMUL', unknownsCursor: prev.data.unknowns || 2 },
        }));
        return true;
      }
      if (key === '2') {
        setModeState((prev) => ({
          ...prev,
          screen: 'SELECT_DEGREE',
          data: { ...prev.data, eqnType: 'POLY', polyDegreeCursor: prev.data.degree || 2 },
        }));
        return true;
      }
      return true;
    }

    // 2. SIMUL_SELECT_UNKNOWNS: Choose number of unknowns (2, 3, 4)
    if (modeState.screen === 'SIMUL_SELECT_UNKNOWNS') {
      const cur = modeState.data.unknownsCursor || 2;

      if (key === 'UP') {
        const next = cur > 2 ? cur - 1 : 4;
        setModeState((prev) => ({ ...prev, data: { ...prev.data, unknownsCursor: next } }));
        return true;
      }
      if (key === 'DOWN') {
        const next = cur < 4 ? cur + 1 : 2;
        setModeState((prev) => ({ ...prev, data: { ...prev.data, unknownsCursor: next } }));
        return true;
      }
      if (key === '2' || (key === '=' && cur === 2)) {
        setModeState((prev) => ({
          ...prev,
          screen: 'SIMUL_COEFF_INPUT',
          data: {
            ...prev.data,
            unknowns: 2,
            simulMatrix: prev.data.unknowns === 2 && prev.data.simulMatrix ? prev.data.simulMatrix : createInitialSimulMatrix(2),
            simulRow: 0,
            simulCol: 0,
            inputBuffer: '',
          },
        }));
        return true;
      }
      if (key === '3' || (key === '=' && cur === 3)) {
        setModeState((prev) => ({
          ...prev,
          screen: 'SIMUL_COEFF_INPUT',
          data: {
            ...prev.data,
            unknowns: 3,
            simulMatrix: prev.data.unknowns === 3 && prev.data.simulMatrix ? prev.data.simulMatrix : createInitialSimulMatrix(3),
            simulRow: 0,
            simulCol: 0,
            inputBuffer: '',
          },
        }));
        return true;
      }
      if (key === '4' || (key === '=' && cur === 4)) {
        setModeState((prev) => ({
          ...prev,
          screen: 'SIMUL_COEFF_INPUT',
          data: {
            ...prev.data,
            unknowns: 4,
            simulMatrix: prev.data.unknowns === 4 && prev.data.simulMatrix ? prev.data.simulMatrix : createInitialSimulMatrix(4),
            simulRow: 0,
            simulCol: 0,
            inputBuffer: '',
          },
        }));
        return true;
      }
      return true;
    }

    // 3. SIMUL_COEFF_INPUT: Coefficient matrix input
    if (modeState.screen === 'SIMUL_COEFF_INPUT') {
      const u = (modeState.data.unknowns as 2 | 3 | 4) || 2;
      const numRows = u;
      const numCols = u + 1;
      let r = modeState.data.simulRow || 0;
      let c = modeState.data.simulCol || 0;
      const buf = modeState.data.inputBuffer || '';
      const matrix: CellEntry[][] = modeState.data.simulMatrix || createInitialSimulMatrix(u);

      // Helper to evaluate and commit active cell buffer if typed
      const commitActiveBuffer = () => {
        if (!buf) return;
        const evalRes = evaluateMathExpression(
          buf.replace(/×/g, '*').replace(/÷/g, '/'),
          ctx.angleMode,
          { ...ctx.sharedMemory },
          ctx.sharedMemory.Ans
        );
        const val = evalRes.success && evalRes.result !== undefined ? evalRes.result : (parseFloat(buf) || 0);
        const raw = evalRes.exactResult || buf;
        if (!matrix[r]) matrix[r] = [];
        matrix[r][c] = { raw, val };
      };

      // D-Pad navigation between cells
      if (key === 'RIGHT') {
        commitActiveBuffer();
        if (c < numCols - 1) {
          c++;
        } else if (r < numRows - 1) {
          r++;
          c = 0;
        } else {
          r = 0;
          c = 0;
        }
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, simulMatrix: [...matrix], simulRow: r, simulCol: c, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'LEFT') {
        commitActiveBuffer();
        if (c > 0) {
          c--;
        } else if (r > 0) {
          r--;
          c = numCols - 1;
        } else {
          r = numRows - 1;
          c = numCols - 1;
        }
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, simulMatrix: [...matrix], simulRow: r, simulCol: c, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'DOWN') {
        commitActiveBuffer();
        r = (r + 1) % numRows;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, simulMatrix: [...matrix], simulRow: r, simulCol: c, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'UP') {
        commitActiveBuffer();
        r = (r - 1 + numRows) % numRows;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, simulMatrix: [...matrix], simulRow: r, simulCol: c, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'DEL') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: buf.slice(0, -1) },
        }));
        return true;
      }

      // Enter key '=': confirms cell and advances, or solves if at end
      if (key === '=') {
        commitActiveBuffer();
        const isLastCell = r === numRows - 1 && c === numCols - 1;

        if (isLastCell) {
          // Solve system using Gaussian Elimination with partial pivoting
          const rawValues: (number | string)[][] = matrix.map((row) =>
            row.map((cell) => cell.raw || cell.val || 0)
          );
          const solveRes = solveSimultaneousEquations(rawValues, u);

          setModeState((prev) => ({
            ...prev,
            screen: 'SIMUL_SOLUTIONS',
            data: {
              ...prev.data,
              simulMatrix: [...matrix],
              simulSolutions: solveRes.solutions || null,
              simulError: solveRes.error || null,
              simulSolIndex: 0,
              inputBuffer: '',
            },
          }));
        } else {
          // Advance to next cell
          if (c < numCols - 1) {
            c++;
          } else {
            r++;
            c = 0;
          }
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, simulMatrix: [...matrix], simulRow: r, simulCol: c, inputBuffer: '' },
          }));
        }
        return true;
      }

      // Input characters: accepts numbers, fractions, operations, sqrt, pi, Ans
      let charToAdd = '';
      if (/^[0-9.\-]$/.test(key)) {
        charToAdd = key;
      } else if (key === '+' || key === '-' || key === '*' || key === '×') {
        charToAdd = key === '×' ? '*' : key;
      } else if (key === '/' || key === '÷' || key === '■/□') {
        charToAdd = '/';
      } else if (key === '√' || key === 'sqrt') {
        charToAdd = '√(';
      } else if (key === 'π' || key === 'PI') {
        charToAdd = 'π';
      } else if (key === 'Ans') {
        charToAdd = 'Ans';
      } else if (key === '(' || key === ')') {
        charToAdd = key;
      } else if (key === '^') {
        charToAdd = '^';
      } else if (key === '²') {
        charToAdd = '^2';
      }

      if (charToAdd) {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: buf + charToAdd },
        }));
        return true;
      }

      return true;
    }

    // 4. SIMUL_SOLUTIONS: Display variable solutions with S<=>D toggle
    if (modeState.screen === 'SIMUL_SOLUTIONS') {
      const sols = modeState.data.simulSolutions || [];
      const curIdx = modeState.data.simulSolIndex || 0;

      if (key === 'DOWN' || key === '=') {
        if (sols.length > 0) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, simulSolIndex: (curIdx + 1) % sols.length },
          }));
        }
        return true;
      }

      if (key === 'UP') {
        if (sols.length > 0) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, simulSolIndex: (curIdx - 1 + sols.length) % sols.length },
          }));
        }
        return true;
      }

      // S<=>D toggle fraction vs decimal
      if (key === 'S_D' || key === 'FORMAT') {
        if (sols.length > 0) {
          const updated = [...sols];
          updated[curIdx] = {
            ...updated[curIdx],
            showFraction: !updated[curIdx].showFraction,
          };
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, simulSolutions: updated },
          }));
        }
        return true;
      }

      return true;
    }

    // 5. Polynomial SELECT_DEGREE screen
    if (modeState.screen === 'SELECT_DEGREE') {
      const cur = modeState.data.polyDegreeCursor || 2;
      if (key === 'UP' || key === 'DOWN') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, polyDegreeCursor: cur === 2 ? 3 : 2 },
        }));
        return true;
      }
      if (key === '2' || (key === '=' && cur === 2)) {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, eqnType: 'POLY', degree: 2, polyCoeffs: [1, -5, 6], polyCoeffIdx: 0, inputBuffer: '' },
        }));
        return true;
      }
      if (key === '3' || (key === '=' && cur === 3)) {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, eqnType: 'POLY', degree: 3, polyCoeffs: [1, -6, 11, -6], polyCoeffIdx: 0, inputBuffer: '' },
        }));
        return true;
      }
      return true;
    }

    // 6. Polynomial COEFF_INPUT screen
    if (modeState.screen === 'COEFF_INPUT') {
      const cur = modeState.data.polyCoeffIdx || 0;
      const deg = modeState.data.degree || 2;
      const defaultCoeffs = deg === 3 ? [1, -6, 11, -6] : [1, -5, 6];
      const coeffs = [...(modeState.data.polyCoeffs || defaultCoeffs)];
      const max = coeffs.length - 1;

      if (key === 'LEFT') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, polyCoeffIdx: cur > 0 ? cur - 1 : max, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'RIGHT') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, polyCoeffIdx: cur < max ? cur + 1 : 0, inputBuffer: '' },
        }));
        return true;
      }

      if (key === 'DEL') {
        const buf = modeState.data.inputBuffer || '';
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: buf.slice(0, -1) },
        }));
        return true;
      }

      if (/^[0-9.\-]$/.test(key)) {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + key },
        }));
        return true;
      }

      if (key === '=') {
        const buf = modeState.data.inputBuffer;
        if (buf && buf !== '-' && buf !== '.') {
          coeffs[cur] = parseFloat(buf) || 0;
        }

        if (cur < max) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, polyCoeffs: coeffs, polyCoeffIdx: cur + 1, inputBuffer: '' },
          }));
        } else {
          const sols = deg === 3
            ? solveCubic(coeffs[0], coeffs[1], coeffs[2], coeffs[3])
            : solveQuadratic(coeffs[0], coeffs[1], coeffs[2]);

          setModeState((prev) => ({
            ...prev,
            screen: 'SOLUTIONS',
            data: { ...prev.data, polyCoeffs: coeffs, polySolutions: sols, polySolIndex: 0, inputBuffer: '' },
          }));
        }
        return true;
      }
    }

    // 7. Polynomial SOLUTIONS screen
    if (modeState.screen === 'SOLUTIONS') {
      const sols = modeState.data.polySolutions || [];
      if (key === 'DOWN' || key === '=') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, polySolIndex: ((prev.data.polySolIndex || 0) + 1) % Math.max(1, sols.length) },
        }));
        return true;
      }
      if (key === 'UP') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, polySolIndex: ((prev.data.polySolIndex || 0) - 1 + sols.length) % Math.max(1, sols.length) },
        }));
        return true;
      }
      return true;
    }

    return false;
  },

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;

    // 1. SELECT_TYPE
    if (modeState.screen === 'SELECT_TYPE') {
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center' },
          React.createElement('span', null, 'Equation/Func'),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, 'EQN')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5 text-xs my-auto' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--display-surface)] border border-[var(--display-divider)]' },
            React.createElement('span', { className: 'font-bold px-1.5 py-0.5 rounded bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] text-[10px]' }, '1:'),
            React.createElement('span', { className: 'font-semibold' }, 'Simul Equation'),
            React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] ml-auto' }, '2 ~ 4 Unknowns')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--display-surface)] border border-[var(--display-divider)]' },
            React.createElement('span', { className: 'font-bold px-1.5 py-0.5 rounded bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] text-[10px]' }, '2:'),
            React.createElement('span', { className: 'font-semibold' }, 'Polynomial'),
            React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] ml-auto' }, 'Degree 2 ~ 3')
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)]' },
          'Press [1] or [2]'
        )
      );
    }

    // 2. SIMUL_SELECT_UNKNOWNS (Choose 2, 3, 4 Unknowns)
    if (modeState.screen === 'SIMUL_SELECT_UNKNOWNS') {
      const cur = modeState.data.unknownsCursor || 2;
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center' },
          React.createElement('span', null, 'Simul Equation'),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, 'Unknowns? 2~4')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1 text-xs my-auto' },
          [
            { num: 2, label: '2 Unknowns (x, y)' },
            { num: 3, label: '3 Unknowns (x, y, z)' },
            { num: 4, label: '4 Unknowns (x, y, z, t)' },
          ].map((item) => {
            const isSelected = item.num === cur;
            return React.createElement(
              'div',
              {
                key: item.num,
                className: `flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors border ${
                  isSelected
                    ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold'
                    : 'border-[var(--display-divider)] bg-[var(--display-surface)] text-[var(--display-text)]'
                }`,
              },
              React.createElement('span', { className: 'font-bold mr-2' }, `${item.num}:`),
              React.createElement('span', { className: 'flex-1 text-left' }, item.label),
              isSelected && React.createElement('span', { className: 'text-[10px]' }, '◄')
            );
          })
        ),
        React.createElement(
          'div',
          { className: 'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between' },
          React.createElement('span', null, '[AC] Back'),
          React.createElement('span', null, '[▲▼] Select  [=] Confirm')
        )
      );
    }

    // 3. SIMUL_COEFF_INPUT (Matrix Grid)
    if (modeState.screen === 'SIMUL_COEFF_INPUT') {
      const u = (modeState.data.unknowns as 2 | 3 | 4) || 2;
      const r = modeState.data.simulRow || 0;
      const c = modeState.data.simulCol || 0;
      const buf = modeState.data.inputBuffer || '';
      const matrix: CellEntry[][] = modeState.data.simulMatrix || createInitialSimulMatrix(u);
      const colLabels = u === 2 ? ['x', 'y', '=k'] : u === 3 ? ['x', 'y', 'z', '=k'] : ['x', 'y', 'z', 't', '=k'];

      // Formula header
      let formula = '';
      if (u === 2) formula = `Eq${r + 1}: a${r + 1}x + b${r + 1}y = c${r + 1}`;
      else if (u === 3) formula = `Eq${r + 1}: a${r + 1}x + b${r + 1}y + c${r + 1}z = d${r + 1}`;
      else formula = `Eq${r + 1}: a${r + 1}x + b${r + 1}y + c${r + 1}z + d${r + 1}t = e${r + 1}`;

      const activeCellVal = matrix[r]?.[c]?.raw ?? matrix[r]?.[c]?.val ?? '0';

      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]' },
        // Top status
        React.createElement(
          'div',
          { className: 'text-[11px] font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center' },
          React.createElement('span', { className: 'truncate' }, formula),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal shrink-0 ml-1' }, `${u} Unknowns`)
        ),
        // Grid Table
        React.createElement(
          'div',
          { className: 'my-auto overflow-x-auto no-scrollbar w-full' },
          React.createElement(
            'div',
            { className: 'inline-block min-w-full text-center text-xs' },
            // Column Headers
            React.createElement(
              'div',
              { className: 'flex items-center gap-1 pb-1 border-b border-[var(--display-divider)] text-[10px] text-[var(--display-muted)]' },
              React.createElement('div', { className: 'w-5 shrink-0' }, '#'),
              colLabels.map((lbl, idx) =>
                React.createElement(
                  'div',
                  { key: idx, className: `flex-1 min-w-[34px] font-bold ${idx === c ? 'text-[var(--ui-accent)]' : ''}` },
                  lbl
                )
              )
            ),
            // Rows
            matrix.slice(0, u).map((row, rowIdx) => {
              const isCurrentRow = rowIdx === r;
              return React.createElement(
                'div',
                {
                  key: rowIdx,
                  className: `flex items-center gap-1 py-0.5 ${isCurrentRow ? 'bg-[var(--display-surface)] rounded-lg' : ''}`,
                },
                React.createElement('div', { className: `w-5 shrink-0 text-[10px] font-bold ${isCurrentRow ? 'text-[var(--ui-accent)]' : 'text-[var(--display-muted)]'}` }, `${rowIdx + 1}:`),
                row.map((cell, colIdx) => {
                  const isSelected = isCurrentRow && colIdx === c;
                  const displayStr = isSelected && buf !== '' ? buf : cell?.raw ?? cell?.val ?? '0';
                  return React.createElement(
                    'div',
                    {
                      key: colIdx,
                      className: `flex-1 min-w-[34px] px-1 py-0.5 rounded text-[11px] truncate border ${
                        isSelected
                          ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold'
                          : 'border-[var(--display-divider)] bg-[var(--display-surface)] text-[var(--display-text)]'
                      }`,
                    },
                    displayStr
                  );
                })
              );
            })
          )
        ),
        // Cell preview & instructions
        React.createElement(
          'div',
          { className: 'text-[10px] border-t border-[var(--display-divider)] pt-1 flex justify-between items-center text-[var(--display-muted)]' },
          React.createElement('span', null, `Cell [${r + 1}, ${colLabels[c]}]: `, React.createElement('strong', { className: 'text-[var(--ui-accent)]' }, buf !== '' ? buf : activeCellVal)),
          React.createElement('span', { className: 'text-[10px]' }, '[▲▼◄►] [=]')
        )
      );
    }

    // 4. SIMUL_SOLUTIONS (One at a time with S<=>D toggle)
    if (modeState.screen === 'SIMUL_SOLUTIONS') {
      const u = (modeState.data.unknowns as 2 | 3 | 4) || 2;
      const err = modeState.data.simulError;
      const sols: SimulVarSolution[] = modeState.data.simulSolutions || [];
      const curIdx = modeState.data.simulSolIndex || 0;
      const activeSol = sols[curIdx];

      if (err || sols.length === 0) {
        return React.createElement(
          'div',
          { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none text-center' },
          React.createElement('div', { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)]' }, 'Simul Equation'),
          React.createElement(
            'div',
            { className: 'my-auto space-y-1' },
            React.createElement('div', { className: 'text-base font-bold text-[var(--ui-danger)] tracking-wider' }, 'Math ERROR'),
            React.createElement('div', { className: 'text-xs text-[var(--display-muted)]' }, 'No Unique Solution')
          ),
          React.createElement('div', { className: 'text-[10px] text-[var(--display-muted)] border-t border-[var(--display-divider)] pt-1' }, 'Press [AC] to edit coefficients')
        );
      }

      const displayVal = activeSol.showFraction ? activeSol.exactFraction : activeSol.decimalStr;

      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        // Top Status
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center' },
          React.createElement('span', null, `Simul Eqn (${u} Unknowns)`),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, '[S⇔D] Fraction/Dec')
        ),
        // Active Variable Display
        React.createElement(
          'div',
          { className: 'my-auto text-right py-1' },
          React.createElement('div', { className: 'text-xs font-semibold text-[var(--display-muted)] mb-0.5' }, `${activeSol.varName} =`),
          React.createElement(
            'div',
            { className: 'text-3xl sm:text-4xl font-light tracking-tight text-[var(--display-text)] select-text overflow-x-auto no-scrollbar whitespace-nowrap' },
            displayVal
          )
        ),
        // Variable Selectors & Navigation footer
        React.createElement(
          'div',
          { className: 'space-y-1 border-t border-[var(--display-divider)] pt-1' },
          React.createElement(
            'div',
            { className: 'flex justify-center gap-1.5 text-xs' },
            sols.map((s, idx) =>
              React.createElement(
                'div',
                {
                  key: s.varName,
                  className: `px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                    idx === curIdx
                      ? 'bg-[var(--ui-accent)] text-[var(--display-bg)]'
                      : 'bg-[var(--display-surface)] border border-[var(--display-divider)] text-[var(--display-muted)]'
                  }`,
                },
                s.varName
              )
            )
          ),
          React.createElement(
            'div',
            { className: 'text-[10px] text-[var(--display-muted)] flex justify-between items-center' },
            React.createElement('span', null, '[AC] Edit Coeffs'),
            React.createElement('span', null, '[▲▼] [=] Next Root')
          )
        )
      );
    }

    // 5. SELECT_DEGREE (Polynomial)
    if (modeState.screen === 'SELECT_DEGREE') {
      const cur = modeState.data.polyDegreeCursor || 2;
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center' },
          React.createElement('span', null, 'Polynomial Degree?'),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, '2 ~ 3')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5 text-xs my-auto' },
          [
            { deg: 2, formula: 'ax² + bx + c = 0', name: 'Degree 2' },
            { deg: 3, formula: 'ax³ + bx² + cx + d = 0', name: 'Degree 3' },
          ].map((item) => {
            const isSelected = item.deg === cur;
            return React.createElement(
              'div',
              {
                key: item.deg,
                className: `flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-colors ${
                  isSelected
                    ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold'
                    : 'border-[var(--display-divider)] bg-[var(--display-surface)] text-[var(--display-text)]'
                }`,
              },
              React.createElement('span', { className: 'font-bold mr-2' }, `${item.deg}:`),
              React.createElement('span', { className: 'font-medium flex-1 text-left' }, item.formula),
              isSelected && React.createElement('span', { className: 'text-[10px]' }, '◄')
            );
          })
        ),
        React.createElement(
          'div',
          { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)] flex justify-between' },
          React.createElement('span', null, '[AC] Back'),
          React.createElement('span', null, '[▲▼] Select  [=] Confirm')
        )
      );
    }

    // 6. SOLUTIONS (Polynomial)
    if (modeState.screen === 'SOLUTIONS') {
      const sols = modeState.data.polySolutions || [];
      const degree = modeState.data.degree || 2;
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center' },
          React.createElement('span', null, `Poly Degree ${degree} Solutions:`),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, '▲▼ [=]')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1 my-auto overflow-y-auto no-scrollbar font-normal text-base tracking-wide' },
          sols.map((s: string, idx: number) =>
            React.createElement(
              'div',
              {
                key: idx,
                className: `px-2.5 py-1 rounded-xl transition-colors flex items-center justify-between border ${
                  idx === (modeState.data.polySolIndex || 0)
                    ? 'bg-[var(--ui-accent-tonal)] text-[var(--display-text)] border-[var(--ui-accent)] font-semibold'
                    : 'bg-[var(--display-surface)] border-[var(--display-divider)] text-[var(--display-muted)]'
                }`,
              },
              React.createElement('span', null, s),
              idx === (modeState.data.polySolIndex || 0) && React.createElement('span', { className: 'text-[10px] text-[var(--ui-accent)]' }, '◄')
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)] flex justify-between' },
          React.createElement('span', null, '[AC] Edit Coeffs'),
          React.createElement('span', null, '[▲▼] Next Root')
        )
      );
    }

    // 7. COEFF_INPUT (Polynomial)
    const degree = modeState.data.degree || 2;
    const defaultCoeffs = degree === 3 ? [1, -6, 11, -6] : [1, -5, 6];
    const coeffs = modeState.data.polyCoeffs || defaultCoeffs;
    const curIdx = modeState.data.polyCoeffIdx || 0;
    const buf = modeState.data.inputBuffer;
    const labels = degree === 3 ? ['a', 'b', 'c', 'd'] : ['a', 'b', 'c'];
    const formula = degree === 3 ? 'ax³ + bx² + cx + d = 0' : 'ax² + bx + c = 0';

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]' },
      React.createElement(
        'div',
        { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center' },
        React.createElement('span', null, formula),
        React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, `Deg ${degree}`)
      ),
      React.createElement(
        'div',
        { className: 'flex justify-center gap-1.5 items-center my-auto text-xs w-full overflow-x-auto no-scrollbar py-1' },
        labels.map((label, idx) => {
          const isSelected = idx === curIdx;
          const displayVal = isSelected && buf ? buf : coeffs[idx];
          return React.createElement(
            'div',
            {
              key: idx,
              className: `flex-1 min-w-[50px] max-w-[80px] px-1.5 py-1.5 border rounded-xl text-center ${
                isSelected
                  ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] font-bold text-[var(--ui-accent)]'
                  : 'border-[var(--display-divider)] bg-[var(--display-surface)] text-[var(--display-text)]'
              }`,
            },
            React.createElement('div', { className: 'text-[10px] text-[var(--display-muted)]' }, `${label}=`),
            React.createElement('div', { className: 'text-xs sm:text-sm font-semibold truncate' }, displayVal)
          );
        })
      ),
      React.createElement(
        'div',
        { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)] flex justify-between' },
        React.createElement('span', null, '[◄►] Move  [DEL] Clear'),
        React.createElement('span', null, 'Type value, press [=]')
      )
    );
  },
};
