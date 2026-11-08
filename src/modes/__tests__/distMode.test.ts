/**
 * Tests for DIST Mode (Distribution Placeholder)
 */

import { distModeModule } from '../distMode';

export function runDistModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'DIST mode is marked not implemented',
      test: () => !distModeModule.isImplemented,
    },
    {
      name: 'DIST mode indicator is "DIST"',
      test: () => distModeModule.getIndicator(distModeModule.getInitialState()) === 'DIST',
    },
    {
      name: 'DIST initial screen is NOT_IMPLEMENTED',
      test: () => distModeModule.getInitialState().screen === 'NOT_IMPLEMENTED',
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
