/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { 
  Power, Sparkles
} from 'lucide-react';
import { 
  AngleMode, DisplayFormat, HistoryItem,
  evaluateMathExpression, evaluateMathAst, formatResult,
  toEngineering, decimalToDms, primeFactorization,
  solveEquation,
  SCIENTIFIC_CONSTANTS, METRIC_CONVERSIONS,
  MENU_PAGES, ALL_MENU_ITEMS, MenuItem,
  navigateMenuGrid
} from './calcEngine';
import { 
  CalculatorModeId, ModeState, ModeContext, SharedMemory
} from './modes/types';
import { 
  getModeModule, normalizeModeId
} from './modes/modeRegistry';
import { 
  playKeyClick, setSoundEnabled,
  triggerHaptic, setHapticEnabled,
  HapticKeyType 
} from './audioFeedback';
import { 
  MathAstState, MathNode, createInitialAstState,
  insertToken, insertFraction, insertIntegral, insertDerivative, insertSqrt,
  insertPower, insertPostfix, PostfixOp, insertLogBase, navigateAst, deleteAst,
  astToExpression, astToDisplayText, parseStringToAst, TokenType
} from './mathAst';
import { NaturalDisplay } from './components/NaturalDisplay';
import {
  IntegralSvg, SigmaSvg, HollowBoxSvg, FractionKeySvg, SqrtKeySvg,
  CubeRootShiftSvg, NthRootShiftSvg, DoubleArrowSvg, OperatorSvg,
  DpadArrowSvg, HeaderGearSvg, HeaderScrollArrowsSvg
} from './components/MathGlyphs';
import { HistorySheet } from './components/HistorySheet';
import { ClassWizQrModal } from './components/ClassWizQrModal';
import { SettingsModal, CalculatorMode, CalculatorTheme, EditorMode } from './components/SettingsModal';
import { CalibrationModal } from './components/CalibrationModal';
import { TestHarnessModal } from './components/TestHarnessModal';
import { PerfOverlay } from './components/PerfOverlay';
import {
  CachedRect,
  toCachedRect,
  useSpringKeypad,
  runInlineFlipExpand,
} from './motion/useMotionEffects';
import {
  animateOpacityPulse,
  animateSpringTransform,
  computeFlipDelta,
  hasActiveSpring,
  prefersReducedMotion,
} from './motion/spring';

function useShrinkFirstFontSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  contentWrapperRef: React.RefObject<HTMLDivElement | null>,
  dependency: unknown,
  minFontSizePx: number
) {
  const [fontSizePx, setFontSizePx] = useState<number | undefined>(undefined);
  const currentPxRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const wrapper = contentWrapperRef.current;
    if (!container || !wrapper) return;

    const measure = () => {
      const availableWidth = container.clientWidth;
      if (availableWidth <= 0) return;

      const basePx = parseFloat(window.getComputedStyle(container).fontSize) || 20;
      const activePx = currentPxRef.current ?? basePx;

      // Measure actual inline content width (first child inline span for NaturalDisplay, or inner span)
      const targetEl = (wrapper.firstElementChild?.firstElementChild as HTMLElement | null) ||
        (wrapper.firstElementChild as HTMLElement | null) ||
        wrapper;
      const contentWidth = targetEl.getBoundingClientRect().width;
      if (contentWidth <= 0) {
        currentPxRef.current = basePx;
        setFontSizePx(basePx);
        return;
      }

      const estimatedBaseWidth = contentWidth * (basePx / activePx);
      let nextPx = basePx;
      if (estimatedBaseWidth > availableWidth - 2) {
        nextPx = Math.max(minFontSizePx, basePx * ((availableWidth - 2) / estimatedBaseWidth));
      }
      nextPx = Math.round(nextPx * 10) / 10;

      if (currentPxRef.current === undefined || Math.abs(currentPxRef.current - nextPx) >= 0.4) {
        currentPxRef.current = nextPx;
        setFontSizePx(nextPx);
      }
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(container);
      ro.observe(wrapper);
    }

    return () => {
      ro?.disconnect();
    };
  }, [containerRef, contentWrapperRef, dependency, minFontSizePx]);

  return fontSizePx;
}

interface DisplayWorkspaceProps {
  inlineHistory: HistoryItem[];
  astState: MathAstState;
  setAstState: React.Dispatch<React.SetStateAction<MathAstState>>;
  errorMessage: string | null;
  result: string;
  onInsertExpr: (expr: string, astRoot?: MathNode[]) => void;
  onInsertResult: (res: string) => void;
  editorMode: EditorMode;
  justCommitted: boolean;
  livePreviewResult: string;
  lastValidPreviewResult: string;
  onCursorTouched?: () => void;
}

