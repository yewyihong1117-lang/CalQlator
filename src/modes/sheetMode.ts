/**
 * fx-570EX ClassWiz - SHEET (Spreadsheet) Mode Module
 * 
 * Mode ID: SHEET
 * Indicator: 'SHEET'
 * Unimplemented mode: Displays authentic informative screen, never a blank screen.
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext } from './types';

export const sheetModeModule: ModeModule = {
  id: 'SHEET',
  code: 'SHEET',
  name: 'Spreadsheet',
  shortName: 'Spreadsheet',
  menuNumber: 8,
  isImplemented: false,

  getIndicator: () => 'SHEET',

  keymap: {
    overrides: {},
  },

  getInitialState: (): ModeState => ({
    mode: 'SHEET',
    screen: 'NOT_IMPLEMENTED',
    data: {},
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    if (key === 'AC' || key === 'ON') {
      ctx.exitToCalc();
      return true;
    }
    return true;
  },

  renderDisplay: (_ctx: ModeContext) => {
    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between py-2 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none text-center' },
      React.createElement('div', { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)]' }, '8: Spreadsheet'),
      React.createElement(
        'div',
        { className: 'my-auto space-y-1' },
        React.createElement('div', { className: 'text-base font-semibold text-[var(--display-text)] tracking-wide' }, 'Not Implemented'),
        React.createElement('div', { className: 'text-xs text-[var(--display-muted)]' }, 'This mode is planned for a future release.')
      ),
      React.createElement('div', { className: 'text-[10px] text-[var(--display-muted)] border-t border-[var(--display-divider)] pt-1' }, 'Press [AC] or [MENU] to exit')
    );
  },
};
