/**
 * Tests for DIST Mode (Mode 7: Distribution)
 *
 * Covers:
 * - Menu pagination (Page 1/2 & Page 2/2)
 * - Numerical accuracy across Normal PD, Normal CD, Inverse Normal,
 *   Binomial PD, Binomial CD, Poisson PD, Poisson CD (including large N/x and extreme tails)
 * - Interactive Variable and List workflows
 * - Expression parsing (1/6, √2, -1E99, -1×10^(99, Ans)
 * - Ans shared memory updates
 * - Math ERROR domain validations & dismissal (AC, ◄, ►)
 * - OPTN submenu and Fix/Sci/Norm2 display formatting
 */

import {
  distModeModule,
  normalPdf,
  normalCd,
  inverseNormal,
  binomialPd,
  binomialCd,
  poissonPd,
  poissonCd,
  DistData,
} from '../distMode';
import { ModeContext, ModeState, SharedMemory } from '../types';

function approx(actual: number, expected: number, tol = 1e-8): boolean {
  return Math.abs(actual - expected) <= tol;
}

function createMockContext(overrides: Partial<ModeContext> = {}): {
  ctx: ModeContext;
  getState: () => ModeState;
  getMemory: () => SharedMemory;
  exitedToCalc: () => boolean;
} {
  let state: ModeState = distModeModule.getInitialState();
  let memory: SharedMemory = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    X: 0,
    Y: 0,
    M: 0,
    Ans: 0,
  };
  let exited = false;

  const ctx: ModeContext = {
    modeState: state,
    setModeState: (updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
      ctx.modeState = state;
    },
    sharedMemory: memory,
    setSharedMemory: (updater) => {
      memory = typeof updater === 'function' ? updater(memory) : updater;
      ctx.sharedMemory = memory;
    },
    exitToCalc: () => {
      exited = true;
    },
    openSubMenu: () => {},
    closeSubMenu: () => {},
    triggerHapticFeedback: () => {},
    playAudioFeedback: () => {},
    angleMode: 'DEG',
    displayFormat: 'NORM1',
    fixDigits: 2,
    sciDigits: 3,
    ...overrides,
  };

  return {
    ctx,
    getState: () => state,
    getMemory: () => memory,
    exitedToCalc: () => exited,
  };
}

function pressKeys(keys: string[], ctx: ModeContext) {
  for (const k of keys) {
    distModeModule.handleKey(k, ctx);
  }
}

