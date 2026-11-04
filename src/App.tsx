/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, VolumeX, Smartphone, Maximize2, Minimize2, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Sliders, RotateCcw, Sparkles, Vibrate, VibrateOff
} from 'lucide-react';
import { 
  AngleMode, DisplayFormat, HistoryItem,
  evaluateMathExpression, formatResult, toFraction,
  recognizeExactSurd, toEngineering, decimalToDms, primeFactorization,
  SCIENTIFIC_CONSTANTS
} from './calcEngine';
import { 
  playKeyClick, isSoundEnabled, setSoundEnabled,
  triggerHaptic, isHapticEnabled, setHapticEnabled,
  HapticKeyType, HAPTIC_PATTERNS 
} from './audioFeedback';
import { AdvancedModesDrawer, ModeTab } from './components/AdvancedModesDrawer';

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
  const [sdCycleState, setSdCycleState] = useState(0); // 0: Decimal, 1: Exact Fraction, 2: Mixed, 3: Surd/Pi, 4: ENG

  // Variables A, B, C, D, E, F, X, Y, M
  const [variables, setVariables] = useState<Record<string, number>>({
    A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0,
  });

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // UI & Device Settings
  const [soundOn, setSoundOn] = useState(true);
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<ModeTab>('STAT');
  const [activeMenu, setActiveMenu] = useState<'NONE' | 'MODE' | 'SETUP'>('NONE');

  // Active Key visual depression feedback (for keyboard & touch)
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  // Swipe Gesture detection
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Auto-scroll expression display container when cursor moves
  const exprDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (exprDisplayRef.current) {
      exprDisplayRef.current.scrollLeft = exprDisplayRef.current.scrollWidth;
    }
  }, [expression, cursorPos]);

  // Audio & Haptic state sync
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    playKeyClick('action');
  };

  const [hapticOn, setHapticOn] = useState(true);

  const toggleHaptic = () => {
    const next = !hapticOn;
    setHapticOn(next);
    setHapticEnabled(next);
    if (next) {
      triggerHaptic('action');
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/modals
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
  const insertToken = (token: string, keyId?: string, keyType: HapticKeyType = 'num') => {
    playKeyClick(keyType);
    if (keyId) {
      setPressedKey(keyId);
      setTimeout(() => setPressedKey(null), 120);
    }

    if (errorMessage) {
      setErrorMessage(null);
    }

    // If starting a fresh calculation after '=', and token is an operator, chain with Ans
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

    // Insert at current cursor
    const newExpr = currentExpr.slice(0, pos) + token + currentExpr.slice(pos);
    setExpression(newExpr);
    setCursorPos(pos + token.length);

    // Reset SHIFT / ALPHA after standard keystroke
    if (shiftActive) setShiftActive(false);
    if (alphaActive) setAlphaActive(false);
  };

  // Cursor navigation (tactile dpad micro-tick)
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

  // Toggle Shift Mode
  const handleShift = () => {
    playKeyClick('shift');
    setShiftActive(!shiftActive);
    if (alphaActive) setAlphaActive(false);
  };

  // Toggle Alpha Mode
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
    setHistory((prev) => [...prev.slice(-30), historyItem]);
    setHistoryIndex(-1);

    // If exact form available, default to displaying standard form on natural screen
    if (exactForm) {
      setResult(exactForm);
      setSdCycleState(1);
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
      // Decimal representation
      setResult(formatResult(num, displayFormat, fixDigits, sciDigits));
    } else if (nextState === 1) {
      // Exact Fraction / Surd
      const surd = recognizeExactSurd(num);
      if (surd) {
        setResult(surd);
      } else {
        const frac = toFraction(num);
        if (frac && frac.den > 1) {
          setResult(`${frac.num}/${frac.den}`);
        } else {
          setResult(formatResult(num, displayFormat, fixDigits, sciDigits));
        }
      }
    } else if (nextState === 2) {
      // Mixed Fraction (if > 1 and fraction exists)
      const frac = toFraction(num);
      if (frac && Math.abs(frac.num) > frac.den && frac.den > 1) {
        const whole = Math.floor(Math.abs(frac.num) / frac.den);
        const rem = Math.abs(frac.num) % frac.den;
        const sign = frac.num < 0 ? '-' : '';
        setResult(`${sign}${whole} ⌟ ${rem}/${frac.den}`);
      } else {
        // Fallback to engineering
        setResult(toEngineering(num));
      }
    } else {
      // Engineering Notation
      setResult(toEngineering(num));
    }
  };

  // Engineering Notation key (ENG)
  const handleEng = () => {
    playKeyClick('func');
    if (!isCalculated && rawNumericVal === 0) return;
    setResult(toEngineering(rawNumericVal));
    setSdCycleState(3);
  };

  // Memory Add (M+)
  const handleMemoryAdd = () => {
    playKeyClick('action');
    const val = isCalculated ? rawNumericVal : parseFloat(result) || 0;
    const nextM = shiftActive ? memoryM - val : memoryM + val;
    setMemoryM(nextM);
    setVariables((prev) => ({ ...prev, M: nextM }));
    setShiftActive(false);
  };

  // Store into variable (STO)
  const handleStoreVar = (varName: string) => {
    playKeyClick('action');
    const val = isCalculated ? rawNumericVal : parseFloat(result) || 0;
    setVariables((prev) => ({ ...prev, [varName]: val }));
    setIsStoreMode(false);
    setShiftActive(false);
    setAlphaActive(false);
    setResult(`➔ ${varName}`);
  };

  // Mode Menu Select
  const handleModeChange = (mode: 'COMP' | 'STAT' | 'MATRIX' | 'VECTOR' | 'EQN' | 'BASE') => {
    playKeyClick('action');
    setActiveMenu('NONE');
    if (mode === 'COMP') {
      // Standard computation
      return;
    }
    // Open corresponding drawer
    if (mode === 'STAT') setActiveDrawerTab('STAT');
    if (mode === 'MATRIX') setActiveDrawerTab('MATRIX');
    if (mode === 'VECTOR') setActiveDrawerTab('VECTOR');
    if (mode === 'EQN') setActiveDrawerTab('EQUATION');
    if (mode === 'BASE') setActiveDrawerTab('BASE');
    setIsDrawerOpen(true);
  };

  // Setup Menu (DEG, RAD, GRA, FIX, SCI, NORM)
  const handleSetupSelect = (type: 'DEG' | 'RAD' | 'GRA' | 'FIX' | 'SCI' | 'NORM') => {
    playKeyClick('action');
    setActiveMenu('NONE');
    if (['DEG', 'RAD', 'GRA'].includes(type)) {
      setAngleMode(type as AngleMode);
    } else if (type === 'FIX') {
      setDisplayFormat('FIX');
    } else if (type === 'SCI') {
      setDisplayFormat('SCI');
    } else if (type === 'NORM') {
      setDisplayFormat('NORM1');
    }
  };

  // Swipe Gestures: Touch Start & Move
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Detect horizontal swipe with low vertical displacement
    if (Math.abs(deltaX) > 45 && Math.abs(deltaY) < 60) {
      if (deltaX < 0) {
        // Swiped Left ➔ Open Advanced FX Drawer!
        playKeyClick('action');
        setIsDrawerOpen(true);
      } else if (deltaX > 0 && isDrawerOpen) {
        // Swiped Right ➔ Close Drawer
        setIsDrawerOpen(false);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Key Definition Helper for fx-570 Key Matrix
  interface KeyDef {
    id: string;
    label: string;
    shiftLabel?: string;
    alphaLabel?: string;
    onClick: () => void;
    type?: 'num' | 'func' | 'action' | 'shift' | 'alpha' | 'equal' | 'dpad';
    className?: string;
  }

  // Key click wrapper with Shift / Alpha routing & haptic feedback
  const handleSmartKey = (
    normalAction: () => void,
    shiftAction?: () => void,
    alphaAction?: () => void,
    keyType: HapticKeyType = 'func'
  ) => {
    playKeyClick(keyType);
    if (isStoreMode) {
      return;
    }
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
    <div className="min-h-screen w-full bg-[#08080A] flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 text-slate-100 selection:bg-amber-400/20">
      
      {/* Top Utility Controls Bar (Sound toggle, Haptics toggle, Phone Frame toggle, Quick Stats) */}
      <div className="w-full max-w-[440px] px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold tracking-tight text-slate-300">CASIO</span>
          <span className="text-[11px] text-slate-500 font-mono">fx-570EX CLASSWIZ</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Sound Toggle */}
          <button
            onClick={toggleSound}
            title={soundOn ? 'Key Audio Clicks: ON' : 'Key Audio Clicks: MUTED'}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Quick Haptic Vibration Toggle (Vibration API) */}
          <button
            onClick={toggleHaptic}
            title={hapticOn ? 'Haptic Vibration: ON' : 'Haptic Vibration: OFF'}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {hapticOn ? <Vibrate className="w-4 h-4 text-amber-400" /> : <VibrateOff className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Quick Drawer Button */}
          <button
            onClick={() => {
              playKeyClick('action');
              setIsDrawerOpen(true);
            }}
            title="Open Advanced Modes Drawer (Statistics, Matrix, Vector)"
            className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] font-mono text-amber-300 flex items-center gap-1 transition-colors"
          >
            <Sliders className="w-3 h-3" />
            <span>FX MODES</span>
          </button>

          {/* Frame Toggle for Desktop Viewing */}
          <button
            onClick={() => {
              playKeyClick('action');
              setIsPhoneFrame(!isPhoneFrame);
            }}
            title={isPhoneFrame ? 'Full Height View' : 'Device Bezel View'}
            className="hidden sm:flex p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isPhoneFrame ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Flagship Smartphone / Calculator Chassis (19.5:9 aspect ratio target) */}
      <main 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`w-full max-w-[430px] flex flex-col justify-between bg-[#101014] border border-slate-800/80 shadow-2xl overflow-hidden transition-all duration-200 select-none ${
          isPhoneFrame 
            ? 'sm:rounded-[42px] sm:border-[8px] sm:border-[#1C1C24] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] sm:my-2 min-h-[92vh] sm:min-h-[860px]' 
            : 'h-screen sm:h-auto min-h-screen sm:rounded-none'
        }`}
      >
        {/* Top Speaker / Camera Pill (Phone Aesthetic) */}
        <div className="pt-2 pb-1 px-6 flex justify-between items-center text-[10px] font-mono text-slate-500 border-b border-slate-900/60 bg-[#0B0B0E]">
          <span className="tracking-wider">fx-570EX</span>
          <div className="w-16 h-3 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
          </div>
          <span className="text-amber-400/90 font-semibold">NATURAL-V.P.A.M.</span>
        </div>

        {/* 1. Casio Brand & Solar Panel Strip */}
        <div className="px-5 pt-2 pb-1.5 flex items-center justify-between bg-[#121217]">
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-widest text-slate-100 font-mono">CASIO</span>
            <span className="text-[9px] text-slate-400 tracking-wider">fx-570EX CLASSWIZ</span>
          </div>

          {/* Solar Cell Strip Graphic with Realistic Grid */}
          <div 
            title="Solar Dual-Power Simulation"
            className="w-24 h-5 rounded bg-gradient-to-r from-[#2B1B17] via-[#3D2520] to-[#2B1B17] border border-[#4A322C] flex items-center justify-between px-1 shadow-inner"
          >
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className="w-4 h-3.5 border-r border-[#1B110E] last:border-0 opacity-70 bg-gradient-to-b from-[#4A322C]/40 to-transparent"></span>
            ))}
          </div>
        </div>

        {/* 2. DUAL-LINE DOT-MATRIX OLED DISPLAY SCREEN */}
        <div className="mx-4 my-2 p-3 rounded-2xl lcd-screen-bg border border-slate-800 shadow-inner relative flex flex-col justify-between min-h-[128px]">
          
          {/* Top Status Indicators Row (SHIFT, ALPHA, DEG, FIX, M, Math) */}
          <div className="flex items-center justify-between text-[11px] font-mono tracking-wider border-b border-emerald-950/40 pb-1 text-slate-400 select-none">
            <div className="flex items-center gap-2">
              {/* SHIFT Indicator */}
              <span className={`px-1 rounded text-[10px] font-bold transition-opacity ${shiftActive ? 'bg-amber-400 text-slate-950' : 'opacity-20'}`}>
                S
              </span>
              {/* ALPHA Indicator */}
              <span className={`px-1 rounded text-[10px] font-bold transition-opacity ${alphaActive ? 'bg-[#E056FD] text-slate-950' : 'opacity-20'}`}>
                A
              </span>
              {/* STORE Indicator */}
              <span className={`px-1 rounded text-[10px] font-bold transition-opacity ${isStoreMode ? 'bg-cyan-400 text-slate-950' : 'opacity-0'}`}>
                STO
              </span>
              {/* MEMORY Indicator */}
              <span className={`px-1 rounded text-[10px] font-bold transition-opacity ${memoryM !== 0 ? 'bg-emerald-400 text-slate-950' : 'opacity-20'}`}>
                M
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Angle Mode Badge: Tap to cycle DEG / RAD / GRA */}
              <button
                onClick={() => {
                  playKeyClick('action');
                  const next: AngleMode = angleMode === 'DEG' ? 'RAD' : angleMode === 'RAD' ? 'GRA' : 'DEG';
                  setAngleMode(next);
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900/90 text-emerald-400 border border-emerald-900/50 hover:bg-slate-800 transition-colors"
              >
                {angleMode === 'DEG' ? 'D' : angleMode === 'RAD' ? 'R' : 'G'}
              </button>

              {/* Display Format: FIX / SCI / NORM */}
              <span className="text-[10px] font-medium text-slate-400">
                {displayFormat}
              </span>

              {/* Math Display Indicator */}
              <span className="text-[10px] font-bold text-emerald-500">
                Math ▲▼
              </span>
            </div>
          </div>

          {/* Upper Line: Natural Textbook Math Expression with Blinking Cursor */}
          <div 
            ref={exprDisplayRef}
            className="flex-1 overflow-x-auto whitespace-nowrap text-lg sm:text-xl font-mono text-emerald-300 py-1.5 flex items-center no-scrollbar tracking-wide"
          >
            {expression.length === 0 ? (
              <span className="text-emerald-700/50 flex items-center">
                0<span className="inline-block w-2 h-4 bg-emerald-400/80 ml-0.5 animate-pulse"></span>
              </span>
            ) : (
              <span className="flex items-center">
                <span>{expression.slice(0, cursorPos)}</span>
                <span className="inline-block w-1.5 h-5 bg-emerald-400 ml-0.5 mr-0.5 animate-pulse rounded-sm"></span>
                <span>{expression.slice(cursorPos)}</span>
              </span>
            )}
          </div>

          {/* Lower Line: Live/Final Output with crisp large dot typography */}
          <div className="flex items-end justify-between pt-1 border-t border-emerald-950/40">
            {errorMessage ? (
              <span className="text-sm font-mono text-red-400 font-semibold tracking-wide animate-pulse">
                [{errorMessage}]
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-500">
                {isCalculated && (
                  <span>
                    Ans = {lastAns}
                  </span>
                )}
              </span>
            )}

            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-slate-100 tracking-tight lcd-dot-text">
                {result}
              </span>
            </div>
          </div>
        </div>

        {/* MODE / SETUP Overlays if toggled */}
        {activeMenu === 'MODE' && (
          <div className="mx-4 mb-2 p-2.5 bg-[#171720] border border-amber-500/40 rounded-xl text-xs font-mono grid grid-cols-3 gap-1.5 animate-in fade-in">
            <button onClick={() => handleModeChange('COMP')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left">
              1: COMP
            </button>
            <button onClick={() => handleModeChange('STAT')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left text-amber-300">
              2: STAT
            </button>
            <button onClick={() => handleModeChange('MATRIX')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left text-pink-300">
              3: MATRIX
            </button>
            <button onClick={() => handleModeChange('VECTOR')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left text-cyan-300">
              4: VECTOR
            </button>
            <button onClick={() => handleModeChange('EQN')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left text-emerald-300">
              5: EQN
            </button>
            <button onClick={() => handleModeChange('BASE')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left text-purple-300">
              6: BASE-N
            </button>
          </div>
        )}

        {activeMenu === 'SETUP' && (
          <div className="mx-4 mb-2 p-2.5 bg-[#171720] border border-amber-500/40 rounded-xl text-xs font-mono grid grid-cols-3 gap-1.5 animate-in fade-in">
            <button onClick={() => handleSetupSelect('DEG')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left">
              1: Deg (°)
            </button>
            <button onClick={() => handleSetupSelect('RAD')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left">
              2: Rad (r)
            </button>
            <button onClick={() => handleSetupSelect('GRA')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left">
              3: Gra (g)
            </button>
            <button onClick={() => handleSetupSelect('FIX')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left">
              4: Fix (0-9)
            </button>
            <button onClick={() => handleSetupSelect('SCI')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left">
              5: Sci (Exp)
            </button>
            <button onClick={() => handleSetupSelect('NORM')} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-left">
              6: Norm
            </button>
          </div>
        )}

        {/* SWIPE AFFORDANCE HINT (Specifically for fx-570 gesture requirement) */}
        <div 
          onClick={() => {
            playKeyClick('action');
            setIsDrawerOpen(true);
          }}
          className="mx-4 mb-1 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 cursor-pointer hover:bg-slate-800/80 transition-colors"
        >
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Fx Modes: Stat · Matrix · Vector</span>
          </span>
          <span className="text-amber-400/90 font-bold flex items-center gap-0.5">
            Swipe ◄ or Tap
          </span>
        </div>

        {/* 3. KEYPAD SECTION */}
        <div className="flex-1 px-3 sm:px-4 pb-4 pt-1 flex flex-col justify-between gap-1.5 bg-[#121217]">
          
          {/* Row 1: Top Navigation Row (SHIFT, ALPHA, REPLAY D-PAD, MODE/SETUP, ON) */}
          <div className="grid grid-cols-5 items-center gap-2 pt-1 pb-1">
            {/* SHIFT Key */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-amber-400 font-mono tracking-tighter">SHIFT</span>
              <button
                onClick={handleShift}
                className={`w-full h-8 rounded-lg font-mono text-xs font-bold transition-all key-func-tactile ${
                  shiftActive 
                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-400/50' 
                    : 'bg-[#1E1E26] text-amber-400 hover:bg-[#262632]'
                }`}
              >
                SHIFT
              </button>
            </div>

            {/* ALPHA Key */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-[#E056FD] font-mono tracking-tighter">ALPHA</span>
              <button
                onClick={handleAlpha}
                className={`w-full h-8 rounded-lg font-mono text-xs font-bold transition-all key-func-tactile ${
                  alphaActive 
                    ? 'bg-[#E056FD] text-slate-950 ring-2 ring-pink-400/50' 
                    : 'bg-[#1E1E26] text-[#E056FD] hover:bg-[#262632]'
                }`}
              >
                ALPHA
              </button>
            </div>

            {/* Center: REPLAY D-PAD (Large circular directional cluster) */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-20 h-16 bg-[#16161D] rounded-full border border-slate-700/80 shadow-md flex items-center justify-center p-1">
                {/* UP */}
                <button
                  onClick={() => navigateHistory('up')}
                  title="History Up"
                  className="absolute top-0.5 p-1 text-slate-400 hover:text-amber-400 active:scale-90 transition-transform"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                {/* DOWN */}
                <button
                  onClick={() => navigateHistory('down')}
                  title="History Down"
                  className="absolute bottom-0.5 p-1 text-slate-400 hover:text-amber-400 active:scale-90 transition-transform"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {/* LEFT */}
                <button
                  onClick={() => moveCursor('left')}
                  title="Cursor Left"
                  className="absolute left-1 p-1 text-slate-400 hover:text-amber-400 active:scale-90 transition-transform"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {/* RIGHT */}
                <button
                  onClick={() => moveCursor('right')}
                  title="Cursor Right"
                  className="absolute right-1 p-1 text-slate-400 hover:text-amber-400 active:scale-90 transition-transform"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {/* Center REPLAY Label */}
                <span className="text-[8px] font-mono text-slate-500 font-bold tracking-tighter">
                  REPLAY
                </span>
              </div>
            </div>

            {/* MODE / SETUP Key */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono text-amber-400 font-semibold tracking-tighter">SETUP</span>
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
                className="w-full h-8 rounded-lg font-mono text-xs font-semibold bg-[#1E1E26] text-slate-300 hover:bg-[#262632] key-func-tactile"
              >
                MODE
              </button>
            </div>

            {/* ON Key */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono text-slate-500 tracking-tighter">CLR</span>
              <button
                onClick={handleAllClear}
                className="w-full h-8 rounded-lg font-mono text-xs font-bold bg-[#22222E] text-slate-200 hover:bg-[#2B2B3A] border border-slate-700/50 key-func-tactile"
              >
                ON
              </button>
            </div>
          </div>

          {/* 4. FUNCTION KEY BLOCK (Rows 2 to 5) */}
          <div className="grid grid-cols-6 gap-1.5 text-xs font-mono">
            {/* ROW 2: [x⁻¹], [CALC], [x/y], [√], [x²], [xⁿ] */}
            
            {/* Key: x⁻¹ (Shift: x!) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'x!' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('⁻¹'), () => insertToken('!'))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                x⁻¹
              </button>
            </div>

            {/* Key: CALC (Shift: d/dx, Alpha: :) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'd/dx' : alphaActive ? ':' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => handleEqual(), () => handleEqual(), () => insertToken(':'))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-semibold"
              >
                CALC
              </button>
            </div>

            {/* Key: x/y Fraction (Shift: a b/c) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'a b/c' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('/'), () => handleSdToggle())}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold"
              >
                <div className="flex flex-col items-center leading-none text-[10px]">
                  <span>□</span>
                  <span className="w-2.5 h-[1px] bg-slate-400 my-0.5"></span>
                  <span>□</span>
                </div>
              </button>
            </div>

            {/* Key: √ (Shift: ³√) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? '³√' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('√('), () => insertToken('³√('))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold"
              >
                √□
              </button>
            </div>

            {/* Key: x² (Shift: x³) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'x³' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('²'), () => insertToken('³'))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold"
              >
                x²
              </button>
            </div>

            {/* Key: xⁿ (Shift: ⁿ√x) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'ⁿ√□' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('^('), () => insertToken('^('))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold"
              >
                x□
              </button>
            </div>

            {/* ROW 3: [log], [ln], [(-)], [° ' "], [hyp], [sin] */}

            {/* Key: log (Shift: 10ˣ) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? '10ⁿ' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('log('), () => insertToken('10^('))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                log
              </button>
            </div>

            {/* Key: ln (Shift: eˣ) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'eⁿ' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('ln('), () => insertToken('e^('))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                ln
              </button>
            </div>

            {/* Key: (-) (Shift: Fact, Alpha: A) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? 'Fact' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'A' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('(-'),
                  () => {
                    if (rawNumericVal > 0) {
                      setResult(primeFactorization(rawNumericVal));
                    }
                  },
                  () => insertToken('A')
                )}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                (-)
              </button>
            </div>

            {/* Key: ° ' " (Shift: ←, Alpha: B) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? '←' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'B' : ''}</span>
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
                  () => insertToken('°'),
                  () => insertToken('B')
                )}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold"
              >
                ° ' "
              </button>
            </div>

            {/* Key: hyp (Shift: hyp⁻¹, Alpha: C) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? 'hyp⁻¹' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'C' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('sinh('),
                  () => insertToken('asinh('),
                  () => insertToken('C')
                )}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                hyp
              </button>
            </div>

            {/* Key: sin (Shift: sin⁻¹, Alpha: D) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? 'sin⁻¹' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'D' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('sin('),
                  () => insertToken('sin⁻¹('),
                  () => insertToken('D')
                )}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                sin
              </button>
            </div>

            {/* ROW 4: [cos], [tan], [STO], [ENG], [(], [)] */}

            {/* Key: cos (Shift: cos⁻¹, Alpha: E) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? 'cos⁻¹' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'E' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('cos('),
                  () => insertToken('cos⁻¹('),
                  () => insertToken('E')
                )}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                cos
              </button>
            </div>

            {/* Key: tan (Shift: tan⁻¹, Alpha: F) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? 'tan⁻¹' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'F' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('tan('),
                  () => insertToken('tan⁻¹('),
                  () => insertToken('F')
                )}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                tan
              </button>
            </div>

            {/* Key: STO (Shift: RECALL, Alpha: X) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? 'RCL' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'X' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => {
                    playKeyClick('action');
                    setIsStoreMode(!isStoreMode);
                  },
                  () => {
                    // Recall variable X
                    insertToken('X');
                  },
                  () => insertToken('X')
                )}
                className={`w-full h-7 rounded-md key-func-tactile flex items-center justify-center ${
                  isStoreMode ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-[#1B1B22] text-slate-300 hover:bg-[#252530]'
                }`}
              >
                STO
              </button>
            </div>

            {/* Key: ENG (Shift: ←, Alpha: Y) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? '←' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'Y' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => handleEng(),
                  () => handleEng(),
                  () => insertToken('Y')
                )}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center"
              >
                ENG
              </button>
            </div>

            {/* Key: ( (Shift: %, Alpha: () */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? '%' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('('), () => insertToken('%'))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold"
              >
                (
              </button>
            </div>

            {/* Key: ) (Shift: ,, Alpha: )) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? ',' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken(')'), () => insertToken(','))}
                className="w-full h-7 rounded-md bg-[#1B1B22] text-slate-300 hover:bg-[#252530] key-func-tactile flex items-center justify-center font-bold"
              >
                )
              </button>
            </div>
          </div>

          {/* Row 5: [S⇔D] and [M+] spanning key functions */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {/* S⇔D Signature Key */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">
                {shiftActive ? 'a b/c ⇔ d/c' : ''}
              </span>
              <button
                onClick={handleSdToggle}
                className="w-full h-8 rounded-lg bg-[#22222E] border border-slate-700/60 text-amber-400 font-bold hover:bg-[#2C2C3C] key-tactile flex items-center justify-center gap-1 shadow-sm"
              >
                <span>S ⇔ D</span>
              </button>
            </div>

            {/* M+ Key */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-4">
                <span className="text-amber-400">{shiftActive ? 'M-' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'M' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => handleMemoryAdd(),
                  () => handleMemoryAdd(),
                  () => insertToken('M')
                )}
                className="w-full h-8 rounded-lg bg-[#22222E] border border-slate-700/60 text-slate-200 font-bold hover:bg-[#2C2C3C] key-tactile flex items-center justify-center"
              >
                M+
              </button>
            </div>
          </div>

          {/* 5. NUMERIC & BASE BLOCK (Standard 7-8-9, 4-5-6, 1-2-3, 0, DEL, AC, Ops) */}
          <div className="grid grid-cols-5 gap-2 text-sm font-mono pt-1">
            
            {/* ROW 6: [7], [8], [9], [DEL], [AC] */}
            
            {/* 7 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'CONST' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('7', '7'),
                  () => { setActiveDrawerTab('CONST'); setIsDrawerOpen(true); }
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                7
              </button>
            </div>

            {/* 8 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'CONV' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('8', '8'),
                  () => { setActiveDrawerTab('CONV'); setIsDrawerOpen(true); }
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                8
              </button>
            </div>

            {/* 9 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'CLR' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('9', '9'),
                  () => handleAllClear()
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                9
              </button>
            </div>

            {/* DEL (Soft Coral #FF6B6B) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'INS' : ''}</span>
              <button
                onClick={handleDelete}
                className="w-full h-11 rounded-xl bg-[#FF6B6B]/20 text-[#FF6B6B] border border-[#FF6B6B]/40 text-sm font-extrabold hover:bg-[#FF6B6B]/30 key-tactile flex items-center justify-center shadow-md"
              >
                DEL
              </button>
            </div>

            {/* AC (Soft Coral #FF6B6B) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'OFF' : ''}</span>
              <button
                onClick={handleAllClear}
                className="w-full h-11 rounded-xl bg-[#FF6B6B] text-slate-950 text-sm font-extrabold hover:bg-[#ff7b7b] key-tactile flex items-center justify-center shadow-md"
              >
                AC
              </button>
            </div>

            {/* ROW 7: [4], [5], [6], [×], [÷] */}
            
            {/* 4 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? '[MATRIX]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('4', '4'),
                  () => { setActiveDrawerTab('MATRIX'); setIsDrawerOpen(true); }
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                4
              </button>
            </div>

            {/* 5 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? '[VECTOR]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('5', '5'),
                  () => { setActiveDrawerTab('VECTOR'); setIsDrawerOpen(true); }
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                5
              </button>
            </div>

            {/* 6 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none"></span>
              <button
                onClick={() => insertToken('6', '6')}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                6
              </button>
            </div>

            {/* × (Shift: nPr) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'nPr' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('×', 'mul'),
                  () => insertToken(' P ')
                )}
                className="w-full h-11 rounded-xl bg-[#23232F] text-slate-200 text-lg font-bold hover:bg-[#2E2E3C] key-tactile flex items-center justify-center shadow-md"
              >
                ×
              </button>
            </div>

            {/* ÷ (Shift: nCr) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'nCr' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('÷', 'div'),
                  () => insertToken(' C ')
                )}
                className="w-full h-11 rounded-xl bg-[#23232F] text-slate-200 text-lg font-bold hover:bg-[#2E2E3C] key-tactile flex items-center justify-center shadow-md"
              >
                ÷
              </button>
            </div>

            {/* ROW 8: [1], [2], [3], [+], [-] */}

            {/* 1 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? '[STAT]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('1', '1'),
                  () => { setActiveDrawerTab('STAT'); setIsDrawerOpen(true); }
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                1
              </button>
            </div>

            {/* 2 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? '[CMPLX]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('2', '2'),
                  () => insertToken('i')
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                2
              </button>
            </div>

            {/* 3 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? '[BASE]' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('3', '3'),
                  () => { setActiveDrawerTab('BASE'); setIsDrawerOpen(true); }
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                3
              </button>
            </div>

            {/* + (Shift: Pol) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'Pol' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('+', 'add'),
                  () => insertToken('Pol(')
                )}
                className="w-full h-11 rounded-xl bg-[#23232F] text-slate-200 text-lg font-bold hover:bg-[#2E2E3C] key-tactile flex items-center justify-center shadow-md"
              >
                +
              </button>
            </div>

            {/* - (Shift: Rec) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'Rec' : ''}</span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('-', 'sub'),
                  () => insertToken('Rec(')
                )}
                className="w-full h-11 rounded-xl bg-[#23232F] text-slate-200 text-lg font-bold hover:bg-[#2E2E3C] key-tactile flex items-center justify-center shadow-md"
              >
                -
              </button>
            </div>

            {/* ROW 9: [0], [.], [×10ˣ], [Ans], [=] */}

            {/* 0 */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'Rnd' : ''}</span>
              <button
                onClick={() => insertToken('0', '0')}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                0
              </button>
            </div>

            {/* . (Shift: Ran#, Alpha: RanInt) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400">{shiftActive ? 'Ran#' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'RanI' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('.'),
                  () => insertToken(parseFloat(Math.random().toFixed(3)).toString()),
                  () => insertToken(Math.floor(Math.random() * 10).toString())
                )}
                className="w-full h-11 rounded-xl bg-[#1C1C24] text-white text-base font-bold hover:bg-[#282834] key-tactile flex items-center justify-center shadow-md"
              >
                ·
              </button>
            </div>

            {/* ×10ˣ (Shift: π, Alpha: e) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] h-3 leading-none flex justify-between w-full px-1">
                <span className="text-amber-400 font-bold">{shiftActive ? 'π' : ''}</span>
                <span className="text-[#E056FD] font-bold">{alphaActive ? 'e' : ''}</span>
              </span>
              <button
                onClick={() => handleSmartKey(
                  () => insertToken('×10^('),
                  () => insertToken('π'),
                  () => insertToken('e')
                )}
                className="w-full h-11 rounded-xl bg-[#23232F] text-slate-200 text-xs font-bold hover:bg-[#2E2E3C] key-tactile flex items-center justify-center shadow-md"
              >
                ×10ˣ
              </button>
            </div>

            {/* Ans (Shift: PreAns) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-amber-400 h-3 leading-none">{shiftActive ? 'PreAns' : ''}</span>
              <button
                onClick={() => handleSmartKey(() => insertToken('Ans'), () => insertToken('Ans'))}
                className="w-full h-11 rounded-xl bg-[#23232F] text-slate-200 text-xs font-bold hover:bg-[#2E2E3C] key-tactile flex items-center justify-center shadow-md"
              >
                Ans
              </button>
            </div>

            {/* = (Alpha: =) */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-[#E056FD] font-bold h-3 leading-none">{alphaActive ? '=' : ''}</span>
              <button
                onClick={handleEqual}
                className="w-full h-11 rounded-xl bg-amber-400 text-slate-950 text-xl font-black hover:bg-amber-300 key-tactile flex items-center justify-center shadow-lg shadow-amber-400/20 active:scale-[0.98]"
              >
                =
              </button>
            </div>

          </div>
        </div>

        {/* Bottom Smartphone Navigation Indicator Bar (Safe-Area styling) */}
        <div className="py-2 flex justify-center bg-[#0D0D10] border-t border-slate-900">
          <div className="w-28 h-1 bg-slate-700/60 rounded-full"></div>
        </div>
      </main>

      {/* Advanced FX Modes Drawer (Swiped left or clicked) */}
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
