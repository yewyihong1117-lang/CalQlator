/**
 * fx-570EX ClassWiz - DIST (Distribution) Mode Module
 * 
 * Mode ID: DIST
 * Indicator: 'DIST'
 * Unimplemented mode: Displays authentic informative screen, never a blank screen.
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext } from './types';

export const distModeModule: ModeModule = {
  id: 'DIST',
  code: 'DIST',
  name: 'Distribution',
  shortName: 'Distribution',
  menuNumber: 7,
  isImplemented: false,

  getIndicator: () => 'DIST',

  keymap: {
    overrides: {},
  },

  getInitialState: (): ModeState => ({
    mode: 'DIST',
    screen: 'NOT_IMPLEMENTED',
    data: {},
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    if (key === 'AC' || key === 'ON') {
      ctx.exitToCalc();
      return true;
    }
    return true; // Absorb keys while showing prompt
  },

  renderDisplay: (_ctx: ModeContext) => {
    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between p-3 font-mono text-[var(--display-text)] select-none text-center' },
      React.createElement('div', { className: 'text-xs font-bold border-b border-[var(--display-text)]/20 pb-1 text-[var(--label-shift)]' }, '7: Distribution'),
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