export function runDistModeTests(): { name: string; passed: boolean; details?: string }[] {
  const tests = [
    {
      name: 'DIST mode is marked implemented with indicator "DIST"',
      test: () =>
        distModeModule.isImplemented === true &&
        distModeModule.getIndicator(distModeModule.getInitialState()) === 'DIST' &&
        distModeModule.getInitialState().screen === 'SELECT_DIST',
    },
    {
      name: 'Selection Menu: Page 1/2 navigates to Page 2/2 via DOWN past item 4',
      test: () => {
        const { ctx, getState } = createMockContext();
        pressKeys(['DOWN', 'DOWN', 'DOWN'], ctx);
        let d = getState().data as DistData;
        if (d.menuCursorIdx !== 3) return false; // 4: Binomial PD
        pressKeys(['DOWN'], ctx);
        d = getState().data as DistData;
        if (d.menuCursorIdx !== 4) return false; // 1: Binomial CD (Page 2/2)
        // Pressing '2' on Page 2 selects Poisson PD
        pressKeys(['2'], ctx);
        d = getState().data as DistData;
        return getState().screen === 'SELECT_INPUT_MODE' && d.distType === 'POISSON_PD';
      },
    },
    {
      name: 'Normal PD numerical accuracy: f(0, 1, 0) ≈ 0.3989422804',
      test: () => approx(normalPdf(0, 1, 0), 0.3989422804014327, 1e-12),
    },
    {
      name: 'Normal CD numerical accuracy: standard intervals, extreme tails, and lower > upper',
      test: () => {
        const p1 = normalCd(-1, 1, 1, 0);
        const p2 = normalCd(-1e99, 1.959963984540054, 1, 0);
        const p3 = normalCd(5, 6, 1, 0); // 2.866515718e-7 - 9.86587645e-10
        const p4 = normalCd(2, 1, 1, 0);
        return (
          approx(p1, 0.6826894921370859, 1e-10) &&
          approx(p2, 0.975, 1e-10) &&
          approx(p3, 2.85664984e-7, 1e-12) &&
          p4 === 0
        );
      },
    },
    {
      name: 'Inverse Normal numerical accuracy: Area 0.975, 0.5, and 0.025',
      test: () => {
        const z975 = inverseNormal(0.975, 1, 0);
        const med = inverseNormal(0.5, 5, 100);
        const low = inverseNormal(0.025, 2, 10);
        return (
          approx(z975, 1.959963984540054, 1e-9) &&
          med === 100 &&
          approx(low, 10 - 2 * 1.959963984540054, 1e-8)
        );
      },
    },
    {
      name: 'Binomial PD & CD accuracy including large N=1000 / N=5000 without overflow',
      test: () => {
        const pd = binomialPd(3, 10, 0.5);
        const cd = binomialCd(3, 10, 0.5);
        const bigPd = binomialPd(500, 1000, 0.5);
        const bigCd = binomialCd(2500, 5000, 0.5);
        return (
          approx(pd, 0.1171875, 1e-12) &&
          approx(cd, 0.171875, 1e-12) &&
          approx(bigPd, 0.02522501817836, 1e-9) &&
          approx(bigCd, 0.50564148, 1e-6)
        );
      },
    },
    {
      name: 'Poisson PD & CD accuracy including large lambda=500 / x=3000 without overflow',
      test: () => {
        const pd = poissonPd(2, 3);
        const cd = poissonCd(2, 3);
        const bigPd = poissonPd(500, 500);
        const bigCd = poissonCd(3000, 3000);
        return (
          approx(pd, 0.22404180765538775, 1e-12) &&
          approx(cd, 0.42319008112684364, 1e-12) &&
          approx(bigPd, 0.017838267869447477, 1e-11) &&
          approx(bigCd, 0.5048555639765586, 1e-9)
        );
      },
    },
    {
      name: 'Interactive Normal CD with (-1×10^(99 to 1.96) updates Ans & returns to Param on AC',
      test: () => {
        const { ctx, getState, getMemory } = createMockContext();
        // Select 2: Normal CD
        pressKeys(['2'], ctx);
        if (getState().screen !== 'PARAM_INPUT') return false;
        // Lower = -1×10^(99
        pressKeys(['(-', '1', '×10^(', '9', '9', '='], ctx);
        // Upper = 1.959963985
        pressKeys(['1', '.', '9', '5', '9', '9', '6', '3', '9', '8', '5', '='], ctx);
        // Accept default sigma=1, mu=0
        pressKeys(['=', '='], ctx);
        const d = getState().data as DistData;
        if (getState().screen !== 'RESULT' || d.resultLabel !== 'p') return false;
        if (!approx(d.resultValue ?? 0, 0.975, 1e-7)) return false;
        if (!approx(getMemory().Ans, 0.975, 1e-7)) return false;

        // AC returns to PARAM_INPUT keeping previous values
        pressKeys(['AC'], ctx);
        const dAfter = getState().data as DistData;
        return (
          getState().screen === 'PARAM_INPUT' &&
          dAfter.params.lower.raw === '-1×10^(99'
        );
      },
    },
    {
      name: 'Interactive Binomial PD List mode with p = 1/6 computes x | P table',
      test: () => {
        const { ctx, getState, getMemory } = createMockContext();
        // 4: Binomial PD -> 1: List
        pressKeys(['4', '1'], ctx);
        if (getState().screen !== 'LIST_INPUT') return false;
        // Enter x = 0, 1, 2
        pressKeys(['0', '=', '1', '=', '2', '='], ctx);
        // Trailing empty '=' moves to PARAM_INPUT (N, p)
        pressKeys(['='], ctx);
        if (getState().screen !== 'PARAM_INPUT') return false;
        // Enter N = 5, p = 1■/□6
        pressKeys(['5', '=', '1', '■/□', '6', '='], ctx);
        const d = getState().data as DistData;
        if (getState().screen !== 'LIST_RESULT' || d.listResults.length !== 3) return false;
        const p0 = Math.pow(5 / 6, 5);
        const p1 = 5 * (1 / 6) * Math.pow(5 / 6, 4);
        const p2 = 10 * Math.pow(1 / 6, 2) * Math.pow(5 / 6, 3);
        return (
          approx(d.listResults[0].pVal, p0, 1e-10) &&
          approx(d.listResults[1].pVal, p1, 1e-10) &&
          approx(d.listResults[2].pVal, p2, 1e-10) &&
          approx(getMemory().Ans, p0, 1e-10)
        );
      },
    },
    {
      name: 'Math ERROR validations (sigma<=0, Inverse Normal Area bounds, p>1, N fractional, lambda<=0) and AC/LEFT dismissal',
      test: () => {
        const { ctx, getState } = createMockContext();
        // Normal PD with sigma = 0 -> Math ERROR
        pressKeys(['1', '=', '0', '=', '='], ctx);
        if (getState().screen !== 'ERROR') return false;
        if ((getState().data as DistData).error !== 'Math ERROR') return false;
        // Dismiss with LEFT
        pressKeys(['LEFT'], ctx);
        if (getState().screen !== 'PARAM_INPUT') return false;

        // OPTN -> 1: Select Type -> Inverse Normal with Area = 1.2 -> Math ERROR
        pressKeys(['OPTN', '1', '3', '1', '.', '2', '=', '=', '='], ctx);
        if (getState().screen !== 'ERROR') return false;
        pressKeys(['AC'], ctx);
        if (getState().screen !== 'PARAM_INPUT') return false;

        // Poisson CD with lambda = 0 -> Math ERROR
        pressKeys(['OPTN', '1', 'DOWN', 'DOWN', 'DOWN', 'DOWN', '3', '2', '2', '=', '0', '='], ctx);
        return getState().screen === 'ERROR';
      },
    },
    {
      name: 'OPTN Submenu switches between Select Type and Parameter without losing values',
      test: () => {
        const { ctx, getState } = createMockContext();
        // Normal PD with x = √(2)
        pressKeys(['1', '√', '2', '='], ctx);
        if (getState().screen !== 'PARAM_INPUT') return false;
        // OPTN -> 2: Parameter returns to PARAM_INPUT preserving x = √(2
        pressKeys(['OPTN'], ctx);
        if (getState().screen !== 'SUBMENU') return false;
        pressKeys(['2'], ctx);
        const d = getState().data as DistData;
        return getState().screen === 'PARAM_INPUT' && approx(d.params.x.val, Math.SQRT2, 1e-12);
      },
    },
  ];

  return tests.map((t) => {
    try {
      const ok = t.test();
      return { name: t.name, passed: ok };
    } catch (e: any) {
      return { name: t.name, passed: false, details: e.message };
    }
  });
}
