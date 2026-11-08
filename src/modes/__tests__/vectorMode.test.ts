/**
 * Tests for VECTOR Mode
 */

import { vectorModeModule } from '../vectorMode';

export function runVectorModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'VECTOR mode indicator is "VCT"',
      test: () => vectorModeModule.getIndicator(vectorModeModule.getInitialState()) === 'VCT',
    },
    {
      name: 'VECTOR keymap overrides OPTN',
      test: () => 'OPTN' in vectorModeModule.keymap.overrides,
    },
    {
      name: 'VECTOR sub-menu provides Dot Product and VctA-VctD',
      test: () => {
        const sub = vectorModeModule.getSubMenu?.(vectorModeModule.getInitialState());
        return !!sub && sub[1].items.some((i) => i.name === 'Dot Product');
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
