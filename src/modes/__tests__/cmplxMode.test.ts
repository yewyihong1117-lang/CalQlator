/**
 * Tests for CMPLX Mode (Complex Numbers)
 */

import { cmplxModeModule, evalComplexExpression } from '../cmplxMode';

export function runCmplxModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'CMPLX mode indicator displays "i"',
      test: () => cmplxModeModule.getIndicator(cmplxModeModule.getInitialState()) === 'i',
    },
    {
      name: 'CMPLX keymap overrides ENG and OPTN keys',
      test: () => 'ENG' in cmplxModeModule.keymap.overrides && 'OPTN' in cmplxModeModule.keymap.overrides,
    },
    {
      name: 'CMPLX sub-menu contains i, Conjg, arg, ReP',
      test: () => {
        const sub = cmplxModeModule.getSubMenu?.(cmplxModeModule.getInitialState());
        return !!sub && sub[0].items.some((i) => i.name === 'Conjg');
      },
    },
    {
      name: 'Complex imaginary evaluation √(-1) → i',
      test: () => evalComplexExpression('√(-1)').result === 'i',
    },
    {
      name: 'Complex imaginary squared i^2 → -1',
      test: () => evalComplexExpression('i^2').result === '-1',
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
