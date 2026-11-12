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
      { className: 'flex flex-col h-full justify-between p-3 font-sans text-[var(--display-text)] select-none text-center' },
      React.createElement('div', { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)]' }, '8: Spreadsheet'),
      React.createElement(
        'div',
        { className: 'my-auto space-y-1' },
        React.createElement('div', { className: 'text-sm font-bold text-[var(--display-text)] tracking-wide' }, 'Not Implemented'),
        React.createElement('div', { className: 'text-[11px] text-[var(--display-text)]/70' }, 'This mode is planned for a future release.')
      ),
      React.createElement('div', { className: 'text-[10px] text-[var(--display-text)]/60 border-t border-[var(--display-text)]/20 pt-1' }, 'Press [AC] or [MENU] to exit')
    );
  },
};
