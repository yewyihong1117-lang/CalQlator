/**
 * fx-570EX ClassWiz - INEQ (Inequality) Mode Module
 * 
 * Mode ID: INEQ
 * Indicator: 'INEQ'
 * 
 * Features:
 * - Types: Polynomial inequality Degree 2, 3, 4
 * - Comparison operators:
 *   1: axⁿ + ... > 0
 *   2: axⁿ + ... < 0
 *   3: axⁿ + ... ≥ 0
 *   4: axⁿ + ... ≤ 0
 * - Authentic coefficient grid editor with the active comparison symbol header
 * - Solution screen displaying exact intervals as the real ClassWiz unit does:
 *   e.g. "x<2, 3<x", "2≤x≤3", "All real numbers", "No solution", "x<1, 1<x", "1<x<2, 3<x"
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext } from './types';

export type IneqComparison = '>' | '<' | '≥' | '≤';

export interface IneqData {
  degree: 2 | 3 | 4;
  compType: 1 | 2 | 3 | 4;
  coeffs: number[]; // length = degree + 1 (e.g. [a, b, c] for deg 2)
  currentCoeffIdx: number;
  inputBuffer: string;
  solutionText: string;
}

export const COMP_SYMBOLS: Record<number, IneqComparison> = {
  1: '>',
  2: '<',
  3: '≥',
  4: '≤',
};

// Evaluate polynomial with given coefficients at x
export function evalPoly(coeffs: number[], x: number): number {
  let res = 0;
  for (let i = 0; i < coeffs.length; i++) {
    res = res * x + coeffs[i];
  }
  return res;
}

// Find real roots of polynomial of degree 1 to 4
export function findRealRoots(rawCoeffs: number[]): number[] {
  let coeffs = [...rawCoeffs];
  while (coeffs.length > 1 && Math.abs(coeffs[0]) < 1e-12) {
    coeffs.shift();
  }
  const deg = coeffs.length - 1;
  if (deg <= 0) return [];

  // Linear: ax + b = 0
  if (deg === 1) {
    return [-coeffs[1] / coeffs[0]];
  }

  // Quadratic: ax² + bx + c = 0
  if (deg === 2) {
    const [a, b, c] = coeffs;
    const disc = b * b - 4 * a * c;
    if (disc > 1e-12) {
      const s = Math.sqrt(disc);
      const r1 = (-b - s) / (2 * a);
      const r2 = (-b + s) / (2 * a);
      return [Math.min(r1, r2), Math.max(r1, r2)];
    } else if (Math.abs(disc) <= 1e-12) {
      return [-b / (2 * a)];
    }
    return [];
  }

  // Cubic: ax³ + bx² + cx + d = 0 (Analytical Cardano/trigonometric formula)
  if (deg === 3) {
    const [a, b, c, d] = coeffs;
    const p = b / a;
    const q = c / a;
    const r = d / a;

    const delta0 = p * p - 3 * q;
    const delta1 = 2 * p * p * p - 9 * p * q + 27 * r;
    const disc = delta1 * delta1 - 4 * delta0 * delta0 * delta0;

    if (Math.abs(delta0) < 1e-11 && Math.abs(delta1) < 1e-11) {
      return [-p / 3];
    }

    if (disc > 1e-11) {
      // One real root
      const sDisc = Math.sqrt(disc);
      const C1 = (delta1 + sDisc) / 2;
      const C_val = Math.sign(C1) * Math.pow(Math.abs(C1), 1 / 3);
      const t = C_val + delta0 / C_val;
      return [-(1 / (3 * a)) * (b + t)];
    } else {
      // 3 real roots
      const denom = 2 * Math.sqrt(Math.max(0, delta0 * delta0 * delta0));
      const cosVal = denom > 1e-12 ? Math.max(-1, Math.min(1, delta1 / denom)) : 1;
      const theta = Math.acos(cosVal);
      const s0 = 2 * Math.sqrt(Math.max(0, delta0));
      const t1 = s0 * Math.cos(theta / 3);
      const t2 = s0 * Math.cos((theta + 2 * Math.PI) / 3);
      const t3 = s0 * Math.cos((theta + 4 * Math.PI) / 3);
      const raw = [
        -(1 / (3 * a)) * (b - t1),
        -(1 / (3 * a)) * (b - t2),
        -(1 / (3 * a)) * (b - t3),
      ].sort((x, y) => x - y);

      const unique: number[] = [];
      for (const x of raw) {
        if (unique.length === 0 || Math.abs(x - unique[unique.length - 1]) > 1e-5) {
          unique.push(x);
        }
      }
      return unique;
    }
  }

  // Degree 4 (Quartic) via Weierstrass (Durand-Kerner) simultaneous root iteration
  const an = coeffs[0];
  const monic = coeffs.map((val) => val / an);

  // Complex arithmetic helper
  type Complex = { re: number; im: number };
  const cAdd = (z1: Complex, z2: Complex): Complex => ({ re: z1.re + z2.re, im: z1.im + z2.im });
  const cSub = (z1: Complex, z2: Complex): Complex => ({ re: z1.re - z2.re, im: z1.im - z2.im });
  const cMul = (z1: Complex, z2: Complex): Complex => ({
    re: z1.re * z2.re - z1.im * z2.im,
    im: z1.re * z2.im + z1.im * z2.re,
  });
  const cDiv = (z1: Complex, z2: Complex): Complex => {
    const den = z2.re * z2.re + z2.im * z2.im || 1e-18;
    return {
      re: (z1.re * z2.re + z1.im * z2.im) / den,
      im: (z1.im * z2.re - z1.re * z2.im) / den,
    };
  };

  // Initial distinct roots: z_k = (0.4 + 0.9i)^k
  const r0: Complex = { re: 0.4, im: 0.9 };
  let roots: Complex[] = [{ re: 1, im: 0 }];
  for (let k = 1; k < deg; k++) {
    roots.push(cMul(roots[k - 1], r0));
  }

  const evalMonic = (x: Complex): Complex => {
    let cur: Complex = { re: 0, im: 0 };
    for (let i = 0; i < monic.length; i++) {
      cur = cAdd(cMul(cur, x), { re: monic[i], im: 0 });
    }
    return cur;
  };

  for (let iter = 0; iter < 300; iter++) {
    let maxDiff = 0;
    const nextRoots: Complex[] = [];
    for (let i = 0; i < deg; i++) {
      let denom: Complex = { re: 1, im: 0 };
      for (let j = 0; j < deg; j++) {
        if (i !== j) {
          denom = cMul(denom, cSub(roots[i], roots[j]));
        }
      }
      const pVal = evalMonic(roots[i]);
      const delta = cDiv(pVal, denom);
      nextRoots.push(cSub(roots[i], delta));
      const diff = Math.sqrt(delta.re * delta.re + delta.im * delta.im);
      if (diff > maxDiff) maxDiff = diff;
    }
    roots = nextRoots;
    if (maxDiff < 1e-11) break;
  }

  // Filter real roots
  const realList: number[] = [];
  for (const r of roots) {
    if (Math.abs(r.im) < 1e-4) {
      realList.push(r.re);
    } else if (Math.abs(evalPoly(coeffs, r.re)) < 1e-4) {
      realList.push(r.re);
    }
  }

  realList.sort((a, b) => a - b);
  const uniqueRoots: number[] = [];
  for (const r of realList) {
    if (uniqueRoots.length === 0 || Math.abs(r - uniqueRoots[uniqueRoots.length - 1]) > 1e-4) {
      uniqueRoots.push(r);
    }
  }
  return uniqueRoots;
}

// Format a number cleanly for ClassWiz display
export function formatIneqNumber(val: number): string {
  if (Math.abs(val - Math.round(val)) < 1e-5) {
    return String(Math.round(val));
  }
  return String(parseFloat(val.toFixed(4)));
}

// Solve polynomial inequality and format interval result string exactly as the ClassWiz does
export function solveInequality(coeffs: number[], comp: IneqComparison): string {
  const strict = comp === '>' || comp === '<';
  const isGt = comp === '>' || comp === '≥';
  const op = strict ? '<' : '≤';

  const rawRoots = findRealRoots(coeffs);
  const cleanedRoots = rawRoots
    .map((r) => (Math.abs(r - Math.round(r)) < 1e-5 ? Math.round(r) : parseFloat(r.toFixed(5))))
    .sort((a, b) => a - b);

  const satisfies = (val: number): boolean => {
    if (Math.abs(val) < 1e-12) {
      return !strict;
    }
    return isGt ? val > 0 : val < 0;
  };

  // Case: No real roots
  if (cleanedRoots.length === 0) {
    const testVal = evalPoly(coeffs, 0);
    return satisfies(testVal) ? 'All real numbers' : 'No solution';
  }

  // Test intervals between roots
  const intervalSatisfies: boolean[] = [];
  for (let i = 0; i <= cleanedRoots.length; i++) {
    let sample: number;
    if (i === 0) {
      sample = cleanedRoots[0] - 1;
    } else if (i === cleanedRoots.length) {
      sample = cleanedRoots[cleanedRoots.length - 1] + 1;
    } else {
      sample = (cleanedRoots[i - 1] + cleanedRoots[i]) / 2;
    }
    intervalSatisfies.push(satisfies(evalPoly(coeffs, sample)));
  }

  const pointSatisfies = cleanedRoots.map((r) => satisfies(evalPoly(coeffs, r)));

  // If all intervals and boundary points satisfy: All real numbers
  if (intervalSatisfies.every(Boolean) && pointSatisfies.every(Boolean)) {
    return 'All real numbers';
  }

  // If no interval and no boundary point satisfies: No solution
  if (intervalSatisfies.every((v) => !v) && pointSatisfies.every((v) => !v)) {
    return 'No solution';
  }

  // Single root (degree 2 repeated root, e.g. x² - 2x + 1 > 0 -> x < 1, 1 < x)
  if (cleanedRoots.length === 1) {
    const r = formatIneqNumber(cleanedRoots[0]);
    if (intervalSatisfies[0] && intervalSatisfies[1]) {
      if (!pointSatisfies[0]) {
        return `x${op}${r}, ${r}${op}x`;
      }
      return 'All real numbers';
    } else if (!intervalSatisfies[0] && !intervalSatisfies[1]) {
      if (pointSatisfies[0]) {
        return `x = ${r}`;
      }
      return 'No solution';
    }
  }

  // Two roots: r1 < r2 (e.g. x² - 5x + 6 > 0 -> x<2, 3<x or ≤ 0 -> 2≤x≤3)
  if (cleanedRoots.length === 2) {
    const r1 = formatIneqNumber(cleanedRoots[0]);
    const r2 = formatIneqNumber(cleanedRoots[1]);

    if (intervalSatisfies[0] && intervalSatisfies[2] && !intervalSatisfies[1]) {
      return `x${op}${r1}, ${r2}${op}x`;
    }
    if (intervalSatisfies[1] && !intervalSatisfies[0] && !intervalSatisfies[2]) {
      return `${r1}${op}x${op}${r2}`;
    }
  }

  // Three roots: r1 < r2 < r3 (e.g. x³ - 6x² + 11x - 6 > 0 -> 1<x<2, 3<x)
  if (cleanedRoots.length === 3) {
    const r1 = formatIneqNumber(cleanedRoots[0]);
    const r2 = formatIneqNumber(cleanedRoots[1]);
    const r3 = formatIneqNumber(cleanedRoots[2]);

    if (!intervalSatisfies[0] && intervalSatisfies[1] && !intervalSatisfies[2] && intervalSatisfies[3]) {
      return `${r1}${op}x${op}${r2}, ${r3}${op}x`;
    }
    if (intervalSatisfies[0] && !intervalSatisfies[1] && intervalSatisfies[2] && !intervalSatisfies[3]) {
      return `x${op}${r1}, ${r2}${op}x${op}${r3}`;
    }
  }

  // Degree 4 or general interval assemblage
  const parts: string[] = [];
  const nRoots = cleanedRoots.length;
  if (intervalSatisfies[0]) {
    parts.push(`x${op}${formatIneqNumber(cleanedRoots[0])}`);
  }
  for (let i = 1; i < nRoots; i++) {
    if (intervalSatisfies[i]) {
      parts.push(`${formatIneqNumber(cleanedRoots[i - 1])}${op}x${op}${formatIneqNumber(cleanedRoots[i])}`);
    }
  }
  if (intervalSatisfies[nRoots]) {
    parts.push(`${formatIneqNumber(cleanedRoots[nRoots - 1])}${op}x`);
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return 'No solution';
}

export const ineqModeModule: ModeModule = {
  id: 'INEQ',
  code: 'INEQ',
  name: 'Inequality',
  shortName: 'Inequality',
  menuNumber: 11,
  isImplemented: true,

  getIndicator: () => 'INEQ',

  keymap: {
    overrides: {
      OPTN: {
        label: 'OPTN',
        description: 'Change Degree or Inequality Form',
        action: (ctx) => {
          ctx.setModeState((prev) => ({ ...prev, screen: 'SELECT_DEGREE' }));
        },
      },
    },
  },

  getInitialState: (): ModeState => ({
    mode: 'INEQ',
    screen: 'SELECT_DEGREE',
    data: {
      degree: 2,
      compType: 1, // '>'
      coeffs: [1, -5, 6],
      currentCoeffIdx: 0,
      inputBuffer: '',
      solutionText: '',
    } as IneqData,
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;
    const data = (modeState.data || {}) as IneqData;

    // AC Key: Navigation & Reset logic
    if (key === 'AC' || key === 'ON') {
      if (modeState.screen === 'SOLUTIONS') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }
      if (modeState.screen === 'COEFF_INPUT') {
        if (data.inputBuffer) {
          // Clear current input buffer
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: '' },
          }));
          return true;
        }
        setModeState((prev) => ({ ...prev, screen: 'SELECT_FORM' }));
        return true;
      }
      if (modeState.screen === 'SELECT_FORM') {
        setModeState((prev) => ({ ...prev, screen: 'SELECT_DEGREE' }));
        return true;
      }
      if (modeState.screen === 'SELECT_DEGREE') {
        ctx.exitToCalc();
        return true;
      }
      return true;
    }

    // 1. SELECT_DEGREE Screen: Polynomial Degree (2 to 4)
    if (modeState.screen === 'SELECT_DEGREE') {
      if (key === '2' || key === '3' || key === '4') {
        const deg = parseInt(key, 10) as 2 | 3 | 4;
        const defaultCoeffs =
          deg === 2
            ? [1, -5, 6]
            : deg === 3
            ? [1, -6, 11, -6]
            : [1, 0, -5, 0, 4];

        setModeState((prev) => ({
          ...prev,
          screen: 'SELECT_FORM',
          data: {
            ...prev.data,
            degree: deg,
            coeffs: defaultCoeffs,
            currentCoeffIdx: 0,
            inputBuffer: '',
          },
        }));
        return true;
      }
      return true;
    }

    // 2. SELECT_FORM Screen: Choose Comparison Symbol (1: >, 2: <, 3: ≥, 4: ≤)
    if (modeState.screen === 'SELECT_FORM') {
      if (['1', '2', '3', '4'].includes(key)) {
        const compType = parseInt(key, 10) as 1 | 2 | 3 | 4;
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: {
            ...prev.data,
            compType,
            currentCoeffIdx: 0,
            inputBuffer: '',
          },
        }));
        return true;
      }
      return true;
    }

    // 3. COEFF_INPUT Screen: Coefficient Grid Editor with Comparison Symbol
    if (modeState.screen === 'COEFF_INPUT') {
      // Arrow keys navigation between coefficients
      if (key === 'LEFT' || key === '◄') {
        const cur = data.currentCoeffIdx || 0;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, currentCoeffIdx: Math.max(0, cur - 1), inputBuffer: '' },
        }));
        return true;
      }
      if (key === 'RIGHT' || key === '►') {
        const cur = data.currentCoeffIdx || 0;
        const maxIdx = (data.coeffs?.length || 3) - 1;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, currentCoeffIdx: Math.min(maxIdx, cur + 1), inputBuffer: '' },
        }));
        return true;
      }

      // Numeric & Negative sign input
      if (/^[0-9.]$/.test(key)) {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + key },
        }));
        return true;
      }

      if (key === '-' || key === '(−)' || key === '(-)') {
        setModeState((prev) => {
          const buf = prev.data.inputBuffer || '';
          const newBuf = buf.startsWith('-') ? buf.slice(1) : '-' + buf;
          return {
            ...prev,
            data: { ...prev.data, inputBuffer: newBuf },
          };
        });
        return true;
      }

      // Backspace / DEL
      if (key === 'DEL') {
        setModeState((prev) => {
          const buf = prev.data.inputBuffer || '';
          return {
            ...prev,
            data: { ...prev.data, inputBuffer: buf.slice(0, -1) },
          };
        });
        return true;
      }

      // [ = ] Key: Confirm coefficient or Solve
      if (key === '=') {
        const buf = data.inputBuffer;
        const curIdx = data.currentCoeffIdx || 0;
        const coeffs = [...(data.coeffs || [1, -5, 6])];

        if (buf !== '') {
          coeffs[curIdx] = parseFloat(buf) || 0;
        }

        if (curIdx < coeffs.length - 1) {
          // Advance to next coefficient
          setModeState((prev) => ({
            ...prev,
            data: {
              ...prev.data,
              coeffs,
              currentCoeffIdx: curIdx + 1,
              inputBuffer: '',
            },
          }));
        } else {
          // Solve inequality!
          const compSym = COMP_SYMBOLS[data.compType || 1] || '>';
          const sol = solveInequality(coeffs, compSym);
          setModeState((prev) => ({
            ...prev,
            screen: 'SOLUTIONS',
            data: {
              ...prev.data,
              coeffs,
              solutionText: sol,
              inputBuffer: '',
            },
          }));
        }
        return true;
      }
    }

    // 4. SOLUTIONS Screen
    if (modeState.screen === 'SOLUTIONS') {
      if (key === '=') {
        // Return to coefficient input
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }
      return true;
    }

    return false;
  },

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;
    const data = (modeState.data || {}) as IneqData;
    const degree = data.degree || 2;
    const compSym = COMP_SYMBOLS[data.compType || 1] || '>';

    // Screen 1: Select Degree
    if (modeState.screen === 'SELECT_DEGREE') {
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between items-center' },
          React.createElement('span', null, 'Polynomial Degree?'),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-text)]/70' }, 'INEQ')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5 text-xs my-auto pl-1' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-2' },
            React.createElement('span', { className: 'font-bold text-[var(--label-shift)] px-1 bg-[var(--display-text)]/15 border border-[var(--display-text)]/30 rounded' }, '2'),
            React.createElement('span', null, 'ax² + bx + c')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center gap-2' },
            React.createElement('span', { className: 'font-bold text-[var(--label-shift)] px-1 bg-[var(--display-text)]/15 border border-[var(--display-text)]/30 rounded' }, '3'),
            React.createElement('span', null, 'ax³ + bx² + cx + d')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center gap-2' },
            React.createElement('span', { className: 'font-bold text-[var(--label-shift)] px-1 bg-[var(--display-text)]/15 border border-[var(--display-text)]/30 rounded' }, '4'),
            React.createElement('span', null, 'ax⁴ + bx³ + cx² + dx + e')
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[9.5px] text-[var(--display-text)]/60 pt-1 border-t border-[var(--display-text)]/20 flex justify-between' },
          React.createElement('span', null, 'Select Degree (2 ~ 4)'),
          React.createElement('span', null, '[AC]: Exit')
        )
      );
    }

    // Screen 2: Select Comparison Form
    if (modeState.screen === 'SELECT_FORM') {
      const polyHead =
        degree === 2
          ? 'ax²+bx+c'
          : degree === 3
          ? 'ax³+...+d'
          : 'ax⁴+...+e';

      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between' },
          React.createElement('span', null, `${polyHead} 0`),
          React.createElement('span', { className: 'text-[10px] text-[var(--label-shift)]' }, `Degree ${degree}`)
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-2 gap-1.5 text-xs my-auto' },
          [
            { num: '1', sym: '>' },
            { num: '2', sym: '<' },
            { num: '3', sym: '≥' },
            { num: '4', sym: '≤' },
          ].map((item) =>
            React.createElement(
              'div',
              {
                key: item.num,
                className: 'px-2 py-1 rounded border border-[var(--display-text)]/25 bg-[var(--display-text)]/5 flex items-center justify-between',
              },
              React.createElement('span', { className: 'font-bold text-[var(--label-shift)] mr-1.5' }, `${item.num}:`),
              React.createElement('span', { className: 'font-semibold tracking-wider text-[var(--display-text)]' }, `${item.sym} 0`)
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[9.5px] text-[var(--display-text)]/60 pt-1 border-t border-[var(--display-text)]/20 flex justify-between' },
          React.createElement('span', null, 'Press [1] ~ [4]'),
          React.createElement('span', null, '[AC]: Back')
        )
      );
    }

    // Screen 3: Solutions Display
    if (modeState.screen === 'SOLUTIONS') {
      const sol = data.solutionText || 'No solution';
      const polyTitle =
        degree === 2
          ? `ax² + bx + c ${compSym} 0`
          : degree === 3
          ? `ax³ + bx² + cx + d ${compSym} 0`
          : `ax⁴ + bx³ + cx² + dx + e ${compSym} 0`;

      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between items-center' },
          React.createElement('span', { className: 'truncate pr-1' }, polyTitle),
          React.createElement('span', { className: 'text-[9.5px] text-[var(--label-shift)] shrink-0' }, 'INEQ')
        ),
        React.createElement(
          'div',
          { className: 'my-auto py-2 text-center' },
          React.createElement(
            'div',
            {
              className: 'text-base sm:text-lg font-bold tracking-wider text-[var(--display-text)] select-text px-1 break-words',
            },
            sol
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[9.5px] text-[var(--display-text)]/60 pt-1 border-t border-[var(--display-text)]/20 flex justify-between' },
          React.createElement('span', null, '[=] / [AC]: Edit Coeffs'),
          React.createElement('span', null, '[OPTN]: Form')
        )
      );
    }

    // Screen 4: Coefficient Grid Input Editor
    const labels = degree === 2 ? ['a', 'b', 'c'] : degree === 3 ? ['a', 'b', 'c', 'd'] : ['a', 'b', 'c', 'd', 'e'];
    const coeffs = data.coeffs || (degree === 2 ? [1, -5, 6] : degree === 3 ? [1, -6, 11, -6] : [1, 0, -5, 0, 4]);
    const curIdx = data.currentCoeffIdx || 0;
    const buf = data.inputBuffer;

    const polyHeader =
      degree === 2
        ? `ax² + bx + c ${compSym} 0`
        : degree === 3
        ? `ax³ + bx² + cx + d ${compSym} 0`
        : `ax⁴ + ... + e ${compSym} 0`;

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between p-2 font-mono select-none text-[var(--display-text)]' },
      React.createElement(
        'div',
        { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between items-center' },
        React.createElement('span', null, polyHeader),
        React.createElement('span', { className: 'text-[10px] text-[var(--label-shift)]' }, `Deg ${degree}`)
      ),
      React.createElement(
        'div',
        { className: 'flex justify-around items-center my-auto gap-1 text-xs px-0.5' },
        labels.map((label, idx) => {
          const isSelected = idx === curIdx;
          const displayVal = isSelected && buf !== '' ? buf : coeffs[idx] ?? 0;
          return React.createElement(
            'div',
            {
              key: label,
              className: `flex-1 py-1 px-1 border rounded text-center transition-all ${
                isSelected
                  ? 'border-[var(--label-shift)] bg-[var(--label-shift)]/15 font-bold text-[var(--label-shift)] shadow-[0_0_6px_rgba(229,169,60,0.25)]'
                  : 'border-[var(--display-text)]/25 bg-[var(--display-text)]/5 text-[var(--display-text)]'
              }`,
            },
            React.createElement('div', { className: 'text-[10px] opacity-75 uppercase' }, `${label}=`),
            React.createElement(
              'div',
              { className: 'text-sm font-semibold truncate', title: String(displayVal) },
              String(displayVal)
            )
          );
        })
      ),
      React.createElement(
        'div',
        { className: 'text-[9.5px] text-[var(--display-text)]/60 pt-1 border-t border-[var(--display-text)]/20 flex justify-between' },
        React.createElement('span', null, 'Enter number, press [=]'),
        React.createElement('span', null, '◄ ►: Move')
      )
    );
  },
};
