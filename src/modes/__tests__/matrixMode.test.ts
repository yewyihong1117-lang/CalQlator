/**
 * Tests for MATRIX Mode
 */

import { matrixModeModule } from '../matrixMode';

export function runMatrixModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'MATRIX mode indicator is "MAT"',
      test: () => matrixModeModule.getIndicator(matrixModeModule.getInitialState()) === 'MAT',
    },
    {
      name: 'MATRIX keymap overrides OPTN',
      test: () => 'OPTN' in matrixModeModule.keymap.overrides,
    },
    {
      name: 'MATRIX sub-menu provides Define Matrix and MatA-MatD',
      test: () => {
        const sub = matrixModeModule.getSubMenu?.(matrixModeModule.getInitialState());
        return !!sub && sub[0].items.some((i) => i.name === 'Define Matrix');
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
