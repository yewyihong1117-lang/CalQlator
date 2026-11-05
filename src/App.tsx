/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, VolumeX, Maximize2, Minimize2, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Sliders, Vibrate, VibrateOff, Lock, Clock, Power
} from 'lucide-react';
import { 
  AngleMode, DisplayFormat, HistoryItem,
  evaluateMathExpression, formatResult, toFraction,
  recognizeExactSurd, toEngineering, decimalToDms, primeFactorization,
  solveEquation
} from './calcEngine';
import { 
  playKeyClick, setSoundEnabled,
  triggerHaptic, setHapticEnabled,
  HapticKeyType 
} from './audioFeedback';
import { 
  MathAstState, createInitialAstState,
  insertToken, insertFraction, insertIntegral, insertSqrt,
  insertPower, insertLogBase, navigateAst, deleteAst,
  astToExpression, astToDisplayText, parseStringToAst
} from './mathAst';
import { NaturalDisplay } from './components/NaturalDisplay';
import { AdvancedModesDrawer, ModeTab } from './components/AdvancedModesDrawer';
import { HistoryModal } from './components/HistoryModal';
import { ClassWizQrModal } from './components/ClassWizQrModal';

export type AspectRatioMode = 'OPPO' | '9:19.5' | 'FIT';

export default function App() {
  // Calculator Power State (Hardware Standby Simulation)
  const [isPoweredOff, setIsPoweredOff] = useState(false);

  // 2D Math AST Template Engine State
  const [astState, setAstState] = useState<MathAstState>(() => createInitialAstState());

  // Calculator Output State
  const [result, setResult] = useState('0');
  const [rawNumericVal, setRawNumericVal] = useState<number>(0);
  const [isCalculated, setIsCalculated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hardware Indicators & Status Modes
  const [shiftActive, setShiftActive] = useState(false);
  const [alphaActive, setAlphaActive] = useState(false);
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG');
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('NORM1');
  const [fixDigits, setFixDigits] = useState(2);
  const [sciDigits, setSciDigits] = useState(5);
  const [memoryM, setMemoryM] = useState<number>(0);
  const [lastAns, setLastAns] = useState<number>(0);
  const [isStoreMode, setIsStoreMode] = useState(false);
  const [sdCycleState, setSdCycleState] = useState(0);

  // Variables A, B, C, D, E, F, X, Y, M
  const [variables, setVariables] = useState<Record<string, number>>({
    A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0,
  });

  // History state with localStorage persistence
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('casio_fx570_history');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [
      {
        id: 'init-1',
        expression: '∫_{0}^{3} (x²) dx',
        result: '9',
        exactResult: '9',
        numericVal: 9,
        timestamp: Date.now() - 3600000,
      },
      {
        id: 'init-2',
        expression: 'd/dx(x³, 2)',
        result: '12',
        exactResult: '12',
        numericVal: 12,
        timestamp: Date.now() - 1800000,
      }
    ];
  });
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  useEffect(() => {
    try {
      localStorage.setItem('casio_fx570_history', JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  // Modals & Panels
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<ModeTab>('STAT');
  const [activeMenu, setActiveMenu] = useState<'NONE' | 'MODE' | 'SETUP'>('NONE');

  // UI & Device Settings (OPPO Find X9 Pro 19.8:9 / 20:9 aspect ratio target)
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>('OPPO');
  const [soundOn, setSoundOn] = useState(true);
  const [hapticOn, setHapticOn] = useState(true);
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);

  // Swipe Gesture detection
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;

    if (diffX > 60 && Math.abs(diffY) < 50) {
      playKeyClick('action');
      setIsDrawerOpen(true);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const cycleAspectMode = () => {
    playKeyClick('action');
    setAspectMode((prev) => (prev === 'OPPO' ? '9:19.5' : prev === '9:19.5' ? 'FIT' : 'OPPO'));
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    playKeyClick('action');
  };

  const toggleHaptic = () => {
    const next = !hapticOn;
    setHapticOn(next);
    setHapticEnabled(next);
    if (next) triggerHaptic('action');
  };

  // Keyboard shortcut listener mapping physical keyboard to Casio ClassWiz
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Shift') {
        e.preventDefault();
        handleShift();
        return;
      }
      if (e.key === 'Alt') {
        e.preventDefault();
        handleAlpha();
        return;
      }

      if (isPoweredOff) {
        if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') {
          handleOn();
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleToken(e.key);
      } else if (e.key === '.') {
        handleToken('.');
      } else if (e.key === '+') {
        handleToken('+');
      } else if (e.key === '-') {
        handleToken('-');
      } else if (e.key === '*') {
        handleToken('×');
      } else if (e.key === '/') {
        handleFractionKey();
      } else if (e.key === '(') {
        handleToken('(');
      } else if (e.key === ')') {
        handleToken(')');
      } else if (e.key === '^') {
        handlePowerKey();
      } else if (e.key === 'x' || e.key === 'X') {
        handleToken('x');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEqual();
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleAllClear();
      } else if (e.key === 'ArrowLeft') {
        handleDpad('left');
      } else if (e.key === 'ArrowRight') {
        handleDpad('right');
      } else if (e.key === 'ArrowUp') {
        handleDpad('up');
      } else if (e.key === 'ArrowDown') {
        handleDpad('down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [astState, isCalculated, isPoweredOff, shiftActive, alphaActive, lastAns, historyIndex, history]);

  // Insert general token
  const handleToken = (tokenVal: string, keyType: HapticKeyType = 'num') => {
    if (isPoweredOff) return;
    playKeyClick(keyType);
    if (errorMessage) setErrorMessage(null);

    let currentState = astState;
    if (isCalculated) {
      if (['+', '-', '×', '÷', '^', '²', '³'].includes(tokenVal)) {
        currentState = parseStringToAst('Ans');
      } else {
        currentState = createInitialAstState();
      }
      setIsCalculated(false);
      setSdCycleState(0);
    }

    setAstState(insertToken(currentState, tokenVal));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Fraction Key (■/□)
  const handleFractionKey = () => {
    if (isPoweredOff) return;
    playKeyClick('func');
    if (errorMessage) setErrorMessage(null);

    let currentState = astState;
    if (isCalculated) {
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertFraction(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Integral Key (∫dx)
  const handleIntegralKey = () => {
    if (isPoweredOff) return;
    playKeyClick('func');
    if (errorMessage) setErrorMessage(null);

    let currentState = astState;
    if (isCalculated) {
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertIntegral(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Square Root Key (√■)
  const handleSqrtKey = () => {
    if (isPoweredOff) return;
    playKeyClick('func');
    if (errorMessage) setErrorMessage(null);

    let currentState = astState;
    if (isCalculated) {
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertSqrt(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Power Key (xⁿ)
  const handlePowerKey = () => {
    if (isPoweredOff) return;
    playKeyClick('func');
    if (errorMessage) setErrorMessage(null);

    let currentState = astState;
    if (isCalculated) {
      currentState = parseStringToAst('Ans');
      setIsCalculated(false);
    }

    setAstState(insertPower(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Natural Display: Logarithm with Custom Base Key (log□■)
  const handleLogBaseKey = () => {
    if (isPoweredOff) return;
    playKeyClick('func');
    if (errorMessage) setErrorMessage(null);

    let currentState = astState;
    if (isCalculated) {
      currentState = createInitialAstState();
      setIsCalculated(false);
    }

    setAstState(insertLogBase(currentState));
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // D-Pad Navigation Engine
  const handleDpad = (dir: 'left' | 'right' | 'up' | 'down') => {
    if (isPoweredOff) return;
    playKeyClick('dpad');

    if (astState.cursor.slotId === 'root' && (dir === 'up' || dir === 'down')) {
      if (history.length > 0) {
        if (dir === 'up') {
          const nextIdx = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
          setHistoryIndex(nextIdx);
          const item = history[history.length - 1 - nextIdx];
          if (item) {
            setAstState(parseStringToAst(item.expression));
            setResult(item.result);
            setRawNumericVal(item.numericVal);
            setIsCalculated(true);
          }
          return;
        } else {
          if (historyIndex > 0) {
            const nextIdx = historyIndex - 1;
            setHistoryIndex(nextIdx);
            const item = history[history.length - 1 - nextIdx];
            if (item) {
              setAstState(parseStringToAst(item.expression));
              setResult(item.result);
              setRawNumericVal(item.numericVal);
              setIsCalculated(true);
            }
            return;
          } else if (historyIndex === 0) {
            setHistoryIndex(-1);
            setAstState(createInitialAstState());
            setResult('0');
            setIsCalculated(false);
            return;
          }
        }
      }
    }

    setAstState((prev) => navigateAst(prev, dir));
  };

  // DEL Key: with 2-step template unit deletion
  const handleDelete = () => {
    if (isPoweredOff) return;
    playKeyClick('action');
    if (errorMessage) {
      setErrorMessage(null);
      return;
    }
    setAstState((prev) => deleteAst(prev));
    setIsCalculated(false);
  };

  // All Clear (AC)
  const handleAllClear = () => {
    if (isPoweredOff) return;
    playKeyClick('action');
    setAstState(createInitialAstState());
    setResult('0');
    setErrorMessage(null);
    setIsCalculated(false);
    setShiftActive(false);
    setAlphaActive(false);
    setIsStoreMode(false);
    setHistoryIndex(-1);
    setActiveMenu('NONE');
  };

  // ON Key (Wakes from standby or clears display)
  const handleOn = () => {
    playKeyClick('action');
    if (isPoweredOff) {
      setIsPoweredOff(false);
    }
    setAstState(createInitialAstState());
    setResult('0');
    setErrorMessage(null);
    setIsCalculated(false);
    setShiftActive(false);
    setAlphaActive(false);
    setIsStoreMode(false);
    setHistoryIndex(-1);
    setActiveMenu('NONE');
  };

  // Power OFF (Shift + AC)
  const handlePowerOff = () => {
    playKeyClick('action');
    setIsPoweredOff(true);
    setShiftActive(false);
    setAlphaActive(false);
    setActiveMenu('NONE');
  };

  // Toggle Shift Mode
  const handleShift = () => {
    if (isPoweredOff) return;
    playKeyClick('shift');
    setShiftActive(!shiftActive);
    if (alphaActive) setAlphaActive(false);
  };

  // Toggle Alpha Mode
  const handleAlpha = () => {
    if (isPoweredOff) return;
    playKeyClick('alpha');
    setAlphaActive(!alphaActive);
    if (shiftActive) setShiftActive(false);
  };

  // Evaluate Expression (=)
  const handleEqual = () => {
    if (isPoweredOff) return;
    playKeyClick('equal');
    const exprStr = astToExpression(astState.root);
    if (!exprStr.trim()) return;

    const evalRes = evaluateMathExpression(exprStr, angleMode, variables, lastAns);
    if (!evalRes.success || evalRes.result === undefined) {
      setErrorMessage(evalRes.error || 'Syntax ERROR');
      playKeyClick('error');
      return;
    }

    const num = evalRes.result;
    setRawNumericVal(num);
    setLastAns(num);
    setIsCalculated(true);
    setSdCycleState(0);

    const formatted = formatResult(num, displayFormat, fixDigits, sciDigits);
    setResult(formatted);

    // Compute standard fraction / exact surd representation
    let exactForm: string | undefined = undefined;
    const surd = recognizeExactSurd(num);
    if (surd) {
      exactForm = surd;
    } else {
      const frac = toFraction(num);
      if (frac && frac.den > 1 && frac.den <= 1000) {
        exactForm = `${frac.num}/${frac.den}`;
      }
    }

    // Add to history tape
    const historyItem: HistoryItem = {
      id: Date.now().toString(),
      expression: astToDisplayText(astState.root) || exprStr,
      result: formatted,
      exactResult: exactForm,
      numericVal: num,
      timestamp: Date.now(),
    };
    setHistory((prev) => [historyItem, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);

    if (exactForm) {
      setResult(exactForm);
      setSdCycleState(1);
    }
  };

  // SOLVE Equation (f(x) = 0) (Shift + CALC)
  const handleSolve = () => {
    if (isPoweredOff) return;
    playKeyClick('action');
    const exprStr = astToExpression(astState.root);
    if (!exprStr.trim()) return;

    let solveExpr = exprStr;
    if (solveExpr.includes('=')) {
      const [lhs, rhs] = solveExpr.split('=');
      solveExpr = `(${lhs}) - (${rhs || '0'})`;
    }

    const solveRes = solveEquation(solveExpr, angleMode, 1);
    if (solveRes.success && solveRes.root !== undefined) {
      const rootStr = `${solveRes.root}`;
      setResult(`x = ${rootStr}`);
      setRawNumericVal(solveRes.root);
      setLastAns(solveRes.root);
      setIsCalculated(true);

      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        expression: `SOLVE: ${astToDisplayText(astState.root)}`,
        result: `x = ${rootStr}`,
        numericVal: solveRes.root,
        timestamp: Date.now(),
      };
      setHistory((prev) => [historyItem, ...prev.slice(0, 49)]);
    } else {
      setErrorMessage("Can't Solve");
      playKeyClick('error');
    }
  };

  // S<=>D Toggle
  const handleSdToggle = () => {
    if (isPoweredOff) return;
    playKeyClick('sd');
    if (!isCalculated && rawNumericVal === 0) return;

    const num = rawNumericVal;
    const nextState = (sdCycleState + 1) % 4;
    setSdCycleState(nextState);

    if (nextState === 0) {
      setResult(formatResult(num, displayFormat, fixDigits, sciDigits));
    } else if (nextState === 1) {
      const surd = recognizeExactSurd(num);
      if (surd) {
        setResult(surd);
      } else {
        const frac = toFraction(num);
        setResult(frac && frac.den > 1 ? `${frac.num}/${frac.den}` : formatResult(num, displayFormat));
      }
    } else if (nextState === 2) {
      const frac = toFraction(num);
      if (frac && frac.den > 1 && Math.abs(frac.num) > frac.den) {
        const whole = Math.floor(Math.abs(frac.num) / frac.den) * (frac.num < 0 ? -1 : 1);
        const rem = Math.abs(frac.num) % frac.den;
        setResult(`${whole} ${rem}/${frac.den}`);
      } else {
        setResult(toEngineering(num));
      }
    } else {
      setResult(toEngineering(num));
    }
  };

  const handleMemoryAdd = () => {
    if (isPoweredOff) return;
    playKeyClick('action');
    if (isCalculated) {
      setMemoryM((prev) => prev + rawNumericVal);
    } else {
      handleToken('M');
    }
  };

  const handleMemorySub = () => {
    if (isPoweredOff) return;
    playKeyClick('action');
    if (isCalculated) {
      setMemoryM((prev) => prev - rawNumericVal);
    } else {
      handleToken('M');
    }
  };

  const handleEng = () => {
    if (isPoweredOff) return;
    playKeyClick('func');
    if (isCalculated) {
      setResult(toEngineering(rawNumericVal));
    }
  };

  // Smart key processor: executes Shift or Alpha action if active, then resets layer
  const handleSmartKey = (
    normalAction: () => void,
    shiftAction?: () => void,
    alphaAction?: () => void,
    keyType: HapticKeyType = 'func'
  ) => {
    if (isPoweredOff) return;
    playKeyClick(keyType);
    if (isStoreMode) return;

    if (shiftActive && shiftAction) {
      shiftAction();
      setShiftActive(false);
      return;
    }
    if (alphaActive && alphaAction) {
      alphaAction();
      setAlphaActive(false);
      return;
    }
    normalAction();
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#08080A] flex flex-col items-center justify-between text-slate-100 selection:bg-amber-400/20 overflow-hidden pt-[env(safe-area-inset-top,0)]">
      
      {/* Top Utility Controls Bar: Deducted cleanly so it never collides with anything */}
      <header className="w-full max-w-[430px] h-8 px-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0 select-none z-10 border-b border-slate-900/40">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold tracking-tight text-slate-100 text-xs">CASIO</span>
          <span className="text-[10px] text-[#E6007E] font-mono font-bold">CLASSWIZ</span>

          {/* Aspect Ratio Mode Lock Indicator */}
          <button
            onClick={cycleAspectMode}
            title={`OPPO Find X9 Pro Ratio Lock: ${aspectMode}. Tap to toggle.`}
            className="px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-[10px] font-mono text-[#E5A93C] border border-slate-700/60 flex items-center gap-1 transition-colors active:scale-95 ml-1"
          >
            <Lock className="w-2.5 h-2.5 text-[#E5A93C]" />
            <span>{aspectMode === 'OPPO' ? 'OPPO 19.8:9' : aspectMode}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* History Log Direct Button */}
          <button
            onClick={() => {
              playKeyClick('action');
              setIsHistoryModalOpen(true);
            }}
            title="Open Calculation History Log"
            className="px-2 py-0.5 rounded bg-[#1A1A24] hover:bg-slate-700 text-[10px] font-mono text-amber-300 border border-amber-400/30 flex items-center gap-1 transition-colors active:scale-95"
          >
            <Clock className="w-3 h-3 text-[#E5A93C]" />
            <span>Tape ({history.length})</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={soundOn ? 'Key Audio Clicks: ON' : 'Key Audio Clicks: MUTED'}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#E5A93C]" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {/* Haptic Vibration Toggle */}
          <button
            onClick={toggleHaptic}
            title={hapticOn ? 'Haptic Vibration: ON' : 'Haptic Vibration: OFF'}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {hapticOn ? <Vibrate className="w-3.5 h-3.5 text-[#E5A93C]" /> : <VibrateOff className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {/* Advanced Drawer Button */}
          <button
            onClick={() => {
              playKeyClick('action');
              setIsDrawerOpen(true);
            }}
            title="Open Advanced Modes Drawer (Statistics, Matrix, Vector)"
            className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] font-mono text-slate-300 flex items-center gap-1 transition-colors"
          >
            <Sliders className="w-3 h-3 text-cyan-400" />
            <span>FX</span>
          </button>

          {/* Device Frame Viewport Toggle */}
          <button
            onClick={() => {
              playKeyClick('action');
              setIsPhoneFrame(!isPhoneFrame);
            }}
            title={isPhoneFrame ? 'Full Height View' : 'Device Bezel View'}
            className="hidden sm:flex p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isPhoneFrame ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Flagship Smartphone / Calculator Chassis constrained to OPPO Find X9 Pro Aspect Ratio */}
      <main 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          aspectRatio: aspectMode === 'OPPO' ? '9 / 19.8' : aspectMode === '9:19.5' ? '9 / 19.5' : undefined,
          maxHeight: 'calc(100dvh - 36px)',
        }}
        className={`h-full w-auto max-w-full flex flex-col justify-between bg-[#0E0E12] border border-slate-800/90 shadow-2xl overflow-hidden select-none transition-all duration-150 relative ${
          isPhoneFrame 
            ? 'rounded-[26px] sm:rounded-[34px] border-[5px] sm:border-[7px] border-[#1C1C24] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)]' 
            : 'rounded-none border-0'
        }`}
      >
        {/* Subtle white tray bezel outer edge simulation */}
        <div className="absolute inset-y-12 -left-[3px] w-[3px] bg-slate-300/40 rounded-l-full pointer-events-none"></div>
        <div className="absolute inset-y-12 -right-[3px] w-[3px] bg-slate-300/40 rounded-r-full pointer-events-none"></div>

        {/* 1. Casio Brand & Authentic CLASSWIZ Header */}
        <div className="shrink-0 pt-2 pb-1 px-4 flex items-center justify-between bg-[#121217] border-b border-slate-900/60">
          <span className="font-extrabold text-sm tracking-widest text-slate-100 font-mono">
            CASIO
          </span>

          <span className="font-black text-xs sm:text-sm tracking-wider font-mono text-[#E6007E] drop-shadow-sm">
            CLASSWIZ
          </span>

          <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
            fx-570EX
          </span>
        </div>

        {/* 2. DUAL-LINE DOT-MATRIX OLED DISPLAY SCREEN (2D Math AST Natural Display) */}
        <div className={`shrink-0 mx-2.5 sm:mx-3 my-0.5 sm:my-1 p-2 sm:p-2.5 rounded-xl border border-slate-800/90 shadow-inner relative flex flex-col justify-between h-[clamp(88px,16.5vh,128px)] min-h-[82px] transition-colors duration-300 ${
          isPoweredOff ? 'bg-[#06080A]' : 'lcd-screen-bg'
        }`}>
          {isPoweredOff ? (
            /* Power-Off Standby Display */
            <div className="h-full flex flex-col items-center justify-center text-slate-800 font-mono select-none">
              <Power className="w-5 h-5 mb-1 opacity-20" />
              <span className="text-[10px] tracking-widest opacity-25">CASIO CLASSWIZ [STANDBY]</span>
              <span className="text-[9px] text-slate-700 opacity-20 mt-0.5">Press ON to power up</span>
            </div>
          ) : (
            <>
              {/* Top Status Indicators Row (S, A, STO, M, D/R/G, FIX/SCI, Math▲▼, History) */}
              <div className="flex items-center justify-between text-[10px] font-mono tracking-wider border-b border-emerald-950/40 pb-0.5 text-slate-400 select-none">
                <div className="flex items-center gap-1.5">
                  {/* [S] Indicator */}
                  <span className={`px-1 rounded text-[9px] font-bold transition-all ${shiftActive ? 'bg-[#E5A93C] text-slate-950 shadow-[0_0_8px_#E5A93C]' : 'opacity-20'}`}>
                    S
                  </span>
                  {/* [A] Indicator */}
                  <span className={`px-1 rounded text-[9px] font-bold transition-all ${alphaActive ? 'bg-[#E6007E] text-white shadow-[0_0_8px_#E6007E]' : 'opacity-20'}`}>
                    A
                  </span>
                  {/* [STO] Indicator */}
                  <span className={`px-1 rounded text-[9px] font-bold transition-opacity ${isStoreMode ? 'bg-cyan-400 text-slate-950' : 'opacity-0'}`}>
                    STO
                  </span>
                  {/* [M] Indicator */}
                  <span className={`px-1 rounded text-[9px] font-bold transition-opacity ${memoryM !== 0 ? 'bg-emerald-400 text-slate-950' : 'opacity-20'}`}>
                    M
                  </span>

                  {/* History Tape Quick Indicator */}
                  <button
                    onClick={() => {
                      playKeyClick('action');
                      setIsHistoryModalOpen(true);
                    }}
                    title="View History Tape"
                    className="px-1 rounded text-[9px] font-mono text-[#E5A93C] hover:bg-slate-800 transition-colors flex items-center gap-0.5"
                  >
                    <span>HIST</span>
                    <span className="text-[8px] bg-slate-800 px-1 rounded text-[#E5A93C]">{history.length}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Angle Mode Badge: Tap to cycle DEG / RAD / GRA */}
                  <button
                    onClick={() => {
                      playKeyClick('action');
                      const next: AngleMode = angleMode === 'DEG' ? 'RAD' : angleMode === 'RAD' ? 'GRA' : 'DEG';
                      setAngleMode(next);
                    }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900/90 text-emerald-400 border border-emerald-900/50 hover:bg-slate-800 transition-colors"
                  >
                    {angleMode === 'DEG' ? 'D' : angleMode === 'RAD' ? 'R' : 'G'}
                  </button>

                  <span className="text-[9px] font-medium text-slate-400">
                    {displayFormat}
                  </span>

                  <span className="text-[9px] font-bold text-emerald-500">
                    Math ▲▼
                  </span>
                </div>
              </div>

              {/* Upper Line: 2D Math Box AST Natural Display */}
              <NaturalDisplay
                nodes={astState.root}
                cursor={astState.cursor}
                pendingDeleteTemplateId={astState.pendingDeleteTemplateId}
                onSetCursor={(slotId, offset) => {
                  setAstState((prev) => ({
                    ...prev,
                    cursor: { slotId, offset },
                    pendingDeleteTemplateId: null,
                  }));
                }}
              />

              {/* Lower Line: Live/Final Output with dot matrix font */}
              <div className="flex items-end justify-between pt-0.5 border-t border-emerald-950/40">
                {errorMessage ? (
                  <span className="text-xs font-mono text-red-400 font-semibold tracking-wide animate-pulse">
                    [{errorMessage}]
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-slate-500">
                    {isCalculated && (
                      <span>
                        Ans = {lastAns}
                      </span>
                    )}
                  </span>
                )}

                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-mono font-bold text-slate-100 tracking-tight lcd-dot-text">
                    {result}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* MODE / SETUP Menus */}
        {activeMenu === 'MODE' && (
          <div className="shrink-0 mx-2.5 mb-1 p-2 bg-[#171720] border border-amber-500/40 rounded-xl text-xs font-mono grid grid-cols-3 gap-1 animate-in fade-in">
            <button onClick={() => { playKeyClick('action'); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left">
              1: COMP
            </button>
            <button onClick={() => { setActiveDrawerTab('STAT'); setIsDrawerOpen(true); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left text-amber-300">
              2: STAT
            </button>
            <button onClick={() => { setActiveDrawerTab('MATRIX'); setIsDrawerOpen(true); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left text-pink-300">
              3: MATRIX
            </button>
            <button onClick={() => { setActiveDrawerTab('VECTOR'); setIsDrawerOpen(true); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left text-cyan-300">
              4: VECTOR
            </button>
            <button onClick={() => { setActiveDrawerTab('EQUATION'); setIsDrawerOpen(true); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left text-emerald-300">
              5: EQN
            </button>
            <button onClick={() => { setActiveDrawerTab('BASE'); setIsDrawerOpen(true); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left text-purple-300">
              6: BASE-N
            </button>
          </div>
        )}

        {activeMenu === 'SETUP' && (
          <div className="shrink-0 mx-2.5 mb-1 p-2 bg-[#171720] border border-amber-500/40 rounded-xl text-xs font-mono grid grid-cols-3 gap-1 animate-in fade-in">
            <button onClick={() => { setAngleMode('DEG'); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left">
              1: Deg (°)
            </button>
            <button onClick={() => { setAngleMode('RAD'); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left">
              2: Rad (r)
            </button>
            <button onClick={() => { setAngleMode('GRA'); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left">
              3: Gra (g)
            </button>
            <button onClick={() => { setDisplayFormat('FIX'); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left">
              4: Fix (0-9)
            </button>
            <button onClick={() => { setDisplayFormat('SCI'); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left">
              5: Sci (Exp)
            </button>
            <button onClick={() => { setDisplayFormat('NORM1'); setActiveMenu('NONE'); }} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-left">
              6: Norm
            </button>
          </div>
        )}

        {/* Swipe Affordance Bar */}
        <div 
          onClick={() => {
            playKeyClick('action');
            setIsDrawerOpen(true);
          }}
          className="shrink-0 mx-2.5 sm:mx-3 mb-0.5 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-400 cursor-pointer hover:bg-slate-800/80 transition-colors"
        >
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5A93C]"></span>
            <span>Modes: Stat · Matrix · Vector · Eqn</span>
          </span>
          <span className="text-[#E5A93C] font-bold flex items-center gap-0.5">
            Swipe ◄ or Tap
          </span>
        </div>

        {/* 3. KEYPAD SECTION (Authentic Physical fx-570EX Key Matrix & Dual Secondary Label System) */}
        <div className="flex-1 min-h-0 px-2 sm:px-3 pb-1 pt-0.5 flex flex-col justify-between gap-1 bg-[#121217]">
          
          {/* Row 1: Top Navigation Row (SHIFT, ALPHA, REPLAY D-PAD, MENU/SETUP, ON) */}
          <div className="shrink-0 grid grid-cols-5 items-center gap-1 h-[clamp(44px,7vh,56px)]">
            {/* SHIFT Key */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,1vh,9px)] font-bold text-[#E5A93C] font-mono tracking-tighter leading-none mb-0.5">SHIFT</span>
              <button
                onClick={handleShift}
                className={`w-full h-[clamp(26px,4vh,32px)] rounded-full font-mono text-[10px] sm:text-xs font-bold transition-all key-hardware-round flex items-center justify-center ${
                  shiftActive 
                    ? 'bg-[#E5A93C] text-slate-950 ring-2 ring-[#E5A93C]' 
                    : 'text-[#E5A93C]'
                }`}
              >
                SHIFT
              </button>
            </div>

            {/* ALPHA Key */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,1vh,9px)] font-bold text-[#E6007E] font-mono tracking-tighter leading-none mb-0.5">ALPHA</span>
              <button
                onClick={handleAlpha}
                className={`w-full h-[clamp(26px,4vh,32px)] rounded-full font-mono text-[10px] sm:text-xs font-bold transition-all key-hardware-round flex items-center justify-center ${
                  alphaActive 
                    ? 'bg-[#E6007E] text-white ring-2 ring-[#E6007E]' 
                    : 'text-[#E6007E]'
                }`}
              >
                ALPHA
              </button>
            </div>

            {/* Center: REPLAY D-PAD (Directional cluster with chrome finish) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <div className="relative w-[clamp(58px,8.8vh,70px)] h-[clamp(40px,6.2vh,50px)] bg-gradient-to-b from-[#2C2C38] via-[#20202A] to-[#14141A] rounded-full border border-slate-600/80 shadow-[0_2px_4px_rgba(0,0,0,0.6)] flex items-center justify-center p-0.5">
                {/* UP */}
                <button
                  onClick={() => handleDpad('up')}
                  title="D-Pad UP: Numerator / Upper Limit"
                  className="absolute top-0 p-1 text-slate-300 hover:text-[#E5A93C] active:scale-90 transition-transform"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                {/* DOWN */}
                <button
                  onClick={() => handleDpad('down')}
                  title="D-Pad DOWN: Denominator / Lower Limit"
                  className="absolute bottom-0 p-1 text-slate-300 hover:text-[#E5A93C] active:scale-90 transition-transform"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {/* LEFT */}
                <button
                  onClick={() => handleDpad('left')}
                  title="D-Pad LEFT"
                  className="absolute left-0.5 p-1 text-slate-300 hover:text-[#E5A93C] active:scale-90 transition-transform"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {/* RIGHT */}
                <button
                  onClick={() => handleDpad('right')}
                  title="D-Pad RIGHT: Step or break out of template"
                  className="absolute right-0.5 p-1 text-slate-300 hover:text-[#E5A93C] active:scale-90 transition-transform"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {/* Center REPLAY Label */}
                <div className="w-5 h-3.5 rounded bg-slate-900 border border-slate-600 flex items-center justify-center pointer-events-none">
                  <span className="text-[6.5px] font-mono text-slate-300 font-bold tracking-tighter">
                    REP
                  </span>
                </div>
              </div>
            </div>

            {/* MENU / SETUP Key */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,1vh,9px)] font-mono text-[#E5A93C] font-semibold tracking-tighter leading-none mb-0.5">SETUP</span>
              <button
                onClick={() => {
                  playKeyClick('action');
                  if (shiftActive) {
                    setActiveMenu(activeMenu === 'SETUP' ? 'NONE' : 'SETUP');
                    setShiftActive(false);
                  } else {
                    setActiveMenu(activeMenu === 'MODE' ? 'NONE' : 'MODE');
                  }
                }}
                className="w-full h-[clamp(26px,4vh,32px)] rounded-full font-mono text-[10px] sm:text-xs font-semibold key-hardware-round text-slate-200 flex items-center justify-center"
              >
                MENU
              </button>
            </div>

            {/* ON Key */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,1vh,9px)] font-mono text-slate-500 tracking-tighter leading-none mb-0.5">CLR</span>
              <button
                onClick={handleOn}
                className="w-full h-[clamp(26px,4vh,32px)] rounded-full font-mono text-[10px] sm:text-xs font-bold key-hardware-round text-slate-100 border border-slate-600/50 flex items-center justify-center"
              >
                ON
              </button>
            </div>
          </div>

          {/* Row 2: OPTN, CALC, (D-Pad Center), ∫□ dx, x */}
          <div className="shrink-0 grid grid-cols-6 items-center gap-1 h-[clamp(36px,5.2vh,46px)] text-[11px] font-mono">
            {/* OPTN: Shift -> QR (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">QR</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => { setActiveDrawerTab('STAT'); setIsDrawerOpen(true); },
                  () => setIsQrModalOpen(true)
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] font-bold"
              >
                OPTN
              </button>
            </div>

            {/* CALC: Shift -> SOLVE (Yellow), Alpha -> = (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">SOLVE</span>
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E6007E]">=</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleEqual(),
                  () => handleSolve(),
                  () => handleToken('=')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-semibold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                CALC
              </button>
            </div>

            {/* Center Spacers */}
            <div className="col-span-2 hidden sm:block"></div>

            {/* INTEGRAL: Shift -> d/dx (Yellow), Alpha -> : (Pink) */}
            <div className="key-wrapper sm:col-start-5">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">d/dx</span>
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E6007E]">:</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleIntegralKey(),
                  () => handleToken('d/dx('),
                  () => handleToken(':')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-[#E5A93C] flex items-center justify-center text-[clamp(10px,1.4vh,12px)] font-bold"
              >
                ∫□ dx
              </button>
            </div>

            {/* VARIABLE X: Shift -> Σ (Yellow) */}
            <div className="key-wrapper sm:col-start-6">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">Σ</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('x'),
                  () => handleToken('Σ(')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-100 flex items-center justify-center text-[clamp(10px,1.4vh,12px)] font-serif italic font-bold"
              >
                x
              </button>
            </div>
          </div>

          {/* 4. FUNCTION KEY BLOCK (Rows 3 to 5) with Dual Secondary Labels */}
          <div className="flex-[1] min-h-0 grid grid-cols-6 grid-rows-3 gap-1 text-[11px] font-mono">
            {/* ROW 3: [■/□], [√], [x²], [xⁿ], [log□■], [ln] */}
            
            {/* ■/□ Fraction: Shift -> a b/c (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">a b/c</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleFractionKey(), () => handleSdToggle())}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-bold"
              >
                <div className="flex flex-col items-center leading-none text-[9px]">
                  <span>■</span>
                  <span className="w-2.5 h-[1px] bg-slate-300 my-0.5"></span>
                  <span>□</span>
                </div>
              </button>
            </div>

            {/* √□ Square Root: Shift -> ³√ (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">³√</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleSqrtKey(), () => handleToken('³√('))}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                √□
              </button>
            </div>

            {/* x²: Shift -> x³ (Yellow), Base -> DEC (Cyan) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">x³</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#00E5FF]">DEC</span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleToken('²'), () => handleToken('³'))}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                x²
              </button>
            </div>

            {/* xⁿ: Shift -> ⁿ√x (Yellow), Base -> HEX (Cyan) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">ⁿ√x</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#00E5FF]">HEX</span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handlePowerKey(), () => handleToken('^('))}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                x□
              </button>
            </div>

            {/* log□■: Shift -> 10ˣ (Yellow), Base -> BIN (Cyan) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">10ˣ</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#00E5FF]">BIN</span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleLogBaseKey(), () => handleToken('10^('))}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                log□■
              </button>
            </div>

            {/* ln: Shift -> eˣ (Yellow), Base -> OCT (Cyan) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">eˣ</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#00E5FF]">OCT</span>
              </div>
              <button
                onClick={() => handleSmartKey(() => handleToken('ln('), () => handleToken('e^('))}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                ln
              </button>
            </div>

            {/* ROW 4: [(-)], [° ' "], [x⁻¹], [sin], [cos], [tan] */}

            {/* (-): Shift -> log (Yellow), Alpha -> A (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">log</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">A</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('(-'),
                  () => handleToken('log('),
                  () => handleToken('A')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                (-)
              </button>
            </div>

            {/* ° ' ": Shift -> FACT (Yellow), Alpha -> B (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">FACT</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">B</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => {
                    if (isCalculated) {
                      setResult(decimalToDms(rawNumericVal));
                    } else {
                      handleToken('°');
                    }
                  },
                  () => {
                    if (rawNumericVal > 0) {
                      setResult(primeFactorization(rawNumericVal));
                    }
                  },
                  () => handleToken('B')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                ° ' "
              </button>
            </div>

            {/* x⁻¹: Shift -> x! (Yellow), Alpha -> C (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">x!</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">C</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('⁻¹'),
                  () => handleToken('!'),
                  () => handleToken('C')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] font-bold"
              >
                x⁻¹
              </button>
            </div>

            {/* sin: Shift -> sin⁻¹ (Yellow), Alpha -> D (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">sin⁻¹</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">D</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('sin('),
                  () => handleToken('sin⁻¹('),
                  () => handleToken('D')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                sin
              </button>
            </div>

            {/* cos: Shift -> cos⁻¹ (Yellow), Alpha -> E (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">cos⁻¹</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">E</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('cos('),
                  () => handleToken('cos⁻¹('),
                  () => handleToken('E')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                cos
              </button>
            </div>

            {/* tan: Shift -> tan⁻¹ (Yellow), Alpha -> F (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">tan⁻¹</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">F</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('tan('),
                  () => handleToken('tan⁻¹('),
                  () => handleToken('F')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                tan
              </button>
            </div>

            {/* ROW 5: [STO], [ENG], [(], [)], [S<=>D], [M+] */}

            {/* STO: Shift -> RECALL (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">RECALL</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => {
                    playKeyClick('action');
                    setIsStoreMode(!isStoreMode);
                  },
                  () => handleToken('X')
                )}
                className={`w-full flex-1 min-h-0 rounded-md key-hardware-charcoal flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] ${
                  isStoreMode ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-200'
                }`}
              >
                STO
              </button>
            </div>

            {/* ENG: Shift -> i (Yellow), Alpha -> ∠ (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">i</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">∠</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleEng(),
                  () => handleToken('i'),
                  () => handleToken('∠')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                ENG
              </button>
            </div>

            {/* (: Shift -> Abs (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">Abs</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('('),
                  () => handleToken('Abs(')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                (
              </button>
            </div>

            {/* ): Shift -> , (Yellow), Alpha -> x (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">,</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">x</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken(')'),
                  () => handleToken(','),
                  () => handleToken('x')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                )
              </button>
            </div>

            {/* S<=>D: Shift -> a b/c <=> d/c (Yellow), Alpha -> y (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8px)] font-bold text-[#E5A93C]">a b/c⇔d/c</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">y</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleSdToggle(),
                  () => handleSdToggle(),
                  () => handleToken('y')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-[#E5A93C] flex items-center justify-center text-[clamp(9px,1.3vh,11px)] font-bold"
              >
                S ⇔ D
              </button>
            </div>

            {/* M+: Shift -> M- (Yellow), Alpha -> M (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">M-</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">M</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleMemoryAdd(),
                  () => handleMemorySub(),
                  () => handleToken('M')
                )}
                className="w-full flex-1 min-h-0 rounded-md key-hardware-charcoal text-slate-200 flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] font-bold"
              >
                M+
              </button>
            </div>
          </div>

          {/* 5. NUMERIC & BASE BLOCK - HARDWARE ACCURATE WHITE/BLUE KEYCAPS WITH DUAL SECONDARY LABELS */}
          <div className="flex-[1.4] min-h-0 grid grid-cols-5 grid-rows-4 gap-1.5 text-sm font-mono pt-0.5">
            
            {/* ROW 6: [7], [8], [9], [DEL], [AC] */}
            
            {/* 7: Shift -> CONST (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">CONST</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('7'),
                  () => { setActiveDrawerTab('CONST'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                7
              </button>
            </div>

            {/* 8: Shift -> CONV (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">CONV</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('8'),
                  () => { setActiveDrawerTab('CONV'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                8
              </button>
            </div>

            {/* 9: Shift -> RESET (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">RESET</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('9'),
                  () => handleAllClear()
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                9
              </button>
            </div>

            {/* DEL: Shift -> INS (Yellow), Alpha -> UNDO (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">INS</span>
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E6007E]">UNDO</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleDelete(),
                  () => handleDelete(),
                  () => handleDelete(),
                  'action'
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-blue text-white text-[clamp(11px,1.8vh,13px)] font-black flex items-center justify-center"
              >
                DEL
              </button>
            </div>

            {/* AC: Shift -> OFF (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">OFF</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleAllClear(),
                  () => handlePowerOff(),
                  undefined,
                  'action'
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-blue text-white text-[clamp(11px,1.8vh,13px)] font-black flex items-center justify-center"
              >
                AC
              </button>
            </div>

            {/* ROW 7: [4], [5], [6], [×], [÷] */}
            
            {/* 4: Shift -> [MATRIX] (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">MATRIX</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('4'),
                  () => { setActiveDrawerTab('MATRIX'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                4
              </button>
            </div>

            {/* 5: Shift -> [VECTOR] (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">VECTOR</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('5'),
                  () => { setActiveDrawerTab('VECTOR'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                5
              </button>
            </div>

            {/* 6 */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span></span>
                <span></span>
              </div>
              <button
                onClick={() => handleToken('6')}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                6
              </button>
            </div>

            {/* ×: Shift -> nPr (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">nPr</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('×', 'func'),
                  () => handleToken(' P ')
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(15px,2.5vh,20px)] font-bold flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* ÷: Shift -> nCr (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">nCr</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('÷', 'func'),
                  () => handleToken(' C ')
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(15px,2.5vh,20px)] font-bold flex items-center justify-center"
              >
                ÷
              </button>
            </div>

            {/* ROW 8: [1], [2], [3], [+], [-] */}
            
            {/* 1: Shift -> [STAT] (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">STAT</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('1'),
                  () => { setActiveDrawerTab('STAT'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                1
              </button>
            </div>

            {/* 2: Shift -> [CMPLX] (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">CMPLX</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('2'),
                  () => handleToken('i')
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                2
              </button>
            </div>

            {/* 3: Shift -> [BASE] (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">BASE</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('3'),
                  () => { setActiveDrawerTab('BASE'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                3
              </button>
            </div>

            {/* +: Shift -> Pol (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">Pol</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('+', 'func'),
                  () => handleToken('Pol(')
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(15px,2.5vh,20px)] font-bold flex items-center justify-center"
              >
                +
              </button>
            </div>

            {/* -: Shift -> Rec (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">Rec</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('-', 'func'),
                  () => handleToken('Rec(')
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(15px,2.5vh,20px)] font-bold flex items-center justify-center"
              >
                -
              </button>
            </div>

            {/* ROW 9: [0], [.], [×10ˣ], [Ans], [=] */}

            {/* 0: Shift -> Rnd (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">Rnd</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('0'),
                  () => handleToken('Rnd(')
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black flex items-center justify-center"
              >
                0
              </button>
            </div>

            {/* .: Shift -> Ran# (Yellow), Alpha -> RanInt (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E5A93C]">Ran#</span>
                <span className="text-[clamp(7px,0.9vh,8.5px)] font-bold text-[#E6007E]">RanInt</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('.'),
                  () => handleToken(parseFloat(Math.random().toFixed(3)).toString()),
                  () => handleToken(Math.floor(Math.random() * 10).toString())
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(15px,2.5vh,20px)] font-black flex items-center justify-center"
              >
                ·
              </button>
            </div>

            {/* ×10ˣ: Shift -> π (Yellow), Alpha -> e (Pink) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">π</span>
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E6007E]">e</span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('×10^('),
                  () => handleToken('π'),
                  () => handleToken('e')
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(10px,1.6vh,13px)] font-black flex items-center justify-center"
              >
                ×10ˣ
              </button>
            </div>

            {/* Ans: Shift -> % (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">%</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleToken('Ans'),
                  () => handleToken('%')
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-900 text-[clamp(11px,1.7vh,13px)] font-black flex items-center justify-center"
              >
                Ans
              </button>
            </div>

            {/* =: Shift -> ≈ (Yellow) */}
            <div className="key-wrapper">
              <div className="key-secondary-labels">
                <span className="text-[clamp(7.5px,0.95vh,9px)] font-bold text-[#E5A93C]">≈</span>
                <span></span>
              </div>
              <button
                onClick={() => handleSmartKey(
                  () => handleEqual(),
                  () => handleEqual(),
                  undefined,
                  'equal'
                )}
                className="w-full flex-1 min-h-0 rounded-xl key-hardware-white text-slate-950 text-[clamp(16px,2.8vh,22px)] font-black flex items-center justify-center"
              >
                =
              </button>
            </div>

          </div>
        </div>

        {/* Bottom Smartphone Navigation Home Bar Indicator */}
        <div className="shrink-0 py-1 flex justify-center bg-[#0D0D10] border-t border-slate-900">
          <div className="w-20 h-1 bg-slate-700/60 rounded-full"></div>
        </div>
      </main>

      {/* DEDICATED CALCULATION HISTORY LOG MODAL */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={history}
        onSelectHistory={(item) => {
          setAstState(parseStringToAst(item.expression));
          setResult(item.result);
          setRawNumericVal(item.numericVal);
          setIsCalculated(true);
        }}
        onInsertAns={(val) => {
          handleToken(val);
        }}
        onClearHistory={() => setHistory([])}
        onDeleteItem={(id) => setHistory((prev) => prev.filter((item) => item.id !== id))}
      />

      {/* CLASSWIZ QR CODE SHEET MODAL */}
      <ClassWizQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        expression={astToDisplayText(astState.root)}
        result={result}
      />

      {/* ADVANCED MODES DRAWER */}
      <AdvancedModesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeDrawerTab}
        setActiveTab={setActiveDrawerTab}
        onInsertValue={(val) => handleToken(val)}
        history={history}
        onSelectHistory={(item) => {
          setAstState(parseStringToAst(item.expression));
          setResult(item.result);
          setRawNumericVal(item.numericVal);
          setIsCalculated(true);
        }}
        onClearHistory={() => setHistory([])}
      />
    </div>
  );
}
