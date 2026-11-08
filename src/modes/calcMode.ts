/**
 * fx-570EX ClassWiz - CALC (Calculate / COMP) Mode Module
 * 
 * Mode ID: CALC (Hardware code COMP)
 * Standard scientific calculation mode with 2D Math I/O Natural Display.
 * CALCULATE MODE MUST NOT CHANGE.
 */

import { ModeModule, ModeState, ModeContext } from './types';

export const calcModeModule: ModeModule = {
  id: 'CALC',
  code: 'COMP',
  name: 'Calculate',
  shortName: 'Calculate',
  menuNumber: 1,
  isImplemented: true,

  getIndicator: () => '',

  // Standard calculation mode defines no overrides; all keys use the native CALC engine
  keymap: {
    overrides: {},
  },

  getInitialState: (): ModeState => ({
    mode: 'CALC',
    screen: 'MAIN',
    data: {},
  }),

  handleKey: (_key: string, _ctx: ModeContext): boolean => {
    // Unlisted keys fall through to the native CALC behavior
    return false;
  },

  renderDisplay: (_ctx: ModeContext) => {
    // CALC mode renders through standard NaturalDisplay component in App.tsx
    return null;
  },
};
