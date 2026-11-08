/**
 * fx-570EX ClassWiz - BASE (Base-N) Mode Module
 * 
 * Mode ID: BASE
 * Hardware Indicators: 'DEC' | 'HEX' | 'BIN' | 'OCT'
 * 
 * KEYMAPS AS DATA:
 * - x²: Switches base to DEC
 * - x^□ / x□: Switches base to HEX
 * - log: Switches base to BIN
 * - ln: Switches base to OCT
 * - (-): Types hex digit A
 * - ° ' " / °: Types hex digit B
 * - hyp: Types hex digit C
 * - sin: Types hex digit D
 * - cos: Types hex digit E
 * - tan: Types hex digit F
 * - OPTN / SHIFT+3: Opens Base-N sub-menu
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext, SubMenuPage } from './types';

export type BaseType = 'DEC' | 'HEX' | 'BIN' | 'OCT';

export const BASE_SUBMENU_PAGES: SubMenuPage[] = [
  {
    title: 'Base-N Logic',
    items: [
      { id: 1, key: '1', name: 'and', action: (ctx) => appendBaseToken(ctx, ' and ') },
      { id: 2, key: '2', name: 'or', action: (ctx) => appendBaseToken(ctx, ' or ') },
      { id: 3, key: '3', name: 'xor', action: (ctx) => appendBaseToken(ctx, ' xor ') },
      { id: 4, key: '4', name: 'xnor', action: (ctx) => appendBaseToken(ctx, ' xnor ') },
    ],
  },
  {
    title: 'Base-N Prefixes',
    items: [
      { id: 5, key: '1', name: 'Not', action: (ctx) => appendBaseToken(ctx, 'Not(') },
      { id: 6, key: '2', name: 'Neg', action: (ctx) => appendBaseToken(ctx, 'Neg(') },
      { id: 7, key: '3', name: 'd (Dec)', action: (ctx) => appendBaseToken(ctx, 'd') },
      { id: 8, key: '4', name: 'h (Hex)', action: (ctx) => appendBaseToken(ctx, 'h') },
    ],
  },
];

function appendBaseToken(ctx: ModeContext, token: string) {
  ctx.setModeState((prev) => ({
    ...prev,
    screen: 'MAIN',
    data: {
      ...prev.data,
      expression: (prev.data.expression || '') + token,
    },
  }));
}

function setCalculatorBase(ctx: ModeContext, newBase: BaseType) {
  ctx.setModeState((prev) => {
    const curVal = prev.data.numericVal ?? 0;
    return {
      ...prev,
      screen: 'MAIN',
      data: {
        ...prev.data,
        base: newBase,
        result: formatBaseValue(curVal, newBase),
      },
    };
  });
}

export function formatBaseValue(val: number, base: BaseType): string {
  // 32-bit signed integer representation
  const int32 = val | 0;
  const uint32 = int32 >>> 0;

  switch (base) {
    case 'DEC':
      return int32.toString(10);
    case 'HEX':
      return uint32.toString(16).toUpperCase();
    case 'BIN': {
      const binStr = uint32.toString(2);
      // Group in 4s for readability if long
      return binStr;
    }
    case 'OCT':
      return uint32.toString(8);
    default:
      return int32.toString(10);
  }
}

export function parseAndEvalBase(expr: string, base: BaseType): { val: number; str: string; error?: string } {
  if (!expr.trim()) return { val: 0, str: formatBaseValue(0, base) };
  try {
    const radix = base === 'HEX' ? 16 : base === 'BIN' ? 2 : base === 'OCT' ? 8 : 10;
    
    // Check if simple single number
    const trimmed = expr.trim();
    if (/^[0-9A-Fa-f]+$/.test(trimmed)) {
      const parsed = parseInt(trimmed, radix);
      if (isNaN(parsed)) return { val: 0, str: 'Syntax ERROR', error: 'Syntax ERROR' };
      return { val: parsed, str: formatBaseValue(parsed, base) };
    }

    // Replace operators
    let jsExpr = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\band\b/gi, '&')
      .replace(/\bor\b/gi, '|')
      .replace(/\bxor\b/gi, '^')
      .replace(/\bxnor\b/gi, '^ ~')
      .replace(/\bNot\(/gi, '~(')
      .replace(/\bNeg\(/gi, '-(');

    // If in non-decimal, replace bare hex/bin/oct tokens
    if (base === 'HEX') {
      jsExpr = jsExpr.replace(/\b([0-9A-Fa-f]+)\b/g, '0x$1');
    } else if (base === 'BIN') {
      jsExpr = jsExpr.replace(/\b([01]+)\b/g, '0b$1');
    } else if (base === 'OCT') {
      jsExpr = jsExpr.replace(/\b([0-7]+)\b/g, '0o$1');
    }

    // eslint-disable-next-line no-eval
    const computed = Function(`'use strict'; return (${jsExpr})`)();
    const intVal = Number(computed) | 0;
    return { val: intVal, str: formatBaseValue(intVal, base) };
  } catch {
    return { val: 0, str: 'Syntax ERROR', error: 'Syntax ERROR' };
  }
}

export const baseModeModule: ModeModule = {
  id: 'BASE',
  code: 'BASE',
  name: 'Base-N',
  shortName: 'Base-N',
  menuNumber: 3,
  isImplemented: true,

  getIndicator: (state) => (state.data?.base as BaseType) || 'DEC',

  // Pure data-driven keymap table
  keymap: {
    overrides: {
      'x²': {
        label: 'DEC',
        description: 'Decimal base',
        action: (ctx) => setCalculatorBase(ctx, 'DEC'),
      },
      'x^□': {
        label: 'HEX',
        description: 'Hexadecimal base',
        action: (ctx) => setCalculatorBase(ctx, 'HEX'),
      },
      'x□': {
        label: 'HEX',
        description: 'Hexadecimal base',
        action: (ctx) => setCalculatorBase(ctx, 'HEX'),
      },
      log: {
        label: 'BIN',
        description: 'Binary base',
        action: (ctx) => setCalculatorBase(ctx, 'BIN'),
      },
      ln: {
        label: 'OCT',
        description: 'Octal base',
        action: (ctx) => setCalculatorBase(ctx, 'OCT'),
      },
      '(-)': {
        label: 'A',
        description: 'Hex digit A',
        action: (ctx) => appendBaseToken(ctx, 'A'),
      },
      '°': {
        label: 'B',
        description: 'Hex digit B',
        action: (ctx) => appendBaseToken(ctx, 'B'),
      },
      "° ' \"": {
        label: 'B',
        description: 'Hex digit B',
        action: (ctx) => appendBaseToken(ctx, 'B'),
      },
      hyp: {
        label: 'C',
        description: 'Hex digit C',
        action: (ctx) => appendBaseToken(ctx, 'C'),
      },
      sin: {
        label: 'D',
        description: 'Hex digit D',
        action: (ctx) => appendBaseToken(ctx, 'D'),
      },
      cos: {
        label: 'E',
        description: 'Hex digit E',
        action: (ctx) => appendBaseToken(ctx, 'E'),
      },
      tan: {
        label: 'F',
        description: 'Hex digit F',
        action: (ctx) => appendBaseToken(ctx, 'F'),
      },
      OPTN: {
        label: 'OPTN',
        description: 'Base-N sub-menu',
        action: (ctx) => {
          ctx.setModeState((prev) => ({
            ...prev,
            screen: prev.screen === 'SUBMENU' ? 'MAIN' : 'SUBMENU',
            data: { ...prev.data, subMenuPage: 0 },
          }));
        },
      },
    },
  },

  getInitialState: (): ModeState => ({
    mode: 'BASE',
    screen: 'MAIN',
    data: {
      base: 'DEC',
      expression: '',
      result: '0',
      numericVal: 0,
      isCalculated: false,
      subMenuPage: 0,
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    // Sub-menu navigation
    if (modeState.screen === 'SUBMENU') {
      const pageIdx = modeState.data.subMenuPage || 0;
      const page = BASE_SUBMENU_PAGES[pageIdx];

      if (key === 'AC' || key === 'ON') {
        setModeState((prev) => ({ ...prev, screen: 'MAIN' }));
        return true;
      }
      if (key === 'DOWN' || key === '▼') {
        if (pageIdx < BASE_SUBMENU_PAGES.length - 1) {
          setModeState((prev) => ({ ...prev, data: { ...prev.data, subMenuPage: pageIdx + 1 } }));
        }
        return true;
      }
      if (key === 'UP' || key === '▲') {
        if (pageIdx > 0) {
          setModeState((prev) => ({ ...prev, data: { ...prev.data, subMenuPage: pageIdx - 1 } }));
        }
        return true;
      }

      const numItem = page.items.find((it) => it.key === key);
      if (numItem) {
        numItem.action(ctx);
        return true;
      }
      return true;
    }

    // Direct keymap overrides (x², x^□, log, ln, (-), etc.)
    if (baseModeModule.keymap.overrides[key]) {
      baseModeModule.keymap.overrides[key].action(ctx);
      return true;
    }

    // AC Key
    if (key === 'AC') {
      const curBase: BaseType = modeState.data.base || 'DEC';
      setModeState((prev) => ({
        ...prev,
        screen: 'MAIN',
        data: {
          ...prev.data,
          expression: '',
          result: formatBaseValue(0, curBase),
          numericVal: 0,
          isCalculated: false,
        },
      }));
      return true;
    }

    // Equal Key
    if (key === '=') {
      const curBase: BaseType = modeState.data.base || 'DEC';
      const expr = modeState.data.expression || '';
      const evalRes = parseAndEvalBase(expr, curBase);
      setModeState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          result: evalRes.str,
          numericVal: evalRes.val,
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

    // Digits validation based on base
    const curBase: BaseType = modeState.data.base || 'DEC';
    if (/^[0-9]$/.test(key)) {
      const num = parseInt(key, 10);
      if (curBase === 'BIN' && num > 1) return true; // Ignore digits > 1 in BIN
      if (curBase === 'OCT' && num > 7) return true; // Ignore digits > 7 in OCT

      setModeState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          expression: (prev.data.expression || '') + key,
        },
      }));
      return true;
    }

    // Basic arithmetic operators
    if (/^[+\-×÷()]$/.test(key)) {
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

  getSubMenu: () => BASE_SUBMENU_PAGES,

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;

    // Submenu screen
    if (modeState.screen === 'SUBMENU') {
      const pageIdx = modeState.data.subMenuPage || 0;
      const page = BASE_SUBMENU_PAGES[pageIdx];
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-emerald-300 select-none' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center border-b border-emerald-950/40 pb-1 text-xs font-bold text-amber-400' },
          React.createElement('span', null, page.title || 'Base-N Menu'),
          React.createElement('span', { className: 'text-[10px] text-emerald-500/80 font-normal' }, `Page ${pageIdx + 1}/${BASE_SUBMENU_PAGES.length} ▲▼`)
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-2 gap-1.5 my-auto text-xs' },
          page.items.map((it) =>
            React.createElement(
              'div',
              { key: it.id, className: 'flex items-center space-x-1.5' },
              React.createElement('span', { className: 'bg-emerald-950 text-amber-300 border border-emerald-800/60 rounded px-1.5 py-0.5 text-[10px] font-bold' }, it.key),
              React.createElement('span', { className: 'font-semibold text-emerald-200' }, it.name)
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[9px] text-emerald-500/80 text-right pt-1 border-t border-emerald-950/40' },
          '[▲/▼] Page  [AC] Return'
        )
      );
    }

    // Main Base-N display
    const base: BaseType = modeState.data.base || 'DEC';
    const expr = modeState.data.expression || '';
    const res = modeState.data.result || '0';

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between p-2 font-mono select-none' },
      React.createElement(
        'div',
        { className: 'flex justify-between text-xs text-emerald-400 font-semibold border-b border-emerald-950/40 pb-1' },
        React.createElement('span', null, `${base} Mode`),
        React.createElement('span', { className: 'text-[10px] text-emerald-500/80 font-normal' }, '[x²]Dec [x□]Hex [log]Bin [ln]Oct')
      ),
      React.createElement(
        'div',
        { className: 'text-sm text-emerald-300 min-h-[1.5rem] break-all my-auto tracking-wide' },
        expr || React.createElement('span', { className: 'text-emerald-700/60' }, '0')
      ),
      React.createElement(
        'div',
        { className: 'flex items-baseline justify-end pt-0.5 border-t border-emerald-950/20' },
        React.createElement('span', { className: 'text-xs text-emerald-400 font-bold mr-2' }, base),
        React.createElement(
          'span',
          { 
            className: 'font-mono text-xl sm:text-2xl font-bold tracking-wider text-emerald-200 select-text overflow-x-auto no-scrollbar whitespace-nowrap pl-2',
            style: { textShadow: '0 0 3px rgba(110,231,183,0.3)' }
          },
          res
        )
      )
    );
  },
};
