/**
 * Tests for SHEET Mode (Spreadsheet Placeholder)
 */

import { sheetModeModule } from '../sheetMode';

export function runSheetModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'SHEET mode is marked not implemented',
      test: () => !sheetModeModule.isImplemented,
    },
    {
      name: 'SHEET mode indicator is "SHEET"',
      test: () => sheetModeModule.getIndicator(sheetModeModule.getInitialState()) === 'SHEET',
    },
    {
      name: 'SHEET initial screen is NOT_IMPLEMENTED',
      test: () => sheetModeModule.getInitialState().screen === 'NOT_IMPLEMENTED',
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