const DisplayWorkspace: React.FC<DisplayWorkspaceProps> = React.memo(({
  inlineHistory,
  astState,
  setAstState,
  errorMessage,
  result,
  onInsertExpr,
  onInsertResult,
  editorMode,
  justCommitted,
  livePreviewResult,
  lastValidPreviewResult,
  onCursorTouched,
}) => {
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const [hasTopFade, setHasTopFade] = useState(false);

  const activeInputContainerRef = useRef<HTMLDivElement>(null);
  const activeInputWrapperRef = useRef<HTMLDivElement>(null);
  const activeResContainerRef = useRef<HTMLDivElement>(null);
  const activeResContentRef = useRef<HTMLDivElement>(null);
  const resultPulseRef = useRef<HTMLSpanElement>(null);
  const prevDisplayedResultRef = useRef<string>('');

  const exprKey = astToDisplayText(astState.root);
  const activeExprFontSize = useShrinkFirstFontSize(
    activeInputContainerRef,
    activeInputWrapperRef,
    exprKey,
    13.5
  );

  const previewText = livePreviewResult || lastValidPreviewResult;
  const activeResultText = errorMessage
    ? `[${errorMessage}]`
    : editorMode === 'PHONE' && !justCommitted
    ? previewText
      ? `= ${previewText}`
      : ''
    : result;

  const activeResFontSize = useShrinkFirstFontSize(
    activeResContainerRef,
    activeResContentRef,
    activeResultText,
    16
  );

  // Short opacity-only compositor pulse when result updates
  useEffect(() => {
    const el = resultPulseRef.current;
    if (!activeResultText) {
      prevDisplayedResultRef.current = '';
      return;
    }
    if (el && prevDisplayedResultRef.current !== '' && activeResultText !== prevDisplayedResultRef.current) {
      animateOpacityPulse(el, 0.36, 1);
    }
    prevDisplayedResultRef.current = activeResultText;
  }, [activeResultText]);

  // Keep inline history anchored to the bottom (newest just above active input) and update top fade state
  useLayoutEffect(() => {
    const el = historyScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setHasTopFade(el.scrollHeight > el.clientHeight + 2);
  }, [inlineHistory.length]);

  useEffect(() => {
    const el = historyScrollRef.current;
    if (!el) return;
    const updateFade = () => {
      setHasTopFade(el.scrollHeight > el.clientHeight + 2 || el.scrollTop > 2);
    };
    updateFade();
    el.addEventListener('scroll', updateFade, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateFade);
      ro.observe(el);
    }
    return () => {
      el.removeEventListener('scroll', updateFade);
      ro?.disconnect();
    };
  }, []);

  return (
    <div data-testid="display-workspace" className="display-workspace select-none">
      {/* Scrollable Inline History Zone: grows upward from active input with top-edge fade */}
      <div
        ref={historyScrollRef}
        data-testid="inline-history-scroll"
        className={`calc-history-scroll no-scrollbar ${hasTopFade ? 'has-top-fade' : ''}`}
      >
        <div className="calc-history-list">
          {inlineHistory.map((item, idx) => {
            const distFromBottom = inlineHistory.length - 1 - idx;
            const entryOpacity = Math.max(0.28, 0.84 - distFromBottom * 0.18);
            const itemNodes =
              item.astRoot && item.astRoot.length > 0
                ? item.astRoot
                : parseStringToAst(item.expression).root;

            return (
              <div
                key={item.id}
                data-testid={`inline-history-entry-${idx}`}
                className="calc-history-entry"
                style={{ opacity: entryOpacity }}
              >
                <div
                  onClick={() => onInsertExpr(item.expression, item.astRoot)}
                  title="Tap to edit in editor"
                  className="calc-history-expr no-scrollbar cursor-pointer hover:opacity-100"
                >
                  <NaturalDisplay
                    nodes={itemNodes}
                    readOnly
                    inheritColor
                  />
                </div>
                <div
                  onClick={() => onInsertResult(item.exactResult || item.result)}
                  title="Tap to insert result"
                  className="calc-history-res no-scrollbar cursor-pointer hover:opacity-100"
                >
                  = {item.result}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Anchored Active Input + Fixed-Height Result Zone */}
      <div data-testid="calc-active-area" className="calc-active-area">
        <div
          ref={activeInputContainerRef}
          data-testid="active-input-line"
          onClick={() => onCursorTouched?.()}
          className="calc-active-input-line"
        >
          <div ref={activeInputWrapperRef} className="w-full min-w-0">
            <NaturalDisplay
              nodes={astState.root}
              cursor={astState.cursor}
              pendingDeleteTemplateId={astState.pendingDeleteTemplateId}
              fontSize={activeExprFontSize}
              onSetCursor={(slotId, offset) => {
                onCursorTouched?.();
                setAstState((prev) => ({
                  ...prev,
                  cursor: { slotId, offset },
                }));
              }}
            />
          </div>
        </div>

        <div
          ref={activeResContainerRef}
          data-testid="active-result-line"
          className="calc-active-result-line no-scrollbar"
        >
          <div ref={activeResContentRef} className="inline-flex items-center justify-end whitespace-nowrap">
            {errorMessage ? (
              <span
                ref={resultPulseRef}
                className="text-[var(--ui-danger)] font-bold text-sm tracking-wider"
              >
                [{errorMessage}]
              </span>
            ) : editorMode === 'PHONE' && !justCommitted ? (
              previewText ? (
                <span
                  ref={resultPulseRef}
                  style={{ fontSize: activeResFontSize ? `${activeResFontSize}px` : undefined }}
                  className="opacity-55 text-[var(--display-text)] font-semibold"
                >
                  = {previewText}
                </span>
              ) : null
            ) : result ? (
              <span
                ref={resultPulseRef}
                onClick={() => onInsertResult(result)}
                title="Tap to insert result"
                style={{ fontSize: activeResFontSize ? `${activeResFontSize}px` : undefined }}
                className="text-[var(--display-text)] cursor-pointer select-text"
              >
                {result}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

// Display Menu Modes (All in-display, zero external chrome)
export type DisplayMenuType = 
  | 'NONE'
  | 'MENU'
  | 'SETUP'
  | 'SETUP_ANGLE'
  | 'SETUP_FORMAT'
  | 'SETUP_FIX'
  | 'SETUP_SCI'
  | 'SETUP_NORM'
  | 'SETUP_IO'
  | 'OPTN'
  | 'OPTN_HYP'
  | 'OPTN_ANGLE'
  | 'OPTN_ENG'
  | 'CONST_CAT'
  | 'CONST_LIST'
  | 'CONV_CAT'
  | 'CONV_LIST'
  | 'RESET'
  | 'RESET_CONFIRM'
  | 'STAT'
  | 'MATRIX'
  | 'VECTOR';

export interface SetupListItem {
  id: number;
  key: string;
  title: string;
  targetMenu?: DisplayMenuType;
  action?: () => void;
}

export const SETUP_PAGES: SetupListItem[][] = [
  // Page 1
  [
    { id: 1, key: '1', title: 'Input/Output', targetMenu: 'SETUP_IO' },
    { id: 2, key: '2', title: 'Angle Unit', targetMenu: 'SETUP_ANGLE' },
    { id: 3, key: '3', title: 'Number Format', targetMenu: 'SETUP_FORMAT' },
    { id: 4, key: '4', title: 'Engineer Symbol' },
  ],
  // Page 2
  [
    { id: 5, key: '1', title: 'Fraction Result' },
    { id: 6, key: '2', title: 'Complex' },
    { id: 7, key: '3', title: 'Statistics' },
    { id: 8, key: '4', title: 'Spreadsheet' },
  ],
  // Page 3
  [
    { id: 9, key: '1', title: 'Equation/Func' },
    { id: 10, key: '2', title: 'Table' },
    { id: 11, key: '3', title: 'Decimal Mark' },
    { id: 12, key: '4', title: 'Digit Separator' },
  ],
  // Page 4
  [
    { id: 13, key: '1', title: 'MultiLine Font' },
    { id: 14, key: '2', title: 'QR Code' },
    { id: 15, key: '3', title: 'Contrast' },
    { id: 16, key: '4', title: 'Auto Power Off' },
  ],
];

export const CONST_CATEGORIES = [
  { id: 1, key: '1', name: 'Universal', items: ['h', 'ħ', 'c', 'ε0', 'μ0', 'G'] },
  { id: 2, key: '2', name: 'Electromagnetic', items: ['e', 'G0', 'atm'] },
  { id: 3, key: '3', name: 'Atomic & Nuclear', items: ['mp', 'mn', 'me', 'mu', 'u'] },
  { id: 4, key: '4', name: 'Physico-Chemical', items: ['NA', 'k', 'Vm', 'R'] },
  { id: 5, key: '5', name: 'Adopted Values', items: ['g', 'atm'] },
  { id: 6, key: '6', name: 'Other', items: ['G0'] },
];

export const CONV_CATEGORIES = [
  { id: 1, key: '1', name: 'Length', codes: ['01', '02', '03', '04', '05', '06', '07', '08', '17'] },
  { id: 2, key: '2', name: 'Area', codes: ['01', '02'] },
  { id: 3, key: '3', name: 'Volume', codes: ['03', '04'] },
  { id: 4, key: '4', name: 'Mass', codes: ['23', '24', '25', '26'] },
  { id: 5, key: '5', name: 'Velocity', codes: ['19', '20'] },
  { id: 6, key: '6', name: 'Pressure', codes: ['33', '34', '35'] },
  { id: 7, key: '7', name: 'Energy', codes: ['39', '40'] },
  { id: 8, key: '8', name: 'Power', codes: ['39', '40'] },
  { id: 9, key: '9', name: 'Temperature', codes: ['37', '38'] },
];

export default function App() {
  // Operating Mode: 'EXAM' (Default, strict 1:1 hardware clone) vs 'STUDY'
  const [calcMode, setCalcMode] = useState<CalculatorMode>(() => {
    try {
      const saved = localStorage.getItem('casio_mode');
      if (saved === 'STUDY' || saved === 'EXAM') return saved;
    } catch {}
    return 'EXAM';
  });

  // Theme System: 'default' (Classic ClassWiz) vs 'icy' (Icy Theme)
  const [theme, setTheme] = useState<CalculatorTheme>(() => {
    try {
      const saved = localStorage.getItem('casio_theme');
      if (saved === 'icy' || saved === 'qiqi') return 'icy';
      if (saved === 'default') return 'default';
    } catch {}
    return 'default';
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
    } catch {}
  }, [theme]);

  // Physical card calibration mm scale factor
  const [calibrationScale, setCalibrationScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('casio_calibration_scale');
      if (saved) return parseFloat(saved);
    } catch {}
    return 1.0;
  });

  // Calculator Power State (Hardware Standby Simulation)
  const [isPoweredOff, setIsPoweredOff] = useState(false);

  // 2D Math AST Template Engine State
  const [astState, setAstState] = useState<MathAstState>(() => createInitialAstState());

  // Multi-level Undo stack (Study Mode)
  const [undoStack, setUndoStack] = useState<MathAstState[]>([]);

  // Practice drills in Study Mode
  const [keystrokes, setKeystrokes] = useState<number>(0);
  const [practiceSeconds, setPracticeSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Key-Path Trainer message
  const [trainerRoute, setTrainerRoute] = useState<string | null>(null);

  // Calculator Output State
  const [result, setResult] = useState('0');
  const [rawNumericVal, setRawNumericVal] = useState<number>(0);
  const [isCalculated, setIsCalculated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Engineering Notation step offset
  const [engStep, setEngStep] = useState<number>(0);

  // Hardware Indicators & Status Modes
  const [shiftActive, setShiftActive] = useState(false);
  const [alphaActive, setAlphaActive] = useState(false);
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG');
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('NORM1');
  const [fixDigits, setFixDigits] = useState(2);
  const [sciDigits, setSciDigits] = useState(3);
  const [memoryM, setMemoryM] = useState<number>(0);
  const [lastAns, setLastAns] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('casio_last_ans');
      if (saved) return parseFloat(saved);
    } catch {}
    return 0;
  });
  const [isStoreMode, setIsStoreMode] = useState(false);
  const [sdCycleState, setSdCycleState] = useState(0);
  const [lastExactResult, setLastExactResult] = useState<string | undefined>(undefined);

  // 12-Mode Architecture Manager: state = { mode, screen, data }
  // Modes: CALC, CMPLX, BASE, MATRIX, VECTOR, STAT, DIST, SHEET, TABLE, EQN, INEQ, RATIO
  const [modeState, setModeState] = useState<ModeState>(() => {
    try {
      const saved = localStorage.getItem('casio_active_mode');
      if (saved) {
        const norm = normalizeModeId(saved);
        return getModeModule(norm).getInitialState();
      }
    } catch {}
    return getModeModule('CALC').getInitialState();
  });

  useEffect(() => {
    try {
      localStorage.setItem('casio_active_mode', modeState.mode);
    } catch {}
  }, [modeState.mode]);

  const currentModeModule = getModeModule(modeState.mode);
  const modeIndicator = currentModeModule.getIndicator(modeState);

  // In-Display Menus (RULE: Everything renders inside display, key block never shifts)
  const [displayMenu, setDisplayMenu] = useState<DisplayMenuType>('NONE');
  const [menuHighlightIndex, setMenuHighlightIndex] = useState<number>(0); // 0..11 for MENU
  const [setupPageIndex, setSetupPageIndex] = useState<number>(0);         // 0..3 for SETUP
  const [setupRowIndex, setSetupRowIndex] = useState<number>(0);           // 0..3
  const [constCatIndex, setConstCatIndex] = useState<number>(0);
  const [constItemIndex, setConstItemIndex] = useState<number>(0);
  const [convCatIndex, setConvCatIndex] = useState<number>(0);
  const [convItemIndex, setConvItemIndex] = useState<number>(0);
  const [optnIndex, setOptnIndex] = useState<number>(0);
  const [resetIndex, setResetIndex] = useState<number>(0);

  // Persistent Variables A, B, C, D, E, F, X, Y, M
  const [variables, setVariables] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('casio_variables');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('casio_variables', JSON.stringify(variables));
    } catch {}
  }, [variables]);

  // Mode Switching: MENU selects a mode. Changing modes clears the expression like the real unit,
  // keeps shared memory (A-F, M, X, Y, Ans), and shows the mode's indicator.
  const handleSelectMode = (code: string) => {
    const norm = normalizeModeId(code);
    const mod = getModeModule(norm);
    const cardOrigin = menuCardRectsRef.current[code] || menuKeyRectRef.current;
    pendingModeFlipOriginRef.current = cardOrigin;
    lastModeOriginRectRef.current = cardOrigin;
    setIsMenuClosing(false);
    menuCloseTokenRef.current++;
    setModeState(mod.getInitialState());
    setAstState(createInitialAstState());
    setResult('0');
    setIsCalculated(false);
    setActiveHistoryId(null);
    setDisplayMenu('NONE');
    setShiftActive(false);
    setAlphaActive(false);
  };

  const modeContext: ModeContext = {
    modeState,
    setModeState,
    sharedMemory: {
      A: variables.A || 0,
      B: variables.B || 0,
      C: variables.C || 0,
      D: variables.D || 0,
      E: variables.E || 0,
      F: variables.F || 0,
      X: variables.X || 0,
      Y: variables.Y || 0,
      M: memoryM || 0,
      Ans: lastAns || 0,
    },
    setSharedMemory: (updater) => {
      setVariables((prev) => {
        const cur: SharedMemory = {
          A: prev.A || 0,
          B: prev.B || 0,
          C: prev.C || 0,
          D: prev.D || 0,
          E: prev.E || 0,
          F: prev.F || 0,
          X: prev.X || 0,
          Y: prev.Y || 0,
          M: memoryM || 0,
          Ans: lastAns || 0,
        };
        const next = typeof updater === 'function' ? updater(cur) : updater;
        setMemoryM(next.M);
        setLastAns(next.Ans);
        return {
          A: next.A,
          B: next.B,
          C: next.C,
          D: next.D,
          E: next.E,
          F: next.F,
          X: next.X,
          Y: next.Y,
          M: next.M,
        };
      });
    },
    exitToCalc: () => handleSelectMode('CALC'),
    openSubMenu: () => {
      setModeState((prev) => ({
        ...prev,
        screen: 'SUBMENU',
        data: { ...prev.data, subMenuPage: 0 },
      }));
    },
    closeSubMenu: () => {
      setModeState((prev) => ({
        ...prev,
        screen: 'MAIN',
      }));
    },
    triggerHapticFeedback: (type?: string) => triggerHaptic((type as any) || 'func'),
    playAudioFeedback: (type?: string) => playKeyClick((type as any) || 'func'),
    angleMode,
    displayFormat,
  };

  // Editor Mode: CLASSIC or PHONE
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    try {
      const saved = localStorage.getItem('casio_editor_mode');
      if (saved === 'PHONE' || saved === 'CLASSIC') return saved;
    } catch {}
    return 'CLASSIC';
  });

  const [justCommitted, setJustCommitted] = useState<boolean>(false);
  const [livePreviewResult, setLivePreviewResult] = useState<string>('');
  const [lastValidPreviewResult, setLastValidPreviewResult] = useState<string>('');

  // Calculation History Log (persisted in localStorage for full history view)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('casio_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Active committed history id (excluded from inline history while still shown as active result)
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState<boolean>(false);
  const grabSwipeStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem('casio_history', JSON.stringify(history));
      } catch {}
    }, 250);
    return () => window.clearTimeout(timer);
  }, [history]);

  const handleLoadHistoryCard = useCallback((item: HistoryItem) => {
    playKeyClick('num');
    triggerHaptic('num');
    const nextRoot: MathNode[] =
      item.astRoot && item.astRoot.length > 0
        ? JSON.parse(JSON.stringify(item.astRoot))
        : parseStringToAst(item.expression).root;
    setAstState({
      root: nextRoot,
      cursor: { slotId: 'root', offset: nextRoot.length },
      pendingDeleteTemplateId: null,
    });
    setJustCommitted(false);
    setIsCalculated(false);
    setErrorMessage(null);
    setActiveHistoryId(null);
    setIsHistorySheetOpen(false);
  }, []);

  const handleTogglePinHistory = useCallback((id: string) => {
    setHistory((prev) => prev.map((it) => (it.id === id ? { ...it, pinned: !it.pinned } : it)));
  }, []);

  const handleDeleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((it) => it.id !== id));
    setActiveHistoryId((prev) => (prev === id ? null : prev));
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    setActiveHistoryId(null);
  }, []);

  // Insert history expression or load into active workspace for editing
  const handleInsertHistoryExpression = useCallback((exprStr: string, astRoot?: MathNode[]) => {
    playKeyClick('num');
    triggerHaptic('num');
    setActiveHistoryId(null);
    if (editorMode === 'PHONE') {
      let nextRoot: MathNode[];
      if (astRoot && astRoot.length > 0) {
        nextRoot = JSON.parse(JSON.stringify(astRoot));
      } else {
        nextRoot = parseStringToAst(exprStr).root;
      }
      setAstState({
        root: nextRoot,
        cursor: { slotId: 'root', offset: nextRoot.length },
        pendingDeleteTemplateId: null,
      });
      setJustCommitted(false);
      setErrorMessage(null);
      setIsCalculated(false);
    } else {
      const parsed = astRoot && astRoot.length > 0
        ? { root: JSON.parse(JSON.stringify(astRoot)), cursor: { slotId: 'root', offset: astRoot.length }, pendingDeleteTemplateId: null }
        : parseStringToAst(exprStr);
      if (astState.root.length === 0 || isCalculated) {
        setAstState(parsed);
        setIsCalculated(false);
        setErrorMessage(null);
      } else {
        setAstState((prev) => ({
          ...prev,
          root: [...prev.root, ...parsed.root],
          cursor: { slotId: 'root', offset: prev.root.length + parsed.root.length },
        }));
      }
    }
  }, [editorMode, isCalculated, astState.root.length]);

  // Live preview calculation for Phone Edit mode
  useEffect(() => {
    if (editorMode !== 'PHONE') return;
    if (justCommitted) return;

    if (astState.root.length === 0) {
      setLivePreviewResult('');
      setLastValidPreviewResult('');
      return;
    }

    try {
      const evalResult = evaluateMathAst(astState.root, angleMode, variables, lastAns);
      if (evalResult.success && evalResult.result !== undefined) {
        let formatted: string;
        if (evalResult.exactResult !== undefined && displayFormat.startsWith('NORM')) {
          formatted = evalResult.exactResult;
        } else {
          formatted = formatResult(evalResult.result, displayFormat, fixDigits, sciDigits, 0);
        }
        setLivePreviewResult(formatted);
        setLastValidPreviewResult(formatted);
      }
      // If expression is incomplete or invalid, keep lastValidPreviewResult and show no error
    } catch {
      // Keep lastValidPreviewResult
    }
  }, [astState.root, editorMode, justCommitted, angleMode, variables, lastAns, displayFormat, fixDigits, sciDigits]);

  const handleInsertHistoryResult = useCallback((valStr: string) => {
    playKeyClick('num');
    triggerHaptic('num');
    setActiveHistoryId(null);
    const cleanStr = valStr.replace(/^=\s*/, '');
    const parsed = parseStringToAst(cleanStr);
    if (astState.root.length === 0 || isCalculated) {
      setAstState(parsed);
      setIsCalculated(false);
      setErrorMessage(null);
    } else {
      setAstState((prev) => ({
        ...prev,
        root: [...prev.root, ...parsed.root],
        cursor: { slotId: 'root', offset: prev.root.length + parsed.root.length },
      }));
    }
  }, [astState.root.length, isCalculated]);

  const commitPendingHistory = useCallback(() => {}, []);

  // History Navigation Index
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Modals (Auxiliary developer/practice tools)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
  const [isTestHarnessOpen, setIsTestHarnessOpen] = useState(false);

  // Sound, Haptic & Frame-Time Debug Overlay Settings
  const [soundOn, setSoundOn] = useState(true);
  const [hapticOn, setHapticOn] = useState(true);
  const [perfOverlayOn, setPerfOverlayOn] = useState(false);

  // Performance and Geometry Metrics (?perf=1)
  const [perfMetrics, setPerfMetrics] = useState<{
    isPerf: boolean;
    screenWidth: number;
    screenHeight: number;
    dpr: number;
    keyBlockWidth: number;
    keyBlockHeight: number;
    displayWidth: number;
    displayHeight: number;
    displayPct: number;
    visualKeyHeight: number;
    touchTargetWidth: number;
    touchTargetHeight: number;
    minKeyLabel: string;
    isVisualKeyPass: boolean;
    isTouchTargetPass: boolean;
    isDisplayPctPass: boolean;
  } | null>(null);

  // DOM Refs & Cached FLIP / Luminous Flow Refs
  const appRootRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const keyBlockRef = useRef<HTMLDivElement>(null);
  const settingsGearRef = useRef<HTMLButtonElement>(null);
  const menuKeyRef = useRef<HTMLButtonElement>(null);
  const historyGrabRef = useRef<HTMLButtonElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const modeContainerRef = useRef<HTMLDivElement>(null);

  const [settingsOriginRect, setSettingsOriginRect] = useState<CachedRect | null>(null);
  const [historyOriginRect, setHistoryOriginRect] = useState<CachedRect | null>(null);
  const menuKeyRectRef = useRef<CachedRect | null>(null);
  const menuCardRectsRef = useRef<Record<string, CachedRect>>({});
  const pendingMenuFlipOriginRef = useRef<CachedRect | null>(null);
  const pendingModeFlipOriginRef = useRef<CachedRect | null>(null);
  const lastModeOriginRectRef = useRef<CachedRect | null>(null);
  const lastMenuTargetRectRef = useRef<CachedRect | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const menuCloseTokenRef = useRef(0);
  const prevDisplayMenuRef = useRef<DisplayMenuType>('NONE');

  const {
    handlePointerDown: handleKeyPointerDown,
    handlePointerMove: handleKeyPointerMove,
    handlePointerUp: handleKeyPointerUp,
  } = useSpringKeypad(keyBlockRef, appRootRef);

  // Precompute cached element rects for FLIP overlays (zero layout reads during pointerdown/click)
  useLayoutEffect(() => {
    const refreshOverlayOrigins = () => {
      if (settingsGearRef.current) {
        const next = toCachedRect(settingsGearRef.current.getBoundingClientRect());
        setSettingsOriginRect((prev) =>
          prev &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5
            ? prev
            : next
        );
      }
      if (historyGrabRef.current) {
        const next = toCachedRect(historyGrabRef.current.getBoundingClientRect());
        setHistoryOriginRect((prev) =>
          prev &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5
            ? prev
            : next
        );
      }
      if (menuKeyRef.current) {
        menuKeyRectRef.current = toCachedRect(menuKeyRef.current.getBoundingClientRect());
      }
    };

    refreshOverlayOrigins();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(refreshOverlayOrigins);
      if (displayRef.current) ro.observe(displayRef.current);
      if (keyBlockRef.current) ro.observe(keyBlockRef.current);
    }
    window.addEventListener('resize', refreshOverlayOrigins, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', refreshOverlayOrigins);
    };
  }, [isPoweredOff, calibrationScale]);

  const calcContainerRef = useRef<HTMLDivElement>(null);
  const lastModeTargetRectRef = useRef<CachedRect | null>(null);
  const menuCardPage = Math.floor(menuHighlightIndex / 6);

  // Precompute visible MENU card rects whenever MENU opens or switches page (zero layout reads on click)
  useLayoutEffect(() => {
    const el = menuContainerRef.current;
    if (displayMenu !== 'MENU' || !el) return;
    const cards = el.querySelectorAll('[data-menu-card-code]');
    cards.forEach((card) => {
      const code = (card as HTMLElement).dataset.menuCardCode;
      if (code) {
        menuCardRectsRef.current[code] = toCachedRect(card.getBoundingClientRect());
      }
    });
  }, [displayMenu, menuCardPage]);

  // Interruptible FLIP open / collapse lifecycle for in-display MENU
  useLayoutEffect(() => {
    const prev = prevDisplayMenuRef.current;
    prevDisplayMenuRef.current = displayMenu;

    const el = menuContainerRef.current;
    if (displayMenu === 'MENU' && prev !== 'MENU') {
      menuCloseTokenRef.current++;
      if (isMenuClosing) setIsMenuClosing(false);
      if (!el) return;
      const targetBox = lastMenuTargetRectRef.current || toCachedRect(el.getBoundingClientRect());
      lastMenuTargetRectRef.current = targetBox;

      const interrupting = hasActiveSpring(el);
      const origin = pendingMenuFlipOriginRef.current || menuKeyRectRef.current;
      pendingMenuFlipOriginRef.current = null;
      const reduced = prefersReducedMotion();
      if (reduced || !origin) {
        animateSpringTransform(
          el,
          { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
          'effects',
          interrupting ? undefined : { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
        );
      } else {
        const delta = computeFlipDelta(origin, targetBox);
        animateSpringTransform(
          el,
          { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
          'spatial',
          interrupting ? undefined : { ...delta, opacity: 0.25 }
        );
      }
    } else if (prev === 'MENU' && isMenuClosing && el) {
      const token = ++menuCloseTokenRef.current;
      const targetBox = lastMenuTargetRectRef.current || toCachedRect(el.getBoundingClientRect());
      const origin = menuKeyRectRef.current;
      const reduced = prefersReducedMotion();
      const collapseTo = !reduced && origin
        ? { ...computeFlipDelta(origin, targetBox), opacity: 0 }
        : { x: 0, y: 0, sx: 0.94, sy: 0.94, opacity: 0 };

      animateSpringTransform(
        el,
        collapseTo,
        reduced ? 'effects' : 'spatial',
        undefined,
        () => {
          if (menuCloseTokenRef.current === token) {
            setIsMenuClosing(false);
          }
        }
      );
    }
  }, [displayMenu, isMenuClosing]);

  // FLIP expand from clicked MENU card into active mode screen (or Calculate workspace)
  useLayoutEffect(() => {
    if (displayMenu === 'NONE' && pendingModeFlipOriginRef.current) {
      const targetEl = modeState.mode !== 'CALC' ? modeContainerRef.current : calcContainerRef.current;
      if (!targetEl) return;
      const origin = pendingModeFlipOriginRef.current;
      pendingModeFlipOriginRef.current = null;
      const target = lastModeTargetRectRef.current || toCachedRect(targetEl.getBoundingClientRect());
      lastModeTargetRectRef.current = target;
      runInlineFlipExpand(targetEl, origin, target);
    }
  }, [displayMenu, modeState.mode]);

  // Fire double error haptic once whenever a non-CALC mode error appears (CALC errors fire directly in handleEqual/handleSolve)
  const prevModeErrorRef = useRef<string | null>(null);
  const modeErrorSignal = (modeState.data?.error as string | undefined) || (modeState.data?.simulError as string | undefined) || null;
  useEffect(() => {
    const errStr = modeErrorSignal ? String(modeErrorSignal) : null;
    if (errStr && errStr !== prevModeErrorRef.current) {
      triggerHaptic('error', { force: true });
    }
    prevModeErrorRef.current = errStr;
  }, [modeErrorSignal]);

  // Helper trigger to close MENU cleanly with FLIP collapse back to MENU key
  const closeInDisplayMenu = useCallback((nextMenu: DisplayMenuType = 'NONE') => {
    if (displayMenu === 'MENU' && nextMenu === 'NONE') {
      setIsMenuClosing(true);
    }
    setDisplayMenu(nextMenu);
  }, [displayMenu]);

  // Check ?perf=1 and ?test=1 in URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('test') === '1') {
      setIsTestHarnessOpen(true);
    }

    const isPerf = params.get('perf') === '1';
    if (isPerf) {
      const updateMetrics = () => {
        const sw = window.innerWidth;
        const sh = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        const kb = keyBlockRef.current?.getBoundingClientRect();
        const dp = displayRef.current?.getBoundingClientRect();

        const displayH = dp?.height || 0;
        const displayPct = sh > 0 ? (displayH / sh) * 100 : 0;

        let minVisualH = 999;
        let minTouchW = 999;
        let minTouchH = 999;
        let minLabel = '';

        // Measure visual button dimensions and cell touch targets
        const wrappers = keyBlockRef.current?.querySelectorAll('.key-wrapper');
        wrappers?.forEach((w) => {
          const wr = w.getBoundingClientRect();
          const btn = w.querySelector('button');
          const br = btn?.getBoundingClientRect();

          if (br && br.width > 0 && br.height > 0) {
            minVisualH = Math.min(minVisualH, br.height);
          }
          if (wr.width > 0 && wr.height > 0) {
            if (wr.width < minTouchW || wr.height < minTouchH) {
              minTouchW = Math.min(minTouchW, wr.width);
              minTouchH = Math.min(minTouchH, wr.height);
              minLabel = btn?.innerText.trim().replace(/\n/g, ' ') || btn?.getAttribute('aria-label') || 'key';
            }
          }
        });

        // Also check standalone buttons if any (like D-pad center/sectors)
        const dpadButtons = keyBlockRef.current?.querySelectorAll('.dpad-btn, button[aria-label^="D-pad"]');
        dpadButtons?.forEach((btn) => {
          const br = btn.getBoundingClientRect();
          if (br.width > 0 && br.height > 0) {
            minTouchW = Math.min(minTouchW, br.width);
            minTouchH = Math.min(minTouchH, br.height);
          }
        });

        const visualH = minVisualH === 999 ? 40 : minVisualH;
        const touchW = minTouchW === 999 ? 44 : minTouchW;
        const touchH = minTouchH === 999 ? 44 : minTouchH;

        setPerfMetrics({
          isPerf: true,
          screenWidth: sw,
          screenHeight: sh,
          dpr,
          keyBlockWidth: kb?.width || 0,
          keyBlockHeight: kb?.height || 0,
          displayWidth: dp?.width || 0,
          displayHeight: displayH,
          displayPct,
          visualKeyHeight: visualH,
          touchTargetWidth: touchW,
          touchTargetHeight: touchH,
          minKeyLabel: minLabel || 'key',
          isVisualKeyPass: visualH >= 39.5, // 40dp visual target with float tolerance
          isTouchTargetPass: touchW >= 43.5 && touchH >= 43.5, // 44dp touch target with float tolerance
          isDisplayPctPass: displayPct >= 19.5, // Target ~24%
        });
      };

      updateMetrics();
      window.addEventListener('resize', updateMetrics);
      return () => window.removeEventListener('resize', updateMetrics);
    }
  }, []);

  // Practice Timer (Study Mode)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (calcMode === 'STUDY' && isTimerRunning && !isPoweredOff) {
      interval = setInterval(() => setPracticeSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [calcMode, isTimerRunning, isPoweredOff]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const toggleHaptic = () => {
    const next = !hapticOn;
    setHapticOn(next);
    setHapticEnabled(next);
  };

  // Push AST to undo stack
  const pushUndoState = (state: MathAstState) => {
    setUndoStack((prev) => [...prev.slice(-25), JSON.parse(JSON.stringify(state))]);
  };

  // Undo last action (Study Mode)
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    playKeyClick('action');
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setAstState(prev);
    setErrorMessage(null);
  };

  // Clear Trainer Route after 3.5 seconds
  useEffect(() => {
    if (trainerRoute) {
      const timer = setTimeout(() => setTrainerRoute(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [trainerRoute]);

  // Handle hardware ON / Power-Up Key
  const handleOn = () => {
    playKeyClick('action');
    triggerHaptic('action');
    if (isPoweredOff) {
      setIsPoweredOff(false);
      return;
    }
    // ON button clears menu or resets input
    if (displayMenu !== 'NONE') {
      closeInDisplayMenu('NONE');
      return;
    }
    setAstState(createInitialAstState());
    setResult('0');
    setIsCalculated(false);
    setShiftActive(false);
    setAlphaActive(false);
    setIsStoreMode(false);
    setSdCycleState(0);
    setEngStep(0);
    setHistoryIndex(-1);
    setErrorMessage(null);
  };

  // Clear All (AC Key): Exits in-display menus restoring previous screen, or clears expression
  const handleAllClear = () => {
    if (isPoweredOff) return;
    playKeyClick('action');
    triggerHaptic('action');

    // Rule 1 & 2: In menu mode, AC exits and restores previous screen with expression intact
    if (displayMenu !== 'NONE') {
      if (['SETUP_ANGLE', 'SETUP_FORMAT', 'SETUP_FIX', 'SETUP_SCI', 'SETUP_NORM', 'SETUP_IO'].includes(displayMenu)) {
        setDisplayMenu('SETUP');
        return;
      }
      if (displayMenu === 'CONST_LIST') {
        setDisplayMenu('CONST_CAT');
        return;
      }
      if (displayMenu === 'CONV_LIST') {
        setDisplayMenu('CONV_CAT');
        return;
      }
      if (displayMenu === 'RESET_CONFIRM') {
        setDisplayMenu('RESET');
        return;
      }
      closeInDisplayMenu('NONE');
      setShiftActive(false);
      setAlphaActive(false);
      return;
    }

    // If in non-CALC mode, let active mode handle AC
    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey('AC', modeContext);
      if (handled) return;
    }

    commitPendingHistory();
    setAstState(createInitialAstState());
    setResult('0');
    setIsCalculated(false);
    setJustCommitted(false);
    setActiveHistoryId(null);
    setLivePreviewResult('');
    setLastValidPreviewResult('');
    setShiftActive(false);
    setAlphaActive(false);
    setIsStoreMode(false);
    setSdCycleState(0);
    setEngStep(0);
    setHistoryIndex(-1);
    setErrorMessage(null);
  };

  // Direct number key selection when inside an in-display menu
  const handleMenuNumberSelect = (numStr: string) => {
    const num = parseInt(numStr, 10);

    // 1. MENU: Grid mode selection (1..9, or A, B, C)
    if (displayMenu === 'MENU') {
      const item = ALL_MENU_ITEMS.find((it) => it.key === numStr || it.id === num);
      if (item) {
        handleSelectMode(item.code);
      }
      return;
    }

    // 2. SETUP: 4 items per page
    if (displayMenu === 'SETUP') {
      const pageItems = SETUP_PAGES[setupPageIndex];
      const item = pageItems[num - 1];
      if (item) {
        if (item.targetMenu) {
          setDisplayMenu(item.targetMenu);
        } else {
          setDisplayMenu('NONE');
        }
      }
      return;
    }

    // 3. SETUP Sub-menus
    if (displayMenu === 'SETUP_ANGLE') {
      if (num === 1) setAngleMode('DEG');
      if (num === 2) setAngleMode('RAD');
      if (num === 3) setAngleMode('GRA');
      setDisplayMenu('NONE');
      return;
    }

    if (displayMenu === 'SETUP_FORMAT') {
      if (num === 1) setDisplayMenu('SETUP_FIX');
      else if (num === 2) setDisplayMenu('SETUP_SCI');
      else if (num === 3) setDisplayMenu('SETUP_NORM');
      return;
    }

    if (displayMenu === 'SETUP_FIX') {
      const digits = Math.min(Math.max(0, num), 9);
      setFixDigits(digits);
      setDisplayFormat('FIX');
      setDisplayMenu('NONE');
      if (isCalculated) {
        setResult(formatResult(rawNumericVal, 'FIX', digits, sciDigits, engStep));
      }
      return;
    }

    if (displayMenu === 'SETUP_SCI') {
      const digits = num === 0 ? 10 : Math.min(Math.max(1, num), 9);
      setSciDigits(digits);
      setDisplayFormat('SCI');
      setDisplayMenu('NONE');
      if (isCalculated) {
        setResult(formatResult(rawNumericVal, 'SCI', fixDigits, digits, engStep));
      }
      return;
    }

    if (displayMenu === 'SETUP_NORM') {
      if (num === 1) setDisplayFormat('NORM1');
      if (num === 2) setDisplayFormat('NORM2');
      setDisplayMenu('NONE');
      if (isCalculated) {
        setResult(formatResult(rawNumericVal, num === 1 ? 'NORM1' : 'NORM2', fixDigits, sciDigits, engStep));
      }
      return;
    }

    if (displayMenu === 'SETUP_IO') {
      setDisplayMenu('NONE');
      return;
    }

    // 4. OPTN Sub-menus
    if (displayMenu === 'OPTN') {
      if (num === 1) setDisplayMenu('OPTN_HYP');
      else if (num === 2) setDisplayMenu('OPTN_ANGLE');
      else if (num === 3) setDisplayMenu('OPTN_ENG');
      return;
    }

    if (displayMenu === 'OPTN_HYP') {
      const hypFuncs = ['sinh(', 'cosh(', 'tanh(', 'sinh⁻¹(', 'cosh⁻¹(', 'tanh⁻¹('];
      if (num >= 1 && num <= 6) {
        setDisplayMenu('NONE');
        handleToken(hypFuncs[num - 1], 'func');
      }
      return;
    }

    if (displayMenu === 'OPTN_ANGLE') {
      const angleSyms = ['°', 'r', 'g'];
      if (num >= 1 && num <= 3) {
        setDisplayMenu('NONE');
        handleToken(angleSyms[num - 1], 'func');
      }
      return;
    }

    if (displayMenu === 'OPTN_ENG') {
      const engSyms = ['m', 'μ', 'n', 'p', 'f', 'k', 'M', 'G', 'T'];
      if (num >= 1 && num <= 9) {
        setDisplayMenu('NONE');
        handleToken(engSyms[num - 1], 'func');
      }
      return;
    }

    // 5. CONST: Categories & Item Selection
    if (displayMenu === 'CONST_CAT') {
      if (num >= 1 && num <= CONST_CATEGORIES.length) {
        setConstCatIndex(num - 1);
        setConstItemIndex(0);
        setDisplayMenu('CONST_LIST');
      }
      return;
    }

    if (displayMenu === 'CONST_LIST') {
      const cat = CONST_CATEGORIES[constCatIndex];
      if (cat && num >= 1 && num <= cat.items.length) {
        const sym = cat.items[num - 1];
        const constantObj = SCIENTIFIC_CONSTANTS.find((c) => c.sym === sym);
        setDisplayMenu('NONE');
        if (constantObj) {
          handleToken(constantObj.val.toString(), 'num');
        } else {
          handleToken(sym, 'num');
        }
      }
      return;
    }

    // 6. CONV: Categories & Conversion Selection
    if (displayMenu === 'CONV_CAT') {
      if (num >= 1 && num <= CONV_CATEGORIES.length) {
        setConvCatIndex(num - 1);
        setConvItemIndex(0);
        setDisplayMenu('CONV_LIST');
      }
      return;
    }

    if (displayMenu === 'CONV_LIST') {
      const cat = CONV_CATEGORIES[convCatIndex];
      if (cat && num >= 1 && num <= cat.codes.length) {
        const code = cat.codes[num - 1];
        const conv = METRIC_CONVERSIONS.find((c) => c.code === code);
        setDisplayMenu('NONE');
        if (conv) {
          handleToken(` conv(${conv.name}) `, 'func');
        }
      }
      return;
    }

    // 7. RESET: 1:Setup, 2:Memory, 3:Initialize All
    if (displayMenu === 'RESET') {
      if (num >= 1 && num <= 3) {
        setResetIndex(num - 1);
        setDisplayMenu('RESET_CONFIRM');
      }
      return;
    }

    // 8. STAT, MATRIX, VECTOR sub-menus
    if (displayMenu === 'STAT') {
      const statSyms = ['1-Var', 'Data', 'Edit', 'Σx', 'x̄', 'minX'];
      if (num >= 1 && num <= 6) {
        setDisplayMenu('NONE');
        handleToken(`stat_${statSyms[num - 1]}`, 'func');
      }
      return;
    }

    if (displayMenu === 'MATRIX') {
      const matSyms = ['MatA', 'MatB', 'MatC', 'MatD', 'MatAns', 'Det(', 'Trn('];
      if (num >= 1 && num <= 7) {
        setDisplayMenu('NONE');
        handleToken(matSyms[num - 1], 'func');
      }
      return;
    }

    if (displayMenu === 'VECTOR') {
      const vctSyms = ['VctA', 'VctB', 'VctC', 'VctD', 'VctAns', 'Dot('];
      if (num >= 1 && num <= 6) {
        setDisplayMenu('NONE');
        handleToken(vctSyms[num - 1], 'func');
      }
      return;
    }
  };

  // Insert general token (Numbers, Variables, Functions)
  const handleToken = (tokenVal: string, keyType: HapticKeyType = 'num', tokenType?: TokenType) => {
    if (isPoweredOff) return;
    playKeyClick(keyType);
    setKeystrokes((k) => k + 1);

    // If an in-display menu is active and a digit or letter is typed, intercept for menu selection
    if (displayMenu !== 'NONE') {
      if (/^[0-9]$/.test(tokenVal) || ['A', 'B', 'C'].includes(tokenVal)) {
        handleMenuNumberSelect(tokenVal);
        return;
      }
    }

    // In non-CALC mode, let current mode handle the token input
    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey(tokenVal, modeContext);
      if (handled) return;
    }

    if (errorMessage) setErrorMessage(null);
    setActiveHistoryId(null);

    pushUndoState(astState);

    let currentState = astState;
    if (editorMode === 'PHONE') {
      if (justCommitted) {
        // Binary and postfix operators start new expression with "Ans"
        // (+ - × ÷ x² x⁻¹ x^□ nPr nCr etc.)
        const isBinaryOrPostfix = [
          '+', '-', '×', '÷', '^', '²', '³', '⁻¹', '!', '%', '°',
          'P', 'C', 'nPr', 'nCr'
        ].includes(tokenVal) || tokenType === 'OP_NPR' || tokenType === 'OP_NCR';

        if (isBinaryOrPostfix) {
          currentState = parseStringToAst('Ans');
        } else {
          // Digits, '(', functions, etc. start a fresh input
          currentState = createInitialAstState();
        }
        setJustCommitted(false);
        setIsCalculated(false);
        setSdCycleState(0);
        setEngStep(0);
      }
    } else if (isCalculated) {
      commitPendingHistory();
      // Binary and postfix operators start new expression with "Ans"
      // (+ - × ÷ x² x⁻¹ x^□ nPr nCr etc.)
      const isBinaryOrPostfix = [
        '+', '-', '×', '÷', '^', '²', '³', '⁻¹', '!', '%', '°',
        'P', 'C', 'nPr', 'nCr'
      ].includes(tokenVal) || tokenType === 'OP_NPR' || tokenType === 'OP_NCR';

      if (isBinaryOrPostfix) {
        currentState = parseStringToAst('Ans');
      } else {
        // Digits, '(', functions, etc. start a fresh input
        currentState = createInitialAstState();
      }
      setIsCalculated(false);
      setSdCycleState(0);
      setEngStep(0);
    }

    setAstState(insertToken(currentState, tokenVal, tokenType));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Fraction Key (■/□)
  const handleFractionKey = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    setKeystrokes((k) => k + 1);

    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey('■/□', modeContext) || currentModeModule.handleKey('/', modeContext);
      if (handled) return;
    }

    if (errorMessage) setErrorMessage(null);
    setActiveHistoryId(null);
    pushUndoState(astState);

    let currentState = astState;
    if (editorMode === 'PHONE') {
      if (justCommitted) {
        currentState = createInitialAstState();
        setJustCommitted(false);
        setIsCalculated(false);
      }
    } else if (isCalculated) {
      commitPendingHistory();
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertFraction(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Integral Key (∫dx)
  const handleIntegralKey = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    setKeystrokes((k) => k + 1);
    if (errorMessage) setErrorMessage(null);
    setActiveHistoryId(null);
    pushUndoState(astState);

    let currentState = astState;
    if (editorMode === 'PHONE') {
      if (justCommitted) {
        currentState = createInitialAstState();
        setJustCommitted(false);
        setIsCalculated(false);
      }
    } else if (isCalculated) {
      commitPendingHistory();
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertIntegral(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Derivative Key (SHIFT + ∫dx -> d/dx)
  const handleDerivativeKey = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    setKeystrokes((k) => k + 1);
    if (errorMessage) setErrorMessage(null);
    setActiveHistoryId(null);
    pushUndoState(astState);

    let currentState = astState;
    if (editorMode === 'PHONE') {
      if (justCommitted) {
        currentState = createInitialAstState();
        setJustCommitted(false);
        setIsCalculated(false);
      }
    } else if (isCalculated) {
      commitPendingHistory();
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertDerivative(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Square Root Key (√■)
  const handleSqrtKey = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    setKeystrokes((k) => k + 1);

    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey('√', modeContext) || currentModeModule.handleKey('sqrt', modeContext);
      if (handled) return;
    }

    if (errorMessage) setErrorMessage(null);
    setActiveHistoryId(null);
    pushUndoState(astState);

    let currentState = astState;
    if (editorMode === 'PHONE') {
      if (justCommitted) {
        currentState = createInitialAstState();
        setJustCommitted(false);
        setIsCalculated(false);
      }
    } else if (isCalculated) {
      commitPendingHistory();
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertSqrt(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Power Key (x□)
  const handlePowerKey = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    setKeystrokes((k) => k + 1);

    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey('^', modeContext);
      if (handled) return;
    }

    if (errorMessage) setErrorMessage(null);
    setActiveHistoryId(null);
    pushUndoState(astState);

    let currentState = astState;
    if (editorMode === 'PHONE') {
      if (justCommitted) {
        currentState = parseStringToAst('Ans');
        setJustCommitted(false);
        setIsCalculated(false);
      }
    } else if (isCalculated) {
      commitPendingHistory();
      currentState = parseStringToAst('Ans');
      setIsCalculated(false);
    }

    setAstState(insertPower(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Postfix Operator Keys: x², x³, x⁻¹, x!, °, %
  const handlePostfixKey = (op: PostfixOp) => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    setKeystrokes((k) => k + 1);

    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey(op, modeContext);
      if (handled) return;
    }

    if (errorMessage) setErrorMessage(null);
    setActiveHistoryId(null);
    pushUndoState(astState);

    let currentState = astState;
    if (editorMode === 'PHONE') {
      if (justCommitted) {
        currentState = parseStringToAst('Ans');
        setJustCommitted(false);
        setIsCalculated(false);
      }
    } else if (isCalculated) {
      commitPendingHistory();
      currentState = parseStringToAst('Ans');
      setIsCalculated(false);
    }

    setAstState(insertPostfix(currentState, op));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Logarithm with arbitrary base: log□(□)
  const handleLogBaseKey = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    setKeystrokes((k) => k + 1);
    if (errorMessage) setErrorMessage(null);
    setActiveHistoryId(null);
    pushUndoState(astState);

    let currentState = astState;
    if (editorMode === 'PHONE') {
      if (justCommitted) {
        currentState = createInitialAstState();
        setJustCommitted(false);
        setIsCalculated(false);
      }
    } else if (isCalculated) {
      commitPendingHistory();
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertLogBase(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Backspace Delete Key (DEL)
  const handleDelete = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('action');
    setKeystrokes((k) => k + 1);

    if (editorMode === 'PHONE') {
      setJustCommitted(false);
    }

    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey('DEL', modeContext);
      if (handled) return;
    }

    setActiveHistoryId(null);
    pushUndoState(astState);
    setAstState(deleteAst(astState));
    setErrorMessage(null);
  };

  // Standard S⇔D Exact/Decimal Format Toggle
  const handleFormatCycle = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('action');

    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey('S_D', modeContext) || currentModeModule.handleKey('FORMAT', modeContext);
      if (handled) return;
    }

    if (!isCalculated) return;

    if (lastExactResult) {
      if (sdCycleState === 0) {
        setSdCycleState(1);
        const nextRes = formatResult(rawNumericVal, displayFormat, fixDigits, sciDigits, engStep);
        setResult(nextRes);
      } else {
        setSdCycleState(0);
        setResult(lastExactResult);
      }
    } else {
      setSdCycleState((prev) => (prev === 0 ? 1 : 0));
    }
  };

  // Engineering Notation ENG Key
  const handleEngKey = (direction: 'forward' | 'backward' = 'forward') => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    if (!isCalculated) return;

    const nextStep = direction === 'forward' ? engStep + 1 : engStep - 1;
    setEngStep(nextStep);
    const nextRes = toEngineering(rawNumericVal, nextStep);
    setResult(nextRes);
  };

  // D-Pad Arrow Navigation (Left, Right, Up, Down)
  const handleDpad = (direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN') => {
    if (isPoweredOff) return;
    playKeyClick('dpad');

    // If an in-display menu is active, D-Pad controls highlight and pagination (2D grid + page wrapping)
    if (displayMenu === 'MENU') {
      setMenuHighlightIndex((prev) => navigateMenuGrid(prev, direction, 12, 3, 2));
      return;
    }

    if (displayMenu === 'SETUP') {
      if (direction === 'DOWN') {
        if (setupRowIndex < 3) {
          setSetupRowIndex((r) => r + 1);
        } else {
          setSetupRowIndex(0);
          setSetupPageIndex((p) => (p + 1) % SETUP_PAGES.length);
        }
      } else if (direction === 'UP') {
        if (setupRowIndex > 0) {
          setSetupRowIndex((r) => r - 1);
        } else {
          setSetupRowIndex(3);
          setSetupPageIndex((p) => (p - 1 + SETUP_PAGES.length) % SETUP_PAGES.length);
        }
      }
      return;
    }

    if (['OPTN', 'CONST_CAT', 'CONST_LIST', 'CONV_CAT', 'CONV_LIST', 'RESET', 'STAT', 'MATRIX', 'VECTOR'].includes(displayMenu)) {
      if (direction === 'DOWN') {
        setOptnIndex((prev) => prev + 1);
      } else if (direction === 'UP') {
        setOptnIndex((prev) => Math.max(0, prev - 1));
      }
      return;
    }

    // If in non-CALC mode, let active mode handle arrows (e.g. data table navigation)
    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey(direction, modeContext);
      if (handled) return;
    }

    if (editorMode === 'PHONE') {
      setJustCommitted(false);
    }

    // Normal calculation: Check AST template navigation first, then history recall
    if (direction === 'UP') {
      const navUp = navigateAst(astState, 'up');
      if (navUp !== astState && (navUp.cursor.slotId !== astState.cursor.slotId || navUp.cursor.offset !== astState.cursor.offset)) {
        setAstState(navUp);
        setActiveHistoryId(null);
        return;
      }
      if (history.length > 0) {
        const nextIdx = historyIndex === -1 ? 0 : Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(nextIdx);
        const item = history[nextIdx];
        setAstState(item.astRoot ? { root: JSON.parse(JSON.stringify(item.astRoot)), cursor: { slotId: 'root', offset: item.astRoot.length }, pendingDeleteTemplateId: null } : parseStringToAst(item.expression));
        setResult(item.result);
        setRawNumericVal(item.numericVal);
        setIsCalculated(true);
        setActiveHistoryId(item.id);
      }
      return;
    }

    if (direction === 'DOWN') {
      const navDown = navigateAst(astState, 'down');
      if (navDown !== astState && (navDown.cursor.slotId !== astState.cursor.slotId || navDown.cursor.offset !== astState.cursor.offset)) {
        setAstState(navDown);
        setActiveHistoryId(null);
        return;
      }
      if (historyIndex !== -1) {
        const nextIdx = historyIndex - 1;
        if (nextIdx < 0) {
          setHistoryIndex(-1);
          setAstState(createInitialAstState());
          setResult('0');
          setIsCalculated(false);
          setActiveHistoryId(null);
        } else {
          setHistoryIndex(nextIdx);
          const item = history[nextIdx];
          setAstState(item.astRoot ? { root: JSON.parse(JSON.stringify(item.astRoot)), cursor: { slotId: 'root', offset: item.astRoot.length }, pendingDeleteTemplateId: null } : parseStringToAst(item.expression));
          setResult(item.result);
          setRawNumericVal(item.numericVal);
          setIsCalculated(true);
          setActiveHistoryId(item.id);
        }
      }
      return;
    }

    setActiveHistoryId(null);
    const dirMap = {
      LEFT: 'left' as const,
      RIGHT: 'right' as const,
      UP: 'up' as const,
      DOWN: 'down' as const,
    };
    setAstState(navigateAst(astState, dirMap[direction]));
  };

  // Evaluate Expression (= Key)
  const handleEqual = () => {
    if (isPoweredOff) return;
    playKeyClick('equal');
    triggerHaptic('equal');

    // If an in-display menu is open, = confirms the highlighted item
    if (displayMenu === 'MENU') {
      const selected = ALL_MENU_ITEMS[menuHighlightIndex];
      if (selected) {
        handleSelectMode(selected.code);
      }
      return;
    }

    if (displayMenu === 'SETUP') {
      const pageItems = SETUP_PAGES[setupPageIndex];
      const item = pageItems[setupRowIndex];
      if (item?.targetMenu) {
        setDisplayMenu(item.targetMenu);
      } else {
        setDisplayMenu('NONE');
      }
      return;
    }

    if (displayMenu === 'RESET_CONFIRM') {
      // Execute hardware reset
      localStorage.clear();
      setVariables({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0 });
      setMemoryM(0);
      setLastAns(0);
      setDisplayFormat('NORM1');
      setAngleMode('DEG');
      handleSelectMode('CALC');
      setAstState(createInitialAstState());
      setResult('0');
      setActiveHistoryId(null);
      setHistory([]);
      setDisplayMenu('NONE');
      return;
    }

    if (['SETUP_ANGLE', 'SETUP_FORMAT', 'SETUP_FIX', 'SETUP_SCI', 'SETUP_NORM', 'SETUP_IO', 'OPTN', 'CONST_CAT', 'CONST_LIST', 'CONV_CAT', 'CONV_LIST', 'RESET', 'STAT', 'MATRIX', 'VECTOR'].includes(displayMenu)) {
      setDisplayMenu('NONE');
      return;
    }

    // In non-CALC mode and displayMenu is NONE, let the active mode handle '=' evaluation
    if (modeState.mode !== 'CALC') {
      const handled = currentModeModule.handleKey('=', modeContext);
      if (handled) return;
    }

    if (astState.root.length === 0) return;

    const evalResult = evaluateMathAst(astState.root, angleMode, variables, lastAns);

    if (evalResult.success && evalResult.result !== undefined) {
      const numVal = evalResult.result;
      setRawNumericVal(numVal);
      setLastAns(numVal);
      try {
        localStorage.setItem('casio_last_ans', String(numVal));
      } catch {}
      setIsCalculated(true);
      setSdCycleState(0);
      setEngStep(0);
      setErrorMessage(null);

      let formattedOutput: string;
      if (evalResult.exactResult !== undefined && displayFormat.startsWith('NORM')) {
        formattedOutput = evalResult.exactResult;
        setLastExactResult(evalResult.exactResult);
      } else {
        formattedOutput = formatResult(numVal, displayFormat, fixDigits, sciDigits, 0);
        setLastExactResult(undefined);
      }

      setResult(formattedOutput);

      const completedExpr = astToDisplayText(astState.root);
      const completedAstRoot = JSON.parse(JSON.stringify(astState.root));

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        expression: completedExpr,
        result: formattedOutput,
        exactResult: evalResult.exactResult,
        numericVal: numVal,
        timestamp: Date.now(),
        astRoot: completedAstRoot,
      };

      if (editorMode === 'PHONE') {
        setJustCommitted(true);
        setLivePreviewResult(formattedOutput);
        setLastValidPreviewResult(formattedOutput);
      }

      setActiveHistoryId(newHistoryItem.id);
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 49)]);
      setHistoryIndex(-1);
    } else {
      setErrorMessage(evalResult.error || 'Syntax ERROR');
      triggerHaptic('error', { force: true });
      setResult('');
      setActiveHistoryId(null);
      if (editorMode === 'PHONE') {
        setJustCommitted(false);
      }
    }
  };

  // Smart multi-state key helper (Primary, SHIFT, ALPHA, Mode Overrides)
  const handleSmartKey = (
    primaryAction: () => void,
    shiftAction?: () => void,
    alphaAction?: () => void,
    hapticTypeOrKeyName?: HapticKeyType | string,
    keyNameParam?: string
  ) => {
    if (isPoweredOff) return;
    let hapticType: HapticKeyType = 'func';
    let keyName = keyNameParam;

    const validHaptics: HapticKeyType[] = ['action', 'alpha', 'dpad', 'equal', 'error', 'func', 'num', 'sd', 'shift'];
    if (typeof hapticTypeOrKeyName === 'string') {
      if (validHaptics.includes(hapticTypeOrKeyName as HapticKeyType)) {
        hapticType = hapticTypeOrKeyName as HapticKeyType;
      } else {
        keyName = hapticTypeOrKeyName;
      }
    }

    playKeyClick(hapticType);
    if (alphaActive && alphaAction) {
      alphaAction();
      setAlphaActive(false);
    } else if (shiftActive && shiftAction) {
      shiftAction();
      setShiftActive(false);
    } else {
      // In non-CALC mode, check if key is overridden in the mode's keymap table
      if (modeState.mode !== 'CALC' && keyName && currentModeModule.keymap.overrides[keyName]) {
        currentModeModule.keymap.overrides[keyName].action(modeContext);
        return;
      }
      primaryAction();
    }
  };

  // Variable Storage and Recall (STO, RCL)
  const handleVariableOperation = (varName: string) => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('action');
    if (isStoreMode) {
      const val = isCalculated ? rawNumericVal : lastAns;
      setVariables((prev) => ({ ...prev, [varName]: val }));
      setIsStoreMode(false);
      setResult(`Ans➔${varName}`);
    } else {
      handleToken(varName, 'num', 'VAR');
    }
  };

  // Memory Plus/Minus (M+, M-)
  const handleMemoryAdd = (subtract = false) => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('action');
    const val = isCalculated ? rawNumericVal : lastAns;
    const nextM = subtract ? memoryM - val : memoryM + val;
    setMemoryM(nextM);
    setVariables((prev) => ({ ...prev, M: nextM }));
  };

  // Prime Factorization (FACT)
  const handlePrimeFactorization = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('func');
    if (!isCalculated || rawNumericVal <= 0 || !Number.isInteger(rawNumericVal)) return;
    const factors = primeFactorization(rawNumericVal);
    setResult(factors);
  };

  // Equation Solve Helper (SOLVE)
  const handleSolve = () => {
    if (isPoweredOff || displayMenu !== 'NONE') return;
    playKeyClick('action');
    const expr = astToExpression(astState.root);
    const res = solveEquation(expr, angleMode, variables.X || 0);
    if (res.success && res.root !== undefined) {
      setResult(`x = ${formatResult(res.root, displayFormat, fixDigits, sciDigits, 0)}`);
      setVariables((prev) => ({ ...prev, X: res.root! }));
      setIsCalculated(true);
    } else {
      setErrorMessage(res.error || "Can't Solve");
      triggerHaptic('error', { force: true });
    }
  };

  // Active page index for MENU grid (2 pages of 6 items each)
  const menuPage = Math.floor(menuHighlightIndex / 6);
  const currentMenuGrid = MENU_PAGES[menuPage] || MENU_PAGES[0];

  // Inline history: exclude active calculation while it is the active one, ordered oldest->newest so newest sits right above active input
  const inlineHistory = [...history]
    .filter((it) => it.id !== activeHistoryId)
    .reverse();

  return (
    <div
      ref={appRootRef}
      data-theme={theme}
      className="w-full h-[100dvh] bg-[var(--bg)] flex items-center justify-center p-0 m-0 overflow-hidden select-none font-sans"
    >

      {/* Hidden Perf Debug Overlay (toggled from Settings -> Frame-time monitor) */}
      <PerfOverlay isOpen={perfOverlayOn} onClose={() => setPerfOverlayOn(false)} />

      {/* Floating Performance Metrics HUD (?perf=1) */}
      {perfMetrics?.isPerf && (
        <div className="fixed top-2 left-2 z-50 p-2.5 bg-[var(--m3-surface)] border border-emerald-500 rounded-lg font-sans text-[10px] text-emerald-400 pointer-events-none shadow-2xl max-w-[320px] leading-tight select-none">
          <div className="font-bold text-amber-300 border-b border-emerald-800 pb-1 mb-1 flex justify-between items-center">
            <span>fx-570EX GEOMETRY & PERF</span>
            <span className="text-[9px] text-emerald-300">?perf=1</span>
          </div>
          <div>Screen: {perfMetrics.screenWidth} × {perfMetrics.screenHeight} px (DPR: {perfMetrics.dpr})</div>
          <div>Key Block: {perfMetrics.keyBlockWidth.toFixed(1)} × {perfMetrics.keyBlockHeight.toFixed(1)} px</div>
          <div className={perfMetrics.isDisplayPctPass ? 'text-emerald-300 font-bold' : 'text-amber-400 font-bold'}>
            Display H: {perfMetrics.displayHeight.toFixed(1)} px ({perfMetrics.displayPct.toFixed(1)}% of VP) {perfMetrics.isDisplayPctPass ? '✓ PASS (~24%)' : '⚠ LOW'}
          </div>
          <div className="mt-1 pt-1 border-t border-emerald-950 space-y-0.5">
            <div className={perfMetrics.isVisualKeyPass ? 'text-emerald-300' : 'text-rose-400 font-bold'}>
              Visual Key H: {perfMetrics.visualKeyHeight.toFixed(1)} dp {perfMetrics.isVisualKeyPass ? '✓ PASS (≥40dp)' : '✗ FAIL (<40dp)'}
            </div>
            <div className={perfMetrics.isTouchTargetPass ? 'text-emerald-300' : 'text-rose-400 font-bold'}>
              Touch Target: {perfMetrics.touchTargetWidth.toFixed(1)} × {perfMetrics.touchTargetHeight.toFixed(1)} dp {perfMetrics.isTouchTargetPass ? '✓ PASS (≥44dp)' : '✗ FAIL (<44dp)'}
            </div>
            <div className="text-slate-400 text-[9px]">
              Smallest Target: {perfMetrics.touchTargetWidth.toFixed(1)} × {perfMetrics.touchTargetHeight.toFixed(1)} dp ({perfMetrics.minKeyLabel})
            </div>
          </div>
        </div>
      )}

      {/* Main Container: Sized edge-to-edge on mobile, letterboxed on desktop using dvh */}
      <main 
        style={{
          transform: calibrationScale !== 1.0 ? `scale(${calibrationScale})` : undefined,
          transformOrigin: 'top center',
        }}
        className="w-full max-w-[440px] h-[100dvh] bg-[var(--bg)] flex flex-col justify-between relative overflow-hidden select-none"
      >
        {/* Key-Path Trainer Floating Pill (Study Mode) */}
        {calcMode === 'STUDY' && trainerRoute && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-full bg-[var(--ui-accent)] text-[var(--ui-accent-text)] font-sans font-bold text-[10px] shadow-lg flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Path: {trainerRoute}</span>
          </div>
        )}

        {/* 2. MINIMALIST HIGH-CONTRAST LCD DISPLAY SCREEN */}
        {/* Shared 16px (8px-grid) left/right margin matching keypad below */}
        <div 
          ref={displayRef}
          data-testid="display-screen"
          style={{
            paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 16px))',
            paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
            paddingBottom: '8px',
          }}
          className={`flex-1 w-full min-h-[140px] rounded-[20px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] flex flex-col justify-between relative select-none ${
            isPoweredOff ? 'bg-[var(--display-bg)]' : 'lcd-screen-bg'
          }`}
        >
          {isPoweredOff ? (
            /* Power-Off Standby Display */
            <div className="h-full flex flex-col items-center justify-center text-[var(--display-text)]/40 font-sans select-none">
              <Power className="w-5 h-5 mb-1 opacity-40" />
              <span className="text-[10px] tracking-widest opacity-45">CASIO CLASSWIZ [STANDBY]</span>
              <span className="text-[9px] opacity-35 mt-0.5">Press ON to power up</span>
            </div>
          ) : (
            <>
              {/* TOP NOTIFICATION-CENTER GRAB HANDLE + SLIM STATUS INDICATOR HEADER */}
              <div
                onPointerDown={(e) => {
                  grabSwipeStartYRef.current = e.clientY;
                }}
                onPointerUp={(e) => {
                  if (grabSwipeStartYRef.current !== null) {
                    const dy = e.clientY - grabSwipeStartYRef.current;
                    grabSwipeStartYRef.current = null;
                    if (dy > 24 && modeState.mode === 'CALC' && displayMenu === 'NONE') {
                      playKeyClick('action');
                      setIsHistorySheetOpen(true);
                    }
                  }
                }}
                className="w-full shrink-0 flex flex-col items-center pb-1"
              >
                {modeState.mode === 'CALC' && displayMenu === 'NONE' && (
                  <button
                    ref={historyGrabRef}
                    type="button"
                    data-testid="history-grab-handle"
                    aria-label="Open calculation history sheet"
                    title="Swipe down or tap for History"
                    onClick={() => {
                      playKeyClick('action');
                      setIsHistorySheetOpen(true);
                    }}
                    className="w-24 h-4 -mt-1 flex items-center justify-center cursor-pointer touch-none group"
                  >
                    <span className="w-9 h-1 rounded-full bg-[var(--display-text)]/35 group-hover:bg-[var(--display-text)]/70" />
                  </button>
                )}

                <div className="flex items-center justify-between text-[11px] font-sans tabular-nums tracking-wider select-none text-[var(--display-text)]/70 w-full">
                  <div className="flex items-center gap-1.5">
                    {/* [S] Indicator: Shown ONLY when active */}
                    {shiftActive && (
                      <span className="px-1 rounded text-[9px] font-bold bg-[var(--label-shift)] text-[var(--ui-accent-text)]">
                        S
                      </span>
                    )}
                    {/* [A] Indicator: Shown ONLY when active */}
                    {alphaActive && (
                      <span className="px-1 rounded text-[9px] font-bold bg-[var(--label-alpha)] text-[var(--key-accent-text)]">
                        A
                      </span>
                    )}
                    {/* Angle Unit Indicator (D, R, G) */}
                    <span className="font-bold text-[var(--display-text)] text-[10.5px]">
                      {angleMode === 'DEG' ? 'D' : angleMode === 'RAD' ? 'R' : 'G'}
                    </span>
                    {/* Precision Format Mode */}
                    <span className="text-[9.5px] text-[var(--display-text)]/75">
                      {displayFormat === 'NORM1' ? 'Norm1' : displayFormat === 'NORM2' ? 'Norm2' : displayFormat === 'FIX' ? `Fix${fixDigits}` : `Sci${sciDigits}`}
                    </span>
                    {/* Mode Indicator: dynamic based on active mode */}
                    {modeIndicator && (
                      <span className="px-1 rounded text-[8.5px] font-bold border border-[var(--display-text)]/30 text-[var(--display-text)]">
                        {modeIndicator}
                      </span>
                    )}
                    {/* [STO] Indicator */}
                    {isStoreMode && (
                      <span className="px-1 rounded text-[8.5px] font-bold bg-[var(--label-base)] text-[var(--ui-accent-text)]">
                        STO
                      </span>
                    )}
                    {/* [M] Indicator */}
                    {memoryM !== 0 && (
                      <span className="px-1 rounded text-[8.5px] font-bold bg-[var(--display-text)] text-[var(--display-bg)]">
                        M
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[var(--display-text)]/85 text-[10.5px] font-math-serif italic">Math</span>
                    <span className="text-[var(--display-text)]/75 inline-flex items-center">
                      <HeaderScrollArrowsSvg className="w-[18px] h-[9px]" />
                    </span>
                    <button
                      ref={settingsGearRef}
                      onClick={() => {
                        playKeyClick('action');
                        setIsSettingsModalOpen(true);
                      }}
                      aria-label="Settings and Modes"
                      title="Settings & Modes"
                      className="p-1 -mr-1 rounded hover:text-[var(--display-text)] opacity-75 hover:opacity-100 cursor-pointer flex items-center justify-center min-w-[28px] min-h-[28px]"
                    >
                      <HeaderGearSvg className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* IN-DISPLAY CONTENT ROUTER: Swaps between Natural Expression, Mode Screens, and In-Display Menus */}
              <div className="flex-1 w-full min-h-0 flex flex-col justify-between relative">
              {displayMenu === 'NONE' || (displayMenu === 'MENU' || isMenuClosing) ? (
                <>
                  {displayMenu !== 'MENU' && (
                    modeState.mode !== 'CALC' ? (
                      /* In-Display Mode Renderer (BASE, CMPLX, MATRIX, VECTOR, STAT, TABLE, EQN, DIST, etc.) */
                      <div
                        ref={modeContainerRef}
                        data-testid="mode-display-container"
                        style={{ transformOrigin: 'center center' }}
                        className="flex-1 w-full flex flex-col justify-between overflow-hidden"
                      >
                        {currentModeModule.renderDisplay(modeContext)}
                      </div>
                    ) : (
                      <div
                        ref={calcContainerRef}
                        style={{ transformOrigin: 'center center' }}
                        className="flex-1 w-full min-h-0 flex flex-col justify-between overflow-hidden"
                      >
                        <DisplayWorkspace
                          inlineHistory={inlineHistory}
                          astState={astState}
                          setAstState={setAstState}
                          errorMessage={errorMessage}
                          result={result}
                          onInsertExpr={handleInsertHistoryExpression}
                          onInsertResult={handleInsertHistoryResult}
                          editorMode={editorMode}
                          justCommitted={justCommitted}
                          livePreviewResult={livePreviewResult}
                          lastValidPreviewResult={lastValidPreviewResult}
                          onCursorTouched={() => {
                            setJustCommitted(false);
                            setActiveHistoryId(null);
                          }}
                        />
                      </div>
                    )
                  )}

                  {(displayMenu === 'MENU' || isMenuClosing) && (
                    /* 1. IN-DISPLAY MENU GRID: 2 rows × 3 columns per page, FLIP expand/collapse back to MENU key */
                    <div
                      ref={menuContainerRef}
                      data-testid="in-display-menu"
                      style={{ transformOrigin: 'center center' }}
                      className={`w-full h-full min-h-[92px] flex flex-col justify-between py-1 font-sans select-none bg-[var(--display-bg)] ${
                        displayMenu === 'MENU' ? 'flex-1' : 'absolute inset-0 z-20 pointer-events-none'
                      }`}
                    >
                      <div className="grid grid-cols-3 grid-rows-2 gap-1.5 flex-1 min-h-[72px] w-full items-stretch">
                        {currentMenuGrid.map((item, idx) => {
                          const absoluteIndex = menuPage * 6 + idx;
                          const isSelected = absoluteIndex === menuHighlightIndex;
                          const isLong = item.shortName.length >= 10;
                          return (
                            <button
                              key={item.id}
                              data-menu-card-code={item.code}
                              onClick={() => {
                                setMenuHighlightIndex(absoluteIndex);
                                handleSelectMode(item.code);
                              }}
                              className={`flex flex-col items-start justify-center px-2 py-1.5 rounded-lg text-left border cursor-pointer overflow-hidden ${
                                isSelected
                                  ? 'bg-[var(--display-text)] text-[var(--display-bg)] font-bold border-[var(--display-text)] static-glow-card'
                                  : 'bg-[var(--menu-card-bg)] text-[var(--display-text)] border-[var(--m3-outline-variant)]'
                              }`}
                            >
                              <span className={`text-[clamp(9.5px,min(2.4cqw,1.5cqh),11px)] font-extrabold leading-none mb-0.5 ${
                                isSelected ? 'text-[var(--display-bg)]' : 'text-[var(--label-shift)]'
                              }`}>
                                {item.key}:
                              </span>
                              <span className={`font-bold leading-[1.15] w-full tracking-tight break-words ${
                                isLong
                                  ? 'text-[clamp(10px,min(2.8cqw,1.8cqh),12px)]'
                                  : 'text-[clamp(11.5px,min(3.5cqw,2.2cqh),14px)]'
                              } ${
                                isSelected ? 'text-[var(--display-bg)]' : 'text-[var(--display-text)]'
                              }`}>
                                {item.shortName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Page indicator and helper footer */}
                      <div className="flex items-center justify-between text-[9px] text-[var(--display-text)]/75 pt-1 border-t border-[var(--m3-outline-variant)]">
                        <span>Use [▲▼◄►] to move, [=] to select</span>
                        <span className="font-bold text-[var(--label-shift)]">Page {menuPage + 1}/2 ▲▼</span>
                      </div>
                    </div>
                  )}
                </>
              ) : displayMenu === 'SETUP' ? (
                /* 2. IN-DISPLAY SETUP LIST: Scrollable list of 4 items per page */
                <div className="flex-1 flex flex-col justify-between py-1 overflow-hidden font-sans">
                  <div className="space-y-1 flex-1">
                    <div className="text-[10px] font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20 pb-0.5 mb-1 flex justify-between">
                      <span>SETUP MENU</span>
                      <span>Page {setupPageIndex + 1}/{SETUP_PAGES.length} ▲▼</span>
                    </div>
                    {SETUP_PAGES[setupPageIndex].map((item, idx) => {
                      const isSelected = idx === setupRowIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSetupRowIndex(idx);
                            if (item.targetMenu) setDisplayMenu(item.targetMenu);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-0.5 rounded text-left text-xs ${
                            isSelected
                              ? 'bg-[var(--display-text)] text-[var(--display-bg)] font-bold shadow-sm'
                              : 'text-[var(--display-text)] hover:bg-[var(--display-text)]/20'
                          }`}
                        >
                          <span>{item.key}:{item.title}</span>
                          <span className="text-[10px] opacity-70">➔</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press 1~4 to select</span>
                    <span>[AC] :Exit</span>
                  </div>
                </div>
              ) : displayMenu === 'SETUP_ANGLE' ? (
                /* Angle Unit Sub-menu */
                <div className="flex-1 flex flex-col justify-between py-1 font-sans">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20 pb-0.5">ANGLE UNIT</div>
                    {[
                      { key: '1', name: 'Degree (D)', mode: 'DEG' as AngleMode },
                      { key: '2', name: 'Radian (R)', mode: 'RAD' as AngleMode },
                      { key: '3', name: 'Gradian (G)', mode: 'GRA' as AngleMode },
                    ].map((m) => (
                      <button
                        key={m.key}
                        onClick={() => {
                          setAngleMode(m.mode);
                          setDisplayMenu('NONE');
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs ${
                          angleMode === m.mode ? 'bg-[var(--display-text)] text-[var(--display-bg)] font-bold' : 'text-[var(--display-text)] hover:bg-[var(--display-text)]/20'
                        }`}
                      >
                        <span>{m.key}:{m.name}</span>
                        {angleMode === m.mode && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press 1~3 to set</span>
                    <span>[AC] :Back</span>
                  </div>
                </div>
              ) : displayMenu === 'SETUP_FORMAT' ? (
                /* Number Format Sub-menu */
                <div className="flex-1 flex flex-col justify-between py-1 font-sans">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20 pb-0.5">NUMBER FORMAT</div>
                    {[
                      { key: '1', name: 'Fix (Fixed decimal places)', menu: 'SETUP_FIX' as DisplayMenuType },
                      { key: '2', name: 'Sci (Significant figures)', menu: 'SETUP_SCI' as DisplayMenuType },
                      { key: '3', name: 'Norm (Norm1 / Norm2)', menu: 'SETUP_NORM' as DisplayMenuType },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setDisplayMenu(f.menu)}
                        className="w-full flex items-center justify-between px-2 py-1 rounded text-xs text-[var(--display-text)] hover:bg-[var(--display-text)]/20"
                      >
                        <span>{f.key}:{f.name}</span>
                        <span className="text-[10px] opacity-70">➔</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press 1~3 to choose</span>
                    <span>[AC] :Back</span>
                  </div>
                </div>
              ) : displayMenu === 'SETUP_FIX' ? (
                /* Fix Digits Prompt */
                <div className="flex-1 flex flex-col justify-between py-2 font-sans text-center">
                  <div className="py-2">
                    <div className="text-sm font-bold text-[var(--display-text)]">Fix 0~9?</div>
                    <p className="text-[10px] text-[var(--display-text)]/70 mt-1">Specify number of decimal places (e.g. press 2 for Fix2)</p>
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press [0] ~ [9]</span>
                    <span>[AC] :Back</span>
                  </div>
                </div>
              ) : displayMenu === 'SETUP_SCI' ? (
                /* Sci Digits Prompt */
                <div className="flex-1 flex flex-col justify-between py-2 font-sans text-center">
                  <div className="py-2">
                    <div className="text-sm font-bold text-[var(--display-text)]">Sci 0~9?</div>
                    <p className="text-[10px] text-[var(--display-text)]/70 mt-1">Specify significant figures (0 = 10 digits)</p>
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press [0] ~ [9]</span>
                    <span>[AC] :Back</span>
                  </div>
                </div>
              ) : displayMenu === 'SETUP_NORM' ? (
                /* Norm1 / Norm2 Selection */
                <div className="flex-1 flex flex-col justify-between py-1 font-sans">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20 pb-0.5">NORM FORMAT</div>
                    <button
                      onClick={() => {
                        setDisplayFormat('NORM1');
                        setDisplayMenu('NONE');
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs ${
                        displayFormat === 'NORM1' ? 'bg-[var(--display-text)] text-[var(--display-bg)] font-bold' : 'text-[var(--display-text)]'
                      }`}
                    >
                      <span>1:Norm1 (10⁻² ~ 10¹⁰)</span>
                      {displayFormat === 'NORM1' && <span>✓</span>}
                    </button>
                    <button
                      onClick={() => {
                        setDisplayFormat('NORM2');
                        setDisplayMenu('NONE');
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs ${
                        displayFormat === 'NORM2' ? 'bg-[var(--display-text)] text-[var(--display-bg)] font-bold' : 'text-[var(--display-text)]'
                      }`}
                    >
                      <span>2:Norm2 (10⁻⁹ ~ 10¹⁰)</span>
                      {displayFormat === 'NORM2' && <span>✓</span>}
                    </button>
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press 1 or 2</span>
                    <span>[AC] :Back</span>
                  </div>
                </div>
              ) : displayMenu === 'OPTN' ? (
                /* 3. OPTN MENU */
                <div className="flex-1 flex flex-col justify-between py-1 font-sans">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20 pb-0.5">OPTIONS (OPTN)</div>
                    {[
                      { key: '1', name: 'Hyperbolic / Trig', menu: 'OPTN_HYP' as DisplayMenuType },
                      { key: '2', name: 'Angle Unit (° / r / g)', menu: 'OPTN_ANGLE' as DisplayMenuType },
                      { key: '3', name: 'Engineer Symbol', menu: 'OPTN_ENG' as DisplayMenuType },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setDisplayMenu(opt.menu)}
                        className="w-full flex items-center justify-between px-2 py-1 rounded text-xs text-[var(--display-text)] hover:bg-[var(--display-text)]/20"
                      >
                        <span>{opt.key}:{opt.name}</span>
                        <span className="text-[10px] opacity-70">➔</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press 1~3</span>
                    <span>[AC] :Exit</span>
                  </div>
                </div>
              ) : displayMenu === 'CONST_CAT' ? (
                /* 4. SCIENTIFIC CONSTANTS CATEGORIES */
                <div className="flex-1 flex flex-col justify-between py-1 font-sans">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20 pb-0.5">SCIENTIFIC CONSTANTS</div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      {CONST_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setConstCatIndex(cat.id - 1);
                            setDisplayMenu('CONST_LIST');
                          }}
                          className="flex items-center px-1.5 py-0.5 rounded text-left text-[var(--display-text)] hover:bg-[var(--display-text)]/20 border border-[var(--display-text)]/30"
                        >
                          <span className="font-bold text-[var(--label-shift)] mr-1">{cat.key}:</span>
                          <span className="truncate">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press 1~6</span>
                    <span>[AC] :Exit</span>
                  </div>
                </div>
              ) : displayMenu === 'CONST_LIST' ? (
                /* Constants List */
                <div className="flex-1 flex flex-col justify-between py-1 font-sans">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20 pb-0.5">
                      {CONST_CATEGORIES[constCatIndex]?.name.toUpperCase()} CONSTANTS
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      {CONST_CATEGORIES[constCatIndex]?.items.map((sym, idx) => (
                        <button
                          key={sym}
                          onClick={() => handleMenuNumberSelect((idx + 1).toString())}
                          className="flex items-center justify-between px-1.5 py-0.5 rounded text-left text-[var(--display-text)] hover:bg-[var(--display-text)]/20 border border-[var(--display-text)]/30"
                        >
                          <span><strong className="text-[var(--label-shift)] mr-1">{idx + 1}:</strong>{sym}</span>
                          <span className="text-[9px] opacity-60">insert</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press key to insert</span>
                    <span>[AC] :Back</span>
                  </div>
                </div>
              ) : displayMenu === 'RESET' ? (
                /* 5. RESET MENU */
                <div className="flex-1 flex flex-col justify-between py-1 font-sans">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-[var(--ui-danger)] border-b border-[var(--display-text)]/20 pb-0.5">RESET ?</div>
                    {[
                      { key: '1', name: 'Setup Data' },
                      { key: '2', name: 'Memory' },
                      { key: '3', name: 'Initialize All' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setResetIndex(parseInt(item.key, 10) - 1);
                          setDisplayMenu('RESET_CONFIRM');
                        }}
                        className="w-full flex items-center justify-between px-2 py-1 rounded text-xs text-[var(--display-text)] hover:bg-[var(--display-text)]/20"
                      >
                        <span>{item.key}:{item.name}</span>
                        <span className="text-[10px] opacity-70">➔</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press 1~3</span>
                    <span>[AC] :Cancel</span>
                  </div>
                </div>
              ) : displayMenu === 'RESET_CONFIRM' ? (
                /* Reset Confirmation */
                <div className="flex-1 flex flex-col justify-between py-2 font-sans text-center">
                  <div className="py-2">
                    <div className="text-sm font-bold text-[var(--label-shift)]">Reset All?</div>
                    <div className="mt-2 text-xs text-[var(--display-text)]">
                      Yes: [ = ] &nbsp;&nbsp;&nbsp;&nbsp; No: [ AC ]
                    </div>
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press [=] to execute</span>
                    <span>[AC] :Cancel</span>
                  </div>
                </div>
              ) : (
                /* Generic In-Display Sub-menu (CONV, STAT, MATRIX, VECTOR) */
                <div className="flex-1 flex flex-col justify-between py-1 font-sans">
                  <div className="text-[10px] font-bold text-[var(--label-shift)] border-b border-[var(--display-text)]/20 pb-0.5 uppercase">
                    {displayMenu} MENU
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] py-1">
                    {['1:Item 1', '2:Item 2', '3:Item 3', '4:Item 4'].map((it, idx) => (
                      <button
                        key={it}
                        onClick={() => handleMenuNumberSelect((idx + 1).toString())}
                        className="px-1.5 py-0.5 rounded text-left text-[var(--display-text)] hover:bg-[var(--display-text)]/20 border border-[var(--display-text)]/30"
                      >
                        {it}
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-[var(--display-text)]/70 pt-1 border-t border-[var(--display-text)]/20 flex justify-between">
                    <span>Press 1~4 to select</span>
                    <span>[AC] :Exit</span>
                  </div>
                </div>
              )}
              </div>
            </>
          )}
        </div>

        {/* 3. KEYPAD SECTION: Physical fx-570EX Unit Grid */}
        {/* Scale key block uniformly by width; side padding min 16px keeps keys out of back-gesture zone */}
        {/* RULE: The key block never moves or shifts when menus open */}
        <div 
          ref={keyBlockRef}
          data-testid="key-block"
          onPointerDown={handleKeyPointerDown}
          onPointerMove={handleKeyPointerMove}
          onPointerUp={handleKeyPointerUp}
          style={{
            paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 16px))',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
          }}
          className="shrink-0 w-full pt-0 flex flex-col gap-1 justify-end"
        >
          {/* FUNCTION KEYS BLOCK: 6 columns × 7 rows */}
          <div className="grid grid-cols-6 gap-x-1.5 gap-y-0.5 relative w-full">
            
            {/* Col 1, Row 1: SHIFT */}
            <div className="col-start-1 row-start-1 key-wrapper">
              <div className="key-secondary-labels">
                <span></span>
                <span></span>
              </div>
              <button
                onClick={() => {
                  playKeyClick('action');
                  setShiftActive((prev) => !prev);
                  if (alphaActive) setAlphaActive(false);
                }}
                aria-label="SHIFT key"
                className={`w-full h-[40px] min-h-[40px] min-w-[44px] rounded-full font-sans text-[10px] sm:text-xs font-bold key-hardware-round flex items-center justify-center ${
                  shiftActive ? 'text-slate-950 bg-[var(--label-shift)] static-glow-shift' : 'theme-label-shift'
                }`}
              >
                SHIFT
              </button>
            </div>

            {/* Col 2, Row 1: ALPHA */}
            <div className="col-start-2 row-start-1 key-wrapper">
              <div className="key-secondary-labels">
                <span></span>
                <span></span>
              </div>
              <button
                onClick={() => {
                  playKeyClick('action');
                  setAlphaActive((prev) => !prev);
                  if (shiftActive) setShiftActive(false);
                }}
                aria-label="ALPHA key"
                className={`w-full h-[40px] min-h-[40px] min-w-[44px] rounded-full font-sans text-[10px] sm:text-xs font-bold key-hardware-round flex items-center justify-center ${
                  alphaActive ? 'text-[var(--label-alpha-active-text)] bg-[var(--label-alpha)] static-glow-alpha' : 'theme-label-alpha'
                }`}
              >
                ALPHA
              </button>
            </div>

            {/* Cols 3-4, Rows 1-2: 4-WAY D-PAD */}
            <div className="col-start-3 col-span-2 row-start-1 row-span-2 relative flex items-center justify-center my-auto py-0 z-10 pointer-events-auto">
              <div className="relative w-[90px] h-[79px] rounded-full bg-[#1A1A22] border border-slate-700/60 shadow-[inset_0_1px_3px_rgba(255,255,255,0.1),0_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden">
                
                {/* Up */}
                <button
                  onClick={() => handleDpad('UP')}
                  aria-label="D-pad Up"
                  className="absolute top-0 w-11 h-10 min-w-[44px] min-h-[40px] flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <DpadArrowSvg direction="UP" className="w-4 h-4" />
                </button>

                {/* Down */}
                <button
                  onClick={() => handleDpad('DOWN')}
                  aria-label="D-pad Down"
                  className="absolute bottom-0 w-11 h-10 min-w-[44px] min-h-[40px] flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <DpadArrowSvg direction="DOWN" className="w-4 h-4" />
                </button>

                {/* Left */}
                <button
                  onClick={() => handleDpad('LEFT')}
                  aria-label="D-pad Left"
                  className="absolute left-0 w-10 h-11 min-w-[40px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <DpadArrowSvg direction="LEFT" className="w-4 h-4" />
                </button>

                {/* Right */}
                <button
                  onClick={() => handleDpad('RIGHT')}
                  aria-label="D-pad Right"
                  className="absolute right-0 w-10 h-11 min-w-[40px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <DpadArrowSvg direction="RIGHT" className="w-4 h-4" />
                </button>

                {/* Center Core: Clean Casio Blank */}
                <div className="w-6 h-6 rounded-full bg-[#121218] border border-slate-800 pointer-events-none shadow-inner" />
              </div>
            </div>

            {/* Col 5, Row 1: MENU / SETUP */}
            <div className="col-start-5 row-start-1 key-wrapper relative z-20">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,1vh,9px)] font-sans theme-label-shift font-semibold tracking-tighter leading-none">SETUP</span>
                <span></span>
              </div>
              <button
                ref={menuKeyRef}
                onClick={() => {
                  playKeyClick('action');
                  if (shiftActive) {
                    setDisplayMenu((prev) => (prev === 'SETUP' ? 'NONE' : 'SETUP'));
                    setShiftActive(false);
                  } else if (displayMenu === 'MENU') {
                    closeInDisplayMenu('NONE');
                  } else {
                    pendingMenuFlipOriginRef.current =
                      modeState.mode !== 'CALC' && lastModeOriginRectRef.current
                        ? lastModeOriginRectRef.current
                        : menuKeyRectRef.current;
                    setIsMenuClosing(false);
                    menuCloseTokenRef.current++;
                    setDisplayMenu('MENU');
                    setMenuHighlightIndex(0);
                  }
                }}
                aria-label="MENU key"
                data-testid="menu-key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-full font-sans text-[10px] sm:text-xs font-semibold key-hardware-round text-slate-200 flex items-center justify-center cursor-pointer select-none"
              >
                MENU
              </button>
            </div>

            {/* Col 6, Row 1: ON */}
            <div className="col-start-6 row-start-1 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,1vh,9px)] font-sans text-slate-500 tracking-tighter leading-none">CLR</span>
                <span></span>
              </div>
              <button
                onClick={handleOn}
                aria-label="ON key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-full font-sans text-[10px] sm:text-xs font-bold key-hardware-round text-slate-100 border border-slate-600/50 flex items-center justify-center"
              >
                ON
              </button>
            </div>

            {/* Col 1, Row 2: OPTN */}
            <div className="col-start-1 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold theme-label-shift">QR</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => {
                    if (modeState.mode !== 'CALC') {
                      if (currentModeModule.keymap.overrides['OPTN']) {
                        currentModeModule.keymap.overrides['OPTN'].action(modeContext);
                      } else {
                        modeContext.openSubMenu();
                      }
                    } else {
                      setDisplayMenu((prev) => (prev === 'OPTN' ? 'NONE' : 'OPTN'));
                    }
                  },
                  () => setIsQrModalOpen(true)
                )}
                aria-label="OPTN key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] font-bold"
              >
                OPTN
              </button>
            </div>

            {/* Col 2, Row 2: CALC */}
            <div className="col-start-2 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold theme-label-shift">SOLVE</span>
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold theme-label-alpha font-math-serif not-italic inline-flex items-center">
                  <OperatorSvg op="=" className="w-[1.05em] h-[1.05em]" />
                </span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleEqual(),
                  () => handleSolve(),
                  () => handleToken('=')
                )}
                aria-label="CALC key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-semibold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                CALC
              </button>
            </div>

            {/* Col 5, Row 2: INTEGRAL */}
            <div className="col-start-5 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold theme-label-shift font-math-serif italic inline-flex items-baseline leading-none">
                  <span>d</span>
                  <span className="not-italic mx-[0.04em]">/</span>
                  <span>dx</span>
                </span>
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold theme-label-alpha">:</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleIntegralKey(),
                  () => handleDerivativeKey(),
                  () => handleToken(':')
                )}
                aria-label="Integral key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-sm"
              >
                <span data-testid="key-integral-glyph" className="inline-flex items-center justify-center gap-[0.12em] leading-none">
                  <IntegralSvg className="w-[0.72em] h-[1.34em]" />
                  <span className="font-math-serif italic text-[14.5px] leading-none">dx</span>
                </span>
              </button>
            </div>

            {/* Col 6, Row 2: VARIABLE x */}
            <div className="col-start-6 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold theme-label-shift inline-flex items-center leading-none">
                  <SigmaSvg className="w-[1.02em] h-[1.12em]" />
                </span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('x', 'num', 'VAR'),
                  () => handleToken('Σ(')
                )}
                aria-label="Variable x key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal theme-label-alpha flex items-center justify-center font-bold text-sm"
              >
                <span className="font-math-serif italic text-[17px] leading-none">x</span>
              </button>
            </div>

            {/* ROW 3: Fraction, Sqrt, Square, Power, LogBase, Ln */}
            {/* Col 1, Row 3: Fraction */}
            <div className="col-start-1 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift font-math-serif italic leading-none">
                  a b<span className="not-italic">/</span>c
                </span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleFractionKey(), () => handleFractionKey())}
                aria-label="Fraction key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-xs"
              >
                <FractionKeySvg className="w-[1.95em] h-[1.15em]" />
              </button>
            </div>

            {/* Col 2, Row 3: Sqrt */}
            <div className="col-start-2 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift inline-flex items-center leading-none">
                  <CubeRootShiftSvg className="w-[2.15em] h-[1.25em]" />
                </span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleSqrtKey(), () => handleToken('³√('))}
                aria-label="Square root key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-xs"
              >
                <SqrtKeySvg className="w-[1.85em] h-[1.15em]" />
              </button>
            </div>

            {/* Col 3, Row 3: x² */}
            <div className="col-start-3 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift font-math-serif leading-none">
                  <span className="italic">x</span>
                  <sup className="not-italic text-[0.78em] ml-[0.04em]">3</sup>
                </span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-base">DEC</span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handlePostfixKey('²'), () => handlePostfixKey('³'), undefined, 'func', 'x²')}
                aria-label="x squared key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-xs"
              >
                <span className="font-math-serif leading-none text-[14.5px] inline-flex items-baseline">
                  <span className="italic">x</span>
                  <sup className="not-italic text-[0.68em] ml-[0.05em]">2</sup>
                </span>
              </button>
            </div>

            {/* Col 4, Row 3: x□ */}
            <div className="col-start-4 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift inline-flex items-center leading-none">
                  <NthRootShiftSvg className="w-[2.25em] h-[1.25em]" />
                </span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-base">HEX</span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handlePowerKey(), () => handleToken('^('), undefined, 'func', 'x^□')}
                aria-label="x to power key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-xs"
              >
                <span className="font-math-serif leading-none text-[14.5px] inline-flex items-baseline">
                  <span className="italic">x</span>
                  <sup className="-top-[0.42em] ml-[0.08em] inline-flex">
                    <HollowBoxSvg className="w-[0.62em] h-[0.62em]" />
                  </sup>
                </span>
              </button>
            </div>

            {/* Col 5, Row 3: log□ */}
            <div className="col-start-5 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift font-math-serif not-italic inline-flex items-baseline leading-none">
                  <span>10</span>
                  <sup className="-top-[0.22em] ml-[0.06em] inline-flex">
                    <HollowBoxSvg className="w-[0.68em] h-[0.68em]" />
                  </sup>
                </span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-base">BIN</span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleLogBaseKey(), () => handleToken('10^('), undefined, 'func', 'log')}
                aria-label="log base key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-[11px]"
              >
                <span className="inline-flex items-baseline leading-none">
                  <span className="font-sans">log</span>
                  <sub className="bottom-[-0.24em] ml-[0.08em] inline-flex">
                    <HollowBoxSvg className="w-[0.66em] h-[0.66em]" />
                  </sub>
                </span>
              </button>
            </div>

            {/* Col 6, Row 3: ln */}
            <div className="col-start-6 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift font-math-serif inline-flex items-baseline leading-none">
                  <span className="italic">e</span>
                  <sup className="-top-[0.22em] ml-[0.06em] inline-flex">
                    <HollowBoxSvg className="w-[0.68em] h-[0.68em]" />
                  </sup>
                </span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-base">OCT</span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleToken('ln('), () => handleToken('e^('), undefined, 'func', 'ln')}
                aria-label="ln key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-xs font-semibold"
              >
                ln
              </button>
            </div>

            {/* ROW 4: (-) Negation, Deg/Min/Sec, x⁻¹, sin, cos, tan */}
            {/* Col 1, Row 4: (-) Negation */}
            <div className="col-start-1 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">log</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">A</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('(-'),
                  () => handleToken('log('),
                  () => handleVariableOperation('A'),
                  '(-)'
                )}
                aria-label="Negation key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-xs"
              >
                <span className="font-math-serif not-italic text-[13.5px] leading-none inline-flex items-center">
                  <span>(</span>
                  <OperatorSvg op="−" className="w-[0.75em] h-[0.75em] mx-[0.03em]" />
                  <span>)</span>
                </span>
              </button>
            </div>

            {/* Col 2, Row 4: DMS (° ' ") */}
            <div className="col-start-2 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">FACT</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">B</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => {
                    if (isCalculated) {
                      setResult(decimalToDms(rawNumericVal));
                    } else {
                      handlePostfixKey('°');
                    }
                  },
                  () => handlePrimeFactorization(),
                  () => handleVariableOperation('B'),
                  "° ' \""
                )}
                aria-label="Degrees minutes seconds key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-xs"
              >
                <span className="font-math-serif not-italic text-[13.5px] leading-none tracking-tight">°′″</span>
              </button>
            </div>

            {/* Col 3, Row 4: x⁻¹ */}
            <div className="col-start-3 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift font-math-serif leading-none">
                  <span className="italic">x</span>
                  <span className="not-italic">!</span>
                </span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">C</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handlePostfixKey('⁻¹'),
                  () => handlePostfixKey('!'),
                  () => handleVariableOperation('C'),
                  'hyp'
                )}
                aria-label="x inverse key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-xs"
              >
                <span className="font-math-serif leading-none text-[14.5px] inline-flex items-baseline">
                  <span className="italic">x</span>
                  <sup className="not-italic text-[0.68em] ml-[0.04em]">−1</sup>
                </span>
              </button>
            </div>

            {/* Col 4, Row 4: sin */}
            <div className="col-start-4 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">sin⁻¹</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">D</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('sin('),
                  () => handleToken('sin⁻¹('),
                  () => handleVariableOperation('D'),
                  'sin'
                )}
                aria-label="sine key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-xs"
              >
                sin
              </button>
            </div>

            {/* Col 5, Row 4: cos */}
            <div className="col-start-5 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">cos⁻¹</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">E</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('cos('),
                  () => handleToken('cos⁻¹('),
                  () => handleVariableOperation('E'),
                  'cos'
                )}
                aria-label="cosine key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-xs"
              >
                cos
              </button>
            </div>

            {/* Col 6, Row 4: tan */}
            <div className="col-start-6 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">tan⁻¹</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">F</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('tan('),
                  () => handleToken('tan⁻¹('),
                  () => handleVariableOperation('F'),
                  'tan'
                )}
                aria-label="tangent key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-xs"
              >
                tan
              </button>
            </div>

            {/* ROW 5: STO, ENG, (, ), S<=>D, M+ */}
            {/* Col 1, Row 5: STO */}
            <div className="col-start-1 row-start-5 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">RECALL</span>
                <span className="text-[clamp(7.5px,0.95vh,9.5px)] font-bold theme-label-alpha font-math-serif italic leading-none">x</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => setIsStoreMode((prev) => !prev),
                  () => {},
                  () => handleVariableOperation('X')
                )}
                aria-label="Store key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-xs font-semibold"
              >
                STO
              </button>
            </div>

            {/* Col 2, Row 5: ENG */}
            <div className="col-start-2 row-start-5 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">←</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">i</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleEngKey('forward'),
                  () => handleEngKey('backward'),
                  () => handleToken('i'),
                  'ENG'
                )}
                aria-label="Engineering format key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-xs font-semibold"
              >
                ENG
              </button>
            </div>

            {/* Col 3, Row 5: ( */}
            <div className="col-start-3 row-start-5 key-wrapper">
              <div className="key-secondary-labels">
                <span></span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleToken('('), () => handleToken('Abs('))}
                aria-label="Left bracket key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-sm"
              >
                <span className="font-math-serif not-italic text-[15px] leading-none">(</span>
              </button>
            </div>

            {/* Col 4, Row 5: ) */}
            <div className="col-start-4 row-start-5 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(9px,1.1vh,11px)] font-bold theme-label-shift font-math-serif not-italic leading-[0.75] -mt-[1px]">,</span>
                <span className="text-[clamp(7.5px,0.95vh,9.5px)] font-bold theme-label-alpha font-math-serif italic leading-none">x</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken(')'),
                  () => handleToken(','),
                  () => handleToken('x', 'num', 'VAR')
                )}
                aria-label="Right bracket key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-sm"
              >
                <span className="font-math-serif not-italic text-[15px] leading-none">)</span>
              </button>
            </div>

            {/* Col 5, Row 5: S<=>D */}
            <div className="col-start-5 row-start-5 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift inline-flex items-center gap-[0.1em] leading-none">
                  <span className="font-math-serif italic">a b<span className="not-italic">/</span>c</span>
                  <DoubleArrowSvg className="w-[1.05em] h-[0.7em]" />
                  <span className="font-math-serif italic">d<span className="not-italic">/</span>c</span>
                </span>
                <span className="text-[clamp(7.5px,0.95vh,9.5px)] font-bold theme-label-alpha font-math-serif italic leading-none">y</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleFormatCycle(),
                  () => handleFormatCycle(),
                  () => handleVariableOperation('Y')
                )}
                aria-label="S to D toggle key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-xs font-semibold"
              >
                <span className="inline-flex items-center justify-center gap-[0.12em] leading-none">
                  <span className="font-sans">S</span>
                  <DoubleArrowSvg className="w-[1.05em] h-[0.75em]" />
                  <span className="font-sans">D</span>
                </span>
              </button>
            </div>

            {/* Col 6, Row 5: M+ */}
            <div className="col-start-6 row-start-5 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">M-</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">M</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleMemoryAdd(false),
                  () => handleMemoryAdd(true),
                  () => handleVariableOperation('M')
                )}
                aria-label="Memory plus key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-sans text-xs font-semibold"
              >
                M+
              </button>
            </div>

          </div>

          {/* NUMERIC & ARITHMETIC KEYPAD: 5 columns × 4 rows */}
          <div className="grid grid-cols-5 gap-x-1.5 gap-y-0.5 relative w-full pt-0.5">

            {/* ROW 1: 7, 8, 9, DEL, AC */}
            {/* Key 7 */}
            <div className="col-start-1 row-start-1 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">CONST</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('7'),
                  () => setDisplayMenu('CONST_CAT')
                )}
                aria-label="7 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                7
              </button>
            </div>

            {/* Key 8 */}
            <div className="col-start-2 row-start-1 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">CONV</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('8'),
                  () => setDisplayMenu('CONV_CAT')
                )}
                aria-label="8 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                8
              </button>
            </div>

            {/* Key 9 */}
            <div className="col-start-3 row-start-1 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">RESET</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('9'),
                  () => setDisplayMenu('RESET')
                )}
                aria-label="9 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                9
              </button>
            </div>

            {/* DEL */}
            <div className="col-start-4 row-start-1 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">INS</span>
                {calcMode === 'STUDY' && <span className="text-[7.5px] font-bold text-sky-300">UNDO</span>}
              </div>
              <button
                onClick={() => handleSmartKey(() => handleDelete(), () => handleUndo())}
                aria-label="Delete key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-blue text-white font-bold text-xs flex items-center justify-center"
              >
                DEL
              </button>
            </div>

            {/* AC */}
            <div className="col-start-5 row-start-1 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">OFF</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleAllClear(),
                  () => setIsPoweredOff(true)
                )}
                aria-label="All clear key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-blue text-white font-bold text-xs flex items-center justify-center"
              >
                AC
              </button>
            </div>

            {/* ROW 2: 4, 5, 6, ×, ÷ */}
            {/* Key 4 */}
            <div className="col-start-1 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">MATRIX</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('4'),
                  () => {
                    handleSelectMode('MATRIX');
                    setModeState((prev) => ({ ...prev, screen: 'SUBMENU', data: { ...prev.data, subMenuPage: 0 } }));
                  }
                )}
                aria-label="4 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                4
              </button>
            </div>

            {/* Key 5 */}
            <div className="col-start-2 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">VECTOR</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('5'),
                  () => {
                    handleSelectMode('VECTOR');
                    setModeState((prev) => ({ ...prev, screen: 'SUBMENU', data: { ...prev.data, subMenuPage: 0 } }));
                  }
                )}
                aria-label="5 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                5
              </button>
            </div>

            {/* Key 6 */}
            <div className="col-start-3 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span></span>
                <span></span>
              </div>
              <button
                onClick={() => handleToken('6')}
                aria-label="6 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                6
              </button>
            </div>

            {/* × */}
            <div className="col-start-4 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">nPr</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('×', 'func'),
                  () => handleToken('P', 'func', 'OP_NPR')
                )}
                aria-label="Multiply key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-lg flex items-center justify-center"
              >
                <OperatorSvg op="×" className="w-[1.05em] h-[1.05em]" />
              </button>
            </div>

            {/* ÷ */}
            <div className="col-start-5 row-start-2 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">nCr</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleFractionKey(),
                  () => handleToken('C', 'func', 'OP_NCR')
                )}
                aria-label="Divide key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-lg flex items-center justify-center"
              >
                <OperatorSvg op="÷" className="w-[1.05em] h-[1.05em]" />
              </button>
            </div>

            {/* ROW 3: 1, 2, 3, +, - */}
            {/* Key 1 */}
            <div className="col-start-1 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">STAT</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('1'),
                  () => {
                    handleSelectMode('STAT');
                    setModeState((prev) => ({ ...prev, screen: 'SUBMENU', data: { ...prev.data, subMenuPage: 0 } }));
                  }
                )}
                aria-label="1 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                1
              </button>
            </div>

            {/* Key 2 */}
            <div className="col-start-2 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">CMPLX</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('2'),
                  () => {
                    handleSelectMode('CMPLX');
                    setModeState((prev) => ({ ...prev, screen: 'SUBMENU', data: { ...prev.data, subMenuPage: 0 } }));
                  }
                )}
                aria-label="2 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                2
              </button>
            </div>

            {/* Key 3 */}
            <div className="col-start-3 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">BASE-N</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('3'),
                  () => {
                    handleSelectMode('BASE');
                    setModeState((prev) => ({ ...prev, screen: 'SUBMENU', data: { ...prev.data, subMenuPage: 0 } }));
                  }
                )}
                aria-label="3 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                3
              </button>
            </div>

            {/* + */}
            <div className="col-start-4 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">Pol</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('+', 'func'),
                  () => handleToken('Pol(')
                )}
                aria-label="Plus key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-lg flex items-center justify-center"
              >
                <OperatorSvg op="+" className="w-[1.05em] h-[1.05em]" />
              </button>
            </div>

            {/* - */}
            <div className="col-start-5 row-start-3 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">Rec</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('-', 'func'),
                  () => handleToken('Rec(')
                )}
                aria-label="Minus key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-lg flex items-center justify-center"
              >
                <OperatorSvg op="−" className="w-[1.05em] h-[1.05em]" />
              </button>
            </div>

            {/* ROW 4: 0, ., ×10ˣ, Ans, = */}
            {/* Key 0 */}
            <div className="col-start-1 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">Rnd</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('0'),
                  () => handleToken('Rnd(')
                )}
                aria-label="0 key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-base flex items-center justify-center"
              >
                0
              </button>
            </div>

            {/* . */}
            <div className="col-start-2 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">Ran#</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-alpha">RanInt</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('.'),
                  () => handleToken(parseFloat(Math.random().toFixed(3)).toString()),
                  () => handleToken(Math.floor(Math.random() * 10).toString())
                )}
                aria-label="Decimal point key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-lg flex items-center justify-center"
              >
                .
              </button>
            </div>

            {/* ×10ˣ */}
            <div className="col-start-3 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9.5px)] font-bold theme-label-shift font-math-serif not-italic leading-none">π</span>
                <span className="text-[clamp(7.5px,0.95vh,9.5px)] font-bold theme-label-alpha font-math-serif italic leading-none">e</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('×10^('),
                  () => handleToken('π'),
                  () => handleToken('e')
                )}
                aria-label="Exponent times 10 to power key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-xs flex items-center justify-center"
              >
                <span className="inline-flex items-baseline leading-none text-[13px]">
                  <OperatorSvg op="×" className="w-[0.82em] h-[0.82em] self-center mr-[0.06em]" />
                  <span className="font-sans font-semibold">10</span>
                  <sup className="font-math-serif italic font-semibold text-[0.78em] ml-[0.04em]">x</sup>
                </span>
              </button>
            </div>

            {/* Ans */}
            <div className="col-start-4 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold theme-label-shift">PRE-ANS</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('Ans'),
                  () => handleToken('Ans')
                )}
                aria-label="Answer recall key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-white text-slate-900 font-bold text-xs flex items-center justify-center"
              >
                Ans
              </button>
            </div>

            {/* = */}
            <div className="col-start-5 row-start-4 key-wrapper">
              <div className="key-secondary-labels">
                <span></span>
                <span></span>
              </div>
              <button
                onClick={handleEqual}
                aria-label="Equals key"
                className="w-full h-[40px] min-h-[40px] min-w-[44px] rounded-lg key-hardware-equals font-bold text-xl flex items-center justify-center"
              >
                <OperatorSvg op="=" className="w-[0.95em] h-[0.95em]" />
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* NOTIFICATION-CENTER HISTORY SHEET */}
      <HistorySheet
        isOpen={isHistorySheetOpen}
        onClose={() => setIsHistorySheetOpen(false)}
        history={history}
        onLoadCard={handleLoadHistoryCard}
        onTogglePin={handleTogglePinHistory}
        onDeleteItem={handleDeleteHistoryItem}
        onClearHistory={handleClearHistory}
        originRect={historyOriginRect}
      />

      {/* CLASSWIZ QR CODE SHEET MODAL (SHIFT + OPTN) */}
      <ClassWizQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        expression={astToDisplayText(astState.root)}
        result={result}
      />

      {/* SETTINGS & OPERATING MODE SELECTION MODAL */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        calcMode={calcMode}
        theme={theme}
        onSetTheme={(t) => {
          setTheme(t);
          localStorage.setItem('casio_theme', t);
        }}
        editorMode={editorMode}
        onSetEditorMode={(m) => {
          setEditorMode(m);
          localStorage.setItem('casio_editor_mode', m);
          setJustCommitted(false);
          setLivePreviewResult('');
          setLastValidPreviewResult('');
        }}
        onSetCalcMode={(mode) => {
          setCalcMode(mode);
          localStorage.setItem('casio_mode', mode);
        }}
        onOpenCalibration={() => setIsCalibrationModalOpen(true)}
        onOpenTestHarness={() => setIsTestHarnessOpen(true)}
        onOpenMenu={() => {
          setDisplayMenu('MENU');
          setMenuHighlightIndex(0);
        }}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        hapticOn={hapticOn}
        onToggleHaptic={toggleHaptic}
        angleMode={angleMode}
        onSetAngleMode={(mode) => setAngleMode(mode)}
        displayFormat={displayFormat}
        onSetDisplayFormat={(fmt) => {
          setDisplayFormat(fmt);
          if (isCalculated) {
            setResult(formatResult(rawNumericVal, fmt, fixDigits, sciDigits, engStep));
          }
        }}
        originRect={settingsOriginRect}
        perfOverlayOn={perfOverlayOn}
        onTogglePerfOverlay={() => setPerfOverlayOn((prev) => !prev)}
        onResetCalculator={() => {
          localStorage.clear();
          handleAllClear();
          setVariables({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0 });
          setMemoryM(0);
          setLastAns(0);
          handleSelectMode('CALC');
          setCalcMode('EXAM');
          setCalibrationScale(1.0);
          setTheme('default');
          localStorage.setItem('casio_theme', 'default');
          setIsSettingsModalOpen(false);
        }}
      />

      {/* ISO CARD CALIBRATION MODAL (1:1 MM SCALE) */}
      <CalibrationModal
        isOpen={isCalibrationModalOpen}
        onClose={() => setIsCalibrationModalOpen(false)}
        scale={calibrationScale}
        onScaleChange={(scale) => {
          setCalibrationScale(scale);
          localStorage.setItem('casio_calibration_scale', scale.toString());
        }}
        onReset={() => {
          setCalibrationScale(1.0);
          setTheme('default');
          localStorage.setItem('casio_theme', 'default');
          localStorage.setItem('casio_calibration_scale', '1.0');
        }}
      />

      {/* TEST SUITE HARNESS MODAL (?test=1) */}
      <TestHarnessModal
        isOpen={isTestHarnessOpen}
        onClose={() => setIsTestHarnessOpen(false)}
      />
    </div>
  );
}
