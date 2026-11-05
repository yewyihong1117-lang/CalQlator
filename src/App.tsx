/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, VolumeX, Maximize2, Minimize2, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Sliders, Vibrate, VibrateOff, Lock, Clock, QrCode, Sparkles, Check
} from 'lucide-react';
import { 
  AngleMode, DisplayFormat, HistoryItem,
  evaluateMathExpression, formatResult, toFraction,
  recognizeExactSurd, toEngineering, decimalToDms, primeFactorization,
  solveEquation
} from './calcEngine';
import { 
  playKeyClick, isSoundEnabled, setSoundEnabled,
  triggerHaptic, isHapticEnabled, setHapticEnabled,
  HapticKeyType 
} from './audioFeedback';
import { AdvancedModesDrawer, ModeTab } from './components/AdvancedModesDrawer';
import { HistoryModal } from './components/HistoryModal';
import { ClassWizQrModal } from './components/ClassWizQrModal';

export type AspectRatioMode = 'OPPO' | '9:19.5' | 'FIT';

export default function App() {
  // Calculator Display & Engine State
  const [expression, setExpression] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [result, setResult] = useState('0');
  const [rawNumericVal, setRawNumericVal] = useState<number>(0);
  const [isCalculated, setIsCalculated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Indicators / Status Modes
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
        expression: '∫(x², 0, 3)',
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

  // Auto-scroll expression display container when cursor moves
  const exprDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (exprDisplayRef.current) {
      exprDisplayRef.current.scrollLeft = exprDisplayRef.current.scrollWidth;
    }
  }, [expression, cursorPos]);

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

    // Detect left swipe to open advanced drawer
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

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        insertToken(e.key);
      } else if (e.key === '.') {
        insertToken('.');
      } else if (e.key === '+') {
        insertToken('+');
      } else if (e.key === '-') {
        insertToken('-');
      } else if (e.key === '*') {
        insertToken('×');
      } else if (e.key === '/') {
        insertToken('÷');
      } else if (e.key === '(') {
        insertToken('(');
      } else if (e.key === ')') {
        insertToken(')');
      } else if (e.key === '^') {
        insertToken('^(');
      } else if (e.key === 'x' || e.key === 'X') {
        insertToken('x');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEqual();
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleAllClear();
      } else if (e.key === 'ArrowLeft') {
        moveCursor('left');
      } else if (e.key === 'ArrowRight') {
        moveCursor('right');
      } else if (e.key === 'ArrowUp') {
        navigateHistory('up');
      } else if (e.key === 'ArrowDown') {
        navigateHistory('down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expression, cursorPos, isCalculated, rawNumericVal, lastAns, historyIndex, history]);

  // Insert token at cursor position
  const insertToken = (token: string, keyType: HapticKeyType = 'num') => {
    playKeyClick(keyType);
    if (errorMessage) {
      setErrorMessage(null);
    }

    let currentExpr = expression;
    let pos = cursorPos;

    if (isCalculated) {
      if (['+', '-', '×', '÷', '^', '²', '³'].includes(token)) {
        currentExpr = 'Ans';
        pos = 3;
      } else {
        currentExpr = '';
        pos = 0;
      }
      setIsCalculated(false);
      setSdCycleState(0);
    }

    const newExpr = currentExpr.slice(0, pos) + token + currentExpr.slice(pos);
    setExpression(newExpr);
    setCursorPos(pos + token.length);

    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Cursor navigation
  const moveCursor = (dir: 'left' | 'right') => {
    playKeyClick('dpad');
    if (dir === 'left') {
      setCursorPos((prev) => Math.max(0, prev - 1));
    } else {
      setCursorPos((prev) => Math.min(expression.length, prev + 1));
    }
  };

  // Replay History navigation (tactile dpad micro-tick)
  const navigateHistory = (dir: 'up' | 'down') => {
    playKeyClick('dpad');
    if (history.length === 0) return;

    if (dir === 'up') {
      const nextIdx = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(nextIdx);
      const item = history[history.length - 1 - nextIdx];
      if (item) {
        setExpression(item.expression);
        setCursorPos(item.expression.length);
        setResult(item.result);
        setRawNumericVal(item.numericVal);
        setIsCalculated(true);
      }
    } else {
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        const item = history[history.length - 1 - nextIdx];
        if (item) {
          setExpression(item.expression);
          setCursorPos(item.expression.length);
          setResult(item.result);
          setRawNumericVal(item.numericVal);
          setIsCalculated(true);
        }
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setExpression('');
        setCursorPos(0);
        setResult('0');
        setIsCalculated(false);
      }
    }
  };

  // Delete single character at cursor
  const handleDelete = () => {
    playKeyClick('action');
    if (expression.length === 0 || cursorPos === 0) return;

    const before = expression.slice(0, cursorPos - 1);
    const after = expression.slice(cursorPos);
    setExpression(before + after);
    setCursorPos(cursorPos - 1);
    setIsCalculated(false);
  };

  // All Clear (AC)
  const handleAllClear = () => {
    playKeyClick('action');
    setExpression('');
    setCursorPos(0);
    setResult('0');
    setErrorMessage(null);
    setIsCalculated(false);
    setShiftActive(false);
    setAlphaActive(false);
    setIsStoreMode(false);
    setHistoryIndex(-1);
    setActiveMenu('NONE');
  };

  const handleShift = () => {
    playKeyClick('shift');
    setShiftActive(!shiftActive);
    if (alphaActive) setAlphaActive(false);
  };

  const handleAlpha = () => {
    playKeyClick('alpha');
    setAlphaActive(!alphaActive);
    if (shiftActive) setShiftActive(false);
  };

  // Evaluate Expression (=)
  const handleEqual = () => {
    playKeyClick('equal');
    if (!expression.trim()) return;

    const evalRes = evaluateMathExpression(expression, angleMode, variables, lastAns);
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
      expression: expression,
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

  // SOLVE Equation (f(x) = 0)
  const handleSolve = () => {
    playKeyClick('action');
    if (!expression.trim()) return;

    let solveExpr = expression;
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
        expression: `SOLVE: ${expression}`,
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

  // S<=>D (Standard to Decimal conversion toggle)
  const handleSdToggle = () => {
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
    playKeyClick('action');
    if (isCalculated) {
      setMemoryM((prev) => prev + rawNumericVal);
    } else {
      insertToken('M');
    }
  };

  const handleEng = () => {
    playKeyClick('func');
    if (isCalculated) {
      setResult(toEngineering(rawNumericVal));
    }
  };

  const handleSmartKey = (
    normalAction: () => void,
    shiftAction?: () => void,
    alphaAction?: () => void,
    keyType: HapticKeyType = 'func'
  ) => {
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

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#08080A] flex flex-col items-center justify-between text-slate-100 selection:bg-amber-400/20 overflow-hidden pt-[env(safe-area-inset-top,0)]">
      
      {/* Top Utility Controls Bar: Deducted cleanly so it never collides with anything */}
      <header className="w-full max-w-[430px] h-8 px-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0 select-none z-10 border-b border-slate-900/40">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold tracking-tight text-slate-100 text-xs">CASIO</span>
          <span className="text-[10px] text-pink-400 font-mono font-bold">CLASSWIZ</span>

          {/* Aspect Ratio Mode Lock Indicator */}
          <button
            onClick={cycleAspectMode}
            title={`OPPO Find X9 Pro Ratio Lock: ${aspectMode}. Tap to toggle.`}
            className="px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-[10px] font-mono text-amber-400 border border-slate-700/60 flex items-center gap-1 transition-colors active:scale-95 ml-1"
          >
            <Lock className="w-2.5 h-2.5 text-amber-400" />
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
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Tape ({history.length})</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={soundOn ? 'Key Audio Clicks: ON' : 'Key Audio Clicks: MUTED'}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {/* Haptic Vibration Toggle */}
          <button
            onClick={toggleHaptic}
            title={hapticOn ? 'Haptic Vibration: ON' : 'Haptic Vibration: OFF'}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {hapticOn ? <Vibrate className="w-3.5 h-3.5 text-amber-400" /> : <VibrateOff className="w-3.5 h-3.5 text-slate-500" />}
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
        {/* Subtle white tray bezel outer edge simulation (seen in user photo) */}
        <div className="absolute inset-y-12 -left-[3px] w-[3px] bg-slate-300/40 rounded-l-full pointer-events-none"></div>
        <div className="absolute inset-y-12 -right-[3px] w-[3px] bg-slate-300/40 rounded-r-full pointer-events-none"></div>

        {/* 1. Casio Brand & Authentic CLASSWIZ Header - Strictly Matching Photo */}
        <div className="shrink-0 pt-2 pb-1 px-4 flex items-center justify-between bg-[#121217] border-b border-slate-900/60">
          <span className="font-extrabold text-sm tracking-widest text-slate-100 font-mono">
            CASIO
          </span>

          <span className="font-black text-xs sm:text-sm tracking-wider font-mono text-[#FF4081] drop-shadow-sm">
            CLASSWIZ
          </span>

          <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
            fx-570EX
          </span>
        </div>

        {/* 2. DUAL-LINE DOT-MATRIX OLED DISPLAY SCREEN */}
        <div className="shrink-0 mx-2.5 sm:mx-3 my-0.5 sm:my-1 p-2 sm:p-2.5 rounded-xl lcd-screen-bg border border-slate-800/90 shadow-inner relative flex flex-col justify-between h-[clamp(82px,15.5vh,122px)] min-h-[78px]">
          
          {/* Top Status Indicators Row (SHIFT, ALPHA, STO, M, D/R/G, Math, History) */}
          <div className="flex items-center justify-between text-[10px] font-mono tracking-wider border-b border-emerald-950/40 pb-0.5 text-slate-400 select-none">
            <div className="flex items-center gap-1.5">
              <span className={`px-1 rounded text-[9px] font-bold transition-opacity ${shiftActive ? 'bg-amber-400 text-slate-950' : 'opacity-20'}`}>
                S
              </span>
              <span className={`px-1 rounded text-[9px] font-bold transition-opacity ${alphaActive ? 'bg-[#FF4081] text-slate-950' : 'opacity-20'}`}>
                A
              </span>
              <span className={`px-1 rounded text-[9px] font-bold transition-opacity ${isStoreMode ? 'bg-cyan-400 text-slate-950' : 'opacity-0'}`}>
                STO
              </span>
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
                className="px-1 rounded text-[9px] font-mono text-amber-300 hover:bg-slate-800 transition-colors flex items-center gap-0.5"
              >
                <span>HIST</span>
                <span className="text-[8px] bg-slate-800 px-1 rounded text-amber-400">{history.length}</span>
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

          {/* Upper Line: Natural Textbook Math Expression with Blinking Cursor */}
          <div 
            ref={exprDisplayRef}
            className="flex-1 overflow-x-auto whitespace-nowrap text-base sm:text-lg font-mono text-emerald-300 py-0.5 flex items-center no-scrollbar tracking-wide"
          >
            {expression.length === 0 ? (
              <span className="text-emerald-700/50 flex items-center">
                0<span className="inline-block w-1.5 h-3.5 bg-emerald-400/80 ml-0.5 animate-pulse"></span>
              </span>
            ) : (
              <span className="flex items-center">
                <span>{expression.slice(0, cursorPos)}</span>
                <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 mr-0.5 animate-pulse rounded-sm"></span>
                <span>{expression.slice(cursorPos)}</span>
              </span>
            )}
          </div>

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
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Modes: Stat · Matrix · Vector · Eqn</span>
          </span>
          <span className="text-amber-400/90 font-bold flex items-center gap-0.5">
            Swipe ◄ or Tap
          </span>
        </div>

        {/* 3. KEYPAD SECTION (Authentic fx-570EX Physical Button Matrix) */}
        <div className="flex-1 min-h-0 px-2 sm:px-3 pb-1 pt-0.5 flex flex-col justify-between gap-1 bg-[#121217]">
          
          {/* Row 1: Top Navigation Row (SHIFT, ALPHA, REPLAY D-PAD, MENU/SETUP, ON) */}
          <div className="shrink-0 grid grid-cols-5 items-center gap-1 h-[clamp(44px,7vh,56px)]">
            {/* SHIFT Key */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,1vh,9px)] font-bold text-amber-400 font-mono tracking-tighter leading-none mb-0.5">SHIFT</span>
              <button
                onClick={handleShift}
                className={`w-full h-[clamp(26px,4vh,32px)] rounded-full font-mono text-[10px] sm:text-xs font-bold transition-all key-func-tactile flex items-center justify-center ${
                  shiftActive 
                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-400/50' 
                    : 'bg-[#22222B] text-amber-400 hover:bg-[#2A2A36]'
                }`}
              >
                SHIFT
              </button>
            </div>

            {/* ALPHA Key */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,1vh,9px)] font-bold text-[#FF4081] font-mono tracking-tighter leading-none mb-0.5">ALPHA</span>
              <button
                onClick={handleAlpha}
                className={`w-full h-[clamp(26px,4vh,32px)] rounded-full font-mono text-[10px] sm:text-xs font-bold transition-all key-func-tactile flex items-center justify-center ${
                  alphaActive 
                    ? 'bg-[#FF4081] text-slate-950 ring-2 ring-pink-400/50' 
                    : 'bg-[#22222B] text-[#FF4081] hover:bg-[#2A2A36]'
                }`}
              >
                ALPHA
              </button>
            </div>

            {/* Center: REPLAY D-PAD (Authentic Diamond/Oval Ring with Chrome Texture) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <div className="relative w-[clamp(58px,8.8vh,70px)] h-[clamp(40px,6.2vh,50px)] bg-gradient-to-b from-[#252530] to-[#14141A] rounded-full border border-slate-600/70 shadow-md flex items-center justify-center p-0.5">
                {/* UP: History Up */}
                <button
                  onClick={() => navigateHistory('up')}
                  title="Previous calculation"
                  className="absolute top-0 p-1 text-slate-300 hover:text-amber-400 active:scale-90 transition-transform"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                {/* DOWN: History Down */}
                <button
                  onClick={() => navigateHistory('down')}
                  title="Next calculation"
                  className="absolute bottom-0 p-1 text-slate-300 hover:text-amber-400 active:scale-90 transition-transform"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {/* LEFT: Cursor Left */}
                <button
                  onClick={() => moveCursor('left')}
                  title="Cursor Left"
                  className="absolute left-0.5 p-1 text-slate-300 hover:text-amber-400 active:scale-90 transition-transform"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {/* RIGHT: Cursor Right */}
                <button
                  onClick={() => moveCursor('right')}
                  title="Cursor Right"
                  className="absolute right-0.5 p-1 text-slate-300 hover:text-amber-400 active:scale-90 transition-transform"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {/* Center REPLAY Label with chrome border */}
                <div className="w-5 h-3.5 rounded bg-slate-900 border border-slate-600 flex items-center justify-center">
                  <span className="text-[6.5px] font-mono text-slate-300 font-bold tracking-tighter">
                    REP
                  </span>
                </div>
              </div>
            </div>

            {/* MENU / SETUP Key */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,1vh,9px)] font-mono text-amber-400 font-semibold tracking-tighter leading-none mb-0.5">SETUP</span>
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
                className="w-full h-[clamp(26px,4vh,32px)] rounded-full font-mono text-[10px] sm:text-xs font-semibold bg-[#22222B] text-slate-200 hover:bg-[#2A2A36] key-func-tactile flex items-center justify-center"
              >
                MENU
              </button>
            </div>

            {/* ON Key */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,1vh,9px)] font-mono text-slate-500 tracking-tighter leading-none mb-0.5">CLR</span>
              <button
                onClick={handleAllClear}
                className="w-full h-[clamp(26px,4vh,32px)] rounded-full font-mono text-[10px] sm:text-xs font-bold bg-[#2A2A36] text-slate-100 hover:bg-[#343444] border border-slate-600/50 key-func-tactile flex items-center justify-center"
              >
                ON
              </button>
            </div>
          </div>

          {/* Row 2: OPTN, CALC, (D-Pad Center), ∫□ dx, x (As in ClassWiz Photo) */}
          <div className="shrink-0 grid grid-cols-6 items-center gap-1 h-[clamp(32px,4.8vh,40px)] text-[11px] font-mono">
            {/* OPTN (Shift: QR) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'QR' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => { setActiveDrawerTab('STAT'); setIsDrawerOpen(true); },
                  () => setIsQrModalOpen(true)
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] font-bold"
              >
                OPTN
              </button>
            </div>

            {/* CALC (Shift: SOLVE, Alpha: =) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'SOLVE' : alphaActive ? '=' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => handleEqual(),
                  () => handleSolve(),
                  () => insertToken('=')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-semibold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                CALC
              </button>
            </div>

            {/* Placeholder / Empty spacer between CALC and Integral */}
            <div className="col-span-2 hidden sm:block"></div>

            {/* INTEGRAL KEY: ∫□ dx (Shift: d/dx, Alpha: :) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0 sm:col-start-5">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'd/dx' : alphaActive ? ':' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('∫('),
                  () => insertToken('d/dx('),
                  () => insertToken(':')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-amber-400 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(10px,1.4vh,12px)] font-bold"
              >
                ∫□ dx
              </button>
            </div>

            {/* VARIABLE X KEY: x (Shift: Σ) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0 sm:col-start-6">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'Σ' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('x'),
                  () => insertToken('Σ(')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-100 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(10px,1.4vh,12px)] font-serif italic font-bold"
              >
                x
              </button>
            </div>
          </div>

          {/* 4. FUNCTION KEY BLOCK (Rows 3 to 5) */}
          <div className="flex-[1] min-h-0 grid grid-cols-6 grid-rows-3 gap-1 text-[11px] font-mono">
            {/* ROW 3: [□/□], [√], [x²], [xⁿ], [log□□], [ln] */}
            
            {/* Key: □/□ Fraction (Shift: a b/c) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'a b/c' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('/'), () => handleSdToggle())}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold"
              >
                <div className="flex flex-col items-center leading-none text-[9px]">
                  <span>□</span>
                  <span className="w-2.5 h-[1px] bg-slate-400 my-0.5"></span>
                  <span>□</span>
                </div>
              </button>
            </div>

            {/* Key: √□ (Shift: ³√) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '³√' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('√('), () => insertToken('³√('))}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                √□
              </button>
            </div>

            {/* Key: x² (Shift: x³, Blue: DEC) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'x³' : 'DEC'}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('²'), () => insertToken('³'))}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                x²
              </button>
            </div>

            {/* Key: xⁿ (Shift: ⁿ√x, Blue: HEX) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'ⁿ√□' : 'HEX'}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('^('), () => insertToken('^('))}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                x□
              </button>
            </div>

            {/* Key: log□□ (Custom base logarithm! Shift: 10ˣ, Blue: BIN) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '10ⁿ' : 'BIN'}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('log('), () => insertToken('10^('))}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                log□□
              </button>
            </div>

            {/* Key: ln (Shift: eˣ, Blue: OCT) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'eⁿ' : 'OCT'}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('ln('), () => insertToken('e^('))}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                ln
              </button>
            </div>

            {/* ROW 4: [(-)], [° ' "], [x⁻¹], [sin], [cos], [tan] */}

            {/* Key: (-) (Shift: Fact, Alpha: A) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'log' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'A' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('(-'),
                  () => insertToken('log('),
                  () => insertToken('A')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                (-)
              </button>
            </div>

            {/* Key: ° ' " (Shift: FACT, Alpha: B) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'FACT' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'B' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => {
                    if (isCalculated) {
                      setResult(decimalToDms(rawNumericVal));
                    } else {
                      insertToken('°');
                    }
                  },
                  () => {
                    if (rawNumericVal > 0) {
                      setResult(primeFactorization(rawNumericVal));
                    }
                  },
                  () => insertToken('B')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                ° ' "
              </button>
            </div>

            {/* Key: x⁻¹ (Shift: x!, Alpha: C) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'x!' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'C' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('⁻¹'),
                  () => insertToken('!'),
                  () => insertToken('C')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] font-bold"
              >
                x⁻¹
              </button>
            </div>

            {/* Key: sin (Shift: sin⁻¹, Alpha: D) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'sin⁻¹' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'D' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('sin('),
                  () => insertToken('sin⁻¹('),
                  () => insertToken('D')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                sin
              </button>
            </div>

            {/* Key: cos (Shift: cos⁻¹, Alpha: E) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'cos⁻¹' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'E' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('cos('),
                  () => insertToken('cos⁻¹('),
                  () => insertToken('E')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                cos
              </button>
            </div>

            {/* Key: tan (Shift: tan⁻¹, Alpha: F) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'tan⁻¹' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'F' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('tan('),
                  () => insertToken('tan⁻¹('),
                  () => insertToken('F')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                tan
              </button>
            </div>

            {/* ROW 5: [STO], [ENG], [(], [)], [S⇔D], [M+] */}

            {/* Key: STO (Shift: RECALL) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'RECALL' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => {
                    playKeyClick('action');
                    setIsStoreMode(!isStoreMode);
                  },
                  () => insertToken('X')
                )}
                className={`w-full flex-1 min-h-0 rounded-md key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] ${
                  isStoreMode ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-[#1B1B22] text-slate-300 hover:bg-[#252530]'
                }`}
              >
                STO
              </button>
            </div>

            {/* Key: ENG (Shift: [←, Alpha: i) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? '←' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'i' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => handleEng(),
                  () => handleEng(),
                  () => insertToken('i')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                ENG
              </button>
            </div>

            {/* Key: ( (Shift: Abs) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'Abs' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('('),
                  () => insertToken('Abs(')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                (
              </button>
            </div>

            {/* Key: ) (Shift: ,, Alpha: x) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? ',' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'x' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken(')'),
                  () => insertToken(','),
                  () => insertToken('x')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold text-[clamp(9.5px,1.35vh,11.5px)]"
              >
                )
              </button>
            </div>

            {/* Key: S⇔D (Shift: a b/c ⇔ d/c, Alpha: y) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'a b/c' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'y' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => handleSdToggle(),
                  () => handleSdToggle(),
                  () => insertToken('Y')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#252532] border border-slate-700/60 text-amber-400 hover:bg-[#2E2E3E] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] font-bold shadow-sm"
              >
                S ⇔ D
              </button>
            </div>

            {/* Key: M+ (Shift: M-, Alpha: M) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'M-' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'M' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => handleMemoryAdd(),
                  () => handleMemoryAdd(),
                  () => insertToken('M')
                )}
                className="w-full flex-1 min-h-0 rounded-md bg-[#252532] border border-slate-700/60 text-slate-200 hover:bg-[#2E2E3E] key-func-tactile flex items-center justify-center text-[clamp(9.5px,1.35vh,11.5px)] font-bold shadow-sm"
              >
                M+
              </button>
            </div>
          </div>

          {/* 5. NUMERIC & BASE BLOCK - STRICTLY FOLLOWING USER'S PHOTO */}
          {/* Del and AC are VIBRANT BLUE keys! All number keys 0-9, ., x10^x, Ans, = are WHITE keys! */}
          <div className="flex-[1.4] min-h-0 grid grid-cols-5 grid-rows-4 gap-1.5 text-sm font-mono pt-0.5">
            
            {/* ROW 6: [7], [8], [9], [DEL], [AC] */}
            
            {/* 7 (WHITE KEY) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'CONST' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('7'),
                  () => { setActiveDrawerTab('CONST'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                7
              </button>
            </div>

            {/* 8 (WHITE KEY) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'CONV' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('8'),
                  () => { setActiveDrawerTab('CONV'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                8
              </button>
            </div>

            {/* 9 (WHITE KEY) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'RESET' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('9'),
                  () => handleAllClear()
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                9
              </button>
            </div>

            {/* DEL (VIBRANT BLUE KEY #1868DB - As in User Photo) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'INS' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'UNDO' : ''}</span>
              </span>
              <button
                onClick={handleDelete}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#1868DB] text-white border border-blue-400/30 text-[clamp(11px,1.8vh,13px)] font-black hover:bg-[#2075ED] active:bg-[#1258BD] key-tactile flex items-center justify-center shadow-md border-b-2 border-blue-900"
              >
                DEL
              </button>
            </div>

            {/* AC (VIBRANT BLUE KEY #1868DB - As in User Photo) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'OFF' : ''}</span>
              <button
                onClick={handleAllClear}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#1868DB] text-white border border-blue-400/30 text-[clamp(11px,1.8vh,13px)] font-black hover:bg-[#2075ED] active:bg-[#1258BD] key-tactile flex items-center justify-center shadow-md border-b-2 border-blue-900"
              >
                AC
              </button>
            </div>

            {/* ROW 7: [4], [5], [6], [×], [÷] (All White as in photo) */}
            
            {/* 4 */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '[MATRIX]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('4'),
                  () => { setActiveDrawerTab('MATRIX'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                4
              </button>
            </div>

            {/* 5 */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '[VECTOR]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('5'),
                  () => { setActiveDrawerTab('VECTOR'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                5
              </button>
            </div>

            {/* 6 */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate"></span>
              <button
                onClick={() => insertToken('6')}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                6
              </button>
            </div>

            {/* × (White key, Shift: nPr) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'nPr' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('×', 'func'),
                  () => insertToken(' P ')
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(15px,2.5vh,20px)] font-bold hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                ×
              </button>
            </div>

            {/* ÷ (White key, Shift: nCr) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'nCr' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('÷', 'func'),
                  () => insertToken(' C ')
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(15px,2.5vh,20px)] font-bold hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                ÷
              </button>
            </div>

            {/* ROW 8: [1], [2], [3], [+], [-] (All White as in photo) */}
            
            {/* 1 */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '[STAT]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('1'),
                  () => { setActiveDrawerTab('STAT'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                1
              </button>
            </div>

            {/* 2 */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '[CMPLX]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('2'),
                  () => insertToken('i')
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                2
              </button>
            </div>

            {/* 3 */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '[BASE]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('3'),
                  () => { setActiveDrawerTab('BASE'); setIsDrawerOpen(true); }
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                3
              </button>
            </div>

            {/* + (White key, Shift: Pol) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'Pol' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('+', 'func'),
                  () => insertToken('Pol(')
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(15px,2.5vh,20px)] font-bold hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                +
              </button>
            </div>

            {/* - (White key, Shift: Rec) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'Rec' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('-', 'func'),
                  () => insertToken('Rec(')
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(15px,2.5vh,20px)] font-bold hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                -
              </button>
            </div>

            {/* ROW 9: [0], [.], [×10ˣ], [Ans], [=] (All White as in photo) */}

            {/* 0 */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? 'Rnd' : ''}</span>
              <button
                onClick={() => insertToken('0')}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(14px,2.4vh,18px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                0
              </button>
            </div>

            {/* . (Shift: Ran#, Alpha: RanInt) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400">{shiftActive ? 'Ran#' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'RanI' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('.'),
                  () => insertToken(parseFloat(Math.random().toFixed(3)).toString()),
                  () => insertToken(Math.floor(Math.random() * 10).toString())
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(15px,2.5vh,20px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                ·
              </button>
            </div>

            {/* ×10ˣ (Shift: π, Alpha: e) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] h-[clamp(8px,1vh,11px)] leading-none flex justify-between w-full px-0.5 truncate">
                <span className="text-amber-400 font-bold">{shiftActive ? 'π' : ''}</span>
                <span className="text-[#FF4081] font-bold">{alphaActive ? 'e' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('×10^('),
                  () => insertToken('π'),
                  () => insertToken('e')
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(10px,1.6vh,13px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                ×10ˣ
              </button>
            </div>

            {/* Ans (Shift: %) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '%' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('Ans'),
                  () => insertToken('%')
                )}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-900 text-[clamp(11px,1.7vh,13px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-md border-b-2 border-slate-400"
              >
                Ans
              </button>
            </div>

            {/* = (Shift: ≈) */}
            <div className="flex flex-col items-center justify-center h-full min-h-0">
              <span className="text-[clamp(7.5px,0.95vh,9px)] text-amber-400 font-bold h-[clamp(8px,1vh,11px)] leading-none truncate">{shiftActive ? '≈' : ''}</span>
              <button
                onClick={handleEqual}
                className="w-full flex-1 min-h-0 rounded-xl bg-[#E8E8EE] text-slate-950 text-[clamp(16px,2.8vh,22px)] font-black hover:bg-white active:bg-[#D5D5DC] key-tactile flex items-center justify-center shadow-lg border-b-2 border-slate-400"
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
          setExpression(item.expression);
          setCursorPos(item.expression.length);
          setResult(item.result);
          setRawNumericVal(item.numericVal);
          setIsCalculated(true);
        }}
        onInsertAns={(val) => {
          insertToken(val);
        }}
        onClearHistory={() => setHistory([])}
        onDeleteItem={handleDeleteHistoryItem}
      />

      {/* CLASSWIZ QR CODE SHEET MODAL */}
      <ClassWizQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        expression={expression}
        result={result}
      />

      {/* ADVANCED MODES DRAWER (Swiped left or clicked) */}
      <AdvancedModesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeDrawerTab}
        setActiveTab={setActiveDrawerTab}
        onInsertValue={(val) => insertToken(val)}
        history={history}
        onSelectHistory={(item) => {
          setExpression(item.expression);
          setCursorPos(item.expression.length);
          setResult(item.result);
          setRawNumericVal(item.numericVal);
          setIsCalculated(true);
        }}
        onClearHistory={() => setHistory([])}
      />
    </div>
  );
}
