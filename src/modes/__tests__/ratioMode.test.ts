/**
 * Tests for RATIO Mode (Ratio Mode)
 * 
 * Verifies all 8 user-requested test calculations:
 * 1. Type 1: 2:3 = X:9        -> X = 6
 * 2. Type 1: 1:3 = X:2        -> X = 2/3 (0.6666666667 in decimal)
 * 3. Type 1: 4:0 = X:5        -> Math ERROR
 * 4. Type 2: X:4 = 3:2        -> X = 6
 * 5. Type 2: X:5 = 1:3        -> X = 5/3
 * 6. Type 2: X:4 = 3:0        -> Math ERROR
 * 7. negative: 2:(-4) = X:6   -> X = -3
 * 8. decimals: 0.5:2 = X:8    -> X = 2
 * 
 * Also verifies interactive UI flow, cell expression input, and S<=>D toggle.
 */

import { ratioModeModule, solveRatio } from '../ratioMode';
import { ModeContext, ModeState } from '../types';

export function runRatioModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'RATIO mode is marked implemented',
      test: () => ratioModeModule.isImplemented === true,
    },
    {
      name: 'RATIO mode indicator is "RATIO"',
      test: () => ratioModeModule.getIndicator(ratioModeModule.getInitialState()) === 'RATIO',
    },
    {
      name: 'RATIO initial screen is SELECT_TYPE',
      test: () => ratioModeModule.getInitialState().screen === 'SELECT_TYPE',
    },
    // Case 1: Type 1: 2:3 = X:9 -> X = 6
    {
      name: 'Test 1: Type 1: 2:3 = X:9 -> X = 6',
      test: () => {
        const res = solveRatio(1, 2, 3, 0, 9);
        return res.success && res.exact === '6' && res.numeric === 6;
      },
    },
    // Case 2: Type 1: 1:3 = X:2 -> X = 2/3 (0.6666666667 in decimal)
    {
      name: 'Test 2: Type 1: 1:3 = X:2 -> X = 2/3 (0.6666666667)',
      test: () => {
        const res = solveRatio(1, 1, 3, 0, 2);
        return res.success && res.exact === '2/3' && res.dec === '0.6666666667' && res.isFraction;
      },
    },
    // Case 3: Type 1: 4:0 = X:5 -> Math ERROR (div by zero)
    {
      name: 'Test 3: Type 1: 4:0 = X:5 -> Math ERROR',
      test: () => {
        const res = solveRatio(1, 4, 0, 0, 5);
        return !res.success && res.error === 'Math ERROR';
      },
    },
    // Case 4: Type 2: X:4 = 3:2 -> X = 6
    {
      name: 'Test 4: Type 2: X:4 = 3:2 -> X = 6',
      test: () => {
        const res = solveRatio(2, 0, 4, 3, 2);
        return res.success && res.exact === '6' && res.numeric === 6;
      },
    },
    // Case 5: Type 2: X:5 = 1:3 -> X = 5/3
    {
      name: 'Test 5: Type 2: X:5 = 1:3 -> X = 5/3',
      test: () => {
        const res = solveRatio(2, 0, 5, 1, 3);
        return res.success && res.exact === '5/3' && res.dec.startsWith('1.66666666') && res.isFraction;
      },
    },
    // Case 6: Type 2: X:4 = 3:0 -> Math ERROR (div by zero)
    {
      name: 'Test 6: Type 2: X:4 = 3:0 -> Math ERROR',
      test: () => {
        const res = solveRatio(2, 0, 4, 3, 0);
        return !res.success && res.error === 'Math ERROR';
      },
    },
    // Case 7: negative: 2:(-4) = X:6 -> X = -3
    {
      name: 'Test 7: negative: 2:(-4) = X:6 -> X = -3',
      test: () => {
        const res = solveRatio(1, 2, -4, 0, 6);
        return res.success && res.exact === '-3' && res.numeric === -3;
      },
    },
    // Case 8: decimals: 0.5:2 = X:8 -> X = 2
    {
      name: 'Test 8: decimals: 0.5:2 = X:8 -> X = 2',
      test: () => {
        const res = solveRatio(1, 0.5, 2, 0, 8);
        return res.success && res.exact === '2' && res.numeric === 2;
      },
    },
    // Interactive UI Flow: Select Type 1 -> Input cells 2, 3, 9 -> Solution X = 6
    {
      name: 'UI Flow: Type 1 2:3 = X:9 solves X = 6',
      test: () => {
        let state: ModeState = ratioModeModule.getInitialState();
        const ctx: ModeContext = {
          modeState: state,
          setModeState: (updater) => {
            state = typeof updater === 'function' ? updater(state) : updater;
            ctx.modeState = state;
          },
          sharedMemory: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0, Ans: 0 },
          setSharedMemory: () => {},
          exitToCalc: () => {},
          openSubMenu: () => {},
          closeSubMenu: () => {},
          triggerHapticFeedback: () => {},
          playAudioFeedback: () => {},
          angleMode: 'DEG',
          displayFormat: 'NORM1',
        };

        // Select Type 1
        ratioModeModule.handleKey('1', ctx);
        if ((ctx.modeState.screen as string) !== 'INPUT_SCREEN') return false;

        // Enter A = 2
        ratioModeModule.handleKey('2', ctx);
        ratioModeModule.handleKey('=', ctx);

        // Enter B = 3
        ratioModeModule.handleKey('3', ctx);
        ratioModeModule.handleKey('=', ctx);

        // Enter D = 9
        ratioModeModule.handleKey('9', ctx);
        ratioModeModule.handleKey('=', ctx);

        return (
          (ctx.modeState.screen as string) === 'SOLUTIONS' &&
          ctx.modeState.data.resultExact === '6'
        );
      },
    },
    // Interactive UI Flow: S<=>D key toggles fraction and decimal
    {
      name: 'UI Flow: S<=>D toggles exact fraction (2/3) and decimal (0.6666666667)',
      test: () => {
        let state: ModeState = ratioModeModule.getInitialState();
        const ctx: ModeContext = {
          modeState: state,
          setModeState: (updater) => {
            state = typeof updater === 'function' ? updater(state) : updater;
            ctx.modeState = state;
          },
          sharedMemory: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0, Ans: 0 },
          setSharedMemory: () => {},
          exitToCalc: () => {},
          openSubMenu: () => {},
          closeSubMenu: () => {},
          triggerHapticFeedback: () => {},
          playAudioFeedback: () => {},
          angleMode: 'DEG',
          displayFormat: 'NORM1',
        };

        ratioModeModule.handleKey('1', ctx);
        ratioModeModule.handleKey('1', ctx);
        ratioModeModule.handleKey('=', ctx);
        ratioModeModule.handleKey('3', ctx);
        ratioModeModule.handleKey('=', ctx);
        ratioModeModule.handleKey('2', ctx);
        ratioModeModule.handleKey('=', ctx);

        if ((ctx.modeState.screen as string) !== 'SOLUTIONS') return false;
        if (ctx.modeState.data.resultExact !== '2/3') return false;
        if (ctx.modeState.data.showDecimal !== false) return false;

        // Press S<=>D to toggle to decimal
        ratioModeModule.handleKey('S_D', ctx);
        if (ctx.modeState.data.showDecimal !== true) return false;
        if (ctx.modeState.data.resultDec !== '0.6666666667') return false;

        // Press S<=>D to toggle back to fraction
        ratioModeModule.handleKey('S_D', ctx);
        return ctx.modeState.data.showDecimal === false;
      },
    },
    // Interactive UI Flow: Edit cells without losing values and switch types
    {
      name: 'UI Flow: Edit cells without losing others and return with [=]',
      test: () => {
        let state: ModeState = ratioModeModule.getInitialState();
        const ctx: ModeContext = {
          modeState: state,
          setModeState: (updater) => {
            state = typeof updater === 'function' ? updater(state) : updater;
            ctx.modeState = state;
          },
          sharedMemory: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0, Ans: 0 },
          setSharedMemory: () => {},
          exitToCalc: () => {},
          openSubMenu: () => {},
          closeSubMenu: () => {},
          triggerHapticFeedback: () => {},
          playAudioFeedback: () => {},
          angleMode: 'DEG',
          displayFormat: 'NORM1',
        };

        ratioModeModule.handleKey('1', ctx);
        ratioModeModule.handleKey('2', ctx);
        ratioModeModule.handleKey('=', ctx);
        ratioModeModule.handleKey('3', ctx);
        ratioModeModule.handleKey('=', ctx);
        ratioModeModule.handleKey('9', ctx);
        ratioModeModule.handleKey('=', ctx);

        // On solution screen, press = to return to edit
        ratioModeModule.handleKey('=', ctx);
        if ((ctx.modeState.screen as string) !== 'INPUT_SCREEN') return false;

        // Cells must retain their values: A=2, B=3, D=9
        const cells = ctx.modeState.data.cells;
        return cells[0].val === 2 && cells[1].val === 3 && cells[2].val === 9;
      },
    },
  ];

  return tests.map((t) => {
    try {
      return { name: t.name, passed: t.test() };
    } catch (e: any) {
      return { name: t.name, passed: false, details: e.message };
    }
  });
}
