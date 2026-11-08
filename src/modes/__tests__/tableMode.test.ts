/**
 * Tests for TABLE Mode
 */

import { tableModeModule, generateTableRows, evalMathFunction } from '../tableMode';

export function runTableModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'TABLE mode indicator is "TABLE"',
      test: () => tableModeModule.getIndicator(tableModeModule.getInitialState()) === 'TABLE',
    },
    {
      name: 'Evaluate math function 2x for x=3 gives 6',
      test: () => evalMathFunction('2x', 3) === 6,
    },
    {
      name: 'Generate table for f(x)=2x from 1 to 3 with step 1 has 3 rows',
      test: () => {
        const rows = generateTableRows('2x', '', 1, 3, 1);
        return rows.length === 3 && rows[0].fx === '2' && rows[2].fx === '6';
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
