/**
 * fx-570EX ClassWiz - EQN (Equation/Func) Mode Module
 * 
 * Mode ID: EQN
 * Indicator: 'EQN'
 * Sub-Menu:
 * 1: Simul Equation (2 to 4 Unknowns)
 * 2: Polynomial (Degree 2 to 4)
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext } from './types';

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
      degree: 2,
      coeffs: [1, -5, 6], // x² - 5x + 6 = 0 -> x1=3, x2=2
      currentCoeffIdx: 0,
      inputBuffer: '',
      solutions: null,
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    if (key === 'AC' || key === 'ON') {
      if (modeState.screen === 'SOLUTIONS') {
        setModeState((prev) => ({ ...prev, screen: 'COEFF_INPUT' }));
      } else {
        setModeState((prev) => ({ ...prev, screen: 'SELECT_TYPE' }));
      }
      return true;
    }

    // Select Type screen
    if (modeState.screen === 'SELECT_TYPE') {
      if (key === '1') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, eqnType: 'SIMUL', degree: 2, coeffs: [1, 1, 5, 2, -1, 4] },
        }));
        return true;
      }
      if (key === '2') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, eqnType: 'POLY', degree: 2, coeffs: [1, -5, 6] },
        }));
        return true;
      }
      return true;
    }

    // Coeff input
    if (modeState.screen === 'COEFF_INPUT') {
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
        const coeffs = [...(modeState.data.coeffs || [1, -5, 6])];

        if (buf) {
          coeffs[curIdx] = parseFloat(buf) || 0;
        }

        if (curIdx < coeffs.length - 1) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, coeffs, currentCoeffIdx: curIdx + 1, inputBuffer: '' },
          }));
        } else {
          // Solve equation
          // For degree 2: ax² + bx + c = 0
          const [a, b, c] = coeffs;
          const disc = b * b - 4 * a * c;
          let sols = [];
          if (disc >= 0) {
            const x1 = (-b + Math.sqrt(disc)) / (2 * a);
            const x2 = (-b - Math.sqrt(disc)) / (2 * a);
            sols = [`x₁ = ${parseFloat(x1.toFixed(5))}`, `x₂ = ${parseFloat(x2.toFixed(5))}`];
          } else {
            const real = (-b / (2 * a)).toFixed(3);
            const imag = (Math.sqrt(-disc) / (2 * a)).toFixed(3);
            sols = [`x₁ = ${real} + ${imag}i`, `x₂ = ${real} - ${imag}i`];
          }

          setModeState((prev) => ({
            ...prev,
            screen: 'SOLUTIONS',
            data: { ...prev.data, coeffs, solutions: sols, solIndex: 0 },
          }));
        }
        return true;
      }
    }

    return false;
  },

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;

    // Type selection
    if (modeState.screen === 'SELECT_TYPE') {
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-emerald-300 select-none' },
        React.createElement('div', { className: 'text-xs font-bold border-b border-emerald-950/40 pb-1 text-emerald-400' }, 'Equation/Func'),
        React.createElement(
          'div',
          { className: 'space-y-1.5 text-xs my-auto' },
          React.createElement('div', null, React.createElement('span', { className: 'font-bold mr-1.5 text-amber-300' }, '1:'), 'Simul Equation'),
          React.createElement('div', null, React.createElement('span', { className: 'font-bold mr-1.5 text-amber-300' }, '2:'), 'Polynomial')
        ),
        React.createElement('div', { className: 'text-[9px] text-emerald-500/80 text-right pt-1 border-t border-emerald-950/40' }, '[1] or [2] to select')
      );
    }

    // Solutions screen (Answer Display)
    if (modeState.screen === 'SOLUTIONS') {
      const sols = modeState.data.solutions || [];
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-emerald-300 select-none' },
        React.createElement('div', { className: 'text-xs font-bold border-b border-emerald-950/40 pb-1 text-amber-400' }, 'Solutions:'),
        React.createElement(
          'div',
          { 
            className: 'space-y-1.5 text-sm sm:text-base my-auto font-bold text-emerald-200 tracking-wider',
            style: { textShadow: '0 0 3px rgba(110,231,183,0.3)' }
          },
          sols.map((s: string, idx: number) =>
            React.createElement('div', { key: idx }, s)
          )
        ),
        React.createElement('div', { className: 'text-[9px] text-emerald-500/80 text-right pt-1 border-t border-emerald-950/40' }, '[AC] Edit Coefficients')
      );
    }

    // Coeff input
    const coeffs = modeState.data.coeffs || [1, -5, 6];
    const curIdx = modeState.data.currentCoeffIdx || 0;
    const buf = modeState.data.inputBuffer;

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between p-2 font-mono select-none' },
      React.createElement(
        'div',
        { className: 'text-xs font-bold border-b border-emerald-950/40 pb-1 text-emerald-400' },
        'ax² + bx + c = 0'
      ),
      React.createElement(
        'div',
        { className: 'flex justify-around items-center my-auto text-xs' },
        ['a', 'b', 'c'].map((label, idx) =>
          React.createElement(
            'div',
            {
              key: idx,
              className: `px-2.5 py-1 border rounded text-center ${idx === curIdx ? 'border-amber-400 bg-amber-950/40 font-bold text-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.3)]' : 'border-emerald-900/60 bg-emerald-950/20 text-emerald-300'}`
            },
            React.createElement('div', { className: 'text-[10px] text-emerald-500/80' }, `${label}=`),
            React.createElement('div', { className: 'text-sm font-semibold' }, idx === curIdx && buf ? buf : coeffs[idx])
          )
        )
      ),
      React.createElement('div', { className: 'text-[9px] text-emerald-500/80 text-right pt-1 border-t border-emerald-950/40' }, 'Enter number, press [=]')
    );
  },
};
