/**
 * fx-570EX ClassWiz - RATIO (Ratio) Mode Module
 * 
 * Mode ID: RATIO
 * Indicator: 'RATIO'
 * 
 * Types:
 * 1: A : B = X : D  ->  X = (A x D) / B
 * 2: X : B = C : D  ->  X = (B x C) / D
 * 
 * Features:
 * - Authentic Casio ClassWiz 4-cell layout:
 *   Type 1: [ A ] : [ B ] =   X   : [ D ]
 *   Type 2:   X   : [ B ] = [ C ] : [ D ]
 * - Full expression evaluation in cells (fractions, sqrt, pi, Ans).
 * - Exact rational arithmetic with fraction and decimal representations.
 * - S<=>D toggle between fraction and 10-digit decimal.
 * - Division-by-zero detection (B=0 in type 1, D=0 in type 2) -> Math ERROR.
 * - Float noise suppression (e.g. 2.0000000001 -> 2).
 * - Overflow protection for long fractions.
 * - Theme-compliant styling using only global CSS tokens:
 *   var(--display-text), var(--display-bg), var(--label-shift).
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext } from './types';
import { evaluateMathExpression } from '../calcEngine';
import { toSimulFrac, SimulFrac } from './eqnMode';

export interface RatioCell {
  raw: string;
  val: number;
}

export interface RatioData {
  ratioType: 1 | 2; // 1: A:B=X:D, 2: X:B=C:D
  cursorType?: 1 | 2; // For arrow navigation on SELECT_TYPE screen
  // For Type 1: cells are [A, B, D]
  // For Type 2: cells are [B, C, D]
  cells: RatioCell[];
  currentCellIdx: number; // 0, 1, 2
  inputBuffer: string;
  resultExact: string;
  resultDec: string;
  resultNumeric: number;
  isFraction: boolean;
  showDecimal: boolean;
  error?: string;
}

export function formatCasioDecimal(val: number): string {
  if (Math.abs(val - Math.round(val)) < 1e-10) {
    return Math.round(val).toString();
  }
  const str = val.toPrecision(10);
  const parsed = parseFloat(str);
  return parsed.toString();
}

export function solveRatio(
  type: 1 | 2,
  a: number | string,
  b: number | string,
  c: number | string,
  d: number | string
): {
  success: boolean;
  error?: string;
  exact: string;
  dec: string;
  numeric: number;
  isFraction: boolean;
} {
  // Clean float noise
  const cleanVal = (v: number | string): number | string => {
    if (typeof v === 'number' && Math.abs(v - Math.round(v)) < 1e-10) {
      return Math.round(v);
    }
    return v;
  };

  const cA = cleanVal(a);
  const cB = cleanVal(b);
  const cC = cleanVal(c);
  const cD = cleanVal(d);

  if (type === 1) {
    // A : B = X : D -> X = (A * D) / B
    const numB = typeof cB === 'number' ? cB : parseFloat(String(cB));
    if (numB === 0 || Math.abs(numB) < 1e-12) {
      return {
        success: false,
        error: 'Math ERROR',
        exact: 'Math ERROR',
        dec: 'Math ERROR',
        numeric: NaN,
        isFraction: false,
      };
    }

    const fA = toSimulFrac(cA);
    const fB = toSimulFrac(cB);
    const fD = toSimulFrac(cD);

    if (fA && fB && fD && !fB.isZero()) {
      const fX = fA.mul(fD).div(fB);
      let numVal = fX.toNumber();
      if (Math.abs(numVal - Math.round(numVal)) < 1e-10) {
        numVal = Math.round(numVal);
      }
      const isFrac = fX.d !== 1n;
      const exact = fX.toString();
      const dec = formatCasioDecimal(numVal);
      return {
        success: true,
        exact,
        dec,
        numeric: numVal,
        isFraction: isFrac,
      };
    }

    const valA = typeof cA === 'number' ? cA : parseFloat(String(cA));
    const valD = typeof cD === 'number' ? cD : parseFloat(String(cD));
    const numX = (valA * valD) / numB;
    const cleanX = Math.abs(numX - Math.round(numX)) < 1e-10 ? Math.round(numX) : numX;
    const decStr = formatCasioDecimal(cleanX);
    return {
      success: true,
      exact: decStr,
      dec: decStr,
      numeric: cleanX,
      isFraction: false,
    };
  } else {
    // X : B = C : D -> X = (B * C) / D
    const numD = typeof cD === 'number' ? cD : parseFloat(String(cD));
    if (numD === 0 || Math.abs(numD) < 1e-12) {
      return {
        success: false,
        error: 'Math ERROR',
        exact: 'Math ERROR',
        dec: 'Math ERROR',
        numeric: NaN,
        isFraction: false,
      };
    }

    const fB = toSimulFrac(cB);
    const fC = toSimulFrac(cC);
    const fD = toSimulFrac(cD);

    if (fB && fC && fD && !fD.isZero()) {
      const fX = fB.mul(fC).div(fD);
      let numVal = fX.toNumber();
      if (Math.abs(numVal - Math.round(numVal)) < 1e-10) {
        numVal = Math.round(numVal);
      }
      const isFrac = fX.d !== 1n;
      const exact = fX.toString();
      const dec = formatCasioDecimal(numVal);
      return {
        success: true,
        exact,
        dec,
        numeric: numVal,
        isFraction: isFrac,
      };
    }

    const valB = typeof cB === 'number' ? cB : parseFloat(String(cB));
    const valC = typeof cC === 'number' ? cC : parseFloat(String(cC));
    const numX = (valB * valC) / numD;
    const cleanX = Math.abs(numX - Math.round(numX)) < 1e-10 ? Math.round(numX) : numX;
    const decStr = formatCasioDecimal(cleanX);
    return {
      success: true,
      exact: decStr,
      dec: decStr,
      numeric: cleanX,
      isFraction: false,
    };
  }
}

export function createInitialCells(): RatioCell[] {
  return [
    { raw: '0', val: 0 },
    { raw: '0', val: 0 },
    { raw: '0', val: 0 },
  ];
}

export const ratioModeModule: ModeModule = {
  id: 'RATIO',
  code: 'RATIO',
  name: 'Ratio',
  shortName: 'Ratio',
  menuNumber: 12,
  isImplemented: true,

  getIndicator: () => 'RATIO',

  keymap: {
    overrides: {
      OPTN: {
        label: 'OPTN',
        description: 'Change Ratio Type',
        action: (ctx) => {
          ctx.setModeState((prev) => ({
            ...prev,
            screen: 'SELECT_TYPE',
          }));
        },
      },
      S_D: {
        label: 'S⇔D',
        description: 'Toggle Fraction and Decimal',
        action: (ctx) => {
          ctx.setModeState((prev) => {
            if (prev.screen !== 'SOLUTIONS') return prev;
            const data = (prev.data || {}) as RatioData;
            return {
              ...prev,
              data: {
                ...data,
                showDecimal: !data.showDecimal,
              },
            };
          });
        },
      },
      FORMAT: {
        label: 'FORMAT',
        description: 'Toggle Fraction and Decimal',
        action: (ctx) => {
          ctx.setModeState((prev) => {
            if (prev.screen !== 'SOLUTIONS') return prev;
            const data = (prev.data || {}) as RatioData;
            return {
              ...prev,
              data: {
                ...data,
                showDecimal: !data.showDecimal,
              },
            };
          });
        },
      },
    },
  },

  getInitialState: (): ModeState => ({
    mode: 'RATIO',
    screen: 'SELECT_TYPE',
    data: {
      ratioType: 1,
      cursorType: 1,
      cells: createInitialCells(),
      currentCellIdx: 0,
      inputBuffer: '',
      resultExact: '',
      resultDec: '',
      resultNumeric: 0,
      isFraction: false,
      showDecimal: false,
    } as RatioData,
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;
    const data = (modeState.data || {}) as RatioData;

    // ==========================================
    // AC & ON Navigation
    // ==========================================
    if (key === 'AC' || key === 'ON') {
      if (modeState.screen === 'SOLUTIONS') {
        // Return to input screen with cells preserved
        setModeState((prev) => ({
          ...prev,
          screen: 'INPUT_SCREEN',
          data: { ...prev.data, inputBuffer: '' },
        }));
        return true;
      }
      if (modeState.screen === 'INPUT_SCREEN') {
        if (data.inputBuffer && data.inputBuffer.length > 0) {
          // Clear current cell buffer only
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, inputBuffer: '' },
          }));
          return true;
        }
        // Go back to type selection
        setModeState((prev) => ({
          ...prev,
          screen: 'SELECT_TYPE',
        }));
        return true;
      }
      if (modeState.screen === 'SELECT_TYPE') {
        ctx.exitToCalc();
        return true;
      }
      return true;
    }

    // ==========================================
    // S<=>D Toggle Key
    // ==========================================
    if (key === 'S_D' || key === 'FORMAT' || key === 'S<=>D' || key === 'S⇔D') {
      if (modeState.screen === 'SOLUTIONS') {
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            showDecimal: !prev.data.showDecimal,
          },
        }));
        return true;
      }
      return false;
    }

    // ==========================================
    // 1. SELECT_TYPE Screen (1: A:B=X:D, 2: X:B=C:D)
    // ==========================================
    if (modeState.screen === 'SELECT_TYPE') {
      const curType = data.cursorType || 1;

      if (key === 'UP' || key === '▲' || key === 'DOWN' || key === '▼') {
        const nextType = curType === 1 ? 2 : 1;
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, cursorType: nextType },
        }));
        return true;
      }

      let selectedType: 1 | 2 | null = null;
      if (key === '1' || key === '2') {
        selectedType = parseInt(key, 10) as 1 | 2;
      } else if (key === '=') {
        selectedType = curType;
      }

      if (selectedType !== null) {
        // Fresh cells to avoid lingering stale values
        setModeState((prev) => ({
          ...prev,
          screen: 'INPUT_SCREEN',
          data: {
            ...prev.data,
            ratioType: selectedType,
            cursorType: selectedType,
            cells: createInitialCells(),
            currentCellIdx: 0,
            inputBuffer: '',
            resultExact: '',
            resultDec: '',
            isFraction: false,
            showDecimal: false,
            error: undefined,
          },
        }));
        return true;
      }

      return true;
    }

    // ==========================================
    // 2. INPUT_SCREEN: Ratio Cell Editor
    // ==========================================
    if (modeState.screen === 'INPUT_SCREEN') {
      const curIdx = data.currentCellIdx || 0;
      const cells: RatioCell[] = data.cells && data.cells.length === 3
        ? data.cells.map((c) => ({ ...c }))
        : createInitialCells();

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
            cells[curIdx] = {
              raw: evalRes.exactResult || buf,
              val: evalRes.result,
            };
          } else {
            const num = parseFloat(buf);
            if (!isNaN(num)) {
              cells[curIdx] = { raw: buf, val: num };
            }
          }
        } catch {
          const num = parseFloat(buf);
          if (!isNaN(num)) {
            cells[curIdx] = { raw: buf, val: num };
          }
        }
      };

      // Arrow navigation between cells (0, 1, 2)
      if (key === 'LEFT' || key === '◄' || key === 'UP' || key === '▲') {
        if (data.inputBuffer) {
          commitCurrentCell(data.inputBuffer);
        }
        const newIdx = curIdx <= 0 ? 2 : curIdx - 1;
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            cells,
            currentCellIdx: newIdx,
            inputBuffer: '',
          },
        }));
        return true;
      }

      if (key === 'RIGHT' || key === '►' || key === 'DOWN' || key === '▼') {
        if (data.inputBuffer) {
          commitCurrentCell(data.inputBuffer);
        }
        const newIdx = curIdx >= 2 ? 0 : curIdx + 1;
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            cells,
            currentCellIdx: newIdx,
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

      // [ = ] Key: Confirm cell or Solve
      if (key === '=') {
        const buf = data.inputBuffer;
        if (buf !== '') {
          commitCurrentCell(buf);
        }

        if (curIdx < 2) {
          // Advance to next cell
          setModeState((prev) => ({
            ...prev,
            data: {
              ...prev.data,
              cells,
              currentCellIdx: curIdx + 1,
              inputBuffer: '',
            },
          }));
          return true;
        } else {
          // On the last cell, solve the ratio!
          const rType = data.ratioType || 1;
          const aVal = rType === 1 ? cells[0].val : 0;
          const bVal = rType === 1 ? cells[1].val : cells[0].val;
          const cVal = rType === 1 ? 0 : cells[1].val;
          const dVal = rType === 1 ? cells[2].val : cells[2].val;

          const res = solveRatio(rType, aVal, bVal, cVal, dVal);

          if (!res.success) {
            setModeState((prev) => ({
              ...prev,
              screen: 'SOLUTIONS',
              data: {
                ...prev.data,
                cells,
                error: res.error || 'Math ERROR',
                resultExact: 'Math ERROR',
                resultDec: 'Math ERROR',
                resultNumeric: NaN,
                isFraction: false,
                showDecimal: false,
                inputBuffer: '',
              },
            }));
          } else {
            setModeState((prev) => ({
              ...prev,
              screen: 'SOLUTIONS',
              data: {
                ...prev.data,
                cells,
                error: undefined,
                resultExact: res.exact,
                resultDec: res.dec,
                resultNumeric: res.numeric,
                isFraction: res.isFraction,
                showDecimal: false,
                inputBuffer: '',
              },
            }));
          }
          return true;
        }
      }

      return false;
    }

    // ==========================================
    // 3. SOLUTIONS Screen
    // ==========================================
    if (modeState.screen === 'SOLUTIONS') {
      if (key === '=') {
        // Return to input screen with cells preserved for immediate editing
        setModeState((prev) => ({
          ...prev,
          screen: 'INPUT_SCREEN',
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
    const data = (modeState.data || {}) as RatioData;
    const ratioType = data.ratioType || 1;

    // ----------------------------------------------------
    // Screen 1: SELECT_TYPE
    // ----------------------------------------------------
    if (modeState.screen === 'SELECT_TYPE') {
      const curType = data.cursorType || 1;
      const typeOptions = [
        { num: 1, label: 'A : B = X : D' },
        { num: 2, label: 'X : B = C : D' },
      ];

      return React.createElement(
        'div',
        {
          className:
            'flex flex-col h-full justify-between p-2 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between items-center',
          },
          React.createElement('span', null, 'Ratio Type?'),
          React.createElement(
            'span',
            { className: 'text-[10px] text-[var(--display-text)]/70 tracking-wider' },
            'RATIO'
          )
        ),
        React.createElement(
          'div',
          { className: 'space-y-2 my-auto pl-1' },
          typeOptions.map((opt) => {
            const isSelected = curType === opt.num;
            return React.createElement(
              'div',
              {
                key: opt.num,
                className: `flex items-center gap-3 px-2 py-1.5 rounded transition-colors ${
                  isSelected
                    ? 'bg-[var(--display-text)]/15 text-[var(--label-shift)] font-semibold'
                    : 'text-[var(--display-text)]'
                }`,
              },
              React.createElement(
                'span',
                {
                  className: `font-bold px-2 py-0.5 rounded text-xs border ${
                    isSelected
                      ? 'border-[var(--label-shift)] bg-[var(--label-shift)]/20 text-[var(--label-shift)]'
                      : 'border-[var(--display-text)]/30 bg-[var(--display-text)]/5 text-[var(--display-text)]/80'
                  }`,
                },
                String(opt.num)
              ),
              React.createElement(
                'span',
                { className: 'text-sm font-semibold tracking-wider font-sans' },
                opt.label
              )
            );
          })
        ),
        React.createElement(
          'div',
          {
            className:
              'text-[9.5px] text-[var(--display-text)]/60 pt-1 border-t border-[var(--display-text)]/20 flex justify-between',
          },
          React.createElement('span', null, 'Select [1] or [2]'),
          React.createElement('span', null, '[▲▼]: Move  [=]: OK')
        )
      );
    }

    // ----------------------------------------------------
    // Screen 2: INPUT_SCREEN
    // ----------------------------------------------------
    if (modeState.screen === 'INPUT_SCREEN') {
      const curIdx = data.currentCellIdx || 0;
      const cells = data.cells || createInitialCells();
      const buf = data.inputBuffer;

      // Define cells layout depending on Type 1 or Type 2
      // Type 1: [A] : [B] =   X   : [D]
      // Type 2:   X   : [B] = [C] : [D]
      const items =
        ratioType === 1
          ? [
              { label: 'A', isUnknown: false, cellIdx: 0 },
              { label: 'B', isUnknown: false, cellIdx: 1 },
              { label: 'X', isUnknown: true, cellIdx: -1 },
              { label: 'D', isUnknown: false, cellIdx: 2 },
            ]
          : [
              { label: 'X', isUnknown: true, cellIdx: -1 },
              { label: 'B', isUnknown: false, cellIdx: 0 },
              { label: 'C', isUnknown: false, cellIdx: 1 },
              { label: 'D', isUnknown: false, cellIdx: 2 },
            ];

      const activeLabel =
        ratioType === 1
          ? ['A', 'B', 'D'][curIdx] || 'A'
          : ['B', 'C', 'D'][curIdx] || 'B';

      const activeVal =
        buf !== ''
          ? buf
          : cells[curIdx]?.raw || String(cells[curIdx]?.val ?? 0);

      const headerTitle = ratioType === 1 ? 'A : B = X : D' : 'X : B = C : D';

      return React.createElement(
        'div',
        {
          className:
            'flex flex-col h-full justify-between p-2 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between items-center',
          },
          React.createElement('span', null, headerTitle),
          React.createElement(
            'span',
            { className: 'text-[10px] text-[var(--label-shift)] tracking-wider' },
            'RATIO'
          )
        ),

        // Authentic Ratio 4-Cell Equation Display (Fits Find X9 20:9 ratio)
        React.createElement(
          'div',
          { className: 'flex items-center justify-between my-auto w-full px-1 gap-1' },
          items.map((item, idx) => {
            const isSepColons = idx === 0 || idx === 2;
            const isSepEqual = idx === 1;

            if (item.isUnknown) {
              return React.createElement(
                React.Fragment,
                { key: item.label + idx },
                React.createElement(
                  'div',
                  {
                    className:
                      'flex-1 py-1 px-1 border-2 border-dashed border-[var(--label-shift)]/60 bg-[var(--label-shift)]/10 rounded text-center min-w-0 flex flex-col justify-between items-center',
                  },
                  React.createElement(
                    'span',
                    { className: 'text-[9px] uppercase leading-none text-[var(--label-shift)]/80' },
                    'X'
                  ),
                  React.createElement(
                    'span',
                    { className: 'text-sm font-bold text-[var(--label-shift)] italic leading-tight' },
                    'X'
                  )
                ),
                isSepColons
                  ? React.createElement('span', { className: 'text-sm font-bold text-[var(--display-text)]/70 mx-0.5' }, ':')
                  : null,
                isSepEqual
                  ? React.createElement('span', { className: 'text-sm font-bold text-[var(--display-text)]/70 mx-0.5' }, '=')
                  : null
              );
            }

            const isSelected = item.cellIdx === curIdx;
            const displayVal =
              isSelected && buf !== ''
                ? buf
                : cells[item.cellIdx]?.raw || String(cells[item.cellIdx]?.val ?? 0);

            return React.createElement(
              React.Fragment,
              { key: item.label + idx },
              React.createElement(
                'div',
                {
                  className: `flex-1 py-1 px-1 border rounded text-center transition-all min-w-0 flex flex-col justify-between ${
                    isSelected
                      ? 'border-[var(--label-shift)] bg-[var(--label-shift)]/15 text-[var(--label-shift)] font-bold shadow-[0_0_6px_rgba(229,169,60,0.2)]'
                      : 'border-[var(--display-text)]/25 bg-[var(--display-text)]/5 text-[var(--display-text)]'
                  }`,
                },
                React.createElement(
                  'span',
                  { className: 'text-[9px] uppercase leading-none opacity-80' },
                  `${item.label}=`
                ),
                React.createElement(
                  'span',
                  {
                    className:
                      'text-xs sm:text-sm font-semibold truncate leading-tight tracking-tight px-0.5',
                    title: String(displayVal),
                  },
                  String(displayVal)
                )
              ),
              isSepColons
                ? React.createElement('span', { className: 'text-sm font-bold text-[var(--display-text)]/70 mx-0.5' }, ':')
                : null,
              isSepEqual
                ? React.createElement('span', { className: 'text-sm font-bold text-[var(--display-text)]/70 mx-0.5' }, '=')
                : null
            );
          })
        ),

        // Bottom active cell prompt & instructions
        React.createElement(
          'div',
          { className: 'space-y-0.5' },
          React.createElement(
            'div',
            {
              className:
                'text-xs font-bold text-[var(--display-text)] flex items-center justify-between px-1.5 bg-[var(--display-text)]/5 py-0.5 rounded border border-[var(--display-text)]/15',
            },
            React.createElement('span', { className: 'text-[var(--label-shift)]' }, `${activeLabel} =`),
            React.createElement(
              'span',
              { className: 'truncate max-w-[200px] text-right font-sans' },
              activeVal
            )
          ),
          React.createElement(
            'div',
            {
              className:
                'text-[9.5px] text-[var(--display-text)]/60 pt-0.5 border-t border-[var(--display-text)]/20 flex justify-between items-center',
            },
            React.createElement('span', null, '[=]: Confirm/Solve'),
            React.createElement('span', null, '◄ ►: Move  [OPTN]: Type')
          )
        )
      );
    }

    // ----------------------------------------------------
    // Screen 3: SOLUTIONS
    // ----------------------------------------------------
    if (modeState.screen === 'SOLUTIONS') {
      const isError = Boolean(data.error);
      const headerTitle = ratioType === 1 ? 'A : B = X : D' : 'X : B = C : D';
      const showDec = data.showDecimal;
      const displayVal = isError
        ? data.error || 'Math ERROR'
        : showDec
        ? data.resultDec
        : data.resultExact;

      return React.createElement(
        'div',
        {
          className:
            'flex flex-col h-full justify-between p-2 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]',
        },
        React.createElement(
          'div',
          {
            className:
              'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)] flex justify-between items-center',
          },
          React.createElement('span', null, headerTitle),
          React.createElement(
            'div',
            { className: 'flex items-center gap-1.5 text-[9.5px]' },
            data.isFraction
              ? React.createElement(
                  'span',
                  {
                    className:
                      'px-1 py-0.2 rounded bg-[var(--label-shift)]/20 text-[var(--label-shift)] font-semibold',
                  },
                  showDec ? 'D' : 'S'
                )
              : null,
            React.createElement(
              'span',
              { className: 'text-[var(--label-shift)] font-bold tracking-wider' },
              'RATIO'
            )
          )
        ),

        // Solution Display Area
        React.createElement(
          'div',
          { className: 'my-auto py-2 text-center flex flex-col items-center justify-center space-y-1' },
          !isError
            ? React.createElement(
                'div',
                { className: 'text-xs text-[var(--label-shift)] font-semibold' },
                'X ='
              )
            : null,
          React.createElement(
            'div',
            {
              className: `font-bold tracking-wider text-[var(--display-text)] select-text px-2 break-all max-w-full ${
                isError ? 'text-base sm:text-lg text-[var(--label-shift)]' : 'text-xl sm:text-2xl'
              }`,
            },
            displayVal
          ),
          data.isFraction && !isError
            ? React.createElement(
                'div',
                { className: 'text-[10px] text-[var(--display-text)]/60' },
                showDec ? `[S⇔D] Exact: ${data.resultExact}` : `[S⇔D] Dec: ${data.resultDec}`
              )
            : null
        ),

        React.createElement(
          'div',
          {
            className:
              'text-[9.5px] text-[var(--display-text)]/60 pt-1 border-t border-[var(--display-text)]/20 flex justify-between items-center',
          },
          React.createElement(
            'span',
            null,
            isError ? '[=] / [AC]: Edit Cells' : data.isFraction ? '[S⇔D]: Format  [=]: Edit' : '[=] / [AC]: Edit'
          ),
          React.createElement('span', null, '[OPTN]: Type')
        )
      );
    }

    return React.createElement('div', null);
  },
};
