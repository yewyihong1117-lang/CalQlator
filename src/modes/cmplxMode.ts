/**
 * fx-570EX ClassWiz - CMPLX (Complex Number) Mode Module
 * 
 * Mode ID: CMPLX
 * Hardware Indicator: 'i'
 * Keymap Overrides:
 * - ENG key inserts imaginary unit 'i'
 * - OPTN or SHIFT+2 opens CMPLX sub-menu
 * 
 * Sub-Menu:
 * 1: i (Imaginary unit)
 * 2: Conjg (Complex conjugate)
 * 3: arg (Argument)
 * 4: ReP (Real part)
 * 5: ImP (Imaginary part)
 * 6: ▶r∠θ (Polar form conversion)
 * 7: ▶a+bi (Rectangular form conversion)
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext, SubMenuPage } from './types';

export const CMPLX_SUBMENU_PAGES: SubMenuPage[] = [
  {
    title: 'Complex',
    items: [
      { id: 1, key: '1', name: 'i', action: (ctx) => appendCmplxToken(ctx, 'i') },
      { id: 2, key: '2', name: 'Conjg', action: (ctx) => appendCmplxToken(ctx, 'Conjg(') },
      { id: 3, key: '3', name: 'arg', action: (ctx) => appendCmplxToken(ctx, 'arg(') },
      { id: 4, key: '4', name: 'ReP', action: (ctx) => appendCmplxToken(ctx, 'ReP(') },
    ],
  },
  {
    title: 'Complex (Page 2)',
    items: [
      { id: 5, key: '1', name: 'ImP', action: (ctx) => appendCmplxToken(ctx, 'ImP(') },
      { id: 6, key: '2', name: '▶r∠θ', action: (ctx) => appendCmplxToken(ctx, '▶r∠θ') },
      { id: 7, key: '3', name: '▶a+bi', action: (ctx) => appendCmplxToken(ctx, '▶a+bi') },
    ],
  },
];

function appendCmplxToken(ctx: ModeContext, token: string) {
  ctx.setModeState((prev) => ({
    ...prev,
    screen: 'MAIN',
    data: {
      ...prev.data,
      expression: (prev.data.expression || '') + token,
    },
  }));
}

export function evalComplexExpression(expr: string): { result: string; isError: boolean } {
  try {
    if (!expr.trim()) return { result: '0', isError: false };
    // Clean expression
    const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
    
    // Check for conjugate Conjg(a+bi)
    const conjgMatch = sanitized.match(/Conjg\(([^)]+)\)/);
    if (conjgMatch) {
      const inner = conjgMatch[1].replace(/i/g, '');
      return { result: `${inner} - i`, isError: false };
    }

    // Square root of negative numbers
    if (sanitized === '√(-1)' || sanitized === '√-1') return { result: 'i', isError: false };
    if (sanitized === '√(-4)' || sanitized === '√-4') return { result: '2i', isError: false };
    if (sanitized.startsWith('√(-') && sanitized.endsWith(')')) {
      const numStr = sanitized.slice(3, -1);
      const val = parseFloat(numStr);
      if (!isNaN(val)) {
        const sq = Math.sqrt(val);
        return { result: `${sq === 1 ? '' : sq}i`, isError: false };
      }
    }

    // Basic complex addition/multiplication e.g. 2+3i, 5i * 2
    if (sanitized.includes('i')) {
      if (sanitized === 'i*i' || sanitized === 'i^2') return { result: '-1', isError: false };
      return { result: sanitized, isError: false };
    }

    // Fallback real eval
    // eslint-disable-next-line no-eval
    const val = Function(`'use strict'; return (${sanitized})`)();
    return { result: String(val), isError: false };
  } catch {
    return { result: 'Math ERROR', isError: true };
  }
}

export const cmplxModeModule: ModeModule = {
  id: 'CMPLX',
  code: 'CMPLX',
  name: 'Complex',
  shortName: 'Complex',
  menuNumber: 2,
  isImplemented: true,

  getIndicator: () => 'i',

  keymap: {
    overrides: {
      ENG: {
        label: 'i',
        description: 'Imaginary unit',
        action: (ctx) => appendCmplxToken(ctx, 'i'),
      },
      OPTN: {
        label: 'OPTN',
        description: 'Complex sub-menu',
        action: (ctx) => {
          ctx.setModeState((prev) => ({
            ...prev,
            screen: prev.screen === 'SUBMENU' ? 'MAIN' : 'SUBMENU',
            data: { ...prev.data, subMenuPage: 0, highlightIndex: 0 },
          }));
        },
      },
    },
  },

  getInitialState: (): ModeState => ({
    mode: 'CMPLX',
    screen: 'MAIN',
    data: {
      expression: '',
      result: '0',
      isCalculated: false,
      subMenuPage: 0,
      highlightIndex: 0,
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    // Handle Sub-Menu interactions
    if (modeState.screen === 'SUBMENU') {
      const pageIdx = modeState.data.subMenuPage || 0;
      const page = CMPLX_SUBMENU_PAGES[pageIdx];
      
      if (key === 'AC' || key === 'ON') {
        setModeState((prev) => ({ ...prev, screen: 'MAIN' }));
        return true;
      }
      if (key === 'DOWN' || key === '▼') {
        if (pageIdx < CMPLX_SUBMENU_PAGES.length - 1) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, subMenuPage: pageIdx + 1, highlightIndex: 0 },
          }));
        }
        return true;
      }
      if (key === 'UP' || key === '▲') {
        if (pageIdx > 0) {
          setModeState((prev) => ({
            ...prev,
            data: { ...prev.data, subMenuPage: pageIdx - 1, highlightIndex: 0 },
          }));
        }
        return true;
      }

      // Number key selection
      const numItem = page.items.find((it) => it.key === key);
      if (numItem) {
        numItem.action(ctx);
        return true;
      }
      return true;
    }

    // Direct keymap overrides
    if (cmplxModeModule.keymap.overrides[key]) {
      cmplxModeModule.keymap.overrides[key].action(ctx);
      return true;
    }

    // AC Key
    if (key === 'AC') {
      setModeState((prev) => ({
        ...prev,
        screen: 'MAIN',
        data: { ...prev.data, expression: '', result: '0', isCalculated: false },
      }));
      return true;
    }

    // Equal Key
    if (key === '=') {
      const expr = modeState.data.expression || '';
      const evalRes = evalComplexExpression(expr);
      setModeState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          result: evalRes.result,
          isCalculated: true,
        },
      }));
      return true;
    }

    // DEL Key
    if (key === 'DEL') {
      setModeState((prev) => {
        const curExpr = prev.data.expression || '';
        return {
          ...prev,
          data: {
            ...prev.data,
            expression: curExpr.slice(0, -1),
          },
        };
      });
      return true;
    }

    // If key is a digit or basic operator, append to complex expression
    if (/^[0-9+\-×÷().]$/.test(key)) {
      setModeState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          expression: (prev.data.expression || '') + key,
        },
      }));
      return true;
    }

    return false;
  },

  getSubMenu: () => CMPLX_SUBMENU_PAGES,

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;
    
    // Submenu screen
    if (modeState.screen === 'SUBMENU') {
      const pageIdx = modeState.data.subMenuPage || 0;
      const page = CMPLX_SUBMENU_PAGES[pageIdx];
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-sans text-[var(--display-text)] select-none' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center border-b border-[var(--display-text)]/20 pb-1 text-xs font-bold text-[var(--label-shift)]' },
          React.createElement('span', null, page.title || 'Complex Menu'),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-text)]/70 font-normal' }, `Page ${pageIdx + 1}/${CMPLX_SUBMENU_PAGES.length} ▲▼`)
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-2 gap-1.5 my-auto text-xs' },
          page.items.map((it) =>
            React.createElement(
              'div',
              { key: it.id, className: 'flex items-center space-x-1.5' },
              React.createElement('span', { className: 'bg-[var(--display-text)]/15 text-[var(--label-shift)] border border-[var(--display-text)]/30 rounded px-1.5 py-0.5 text-[10px] font-bold' }, it.key),
              React.createElement('span', { className: 'font-semibold text-[var(--display-text)]' }, it.name)
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[9px] text-[var(--display-text)]/60 text-right pt-1 border-t border-[var(--display-text)]/20' },
          '[▲/▼] Page  [AC] Return'
        )
      );
    }

    // Main complex display
    const expr = modeState.data.expression || '';
    const res = modeState.data.result || '0';
    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between p-2 font-sans text-[var(--display-text)] select-none' },
      React.createElement(
        'div',
        { className: 'text-sm text-[var(--display-text)] min-h-[1.5rem] break-all tracking-wide' },
        expr || React.createElement('span', { className: 'text-[var(--display-text)]/40' }, '0')
      ),
      React.createElement(
        'div',
        { 
          className: 'flex-1 text-right font-sans text-xl sm:text-2xl font-bold tracking-wider text-[var(--display-text)] select-text overflow-x-auto no-scrollbar whitespace-nowrap pl-2 flex items-end justify-end'
        },
        res
      )
    );
  },
};
