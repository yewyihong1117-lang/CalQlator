/**
 * Tests for RATIO Mode (Ratio Placeholder)
 */

import { ratioModeModule } from '../ratioMode';

export function runRatioModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'RATIO mode is marked not implemented',
      test: () => !ratioModeModule.isImplemented,
    },
    {
      name: 'RATIO mode indicator is "RATIO"',
      test: () => ratioModeModule.getIndicator(ratioModeModule.getInitialState()) === 'RATIO',
    },
    {
      name: 'RATIO initial screen is NOT_IMPLEMENTED',
      test: () => ratioModeModule.getInitialState().screen === 'NOT_IMPLEMENTED',
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
