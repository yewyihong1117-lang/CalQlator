import React from 'react';
import { Settings, ShieldCheck, GraduationCap, Sliders, CheckSquare, Volume2, Vibrate, X, RotateCcw } from 'lucide-react';
import { AngleMode, DisplayFormat } from '../calcEngine';

export type CalculatorMode = 'EXAM' | 'STUDY';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  calcMode: CalculatorMode;
  onSetCalcMode: (mode: CalculatorMode) => void;
  onOpenCalibration: () => void;
  onOpenTestHarness: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  hapticOn: boolean;
  onToggleHaptic: () => void;
  angleMode: AngleMode;
  onSetAngleMode: (mode: AngleMode) => void;
  displayFormat: DisplayFormat;
  onSetDisplayFormat: (fmt: DisplayFormat) => void;
  onResetCalculator: () => void;
  onOpenMenu?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  calcMode,
  onSetCalcMode,
  onOpenCalibration,
  onOpenTestHarness,
  soundOn,
  onToggleSound,
  hapticOn,
  onToggleHaptic,
  angleMode,
  onSetAngleMode,
  displayFormat,
  onSetDisplayFormat,
  onResetCalculator,
  onOpenMenu,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-[#13151D] border border-slate-700/80 rounded-2xl shadow-2xl p-5 font-mono text-slate-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto no-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#E5A93C]" />
            <h3 className="font-bold text-sm tracking-wide text-slate-100">
              ClassWiz System Menu
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* In-Display Mode Menu Launcher */}
        {onOpenMenu && (
          <button
            onClick={() => {
              onClose();
              onOpenMenu();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-950/60 border border-emerald-500/60 hover:bg-emerald-900/60 text-emerald-300 font-bold text-xs flex items-center justify-between transition-colors shadow"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Open In-Display Mode Menu (Calculate, Matrix, Vector...)</span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">MENU key</span>
          </button>
        )}

        {/* 1. Operating Mode Selection */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Operating Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Exam Mode Button */}
            <button
              onClick={() => onSetCalcMode('EXAM')}
              className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                calcMode === 'EXAM'
                  ? 'bg-amber-950/40 border-amber-500/80 text-amber-200 ring-1 ring-amber-500/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Exam Mode</span>
              </div>
              <span className="text-[9.5px] text-slate-400 leading-tight">
                Strict 1:1 hardware clone. Zero distractions, authentic faceplate & keys only.
              </span>
              <span className="mt-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                Default (Spec)
              </span>
            </button>

            {/* Study Mode Button */}
            <button
              onClick={() => onSetCalcMode('STUDY')}
              className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                calcMode === 'STUDY'
                  ? 'bg-purple-950/40 border-purple-500/80 text-purple-200 ring-1 ring-purple-500/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-purple-400">
                <GraduationCap className="w-4 h-4" />
                <span>Study Mode</span>
              </div>
              <span className="text-[9.5px] text-slate-400 leading-tight">
                Tape history, undo, key-path trainer, timer, and drill counter.
              </span>
              <span className="mt-1 text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                Practice Tools
              </span>
            </button>
          </div>
        </div>

        {/* 2. Calibration & Test Tools */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Hardware & Testing Tools
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => {
                onClose();
                onOpenCalibration();
              }}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center gap-2 transition-colors text-left"
            >
              <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-200 block text-[11px]">Card Calibration</span>
                <span className="text-[9px] text-slate-400">Match phone to real mm</span>
              </div>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenTestHarness();
              }}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center gap-2 transition-colors text-left"
            >
              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-200 block text-[11px]">Test Suite (?test=1)</span>
                <span className="text-[9px] text-slate-400">22+ ground truth tests</span>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Audio & Haptics Feedback */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Tactile Feedback
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={onToggleHaptic}
              className={`p-2 rounded-lg border flex items-center justify-between transition-colors ${
                hapticOn ? 'bg-slate-900 border-amber-500/50 text-amber-300' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Vibrate className="w-4 h-4" />
                <span className="text-[11px]">Haptic Pulse</span>
              </div>
              <span className="text-[10px] font-bold">{hapticOn ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={onToggleSound}
              className={`p-2 rounded-lg border flex items-center justify-between transition-colors ${
                soundOn ? 'bg-slate-900 border-amber-500/50 text-amber-300' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4" />
                <span className="text-[11px]">Key Clicks</span>
              </div>
              <span className="text-[10px] font-bold">{soundOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* 4. Angle & Display Setup */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Angle Mode & Display Format
          </label>
          <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
            {(['DEG', 'RAD', 'GRA'] as AngleMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetAngleMode(mode)}
                className={`py-1.5 rounded-lg border font-bold text-[11px] transition-colors ${
                  angleMode === mode
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {mode === 'DEG' ? 'Degree (°)' : mode === 'RAD' ? 'Radian (r)' : 'Gradian (g)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-xs text-center mt-1.5">
            {(['NORM1', 'NORM2', 'FIX', 'SCI'] as DisplayFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => onSetDisplayFormat(fmt)}
                className={`py-1 rounded-lg border font-bold text-[10px] transition-colors ${
                  displayFormat === fmt
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button
            onClick={() => {
              if (window.confirm('Reset calculator memory and settings to defaults?')) {
                onResetCalculator();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset fx-570EX</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
