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
 *   3: axⁿ + ... ≥ 0 (>= 0)
 *   4: axⁿ + ... ≤ 0 (<= 0)
 * - Authentic coefficient grid editor with the active comparison symbol header.
 *   Cells accept full mathematical expressions (fractions, square roots, pi, Ans).
 *   Arrow keys navigate smoothly between cells, [=] confirms.
 * - Solution screen displaying exact intervals as the real ClassWiz unit does:
 *   e.g. "x < -1, x > 1", "-1 <= x <= 1", "All real numbers", "No solution",
 *   "x = 1", "1 < x < 2, x > 3", "-2 <= x <= -1, 1 <= x <= 2", "Math ERROR"
 * - Multi-interval navigation with arrow keys [▲▼].
 * - Strict theme styling using only global CSS tokens:
 *   var(--display-text), var(--display-bg), var(--label-shift).
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext } from './types';
import { evaluateMathExpression } from '../calcEngine';
import {
  solveInequality,
  findPolynomialRealRoots,
  evalPoly,
  cleanNumber,
} from './polySolver';

export { solveInequality, findPolynomialRealRoots, evalPoly, cleanNumber };

export type IneqComparison = '>' | '<' | '≥' | '≤' | '>=' | '<=';

export interface IneqData {
  degree: 2 | 3 | 4;
  compType: 1 | 2 | 3 | 4;
  cursorDegree?: number;
  cursorCompType?: number;
  coeffs: number[]; // length = degree + 1 (e.g. [a, b, c] for deg 2)
  coeffRawTexts?: string[];
  currentCoeffIdx: number;
  inputBuffer: string;
  solutionText: string;
  solutionParts?: string[];
  selectedSolutionIdx?: number;
}

export const COMP_SYMBOLS: Record<number, IneqComparison> = {
  1: '>',
  2: '<',
  3: '>=',
  4: '<=',
};

export const COMP_UNICODE_SYMBOLS: Record<number, string> = {
  1: '>',
  2: '<',
  3: '≥',
  4: '≤',
};

