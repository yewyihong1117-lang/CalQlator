import React from 'react';
import { 
  X, 
  RotateCcw, 
  Palette, 
  Compass, 
  Binary, 
  Sliders, 
  CheckSquare, 
  Sparkles,
  Smartphone
} from 'lucide-react';
import { AngleMode, DisplayFormat } from '../calcEngine';

export type CalculatorMode = 'EXAM' | 'STUDY';
export type CalculatorTheme = 'default' | 'qiqi';
export type EditorMode = 'CLASSIC' | 'PHONE';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  calcMode: CalculatorMode;
  onSetCalcMode: (mode: CalculatorMode) => void;
  theme?: CalculatorTheme;
  onSetTheme?: (theme: CalculatorTheme) => void;
  editorMode?: EditorMode;
  onSetEditorMode?: (mode: EditorMode) => void;
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
  theme = 'default',
  onSetTheme,
  editorMode = 'CLASSIC',
  onSetEditorMode,
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
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--m3-surface, #14141A)',
          color: 'var(--m3-on-surface, #E2E8F0)',
        }}
        className="w-full max-w-md rounded-3xl p-6 font-sans flex flex-col gap-5 max-h-[88vh] overflow-y-auto no-scrollbar shadow-2xl transition-all"
      >
        
        {/* Header: Clean M3 Top App Bar */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
            <p 
              style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
              className="text-xs"
            >
              Calculator preferences and hardware options
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            style={{ 
              backgroundColor: 'var(--m3-surface-container, #1C1C24)',
              color: 'var(--m3-on-surface, #E2E8F0)',
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-85 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GROUP 1: Mode & Theme (Appearance & Behavior) */}
        <div className="space-y-2">
          <span 
            style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
            className="text-xs font-medium px-1 tracking-wide"
          >
            Mode and appearance
          </span>

          <div 
            style={{ backgroundColor: 'var(--m3-surface-container, #1C1C24)' }}
            className="rounded-2xl p-4 space-y-4"
          >
            {/* Row 1: Operating Mode (Segmented Button) */}
            <div className="min-h-[56px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                >
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">Operating mode</span>
                  <span 
                    style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                    className="text-xs leading-normal"
                  >
                    {calcMode === 'EXAM' ? 'Strict 1:1 hardware replica' : 'Tape history and trainer drills'}
                  </span>
                </div>
              </div>

              {/* Segmented Button: Exam / Study */}
              <div 
                style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                className="p-1 rounded-full flex items-center self-start sm:self-auto shrink-0"
              >
                <button
                  type="button"
                  onClick={() => onSetCalcMode('EXAM')}
                  style={{
                    backgroundColor: calcMode === 'EXAM' ? 'var(--ui-accent, #E5A93C)' : 'transparent',
                    color: calcMode === 'EXAM' ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                  }}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                >
                  Exam
                </button>
                <button
                  type="button"
                  onClick={() => onSetCalcMode('STUDY')}
                  style={{
                    backgroundColor: calcMode === 'STUDY' ? 'var(--ui-accent, #E5A93C)' : 'transparent',
                    color: calcMode === 'STUDY' ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                  }}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                >
                  Study
                </button>
              </div>
            </div>

            {/* Row 2: Theme Selector (Segmented Button) */}
            {onSetTheme && (
              <div className="min-h-[56px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <div 
                    style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <Palette className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-tight">Theme appearance</span>
                    <span 
                      style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                      className="text-xs leading-normal"
                    >
                      {theme === 'default' ? 'Classic Casio ClassWiz hardware' : 'Qiqi icy cyan & purple palette'}
                    </span>
                  </div>
                </div>

                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="p-1 rounded-full flex items-center self-start sm:self-auto shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => onSetTheme('default')}
                    style={{
                      backgroundColor: theme === 'default' ? 'var(--ui-accent, #E5A93C)' : 'transparent',
                      color: theme === 'default' ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                  >
                    Classic
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTheme('qiqi')}
                    style={{
                      backgroundColor: theme === 'qiqi' ? 'var(--ui-accent, #E5A93C)' : 'transparent',
                      color: theme === 'qiqi' ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                  >
                    Qiqi
                  </button>
                </div>
              </div>
            )}

            {/* Row 3: Editor Behavior (Classic Casio vs Phone Edit) */}
            {onSetEditorMode && (
              <div className="min-h-[56px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <div 
                    style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <Smartphone className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-tight">Editor behavior</span>
                    <span 
                      style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                      className="text-xs leading-normal"
                    >
                      {editorMode === 'PHONE' ? 'Phone edit: tap to edit, live preview' : 'Classic Casio: clears on key after result'}
                    </span>
                  </div>
                </div>

                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="p-1 rounded-full flex items-center self-start sm:self-auto shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => onSetEditorMode('CLASSIC')}
                    style={{
                      backgroundColor: editorMode === 'CLASSIC' ? 'var(--ui-accent, #E5A93C)' : 'transparent',
                      color: editorMode === 'CLASSIC' ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                  >
                    Classic
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetEditorMode('PHONE')}
                    style={{
                      backgroundColor: editorMode === 'PHONE' ? 'var(--ui-accent, #E5A93C)' : 'transparent',
                      color: editorMode === 'PHONE' ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                  >
                    Phone
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GROUP 2: Math and Display Formatting */}
        <div className="space-y-2">
          <span 
            style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
            className="text-xs font-medium px-1 tracking-wide"
          >
            Calculation and display
          </span>

          <div 
            style={{ backgroundColor: 'var(--m3-surface-container, #1C1C24)' }}
            className="rounded-2xl p-4 space-y-4"
          >
            {/* Angle Unit: Degree / Radian / Gradian */}
            <div className="min-h-[56px] flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                >
                  <Compass className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">Angle unit</span>
                  <span 
                    style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                    className="text-xs leading-normal"
                  >
                    Trigonometric input and output mode
                  </span>
                </div>
              </div>

              <div 
                style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                className="p-1 rounded-full flex items-center w-full"
              >
                {(['DEG', 'RAD', 'GRA'] as AngleMode[]).map((mode) => {
                  const isActive = angleMode === mode;
                  const label = mode === 'DEG' ? 'Degree' : mode === 'RAD' ? 'Radian' : 'Gradian';
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSetAngleMode(mode)}
                      style={{
                        backgroundColor: isActive ? 'var(--ui-accent, #E5A93C)' : 'transparent',
                        color: isActive ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                      }}
                      className="flex-1 py-1.5 rounded-full text-xs font-semibold transition-all text-center active:scale-95"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display Notation Format: Norm1 / Norm2 / Fix / Sci */}
            <div className="min-h-[56px] flex flex-col gap-2.5 pt-3 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                >
                  <Binary className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">Display format</span>
                  <span 
                    style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                    className="text-xs leading-normal"
                  >
                    Numerical representation and precision
                  </span>
                </div>
              </div>

              <div 
                style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                className="p-1 rounded-full flex items-center w-full"
              >
                {(['NORM1', 'NORM2', 'FIX', 'SCI'] as DisplayFormat[]).map((fmt) => {
                  const isActive = displayFormat === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => onSetDisplayFormat(fmt)}
                      style={{
                        backgroundColor: isActive ? 'var(--ui-accent, #E5A93C)' : 'transparent',
                        color: isActive ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                      }}
                      className="flex-1 py-1.5 rounded-full text-xs font-semibold transition-all text-center active:scale-95"
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* GROUP 3: Tactile and Audio Feedback (Switches) */}
        <div className="space-y-2">
          <span 
            style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
            className="text-xs font-medium px-1 tracking-wide"
          >
            Feedback
          </span>

          <div 
            style={{ backgroundColor: 'var(--m3-surface-container, #1C1C24)' }}
            className="rounded-2xl divide-y divide-white/5"
          >
            {/* Haptic Switch Row */}
            <div 
              onClick={onToggleHaptic}
              className="min-h-[56px] px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors rounded-t-2xl"
            >
              <div className="flex items-center gap-3">
                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                >
                  <Smartphone className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">Haptic vibration</span>
                  <span 
                    style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                    className="text-xs leading-normal"
                  >
                    Tactile vibration on physical key presses
                  </span>
                </div>
              </div>

              {/* M3 Switch Component */}
              <button
                type="button"
                role="switch"
                aria-checked={hapticOn}
                aria-label="Toggle haptic vibration"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHaptic();
                }}
                style={{
                  backgroundColor: hapticOn ? 'var(--ui-accent, #E5A93C)' : 'var(--m3-surface-container-high, #262632)',
                }}
                className="w-13 h-7 rounded-full p-1 transition-colors relative flex items-center shrink-0 cursor-pointer"
              >
                <span 
                  style={{
                    backgroundColor: hapticOn ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                    transform: hapticOn ? 'translateX(24px)' : 'translateX(0px)',
                  }}
                  className="w-5 h-5 rounded-full transition-transform shadow-md inline-block"
                />
              </button>
            </div>

            {/* Key Clicks Switch Row */}
            <div 
              onClick={onToggleSound}
              className="min-h-[56px] px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors rounded-b-2xl"
            >
              <div className="flex items-center gap-3">
                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                >
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">Key clicks</span>
                  <span 
                    style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                    className="text-xs leading-normal"
                  >
                    Audio click sound for authentic feedback
                  </span>
                </div>
              </div>

              {/* M3 Switch Component */}
              <button
                type="button"
                role="switch"
                aria-checked={soundOn}
                aria-label="Toggle key click audio"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSound();
                }}
                style={{
                  backgroundColor: soundOn ? 'var(--ui-accent, #E5A93C)' : 'var(--m3-surface-container-high, #262632)',
                }}
                className="w-13 h-7 rounded-full p-1 transition-colors relative flex items-center shrink-0 cursor-pointer"
              >
                <span 
                  style={{
                    backgroundColor: soundOn ? 'var(--ui-accent-text, #171104)' : 'var(--m3-on-surface-variant, #94A3B8)',
                    transform: soundOn ? 'translateX(24px)' : 'translateX(0px)',
                  }}
                  className="w-5 h-5 rounded-full transition-transform shadow-md inline-block"
                />
              </button>
            </div>
          </div>
        </div>

        {/* GROUP 4: Advanced (At the bottom) */}
        <div className="space-y-2">
          <span 
            style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
            className="text-xs font-medium px-1 tracking-wide"
          >
            Advanced
          </span>

          <div 
            style={{ backgroundColor: 'var(--m3-surface-container, #1C1C24)' }}
            className="rounded-2xl divide-y divide-white/5"
          >
            {/* Row 1: Card Calibration */}
            <div 
              onClick={() => {
                onClose();
                onOpenCalibration();
              }}
              className="min-h-[56px] px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors rounded-t-2xl"
            >
              <div className="flex items-center gap-3">
                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                >
                  <Sliders className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">Card calibration</span>
                  <span 
                    style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                    className="text-xs leading-normal"
                  >
                    Match screen millimeters to a physical card
                  </span>
                </div>
              </div>
              <span 
                style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5"
              >
                Open
              </span>
            </div>

            {/* Row 2: Test Suite */}
            <div 
              onClick={() => {
                onClose();
                onOpenTestHarness();
              }}
              className="min-h-[56px] px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors rounded-b-2xl"
            >
              <div className="flex items-center gap-3">
                <div 
                  style={{ backgroundColor: 'var(--m3-surface-container-high, #262632)' }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                >
                  <CheckSquare className="w-5 h-5" style={{ color: 'var(--ui-accent, #E5A93C)' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">Test suite</span>
                  <span 
                    style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                    className="text-xs leading-normal"
                  >
                    Automated ground-truth verification harness
                  </span>
                </div>
              </div>
              <span 
                style={{ color: 'var(--m3-on-surface-variant, #94A3B8)' }}
                className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5"
              >
                ?test=1
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions: M3 Button Group */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset calculator memory and settings to defaults?')) {
                onResetCalculator();
              }
            }}
            style={{ 
              backgroundColor: 'var(--m3-surface-container, #1C1C24)',
              color: '#F87171',
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold transition-all hover:opacity-85 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset calculator</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{ 
              backgroundColor: 'var(--ui-accent, #E5A93C)',
              color: 'var(--ui-accent-text, #171104)',
            }}
            className="px-6 py-2.5 rounded-full text-xs font-semibold transition-all hover:opacity-90 active:scale-95 shadow-md"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
