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
      { className: 'flex flex-col h-full justify-between p-3 font-mono text-emerald-300 select-none text-center' },
      React.createElement('div', { className: 'text-xs font-bold border-b border-emerald-950/40 pb-1 text-amber-400' }, '7: Distribution'),
      React.createElement(
        'div',
        { className: 'my-auto space-y-1' },
        React.createElement('div', { className: 'text-sm font-bold text-emerald-200 tracking-wide', style: { textShadow: '0 0 3px rgba(110,231,183,0.3)' } }, 'Not Implemented'),
        React.createElement('div', { className: 'text-[11px] text-emerald-500/80' }, 'This mode is planned for a future release.')
      ),
      React.createElement('div', { className: 'text-[10px] text-emerald-600/80 border-t border-emerald-950/40 pt-1' }, 'Press [AC] or [MENU] to exit')
    );
  },
};
