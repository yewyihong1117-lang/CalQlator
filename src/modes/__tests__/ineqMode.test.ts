/**
 * Tests for INEQ Mode (Inequality Mode)
 * 
 * Verifies all requested test cases:
 * 1. x² − 5x + 6 > 0 → x<2, 3<x
 * 2. x² − 5x + 6 ≤ 0 → 2≤x≤3
 * 3. x² + 1 > 0 → All real numbers
 * 4. x² + 1 < 0 → No solution
 * 5. x² − 2x + 1 > 0 → x<1, 1<x
 * 6. x² − 2x + 1 ≥ 0 → All real numbers
 * 7. x³ − 6x² + 11x − 6 > 0 → 1<x<2, 3<x
 * 8. Degree 4: x⁴ − 5x² + 4 > 0 → x<-2, -1<x<1, 2<x
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
    // User requested Test 1: x² − 5x + 6 > 0 → x<2, 3<x
    {
      name: 'Test 1: x² − 5x + 6 > 0 → x<2, 3<x',
      test: () => {
        const sol = solveInequality([1, -5, 6], '>');
        return sol === 'x<2, 3<x';
      },
    },
    // User requested Test 2: x² − 5x + 6 ≤ 0 → 2≤x≤3
    {
      name: 'Test 2: x² − 5x + 6 ≤ 0 → 2≤x≤3',
      test: () => {
        const sol = solveInequality([1, -5, 6], '≤');
        return sol === '2≤x≤3';
      },
    },
    // User requested Test 3: x² + 1 > 0 → All real numbers
    {
      name: 'Test 3: x² + 1 > 0 → All real numbers',
      test: () => {
        const sol = solveInequality([1, 0, 1], '>');
        return sol === 'All real numbers';
      },
    },
    // User requested Test 4: x² + 1 < 0 → No solution
    {
      name: 'Test 4: x² + 1 < 0 → No solution',
      test: () => {
        const sol = solveInequality([1, 0, 1], '<');
        return sol === 'No solution';
      },
    },
    // User requested Test 5: x² − 2x + 1 > 0 → x<1, 1<x
    {
      name: 'Test 5: x² − 2x + 1 > 0 → x<1, 1<x',
      test: () => {
        const sol = solveInequality([1, -2, 1], '>');
        return sol === 'x<1, 1<x';
      },
    },
    // User requested Test 6: x² − 2x + 1 ≥ 0 → All real numbers
    {
      name: 'Test 6: x² − 2x + 1 ≥ 0 → All real numbers',
      test: () => {
        const sol = solveInequality([1, -2, 1], '≥');
        return sol === 'All real numbers';
      },
    },
    // User requested Test 7: x³ − 6x² + 11x − 6 > 0 → 1<x<2, 3<x
    {
      name: 'Test 7: x³ − 6x² + 11x − 6 > 0 → 1<x<2, 3<x',
      test: () => {
        const sol = solveInequality([1, -6, 11, -6], '>');
        return sol === '1<x<2, 3<x';
      },
    },
    // Degree 4 test: x⁴ − 5x² + 4 > 0 → x<-2, -1<x<1, 2<x
    {
      name: 'Test 8: x⁴ − 5x² + 4 > 0 → x<-2, -1<x<1, 2<x',
      test: () => {
        const sol = solveInequality([1, 0, -5, 0, 4], '>');
        return sol === 'x<-2, -1<x<1, 2<x';
      },
    },
    // Key Navigation and State Transitions
    {
      name: 'Key Navigation: Select degree 2 -> Select form 1 -> Coeff input -> Solution',
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

        // Input coefficients 1, = -5, = 6, =
        ineqModeModule.handleKey('1', ctx);
        ineqModeModule.handleKey('=', ctx);
        ineqModeModule.handleKey('-', ctx);
        ineqModeModule.handleKey('5', ctx);
        ineqModeModule.handleKey('=', ctx);
        ineqModeModule.handleKey('6', ctx);
        ineqModeModule.handleKey('=', ctx);

        return (ctx.modeState.screen as string) === 'SOLUTIONS' && ctx.modeState.data.solutionText === 'x<2, 3<x';
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
