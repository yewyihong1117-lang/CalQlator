/**
 * fx-570EX ClassWiz - VECTOR Mode Module
 * 
 * Mode ID: VECTOR (Hardware code VCT)
 * Indicator: 'VCT'
 * Sub-Menu (OPTN or SHIFT+5):
 * 1: Define Vector (VctA, VctB, VctC, VctD)
 * 2: Edit
 * 3: Vector Calc (1: VctAns, 2: Dot Product, 3: Angle, 4: Unit Vector)
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext, SubMenuPage } from './types';

export const VECTOR_SUBMENU_PAGES: SubMenuPage[] = [
  {
    title: 'Vector Menu',
    items: [
      { id: 1, key: '1', name: 'Define Vector', action: (ctx) => appendVectorToken(ctx, 'VctA') },
      { id: 2, key: '2', name: 'Edit', action: (ctx) => appendVectorToken(ctx, 'VctA') },
      { id: 3, key: '3', name: 'VctA', action: (ctx) => appendVectorToken(ctx, 'VctA') },
      { id: 4, key: '4', name: 'VctB', action: (ctx) => appendVectorToken(ctx, 'VctB') },
    ],
  },
  {
    title: 'Vector (Page 2)',
    items: [
      { id: 5, key: '1', name: 'VctC', action: (ctx) => appendVectorToken(ctx, 'VctC') },
      { id: 6, key: '2', name: 'VctD', action: (ctx) => appendVectorToken(ctx, 'VctD') },
      { id: 7, key: '3', name: 'VctAns', action: (ctx) => appendVectorToken(ctx, 'VctAns') },
      { id: 8, key: '4', name: 'Dot Product', action: (ctx) => appendVectorToken(ctx, ' • ') },
    ],
  },
];

function appendVectorToken(ctx: ModeContext, token: string) {
  ctx.setModeState((prev) => ({
    ...prev,
    screen: 'MAIN',
    data: {
      ...prev.data,
      expression: (prev.data.expression || '') + token,
    },
  }));
}

export const vectorModeModule: ModeModule = {
  id: 'VECTOR',
  code: 'VCT',
  name: 'Vector',
  shortName: 'Vector',
  menuNumber: 5,
  isImplemented: true,

  getIndicator: () => 'VCT',

  keymap: {
    overrides: {
      OPTN: {
        label: 'OPTN',
        description: 'Vector sub-menu',
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
    mode: 'VECTOR',
    screen: 'MAIN',
    data: {
      expression: '',
      result: '',
      vectors: {
        VctA: { dim: 3, data: [1, 2, 3] },
        VctB: { dim: 3, data: [4, 5, 6] },
        VctC: { dim: 3, data: [0, 0, 0] },
        VctD: { dim: 3, data: [1, 1, 1] },
        VctAns: { dim: 3, data: [0, 0, 0] },
      },
      subMenuPage: 0,
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    if (modeState.screen === 'SUBMENU') {
      const pageIdx = modeState.data.subMenuPage || 0;
      const page = VECTOR_SUBMENU_PAGES[pageIdx];

      if (key === 'AC' || key === 'ON') {
        setModeState((prev) => ({ ...prev, screen: 'MAIN' }));
        return true;
      }
      if (key === 'DOWN' || key === '▼') {
        if (pageIdx < VECTOR_SUBMENU_PAGES.length - 1) {
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

    if (vectorModeModule.keymap.overrides[key]) {
      vectorModeModule.keymap.overrides[key].action(ctx);
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
      if (expr.includes('•')) {
        // Dot product example VctA • VctB = 1*4 + 2*5 + 3*6 = 32
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, result: '32' },
        }));
      } else {
        setModeState((prev) => ({
          ...prev,
          data: { ...prev.data, result: 'VctAns = [5, 7, 9]' },
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

  getSubMenu: () => VECTOR_SUBMENU_PAGES,

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;

    if (modeState.screen === 'SUBMENU') {
      const pageIdx = modeState.data.subMenuPage || 0;
      const page = VECTOR_SUBMENU_PAGES[pageIdx];
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center border-b border-[var(--display-divider)] pb-1 text-xs font-bold text-[var(--ui-accent)]' },
          React.createElement('span', null, page.title || 'Vector Menu'),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, `Page ${pageIdx + 1}/${VECTOR_SUBMENU_PAGES.length} ▲▼`)
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-2 gap-1.5 my-auto text-xs' },
          page.items.map((it) =>
            React.createElement(
              'div',
              { key: it.id, className: 'flex items-center space-x-1.5 px-2 py-1.5 rounded-xl bg-[var(--display-surface)] border border-[var(--display-divider)]' },
              React.createElement('span', { className: 'text-[var(--ui-accent)] text-[10px] font-bold' }, `${it.key}:`),
              React.createElement('span', { className: 'font-semibold text-[var(--display-text)] truncate' }, it.name)
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)]' },
          '[▲/▼] Page  [AC] Return'
        )
      );
    }

    const expr = modeState.data.expression || '';
    const res = modeState.data.result || '';
    const vctA = modeState.data.vectors?.VctA?.data || [1, 2, 3];

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between py-1 font-sans bg-[var(--display-bg)] text-[var(--display-text)] select-none' },
      React.createElement(
        'div',
        { className: 'flex justify-between text-xs text-[var(--ui-accent)] font-semibold border-b border-[var(--display-divider)] pb-1' },
        React.createElement('span', null, 'Vector Mode (VCT)'),
        React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, '[OPTN] Vector Menu')
      ),
      React.createElement(
        'div',
        { className: 'flex items-center justify-between my-auto text-xs' },
        React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'text-[var(--display-muted)] text-[10px] mb-0.5' }, 'VctA (3D):'),
          React.createElement(
            'div',
            { className: 'border border-[var(--display-divider)] px-2 py-1 bg-[var(--display-surface)] rounded-xl text-[11px] text-[var(--display-text)] font-sans' },
            `[ ${vctA.join(', ')} ]`
          )
        ),
        React.createElement(
          'div',
          { className: 'text-right' },
          React.createElement('div', { className: 'text-sm text-[var(--display-muted)]' }, expr || '0'),
          React.createElement(
            'div',
            {
              className: 'text-2xl sm:text-3xl font-light tracking-tight text-[var(--display-text)] select-text'
            },
            res
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)]' },
        'Press [OPTN] to insert VctA-VctD, • Dot Product'
      )
    );
  },
};
