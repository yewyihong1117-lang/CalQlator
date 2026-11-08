/**
 * fx-570EX ClassWiz - Mode Registry & Mode Manager
 * 
 * Central registry managing all 12 operational calculator modes.
 * Provides lookup, keymap resolution, indicator resolution, and switching logic.
 */

import { CalculatorModeId, ModeModule } from './types';
import { calcModeModule } from './calcMode';
import { cmplxModeModule } from './cmplxMode';
import { baseModeModule } from './baseMode';
import { matrixModeModule } from './matrixMode';
import { vectorModeModule } from './vectorMode';
import { statModeModule } from './statMode';
import { distModeModule } from './distMode';
import { sheetModeModule } from './sheetMode';
import { tableModeModule } from './tableMode';
import { eqnModeModule } from './eqnMode';
import { ineqModeModule } from './ineqMode';
import { ratioModeModule } from './ratioMode';

export const MODE_MODULES: Record<CalculatorModeId, ModeModule> = {
  CALC: calcModeModule,
  CMPLX: cmplxModeModule,
  BASE: baseModeModule,
  MATRIX: matrixModeModule,
  VECTOR: vectorModeModule,
  STAT: statModeModule,
  DIST: distModeModule,
  SHEET: sheetModeModule,
  TABLE: tableModeModule,
  EQN: eqnModeModule,
  INEQ: ineqModeModule,
  RATIO: ratioModeModule,
};

// Aliases for hardware codes
export function normalizeModeId(code: string): CalculatorModeId {
  const upper = code.toUpperCase();
  if (upper === 'COMP' || upper === 'CALCULATE') return 'CALC';
  if (upper === 'MAT') return 'MATRIX';
  if (upper === 'VCT') return 'VECTOR';
  if (upper in MODE_MODULES) return upper as CalculatorModeId;
  return 'CALC';
}

export function getModeModule(modeId: string): ModeModule {
  const norm = normalizeModeId(modeId);
  return MODE_MODULES[norm] || calcModeModule;
}

export function getAllModeModules(): ModeModule[] {
  return Object.values(MODE_MODULES);
}
