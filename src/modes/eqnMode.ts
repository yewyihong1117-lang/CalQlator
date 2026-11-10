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

function cleanNumber(val: number): string {
  if (Math.abs(val) < 1e-12) return '0';
  const fixed = val.toFixed(5);
  const clean = parseFloat(fixed).toString();
  return clean === '-0' ? '0' : clean;
}

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

export function solveCubic(a: number, b: number, c: number, d: number): string[] {
  if (Math.abs(a) < 1e-12) {
    return solveQuadratic(b, c, d);
  }

  // Depressed cubic t³ + pt + q = 0 via x = t - b/(3a)
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
    // 3 distinct real roots (Trigonometric method)
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
    // 1 real root, 2 complex conjugate roots (Cardano's method)
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
      eqnType: 'POLY', // 'SIMUL' | 'POLY'
      degree: 2, // 2 | 3
      coeffs: [1, -5, 6], // Default: x² - 5x + 6 = 0
      currentCoeffIdx: 0,
      inputBuffer: '',
      solutions: null,
      solIndex: 0,
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    if (key === 'AC' || key === 'ON') {
      if (modeState.screen === 'SOLUTIONS') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, inputBuffer: '', currentCoeffIdx: 0 },
        }));
      } else if (modeState.screen === 'SELECT_DEGREE') {
        setModeState((prev) => ({ ...prev, screen: 'SELECT_TYPE' }));
      } else {
        setModeState((prev) => ({ ...prev, screen: 'SELECT_TYPE' }));
      }
      return true;
    }

    // 1. Select Equation Type screen
    if (modeState.screen === 'SELECT_TYPE') {
      if (key === '1') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, eqnType: 'SIMUL', degree: 2, coeffs: [1, 1, 5, 2, -1, 4], currentCoeffIdx: 0, inputBuffer: '' },
        }));
        return true;
      }
      if (key === '2') {
        setModeState((prev) => ({
          ...prev,
          screen: 'SELECT_DEGREE',
        }));
        return true;
      }
      return true;
    }

    // 2. Select Degree screen for Polynomial
    if (modeState.screen === 'SELECT_DEGREE') {
      if (key === '2') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, eqnType: 'POLY', degree: 2, coeffs: [1, -5, 6], currentCoeffIdx: 0, inputBuffer: '' },
        }));
        return true;
      }
      if (key === '3') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, eqnType: 'POLY', degree: 3, coeffs: [1, -6, 11, -6], currentCoeffIdx: 0, inputBuffer: '' },
        }));
        return true;
      }
      return true;
    }

    // 3. Coefficient Input screen
    if (modeState.screen === 'COEFF_INPUT') {
      if (key === 'LEFT') {
        setModeState((prev) => {
          const cur = prev.data.currentCoeffIdx || 0;
          const max = (prev.data.coeffs?.length || 3) - 1;
          const nextIdx = cur > 0 ? cur - 1 : max;
          return {
            ...prev,
            data: { ...prev.data, currentCoeffIdx: nextIdx, inputBuffer: '' },
          };
        });
        return true;
      }

      if (key === 'RIGHT') {
        setModeState((prev) => {
          const cur = prev.data.currentCoeffIdx || 0;
          const max = (prev.data.coeffs?.length || 3) - 1;
          const nextIdx = cur < max ? cur + 1 : 0;
          return {
            ...prev,
            data: { ...prev.data, currentCoeffIdx: nextIdx, inputBuffer: '' },
          };
        });
        return true;
      }

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

      if (/^[0-9.\-]$/.test(key)) {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + key },
        }));
        return true;
      }

      if (key === '=') {
        const buf = modeState.data.inputBuffer;
        const curIdx = modeState.data.currentCoeffIdx || 0;
        const degree = modeState.data.degree || 2;
        const defaultCoeffs = degree === 3 ? [1, -6, 11, -6] : [1, -5, 6];
        const coeffs = [...(modeState.data.coeffs || defaultCoeffs)];

        if (buf && buf !== '-' && buf !== '.') {
          coeffs[curIdx] = parseFloat(buf) || 0;
        }

        if (curIdx < coeffs.length - 1) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, coeffs, currentCoeffIdx: curIdx + 1, inputBuffer: '' },
          }));
        } else {
          // Final coefficient entered: solve equation!
          let sols: string[] = [];
          if (degree === 3) {
            sols = solveCubic(coeffs[0], coeffs[1], coeffs[2], coeffs[3]);
          } else {
            sols = solveQuadratic(coeffs[0], coeffs[1], coeffs[2]);
          }

          setModeState((prev) => ({
            ...prev,
            screen: 'SOLUTIONS',
            data: { ...prev.data, coeffs, solutions: sols, solIndex: 0, inputBuffer: '' },
          }));
        }
        return true;
      }
    }

    // 4. Solutions Display screen
    if (modeState.screen === 'SOLUTIONS') {
      const sols = modeState.data.solutions || [];
      if (key === 'DOWN' || key === '=') {
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            solIndex: ((prev.data.solIndex || 0) + 1) % Math.max(1, sols.length),
          },
        }));
        return true;
      }
      if (key === 'UP') {
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            solIndex: ((prev.data.solIndex || 0) - 1 + sols.length) % Math.max(1, sols.length),
          },
        }));
        return true;
      }
      return true;
    }

    return false;
  },

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;

    // 1. Select Type
    if (modeState.screen === 'SELECT_TYPE') {
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between' },
          React.createElement('span', null, 'Equation/Func'),
          React.createElement('span', { className: 'text-[9.5px] opacity-70 font-normal' }, 'EQN')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5 text-xs my-auto' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-1.5' },
            React.createElement('span', { className: 'font-bold px-1 py-0.5 rounded bg-[var(--display-text)]/15 text-[var(--label-shift)] text-[10px]' }, '1:'),
            React.createElement('span', { className: 'font-semibold' }, 'Simul Equation')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center gap-1.5' },
            React.createElement('span', { className: 'font-bold px-1 py-0.5 rounded bg-[var(--display-text)]/15 text-[var(--label-shift)] text-[10px]' }, '2:'),
            React.createElement('span', { className: 'font-semibold' }, 'Polynomial')
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-1 border-t border-[var(--display-text)]/20' },
          'Press [1] or [2] to select'
        )
      );
    }

    // 2. Select Degree for Polynomial
    if (modeState.screen === 'SELECT_DEGREE') {
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between' },
          React.createElement('span', null, 'Polynomial Degree?'),
          React.createElement('span', { className: 'text-[9.5px] opacity-70 font-normal' }, '2 ~ 3')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5 text-xs my-auto' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between px-2 py-1 rounded border border-[var(--display-text)]/20 bg-[var(--display-text)]/5' },
            React.createElement('span', { className: 'font-bold text-[var(--label-shift)] mr-2' }, '2:'),
            React.createElement('span', { className: 'font-medium flex-1 text-left' }, 'ax² + bx + c = 0'),
            React.createElement('span', { className: 'text-[9.5px] opacity-70' }, 'Degree 2')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center justify-between px-2 py-1 rounded border border-[var(--display-text)]/20 bg-[var(--display-text)]/5' },
            React.createElement('span', { className: 'font-bold text-[var(--label-shift)] mr-2' }, '3:'),
            React.createElement('span', { className: 'font-medium flex-1 text-left' }, 'ax³ + bx² + cx + d = 0'),
            React.createElement('span', { className: 'text-[9.5px] opacity-70' }, 'Degree 3')
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-1 border-t border-[var(--display-text)]/20 flex justify-between' },
          React.createElement('span', null, '[AC] Back'),
          React.createElement('span', null, 'Press [2] or [3]')
        )
      );
    }

    // 3. Solutions screen (Answer Display)
    if (modeState.screen === 'SOLUTIONS') {
      const sols = modeState.data.solutions || [];
      const degree = modeState.data.degree || 2;
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-0.5 text-[var(--label-shift)] flex justify-between items-center' },
          React.createElement('span', null, `Poly Degree ${degree} Solutions:`),
          React.createElement('span', { className: 'text-[9px] text-[var(--display-text)]/70 font-normal' }, '▲▼ [=]')
        ),
        React.createElement(
          'div',
          { className: 'space-y-1 my-auto overflow-y-auto no-scrollbar font-bold text-sm sm:text-base tracking-wider' },
          sols.map((s: string, idx: number) =>
            React.createElement(
              'div',
              {
                key: idx,
                className: `px-2 py-0.5 rounded transition-colors flex items-center justify-between ${
                  idx === (modeState.data.solIndex || 0)
                    ? 'bg-[var(--display-text)]/20 text-[var(--display-text)] border border-[var(--display-text)]/40'
                    : 'text-[var(--display-text)]/85'
                }`,
              },
              React.createElement('span', null, s),
              idx === (modeState.data.solIndex || 0) && React.createElement('span', { className: 'text-[10px] text-[var(--label-shift)]' }, '◄')
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-0.5 border-t border-[var(--display-text)]/20 flex justify-between' },
          React.createElement('span', null, '[AC] Edit Coeffs'),
          React.createElement('span', null, '[▲▼] Next Root')
        )
      );
    }

    // 4. Coefficient input table
    const degree = modeState.data.degree || 2;
    const defaultCoeffs = degree === 3 ? [1, -6, 11, -6] : [1, -5, 6];
    const coeffs = modeState.data.coeffs || defaultCoeffs;
    const curIdx = modeState.data.currentCoeffIdx || 0;
    const buf = modeState.data.inputBuffer;
    const labels = degree === 3 ? ['a', 'b', 'c', 'd'] : ['a', 'b', 'c'];
    const formula = degree === 3 ? 'ax³ + bx² + cx + d = 0' : 'ax² + bx + c = 0';

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between p-2 font-mono select-none text-[var(--display-text)]' },
      React.createElement(
        'div',
        { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-0.5 text-[var(--label-shift)] flex justify-between' },
        React.createElement('span', null, formula),
        React.createElement('span', { className: 'text-[9px] text-[var(--display-text)]/70 font-normal' }, `Deg ${degree}`)
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
              className: `flex-1 min-w-[50px] max-w-[80px] px-1.5 py-1 border rounded text-center transition-all ${
                isSelected
                  ? 'border-[var(--label-shift)] bg-[var(--label-shift)]/15 font-bold text-[var(--label-shift)] shadow-[0_0_6px_rgba(229,169,60,0.25)]'
                  : 'border-[var(--display-text)]/25 bg-[var(--display-text)]/5 text-[var(--display-text)]'
              }`,
            },
            React.createElement('div', { className: 'text-[9.5px] opacity-75' }, `${label}=`),
            React.createElement('div', { className: 'text-xs sm:text-sm font-semibold truncate' }, displayVal)
          );
        })
      ),
      React.createElement(
        'div',
        { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-0.5 border-t border-[var(--display-text)]/20 flex justify-between' },
        React.createElement('span', null, '[◄►] Move  [DEL] Clear'),
        React.createElement('span', null, 'Type value, press [=]')
      )
    );
  },
};
