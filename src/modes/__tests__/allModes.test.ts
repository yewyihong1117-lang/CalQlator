/**
 * Aggregator for all 12 Mode Unit Tests
 */

import { runCalcModeTests } from './calcMode.test';
import { runCmplxModeTests } from './cmplxMode.test';
import { runBaseModeTests } from './baseMode.test';
import { runMatrixModeTests } from './matrixMode.test';
import { runVectorModeTests } from './vectorMode.test';
import { runStatModeTests } from './statMode.test';
import { runTableModeTests } from './tableMode.test';
import { runEqnModeTests } from './eqnMode.test';
import { runDistModeTests } from './distMode.test';
import { runSheetModeTests } from './sheetMode.test';
import { runIneqModeTests } from './ineqMode.test';
import { runRatioModeTests } from './ratioMode.test';

export interface ModeTestResult {
  mode: string;
  tests: { name: string; passed: boolean; details?: string }[];
}

export function runAllModeTests(): ModeTestResult[] {
  return [
    { mode: 'CALC', tests: runCalcModeTests() },
    { mode: 'CMPLX', tests: runCmplxModeTests() },
    { mode: 'BASE', tests: runBaseModeTests() },
    { mode: 'MATRIX', tests: runMatrixModeTests() },
    { mode: 'VECTOR', tests: runVectorModeTests() },
    { mode: 'STAT', tests: runStatModeTests() },
    { mode: 'TABLE', tests: runTableModeTests() },
    { mode: 'EQN', tests: runEqnModeTests() },
    { mode: 'DIST', tests: runDistModeTests() },
    { mode: 'SHEET', tests: runSheetModeTests() },
    { mode: 'INEQ', tests: runIneqModeTests() },
    { mode: 'RATIO', tests: runRatioModeTests() },
  ];
}
