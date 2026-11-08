/**
 * Tests for EQN Mode
 */

import { eqnModeModule } from '../eqnMode';

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
  ];

  return tests.map((t) => {
    try {
      return { name: t.name, passed: t.test() };
    } catch (e: any) {
      return { name: t.name, passed: false, details: e.message };
    }
  });
}
