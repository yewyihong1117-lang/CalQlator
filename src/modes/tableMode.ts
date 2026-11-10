/**
 * fx-570EX ClassWiz - TABLE Mode Module
 * 
 * Mode ID: TABLE
 * Indicator: 'TABLE'
 * Prompts:
 * 1: f(x) =
 * 2: g(x) =
 * 3: Table Range (Start: 1, End: 5, Step: 1)
 * 4: Table View [ No. | x | f(x) | g(x) ]
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext } from './types';

export function evalMathFunction(expr: string, xVal: number): number {
  try {
    const sanitized = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/(\d)\s*x/gi, `$1*(${xVal})`)
      .replace(/x/gi, `(${xVal})`)
      .replace(/\^/g, '**');
    // eslint-disable-next-line no-eval
    return Number(Function(`'use strict'; return (${sanitized})`)());
  } catch {
    return NaN;
  }
}

export function generateTableRows(
  fExpr: string,
  gExpr: string,
  start: number,
  end: number,
  step: number
): Array<{ no: number; x: number; fx: string; gx: string }> {
  const rows: Array<{ no: number; x: number; fx: string; gx: string }> = [];
  if (step <= 0 || start > end) return rows;
  let no = 1;
  for (let x = start; x <= end + 1e-9; x += step) {
    const roundedX = parseFloat(x.toFixed(4));
    const fxVal = evalMathFunction(fExpr || 'x', roundedX);
    const gxVal = gExpr ? evalMathFunction(gExpr, roundedX) : NaN;
    rows.push({
      no,
      x: roundedX,
      fx: isNaN(fxVal) ? 'ERROR' : String(parseFloat(fxVal.toFixed(4))),
      gx: isNaN(gxVal) ? '-' : String(parseFloat(gxVal.toFixed(4))),
    });
    no++;
    if (no > 30) break; // ClassWiz safety limit
  }
  return rows;
}

export const tableModeModule: ModeModule = {
  id: 'TABLE',
  code: 'TABLE',
  name: 'Table',
  shortName: 'Table',
  menuNumber: 9,
  isImplemented: true,

  getIndicator: () => 'TABLE',

  keymap: {
    overrides: {
      // In TABLE mode, 'x' or ')' can insert 'x'
      ')': {
        label: 'x',
        description: 'Input variable x',
        action: (ctx) => appendTableToken(ctx, 'x'),
      },
      OPTN: {
        label: 'OPTN',
        description: 'Table options',
        action: (ctx) => {
          ctx.setModeState((prev) => ({ ...prev, screen: 'PROMPT_F' }));
        },
      },
    },
  },

  getInitialState: (): ModeState => ({
    mode: 'TABLE',
    screen: 'PROMPT_F',
    data: {
      fExpr: '2x',
      gExpr: '',
      rangeStart: 1,
      rangeEnd: 5,
      rangeStep: 1,
      currentField: 'f',
      rows: generateTableRows('2x', '', 1, 5, 1),
      scrollIndex: 0,
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    // AC Key: Return to prompt f(x)
    if (key === 'AC') {
      if (modeState.screen === 'TABLE_VIEW') {
        setModeState((prev) => ({ ...prev, screen: 'PROMPT_F' }));
      } else {
        setModeState((prev) => ({ ...prev, data: { ...prev.data, fExpr: '' } }));
      }
      return true;
    }

    // Navigation in TABLE_VIEW
    if (modeState.screen === 'TABLE_VIEW') {
      if (key === 'DOWN' || key === '▼') {
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            scrollIndex: Math.min((prev.data.rows?.length || 1) - 1, (prev.data.scrollIndex || 0) + 1),
          },
        }));
        return true;
      }
      if (key === 'UP' || key === '▲') {
        setModeState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            scrollIndex: Math.max(0, (prev.data.scrollIndex || 0) - 1),
          },
        }));
        return true;
      }
    }

    // Step progression through = key
    if (key === '=') {
      if (modeState.screen === 'PROMPT_F') {
        setModeState((prev) => ({ ...prev, screen: 'PROMPT_G' }));
        return true;
      }
      if (modeState.screen === 'PROMPT_G') {
        setModeState((prev) => ({ ...prev, screen: 'RANGE' }));
        return true;
      }
      if (modeState.screen === 'RANGE') {
        const rows = generateTableRows(
          modeState.data.fExpr || 'x',
          modeState.data.gExpr || '',
          modeState.data.rangeStart ?? 1,
          modeState.data.rangeEnd ?? 5,
          modeState.data.rangeStep ?? 1
        );
        setModeState((prev) => ({
          ...prev,
          screen: 'TABLE_VIEW',
          data: { ...prev.data, rows, scrollIndex: 0 },
        }));
        return true;
      }
      return true;
    }

    // Key input in prompt screens
    if (modeState.screen === 'PROMPT_F' || modeState.screen === 'PROMPT_G') {
      const field = modeState.screen === 'PROMPT_F' ? 'fExpr' : 'gExpr';
      if (key === 'DEL') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, [field]: (prev.data[field] || '').slice(0, -1) },
        }));
        return true;
      }
      if (/^[0-9+\-×÷().x^]$/.test(key) || key === 'x') {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, [field]: (prev.data[field] || '') + key },
        }));
        return true;
      }
    }

    return false;
  },

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;

    // Prompt f(x)=
    if (modeState.screen === 'PROMPT_F') {
      const expr = modeState.data.fExpr || '';
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement('div', { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)]' }, 'Table: Define f(x)'),
        React.createElement(
          'div',
          { className: 'my-auto text-sm' },
          React.createElement('span', { className: 'font-bold mr-2 text-[var(--label-shift)]' }, 'f(x)='),
          React.createElement('span', { className: 'border-b border-[var(--display-text)]/40 font-semibold text-[var(--display-text)] tracking-wide' }, expr || ' ')
        ),
        React.createElement('div', { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-1 border-t border-[var(--display-text)]/20' }, 'Enter expression, press [=]')
      );
    }

    // Prompt g(x)=
    if (modeState.screen === 'PROMPT_G') {
      const expr = modeState.data.gExpr || '';
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement('div', { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)]' }, 'Table: Define g(x) (Optional)'),
        React.createElement(
          'div',
          { className: 'my-auto text-sm' },
          React.createElement('span', { className: 'font-bold mr-2 text-[var(--label-shift)]' }, 'g(x)='),
          React.createElement('span', { className: 'border-b border-[var(--display-text)]/40 font-semibold text-[var(--display-text)] tracking-wide' }, expr || ' ')
        ),
        React.createElement('div', { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-1 border-t border-[var(--display-text)]/20' }, 'Press [=] to continue')
      );
    }

    // Table Range
    if (modeState.screen === 'RANGE') {
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-[var(--display-text)] select-none' },
        React.createElement('div', { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)]' }, 'Table Range'),
        React.createElement(
          'div',
          { className: 'space-y-1 text-xs my-auto' },
          React.createElement('div', null, 'Start: ', React.createElement('span', { className: 'font-mono font-bold text-[var(--display-text)]' }, modeState.data.rangeStart ?? 1)),
          React.createElement('div', null, 'End: ', React.createElement('span', { className: 'font-mono font-bold text-[var(--display-text)]' }, modeState.data.rangeEnd ?? 5)),
          React.createElement('div', null, 'Step: ', React.createElement('span', { className: 'font-mono font-bold text-[var(--display-text)]' }, modeState.data.rangeStep ?? 1))
        ),
        React.createElement('div', { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-1 border-t border-[var(--display-text)]/20' }, 'Press [=] to generate table')
      );
    }

    // Table View
    const rows = modeState.data.rows || [];
    const scroll = modeState.data.scrollIndex || 0;

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between p-1.5 font-mono select-none text-[var(--display-text)]' },
      React.createElement(
        'div',
        { className: 'flex justify-between items-center text-xs font-bold border-b border-[var(--display-text)]/20 pb-0.5 text-[var(--label-shift)]' },
        React.createElement('span', null, `f(x)=${modeState.data.fExpr || 'x'}`),
        React.createElement('span', { className: 'text-[10px] text-[var(--display-text)]/70' }, '[AC] Edit')
      ),
      React.createElement(
        'div',
        { className: 'overflow-y-auto max-h-[90px] text-xs border border-[var(--display-text)]/30 rounded bg-[var(--display-text)]/5 my-0.5' },
        React.createElement(
          'table',
          { className: 'w-full text-left' },
          React.createElement(
            'thead',
            { className: 'bg-[var(--display-text)]/15 text-[10px] uppercase font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20' },
            React.createElement(
              'tr',
              null,
              React.createElement('th', { className: 'px-1.5 py-0.5 w-8' }, 'No.'),
              React.createElement('th', { className: 'px-1.5 py-0.5' }, 'x'),
              React.createElement('th', { className: 'px-1.5 py-0.5' }, 'f(x)'),
              React.createElement('th', { className: 'px-1.5 py-0.5' }, 'g(x)')
            )
          ),
          React.createElement(
            'tbody',
            { className: 'divide-y divide-[var(--display-text)]/15 text-[11px]' },
            rows.map((r: any, idx: number) =>
              React.createElement(
                'tr',
                { key: idx, className: idx === scroll ? 'bg-[var(--display-text)]/20 font-bold' : '' },
                React.createElement('td', { className: 'px-1.5 py-0.5 text-[var(--display-text)]/60' }, r.no),
                React.createElement('td', { className: 'px-1.5 py-0.5 text-[var(--display-text)] font-semibold' }, r.x),
                React.createElement(
                  'td', 
                  { 
                    className: 'px-1.5 py-0.5 font-bold text-[var(--display-text)] tracking-wide'
                  }, 
                  r.fx
                ),
                React.createElement(
                  'td', 
                  { 
                    className: 'px-1.5 py-0.5 font-bold text-[var(--display-text)] tracking-wide'
                  }, 
                  r.gx
                )
              )
            )
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-0.5 border-t border-[var(--display-text)]/20' },
        '[▲/▼] Scroll'
      )
    );
  },
};

function appendTableToken(ctx: ModeContext, token: string) {
  const { modeState, setModeState } = ctx;
  if (modeState.screen === 'PROMPT_F' || modeState.screen === 'PROMPT_G') {
    const field = modeState.screen === 'PROMPT_F' ? 'fExpr' : 'gExpr';
    setModeState((prev) => ({
      ...prev,
      data: { ...prev.data, [field]: (prev.data[field] || '') + token },
    }));
  }
}
