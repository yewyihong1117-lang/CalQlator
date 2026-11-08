/**
 * Tests for BASE Mode (Base-N Calculations)
 */

import { baseModeModule, formatBaseValue, parseAndEvalBase } from '../baseMode';

export function runBaseModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'BASE keymap overrides x² (DEC), x^□ (HEX), log (BIN), ln (OCT)',
      test: () => {
        const ov = baseModeModule.keymap.overrides;
        return 'x²' in ov && ('x^□' in ov || 'x□' in ov) && 'log' in ov && 'ln' in ov;
      },
    },
    {
      name: 'BASE keymap maps (-), °, hyp, sin, cos, tan to hex A-F',
      test: () => {
        const ov = baseModeModule.keymap.overrides;
        return ov['(-)']?.label === 'A' && ov['hyp']?.label === 'C' && ov['tan']?.label === 'F';
      },
    },
    {
      name: 'Format value 15 in HEX gives F',
      test: () => formatBaseValue(15, 'HEX') === 'F',
    },
    {
      name: 'Format value 15 in BIN gives 1111',
      test: () => formatBaseValue(15, 'BIN') === '1111',
    },
    {
      name: 'Format value 15 in OCT gives 17',
      test: () => formatBaseValue(15, 'OCT') === '17',
    },
    {
      name: 'Base-N evaluation in DEC: 10 + 5 = 15',
      test: () => parseAndEvalBase('10 + 5', 'DEC').val === 15,
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
