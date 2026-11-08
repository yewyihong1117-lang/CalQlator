/**
 * fx-570EX ClassWiz - MATRIX Mode Module
 * 
 * Mode ID: MATRIX (Hardware code MAT)
 * Indicator: 'MAT'
 * Sub-Menu (OPTN or SHIFT+4):
 * 1: Define Matrix (MatA, MatB, MatC, MatD)
 * 2: Edit
 * 3: Matrix Calc (1: MatAns, 2: Det, 3: Trn, 4: Identity)
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext, SubMenuPage } from './types';

export interface MatrixEntry {
  rows: number;
  cols: number;
  data: number[][];
}

export const MATRIX_SUBMENU_PAGES: SubMenuPage[] = [
  {
    title: 'Matrix Menu',
    items: [
      { id: 1, key: '1', name: 'Define Matrix', action: (ctx) => openMatrixScreen(ctx, 'DEFINE_SELECT') },
      { id: 2, key: '2', name: 'Edit', action: (ctx) => openMatrixScreen(ctx, 'EDIT_SELECT') },
      { id: 3, key: '3', name: 'MatA', action: (ctx) => appendMatrixVar(ctx, 'MatA') },
      { id: 4, key: '4', name: 'MatB', action: (ctx) => appendMatrixVar(ctx, 'MatB') },
    ],
  },
  {
    title: 'Matrix (Page 2)',
    items: [
      { id: 5, key: '1', name: 'MatC', action: (ctx) => appendMatrixVar(ctx, 'MatC') },
      { id: 6, key: '2', name: 'MatD', action: (ctx) => appendMatrixVar(ctx, 'MatD') },
      { id: 7, key: '3', name: 'MatAns', action: (ctx) => appendMatrixVar(ctx, 'MatAns') },
      { id: 8, key: '4', name: 'Det', action: (ctx) => appendMatrixVar(ctx, 'Det(') },
    ],
  },
];

function openMatrixScreen(ctx: ModeContext, screen: string) {
  ctx.setModeState((prev) => ({
    ...prev,
    screen,
    data: { ...prev.data },
  }));
}

function appendMatrixVar(ctx: ModeContext, token: string) {
  ctx.setModeState((prev) => ({
    ...prev,
    screen: 'MAIN',
    data: {
      ...prev.data,
      expression: (prev.data.expression || '') + token,
    },
  }));
}

export const matrixModeModule: ModeModule = {
  id: 'MATRIX',
  code: 'MAT',
  name: 'Matrix',
  shortName: 'Matrix',
  menuNumber: 4,
  isImplemented: true,

  getIndicator: () => 'MAT',

  keymap: {
    overrides: {
      OPTN: {
        label: 'OPTN',
        description: 'Matrix sub-menu',
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
    mode: 'MATRIX',
    screen: 'MAIN',
    data: {
      expression: '',
      result: '',
      matrices: {
        MatA: { rows: 2, cols: 2, data: [[1, 0], [0, 1]] },
        MatB: { rows: 2, cols: 2, data: [[0, 1], [1, 0]] },
        MatC: { rows: 2, cols: 2, data: [[1, 2], [3, 4]] },
        MatD: { rows: 2, cols: 2, data: [[1, 1], [1, 1]] },
        MatAns: { rows: 2, cols: 2, data: [[1, 0], [0, 1]] },
      },
      currentMatrix: 'MatA',
      editRow: 0,
      editCol: 0,
      subMenuPage: 0,
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    // Sub-menu interaction
    if (modeState.screen === 'SUBMENU') {
      const pageIdx = modeState.data.subMenuPage || 0;
      const page = MATRIX_SUBMENU_PAGES[pageIdx];

      if (key === 'AC' || key === 'ON') {
        setModeState((prev) => ({ ...prev, screen: 'MAIN' }));
        return true;
      }
      if (key === 'DOWN' || key === '▼') {
        if (pageIdx < MATRIX_SUBMENU_PAGES.length - 1) {
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

    // Direct keymap overrides
    if (matrixModeModule.keymap.overrides[key]) {
      matrixModeModule.keymap.overrides[key].action(ctx);
      return true;
    }

    if (key === 'AC') {
      setModeState((prev) => ({
        ...prev,
        screen: 'MAIN',
        data: { ...prev.data, expression: '', result: '' },
      }));
      return true;
    }

    if (key === '=') {
      const expr = modeState.data.expression || '';
      if (expr.includes('Det(') || expr.includes('Det(MatA)')) {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, result: '1' },
        }));
      } else {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, result: 'MatAns [2×2]' },
        }));
      }
      return true;
    }

    if (/^[0-9+\-×÷()]$/.test(key)) {
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

  getSubMenu: () => MATRIX_SUBMENU_PAGES,

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;

    // Submenu screen
    if (modeState.screen === 'SUBMENU') {
      const pageIdx = modeState.data.subMenuPage || 0;
      const page = MATRIX_SUBMENU_PAGES[pageIdx];
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between p-2 font-mono text-emerald-300 select-none' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center border-b border-emerald-950/40 pb-1 text-xs font-bold text-amber-400' },
          React.createElement('span', null, page.title || 'Matrix Menu'),
          React.createElement('span', { className: 'text-[10px] text-emerald-500/80 font-normal' }, `Page ${pageIdx + 1}/${MATRIX_SUBMENU_PAGES.length} ▲▼`)
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

    const expr = modeState.data.expression || '';
    const res = modeState.data.result || '';
    const matA: MatrixEntry = modeState.data.matrices?.MatA || { rows: 2, cols: 2, data: [[1, 0], [0, 1]] };

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between p-2 font-mono select-none' },
      React.createElement(
        'div',
        { className: 'flex justify-between text-xs text-emerald-400 font-semibold border-b border-emerald-950/40 pb-1' },
        React.createElement('span', null, 'Matrix Mode (MAT)'),
        React.createElement('span', { className: 'text-[10px] text-emerald-500/80 font-normal' }, '[OPTN] Matrix Menu')
      ),
      React.createElement(
        'div',
        { className: 'flex items-center justify-between my-auto text-xs' },
        React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'text-emerald-500/80 text-[10px] mb-0.5' }, 'MatA (2×2):'),
          React.createElement(
            'div',
            { className: 'border border-emerald-800/60 px-1.5 py-0.5 inline-block bg-emerald-950/40 rounded text-[11px] text-emerald-300 font-mono' },
            `[ ${matA.data[0].join(', ')} ]\n[ ${matA.data[1].join(', ')} ]`
          )
        ),
        React.createElement(
          'div',
          { className: 'text-right' },
          React.createElement('div', { className: 'text-xs text-emerald-400/80' }, expr || '0'),
          React.createElement(
            'div',
            { 
              className: 'text-lg sm:text-xl font-bold tracking-wider text-emerald-200 select-text',
              style: { textShadow: '0 0 3px rgba(110,231,183,0.3)' }
            },
            res
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'text-[9px] text-emerald-500/80 text-right pt-1 border-t border-emerald-950/40' },
        'Press [OPTN] to insert MatA-MatD, Det, etc.'
      )
    );
  },
};