// Format coefficient value for compact display inside grid cells
export function formatCellDisplay(val: number, rawText?: string): string {
  if (rawText && rawText.trim() !== '') {
    return rawText;
  }
  return cleanNumber(val);
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
      cursorDegree: 2,
      cursorCompType: 1,
      coeffs: [1, 0, -1],
      coeffRawTexts: ['1', '0', '-1'],
      currentCoeffIdx: 0,
      inputBuffer: '',
      solutionText: '',
      solutionParts: [],
      selectedSolutionIdx: 0,
    } as IneqData,
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;
    const data = (modeState.data || {}) as IneqData;
    const degree = data.degree || 2;

    // ==========================================
    // AC & ON Navigation
    // ==========================================
    if (key === 'AC' || key === 'ON') {
      if (modeState.screen === 'SOLUTIONS') {
        // Return to coefficient input without losing values
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }
      if (modeState.screen === 'COEFF_INPUT') {
        if (data.inputBuffer && data.inputBuffer.length > 0) {
          // Clear current cell buffer only
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: '' },
          }));
          return true;
        }
        // Go back to Form selection
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

    // ==========================================
    // 1. SELECT_DEGREE Screen: Choose Degree (2, 3, 4)
    // ==========================================
    if (modeState.screen === 'SELECT_DEGREE') {
      const curDeg = data.cursorDegree || 2;

      // Arrow navigation
      if (key === 'UP' || key === '▲') {
        const nextDeg = curDeg <= 2 ? 4 : curDeg - 1;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, cursorDegree: nextDeg },
        }));
        return true;
      }
      if (key === 'DOWN' || key === '▼') {
        const nextDeg = curDeg >= 4 ? 2 : curDeg + 1;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, cursorDegree: nextDeg },
        }));
        return true;
      }

      // Confirm with [=] or direct number key [2], [3], [4]
      let selectedDeg: 2 | 3 | 4 | null = null;
      if (key === '2' || key === '3' || key === '4') {
        selectedDeg = parseInt(key, 10) as 2 | 3 | 4;
      } else if (key === '=') {
        selectedDeg = (curDeg as 2 | 3 | 4) || 2;
      }

      if (selectedDeg !== null) {
        const defaultCoeffs =
          selectedDeg === 2
            ? [1, 0, -1]
            : selectedDeg === 3
            ? [1, -6, 11, -6]
            : [1, 0, -5, 0, 4];
        const defaultTexts = defaultCoeffs.map(String);

        setModeState((prev) => ({
          ...prev,
          screen: 'SELECT_FORM',
          data: {
            ...prev.data,
            degree: selectedDeg,
            cursorDegree: selectedDeg,
            coeffs: defaultCoeffs,
            coeffRawTexts: defaultTexts,
            currentCoeffIdx: 0,
            inputBuffer: '',
          },
        }));
        return true;
      }

      return true;
    }

    // ==========================================
    // 2. SELECT_FORM Screen: Choose Operator (1: >, 2: <, 3: >=, 4: <=)
    // ==========================================
    if (modeState.screen === 'SELECT_FORM') {
      const curForm = data.cursorCompType || 1;

      // Arrow navigation
      if (key === 'UP' || key === '▲') {
        const nextForm = curForm <= 1 ? 4 : curForm - 1;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, cursorCompType: nextForm },
        }));
        return true;
      }
      if (key === 'DOWN' || key === '▼') {
        const nextForm = curForm >= 4 ? 1 : curForm + 1;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, cursorCompType: nextForm },
        }));
        return true;
      }
      if (key === 'LEFT' || key === '◄') {
        setModeState((prev) => ({ ...prev, screen: 'SELECT_DEGREE' }));
        return true;
      }

      // Confirm with [=] or direct number key [1], [2], [3], [4]
      let selectedForm: 1 | 2 | 3 | 4 | null = null;
      if (['1', '2', '3', '4'].includes(key)) {
        selectedForm = parseInt(key, 10) as 1 | 2 | 3 | 4;
      } else if (key === '=') {
        selectedForm = (curForm as 1 | 2 | 3 | 4) || 1;
      }

      if (selectedForm !== null) {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: {
            ...prev.data,
            compType: selectedForm,
            cursorCompType: selectedForm,
            currentCoeffIdx: 0,
            inputBuffer: '',
          },
        }));
        return true;
      }

      return true;
    }

    // ==========================================
    // 3. COEFF_INPUT Screen: Coefficient Grid Editor
    // ==========================================
    if (modeState.screen === 'COEFF_INPUT') {
      const curIdx = data.currentCoeffIdx || 0;
      const numCoeffs = degree + 1;
      const coeffs = [...(data.coeffs || [1, 0, -1])];
      const rawTexts = [...(data.coeffRawTexts || coeffs.map(String))];
      while (coeffs.length < numCoeffs) coeffs.push(0);
      while (rawTexts.length < numCoeffs) rawTexts.push('0');

      // Helper to commit current input buffer into active cell
      const commitCurrentCell = (buf: string) => {
        if (buf.trim() === '') return;
        try {
          const evalRes = evaluateMathExpression(
            buf,
            ctx.angleMode,
            { ...ctx.sharedMemory },
            ctx.sharedMemory.Ans
          );
          if (evalRes && evalRes.success && typeof evalRes.result === 'number' && !isNaN(evalRes.result)) {
            coeffs[curIdx] = evalRes.result;
            rawTexts[curIdx] = buf;
          } else {
            const num = parseFloat(buf);
            if (!isNaN(num)) {
              coeffs[curIdx] = num;
              rawTexts[curIdx] = buf;
            }
          }
        } catch {
          const num = parseFloat(buf);
          if (!isNaN(num)) {
            coeffs[curIdx] = num;
            rawTexts[curIdx] = buf;
          }
        }
      };

      // Arrow navigation
      if (key === 'LEFT' || key === '◄' || key === 'UP' || key === '▲') {
        if (data.inputBuffer) {
          commitCurrentCell(data.inputBuffer);
        }
        const newIdx = curIdx <= 0 ? numCoeffs - 1 : curIdx - 1;
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            coeffs,
            coeffRawTexts: rawTexts,
            currentCoeffIdx: newIdx,
            inputBuffer: '',
          },
        }));
        return true;
      }

      if (key === 'RIGHT' || key === '►' || key === 'DOWN' || key === '▼') {
        if (data.inputBuffer) {
          commitCurrentCell(data.inputBuffer);
        }
        const newIdx = curIdx >= numCoeffs - 1 ? 0 : curIdx + 1;
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            coeffs,
            coeffRawTexts: rawTexts,
            currentCoeffIdx: newIdx,
            inputBuffer: '',
          },
        }));
        return true;
      }

      // DEL key: Backspace
      if (key === 'DEL') {
        const buf = data.inputBuffer || '';
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: buf.slice(0, -1) },
        }));
        return true;
      }

      // Mathematical expression input keys
      if (/^[0-9.]$/.test(key)) {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + key },
        }));
        return true;
      }

      if (key === '+' || key === '-' || key === '×' || key === '*' || key === '÷' || key === '/' || key === '^' || key === '(' || key === ')') {
        const mapped = key === '×' ? '*' : key === '÷' ? '/' : key;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + mapped },
        }));
        return true;
      }

      if (key === '(-)' || key === '(−)') {
        setModeState((prev) => {
          const buf = prev.data.inputBuffer || '';
          return {
            ...prev,
            data: { ...prev.data, inputBuffer: buf + '-' },
          };
        });
        return true;
      }

      if (key === '■/□') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + '/' },
        }));
        return true;
      }

      if (key === '√' || key === 'sqrt') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + '√(' },
        }));
        return true;
      }

      if (key === 'x²') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + '^2' },
        }));
        return true;
      }

      if (key === 'x³') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + '^3' },
        }));
        return true;
      }

      if (key === 'x⁻¹') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + '^(-1)' },
        }));
        return true;
      }

      if (key === 'π' || key === 'pi') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + 'π' },
        }));
        return true;
      }

      if (key === 'e') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + 'e' },
        }));
        return true;
      }

      if (key === 'Ans') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, inputBuffer: (prev.data.inputBuffer || '') + 'Ans' },
        }));
        return true;
      }

      // [ = ] Key: Confirm coefficient or Solve
      if (key === '=') {
        const buf = data.inputBuffer;
        if (buf !== '') {
          commitCurrentCell(buf);
        }

        if (curIdx < numCoeffs - 1) {
          // Advance to next coefficient
          setModeState((prev) => ({
            ...prev,
            data: {
              ...prev.data,
              coeffs,
              coeffRawTexts: rawTexts,
              currentCoeffIdx: curIdx + 1,
              inputBuffer: '',
            },
          }));
          return true;
        } else {
          // Solve inequality!
          const compSym = COMP_SYMBOLS[data.compType || 1] || '>';
          let sol = '';
          if (Math.abs(coeffs[0]) < 1e-12) {
            sol = 'Math ERROR';
          } else {
            sol = solveInequality(coeffs, compSym);
          }

          const parts = sol.includes(', ') ? sol.split(', ') : [sol];

          setModeState((prev) => ({
            ...prev,
            screen: 'SOLUTIONS',
            data: {
              ...prev.data,
              coeffs,
              coeffRawTexts: rawTexts,
              solutionText: sol,
              solutionParts: parts,
              selectedSolutionIdx: 0,
              inputBuffer: '',
            },
          }));
          return true;
        }
      }

      return false;
    }

    // ==========================================
    // 4. SOLUTIONS Screen: Display & Navigate Intervals
    // ==========================================
    if (modeState.screen === 'SOLUTIONS') {
      const parts = data.solutionParts || (data.solutionText ? [data.solutionText] : []);
      const curIdx = data.selectedSolutionIdx || 0;

      // Navigate multiple interval components with UP/DOWN
      if (key === 'UP' || key === '▲') {
        if (parts.length > 1) {
          const nextIdx = curIdx <= 0 ? parts.length - 1 : curIdx - 1;
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, selectedSolutionIdx: nextIdx },
          }));
          return true;
        }
        return true;
      }

      if (key === 'DOWN' || key === '▼') {
        if (parts.length > 1) {
          const nextIdx = curIdx >= parts.length - 1 ? 0 : curIdx + 1;
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, selectedSolutionIdx: nextIdx },
          }));
          return true;
        }
        return true;
      }

      // Return to coefficient editing with [=]
      if (key === '=') {
        setModeState((prev) => ({
          ...prev,
          screen: 'COEFF_INPUT',
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }

      return false;
    }

    return false;
  },

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;
    const data = (modeState.data || {}) as IneqData;
    const degree = data.degree || 2;
    const compSym = COMP_UNICODE_SYMBOLS[data.compType || 1] || '>';

    // ----------------------------------------------------
    // Screen 1: Select Degree (2, 3, 4)
    // ----------------------------------------------------
    if (modeState.screen === 'SELECT_DEGREE') {
      const curDeg = data.cursorDegree || 2;
      const degOptions = [
        { num: 2, label: 'ax² + bx + c' },
        { num: 3, label: 'ax³ + bx² + cx + d' },
        { num: 4, label: 'ax⁴ + bx³ + cx² + dx + e' },
      ];

      return React.createElement(
        'div',
        {
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, 'Polynomial Degree?'),
          React.createElement(
            'span',
            { className: 'text-[10px] font-normal text-[var(--display-muted)] tracking-wider' },
            'INEQ'
          )
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5 text-xs my-auto' },
          degOptions.map((opt) => {
            const isSelected = curDeg === opt.num;
            return React.createElement(
              'div',
              {
                key: opt.num,
                className: `flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-[var(--ui-accent-tonal)] border-[var(--ui-accent)] text-[var(--ui-accent)] font-semibold'
                    : 'bg-[var(--display-surface)] border-[var(--display-divider)] text-[var(--display-text)]'
                }`,
              },
              React.createElement(
                'span',
                {
                  className: `font-bold px-1.5 py-0.5 rounded text-[11px] border ${
                    isSelected
                      ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)]'
                      : 'border-[var(--display-divider)] bg-[var(--display-bg)] text-[var(--display-muted)]'
                  }`,
                },
                String(opt.num)
              ),
              React.createElement('span', { className: 'truncate text-xs' }, opt.label)
            );
          })
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between',
          },
          React.createElement('span', null, 'Select Degree (2 ~ 4)'),
          React.createElement('span', null, '[▲▼]: Move  [=]: OK')
        )
      );
    }

    // ----------------------------------------------------
    // Screen 2: Select Comparison Form
    // ----------------------------------------------------
    if (modeState.screen === 'SELECT_FORM') {
      const curComp = data.cursorCompType || 1;
      const polyHead =
        degree === 2
          ? 'ax²+bx+c'
          : degree === 3
          ? 'ax³+...+d'
          : 'ax⁴+...+e';

      const forms = [
        { num: 1, sym: '>' },
        { num: 2, sym: '<' },
        { num: 3, sym: '≥' },
        { num: 4, sym: '≤' },
      ];

      return React.createElement(
        'div',
        {
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', null, `${polyHead} 0`),
          React.createElement(
            'span',
            { className: 'text-[10px] font-normal text-[var(--display-muted)]' },
            `Degree ${degree}`
          )
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-2 gap-1.5 text-xs my-auto' },
          forms.map((item) => {
            const isSelected = curComp === item.num;
            return React.createElement(
              'div',
              {
                key: item.num,
                className: `px-2.5 py-1.5 rounded-xl border flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold'
                    : 'border-[var(--display-divider)] bg-[var(--display-surface)] text-[var(--display-text)]'
                }`,
              },
              React.createElement(
                'span',
                {
                  className: `font-bold mr-1.5 ${
                    isSelected ? 'text-[var(--ui-accent)]' : 'text-[var(--display-muted)]'
                  }`,
                },
                `${item.num}:`
              ),
              React.createElement(
                'span',
                { className: 'font-semibold tracking-wider text-sm' },
                `${item.sym} 0`
              )
            );
          })
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between',
          },
          React.createElement('span', null, 'Press [1] ~ [4] or [=]'),
          React.createElement('span', null, '[AC]: Back')
        )
      );
    }

    // ----------------------------------------------------
    // Screen 3: Solutions Display
    // ----------------------------------------------------
    if (modeState.screen === 'SOLUTIONS') {
      const sol = data.solutionText || 'No solution';
      const parts = data.solutionParts || [sol];
      const curPartIdx = data.selectedSolutionIdx || 0;
      const polyTitle =
        degree === 2
          ? `ax² + bx + c ${compSym} 0`
          : degree === 3
          ? `ax³ + bx² + cx + d ${compSym} 0`
          : `ax⁴ + ... + e ${compSym} 0`;

      return React.createElement(
        'div',
        {
          className:
            'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
          },
          React.createElement('span', { className: 'truncate pr-1' }, polyTitle),
          React.createElement(
            'div',
            { className: 'flex items-center gap-1.5 text-[10px] shrink-0' },
            parts.length > 1
              ? React.createElement(
                  'span',
                  {
                    className:
                      'px-1.5 py-0.5 rounded bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-semibold',
                  },
                  `${curPartIdx + 1}/${parts.length}`
                )
              : null,
            React.createElement(
              'span',
              { className: 'text-[var(--display-muted)] font-normal' },
              'INEQ'
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'my-auto py-1 text-right flex flex-col items-end justify-center' },
          React.createElement(
            'div',
            {
              className:
                'text-2xl sm:text-3xl font-light tracking-tight text-[var(--display-text)] select-text break-words max-w-full',
            },
            sol
          ),
          parts.length > 1
            ? React.createElement(
                'div',
                {
                  className:
                    'mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-lg border border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)]',
                },
                `Interval [${curPartIdx + 1}]: ${parts[curPartIdx]}`
              )
            : null
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-1 border-t border-[var(--display-divider)] flex justify-between items-center',
          },
          React.createElement(
            'span',
            null,
            parts.length > 1 ? '[▲▼]: Browse intervals' : '[=] / [AC]: Edit Coeffs'
          ),
          React.createElement('span', null, '[OPTN]: Form')
        )
      );
    }

    // ----------------------------------------------------
    // Screen 4: Coefficient Grid Input Editor
    // ----------------------------------------------------
    const labels =
      degree === 2
        ? ['a', 'b', 'c']
        : degree === 3
        ? ['a', 'b', 'c', 'd']
        : ['a', 'b', 'c', 'd', 'e'];

    const coeffs = data.coeffs || [1, 0, -1];
    const rawTexts = data.coeffRawTexts || coeffs.map(String);
    const curIdx = data.currentCoeffIdx || 0;
    const buf = data.inputBuffer;

    const polyHeader =
      degree === 2
        ? `ax² + bx + c ${compSym} 0`
        : degree === 3
        ? `ax³ + bx² + cx + d ${compSym} 0`
        : `ax⁴ + ... + e ${compSym} 0`;

    const activeLabel = labels[curIdx] || 'a';
    const activeValue = buf !== '' ? buf : formatCellDisplay(coeffs[curIdx] ?? 0, rawTexts[curIdx]);

    return React.createElement(
      'div',
      {
        className:
          'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
      },
      React.createElement(
        'div',
        {
          className:
            'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)] flex justify-between items-center',
        },
        React.createElement('span', null, polyHeader),
        React.createElement(
          'span',
          { className: 'text-[10px] font-normal text-[var(--display-muted)]' },
          `Deg ${degree}`
        )
      ),

      // Responsive coefficient cells grid fitting 20:9 ratio at degree 4 (5 cells)
      React.createElement(
        'div',
        {
          className: `grid ${
            degree === 2 ? 'grid-cols-3' : degree === 3 ? 'grid-cols-4' : 'grid-cols-5'
          } gap-1 my-auto w-full`,
        },
        labels.map((label, idx) => {
          const isSelected = idx === curIdx;
          const cellVal =
            isSelected && buf !== ''
              ? buf
              : formatCellDisplay(coeffs[idx] ?? 0, rawTexts[idx]);

          return React.createElement(
            'div',
            {
              key: label,
              className: `py-1 px-0.5 border rounded-xl text-center min-w-0 flex flex-col justify-between ${
                isSelected
                  ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold'
                  : 'border-[var(--display-divider)] bg-[var(--display-surface)] text-[var(--display-text)]'
              }`,
            },
            React.createElement(
              'span',
              { className: 'text-[9px] uppercase leading-none text-[var(--display-muted)]' },
              `${label}=`
            ),
            React.createElement(
              'span',
              {
                className:
                  'text-xs sm:text-sm font-semibold truncate leading-tight tracking-tight px-0.5',
                title: String(cellVal),
              },
              String(cellVal)
            )
          );
        })
      ),

      // Bottom active input prompt line & hints
      React.createElement(
        'div',
        { className: 'space-y-0.5' },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold text-[var(--display-text)] flex items-center justify-between px-2 bg-[var(--display-surface)] py-0.5 rounded-lg border border-[var(--display-divider)]',
          },
          React.createElement('span', { className: 'text-[var(--ui-accent)]' }, `${activeLabel} =`),
          React.createElement(
            'span',
            { className: 'truncate max-w-[200px] text-right font-sans' },
            activeValue
          )
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[10px] text-[var(--display-muted)] pt-0.5 border-t border-[var(--display-divider)] flex justify-between',
          },
          React.createElement('span', null, '[=]: Confirm/Solve'),
          React.createElement('span', null, '◄ ►: Move  [AC]: Clear')
        )
      )
    );
  },
};
