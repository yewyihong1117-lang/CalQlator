/**
 * Tests for EQN Mode (Simultaneous & Polynomial Degree 2 and 3)
 */

import { eqnModeModule, solveQuadratic, solveCubic } from '../eqnMode';

export function runEqnModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'EQN mode indicator is "EQN"',
      test: () => eqnModeModule.getIndicator(eqnModeModule.getInitialState()) === 'EQN',
    },
    {
      name: 'EQN supports Simul Equation and Polynomial',
      test: () => eqnModeModule.isImplemented,
    },
    {
      name: 'EQN degree 2 quadratic real roots (x² - 5x + 6 = 0 -> 3, 2)',
      test: () => {
        const sols = solveQuadratic(1, -5, 6);
        return sols.includes('x₁ = 3') && sols.includes('x₂ = 2');
      },
    },
    {
      name: 'EQN degree 2 quadratic complex roots (x² + 1 = 0 -> 0 + 1i, 0 - 1i)',
      test: () => {
        const sols = solveQuadratic(1, 0, 1);
        return sols[0].includes('i') && sols[1].includes('i');
      },
    },
    {
      name: 'EQN degree 3 cubic real roots (x³ - 6x² + 11x - 6 = 0 -> 3, 2, 1)',
      test: () => {
        const sols = solveCubic(1, -6, 11, -6);
        return sols.length === 3 && sols.includes('x₁ = 3') && sols.includes('x₂ = 2') && sols.includes('x₃ = 1');
      },
    },
    {
      name: 'EQN degree 3 cubic complex roots (x³ - 1 = 0 -> x₁=1, x₂,x₃ complex)',
      test: () => {
        const sols = solveCubic(1, 0, 0, -1);
        return sols.length === 3 && sols[0] === 'x₁ = 1' && sols[1].includes('i') && sols[2].includes('i');
      },
    },
    {
      name: 'EQN degree 3 cubic triple root ((x - 2)³ = x³ - 6x² + 12x - 8 = 0 -> 2, 2, 2)',
      test: () => {
        const sols = solveCubic(1, -6, 12, -8);
        return sols.length === 3 && sols.every((s) => s.includes('2'));
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
