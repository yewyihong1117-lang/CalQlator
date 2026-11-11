/**
 * Tests for INEQ Mode (Inequality Mode)
 * 
 * Verifies all 10 user-requested test calculations:
 * 1. x² - 1 > 0 → x < -1, x > 1
 * 2. x² - 1 ≤ 0 → -1 <= x <= 1
 * 3. x² + 1 > 0 → All real numbers
 * 4. x² + 1 < 0 → No solution
 * 5. (x-1)² ≥ 0 → All real numbers
 * 6. (x-1)² > 0 → x < 1, x > 1
 * 7. (x-1)² ≤ 0 → x = 1
 * 8. x³ - 6x² + 11x - 6 > 0 → 1 < x < 2, x > 3
 * 9. x⁴ - 5x² + 4 ≤ 0 → -2 <= x <= -1, 1 <= x <= 2
 * 10. Leading coefficient 0 → Math ERROR
 * 
 * Also verifies interactive UI flow, expression cell evaluation, and multi-interval navigation.
 */

import { ineqModeModule, solveInequality } from '../ineqMode';
import { ModeContext, ModeState } from '../types';

export function runIneqModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'INEQ mode is marked implemented',
      test: () => ineqModeModule.isImplemented === true,
    },
    {
      name: 'INEQ mode indicator is "INEQ"',
      test: () => ineqModeModule.getIndicator(ineqModeModule.getInitialState()) === 'INEQ',
    },
    {
      name: 'INEQ initial screen is SELECT_DEGREE',
      test: () => ineqModeModule.getInitialState().screen === 'SELECT_DEGREE',
    },
    // Case 1: x² - 1 > 0 → x < -1, x > 1
    {
      name: 'Test 1: x² - 1 > 0 → x < -1, x > 1',
      test: () => {
        const sol = solveInequality([1, 0, -1], '>');
        return sol === 'x < -1, x > 1';
      },
    },
    // Case 2: x² - 1 ≤ 0 → -1 <= x <= 1
    {
      name: 'Test 2: x² - 1 ≤ 0 → -1 <= x <= 1',
      test: () => {
        const sol = solveInequality([1, 0, -1], '<=');
        return sol === '-1 <= x <= 1' || sol === '-1 ≤ x ≤ 1';
      },
    },
    // Case 3: x² + 1 > 0 → All real numbers
    {
      name: 'Test 3: x² + 1 > 0 → All real numbers',
      test: () => {
        const sol = solveInequality([1, 0, 1], '>');
        return sol === 'All real numbers';
      },
    },
    // Case 4: x² + 1 < 0 → No solution
    {
      name: 'Test 4: x² + 1 < 0 → No solution',
      test: () => {
        const sol = solveInequality([1, 0, 1], '<');
        return sol === 'No solution';
      },
    },
    // Case 5: (x-1)² ≥ 0 → All real numbers
    {
      name: 'Test 5: (x-1)² ≥ 0 → All real numbers',
      test: () => {
        const sol = solveInequality([1, -2, 1], '>=');
        return sol === 'All real numbers';
      },
    },
    // Case 6: (x-1)² > 0 → x < 1, x > 1
    {
      name: 'Test 6: (x-1)² > 0 → x < 1, x > 1',
      test: () => {
        const sol = solveInequality([1, -2, 1], '>');
        return sol === 'x < 1, x > 1';
      },
    },
    // Case 7: (x-1)² ≤ 0 → x = 1
    {
      name: 'Test 7: (x-1)² ≤ 0 → x = 1',
      test: () => {
        const sol = solveInequality([1, -2, 1], '<=');
        return sol === 'x = 1';
      },
    },
    // Case 8: x³ - 6x² + 11x - 6 > 0 → 1 < x < 2, x > 3
    {
      name: 'Test 8: x³ - 6x² + 11x - 6 > 0 → 1 < x < 2, x > 3',
      test: () => {
        const sol = solveInequality([1, -6, 11, -6], '>');
        return sol === '1 < x < 2, x > 3';
      },
    },
    // Case 9: x⁴ - 5x² + 4 ≤ 0 → -2 <= x <= -1, 1 <= x <= 2
    {
      name: 'Test 9: x⁴ - 5x² + 4 ≤ 0 → -2 <= x <= -1, 1 <= x <= 2',
      test: () => {
        const sol = solveInequality([1, 0, -5, 0, 4], '<=');
        return (
          sol === '-2 <= x <= -1, 1 <= x <= 2' ||
          sol === '-2 ≤ x ≤ -1, 1 ≤ x ≤ 2'
        );
      },
    },
    // Case 10: Leading coefficient 0 → Math ERROR
    {
      name: 'Test 10: Leading coefficient 0 → Math ERROR',
      test: () => {
        const sol = solveInequality([0, 1, -1], '>');
        return sol === 'Math ERROR';
      },
    },
    // Interactive UI Flow: Select degree 2 -> Select form 1 -> Coeff input -> Solution
    {
      name: 'UI Flow: Select degree 2 -> Select form 1 -> Coeff input [1, 0, -1] -> x < -1, x > 1',
      test: () => {
        let state: ModeState = ineqModeModule.getInitialState();
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

        // Select Degree 2
        ineqModeModule.handleKey('2', ctx);
        if ((ctx.modeState.screen as string) !== 'SELECT_FORM') return false;

        // Select Form 1 (>)
        ineqModeModule.handleKey('1', ctx);
        if ((ctx.modeState.screen as string) !== 'COEFF_INPUT') return false;

        // Input coefficients a=1, b=0, c=-1
        ineqModeModule.handleKey('1', ctx);
        ineqModeModule.handleKey('=', ctx);
        ineqModeModule.handleKey('0', ctx);
        ineqModeModule.handleKey('=', ctx);
        ineqModeModule.handleKey('-', ctx);
        ineqModeModule.handleKey('1', ctx);
        ineqModeModule.handleKey('=', ctx);

        return (
          (ctx.modeState.screen as string) === 'SOLUTIONS' &&
          ctx.modeState.data.solutionText === 'x < -1, x > 1'
        );
      },
    },
    // Cell Expression Evaluation: accepts fractions and sqrt
    {
      name: 'UI Flow: Cell accepts math expressions (e.g. 1/2, Ans)',
      test: () => {
        let state: ModeState = ineqModeModule.getInitialState();
        const ctx: ModeContext = {
          modeState: state,
          setModeState: (updater) => {
            state = typeof updater === 'function' ? updater(state) : updater;
            ctx.modeState = state;
          },
          sharedMemory: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0, Ans: 2 },
          setSharedMemory: () => {},
          exitToCalc: () => {},
          openSubMenu: () => {},
          closeSubMenu: () => {},
          triggerHapticFeedback: () => {},
          playAudioFeedback: () => {},
          angleMode: 'DEG',
          displayFormat: 'NORM1',
        };

        ineqModeModule.handleKey('2', ctx);
        ineqModeModule.handleKey('1', ctx);

        // a = 1
        ineqModeModule.handleKey('1', ctx);
        ineqModeModule.handleKey('=', ctx);

        // b = -Ans (where Ans = 2, so b = -2)
        ineqModeModule.handleKey('-', ctx);
        ineqModeModule.handleKey('Ans', ctx);
        ineqModeModule.handleKey('=', ctx);

        // c = 1
        ineqModeModule.handleKey('1', ctx);
        ineqModeModule.handleKey('=', ctx);

        // (x-1)^2 > 0 -> x < 1, x > 1
        return (
          (ctx.modeState.screen as string) === 'SOLUTIONS' &&
          ctx.modeState.data.solutionText === 'x < 1, x > 1'
        );
      },
    },
    // Multi-interval navigation with UP/DOWN
    {
      name: 'UI Flow: Multi-interval navigation with UP/DOWN arrows',
      test: () => {
        let state: ModeState = ineqModeModule.getInitialState();
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

        ineqModeModule.handleKey('2', ctx);
        ineqModeModule.handleKey('1', ctx);
        ineqModeModule.handleKey('1', ctx);
        ineqModeModule.handleKey('=', ctx);
        ineqModeModule.handleKey('0', ctx);
        ineqModeModule.handleKey('=', ctx);
        ineqModeModule.handleKey('-', ctx);
        ineqModeModule.handleKey('1', ctx);
        ineqModeModule.handleKey('=', ctx);

        if ((ctx.modeState.screen as string) !== 'SOLUTIONS') return false;
        if (ctx.modeState.data.selectedSolutionIdx !== 0) return false;

        // Press DOWN arrow to advance interval
        ineqModeModule.handleKey('DOWN', ctx);
        if (ctx.modeState.data.selectedSolutionIdx !== 1) return false;

        // Press UP arrow to return to first interval
        ineqModeModule.handleKey('UP', ctx);
        if (ctx.modeState.data.selectedSolutionIdx !== 0) return false;

        // Press [=] to return to COEFF_INPUT
        ineqModeModule.handleKey('=', ctx);
        return (ctx.modeState.screen as string) === 'COEFF_INPUT';
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
