/**
 * Tests for STAT Mode
 */

import { statModeModule } from '../statMode';

export function runStatModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'STAT mode indicator is "STAT"',
      test: () => statModeModule.getIndicator(statModeModule.getInitialState()) === 'STAT',
    },
    {
      name: 'STAT sub-menu provides 1-Variable Calc and Editor',
      test: () => {
        const sub = statModeModule.getSubMenu?.(statModeModule.getInitialState());
        return !!sub && sub[0].items.some((i) => i.name === '1-Variable Calc');
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
