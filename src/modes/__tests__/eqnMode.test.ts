/**
 * Tests for EQN Mode (Simultaneous Equations & Polynomial Degree 2 and 3)
 */

import {
  eqnModeModule,
  solveQuadratic,
  solveCubic,
  solveSimultaneousEquations,
  toSimulFrac,
} from '../eqnMode';

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
    // Polynomial tests
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
    // Simultaneous Equation tests
    {
      name: 'EQN Simul 2 unknowns integer solution (2x + y = 5, x - y = 1 -> x=2, y=1)',
      test: () => {
        const mat = [
          [2, 1, 5],
          [1, -1, 1],
        ];
        const res = solveSimultaneousEquations(mat, 2);
        if (!res.success || !res.solutions) return false;
        const x = res.solutions.find((s) => s.varName === 'x');
        const y = res.solutions.find((s) => s.varName === 'y');
        return x?.exactFraction === '2' && y?.exactFraction === '1';
      },
    },
    {
      name: 'EQN Simul 2 unknowns exact rational fraction (3x + 2y = 7, x - 4y = -1 -> x=13/7, y=5/7)',
      test: () => {
        const mat = [
          [3, 2, 7],
          [1, -4, -1],
        ];
        const res = solveSimultaneousEquations(mat, 2);
        if (!res.success || !res.solutions) return false;
        const x = res.solutions.find((s) => s.varName === 'x');
        const y = res.solutions.find((s) => s.varName === 'y');
        return x?.exactFraction === '13/7' && y?.exactFraction === '5/7';
      },
    },
    {
      name: 'EQN Simul 2 unknowns singular/inconsistent returns Math ERROR',
      test: () => {
        const mat = [
          [1, 1, 1],
          [1, 1, 2],
        ];
        const res = solveSimultaneousEquations(mat, 2);
        return !res.success && res.error === 'Math ERROR';
      },
    },
    {
      name: 'EQN Simul 3 unknowns integer solution (x+y+z=6, 2y+5z=-4, 2x+5y-z=27 -> x=5, y=3, z=-2)',
      test: () => {
        const mat = [
          [1, 1, 1, 6],
          [0, 2, 5, -4],
          [2, 5, -1, 27],
        ];
        const res = solveSimultaneousEquations(mat, 3);
        if (!res.success || !res.solutions) return false;
        const x = res.solutions.find((s) => s.varName === 'x');
        const y = res.solutions.find((s) => s.varName === 'y');
        const z = res.solutions.find((s) => s.varName === 'z');
        return x?.exactFraction === '5' && y?.exactFraction === '3' && z?.exactFraction === '-2';
      },
    },
    {
      name: 'EQN Simul 4 unknowns exact rational solution',
      test: () => {
        const mat = [
          [1, 1, 1, 1, 10],
          [1, -1, 2, -1, 2],
          [2, 1, -1, 2, 11],
          [3, 2, 1, -1, 9],
        ];
        const res = solveSimultaneousEquations(mat, 4);
        if (!res.success || !res.solutions) return false;
        const x = res.solutions.find((s) => s.varName === 'x');
        const y = res.solutions.find((s) => s.varName === 'y');
        const z = res.solutions.find((s) => s.varName === 'z');
        const t = res.solutions.find((s) => s.varName === 't');
        return (
          x?.exactFraction === '30/13' &&
          y?.exactFraction === '21/13' &&
          z?.exactFraction === '32/13' &&
          t?.exactFraction === '47/13'
        );
      },
    },
    {
      name: 'EQN Simul handles tiny float noise (2.0000000001 -> 2)',
      test: () => {
        const f = toSimulFrac(2.00000000005);
        return f !== null && f.toString() === '2';
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
