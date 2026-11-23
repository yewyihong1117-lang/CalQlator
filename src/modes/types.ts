/**
 * fx-570EX ClassWiz Mode System - Type Definitions
 * 
 * Defines the contract for all 12 calculator operating modes:
 * CALC, CMPLX, BASE, MATRIX, VECTOR, STAT, DIST, SHEET, TABLE, EQN, INEQ, RATIO.
 * 
 * Each mode module provides:
 * 1. Mode identifier & metadata
 * 2. Status-bar indicator
 * 3. Keymap override table (pure data)
 * 4. Display renderer (inside LCD display, zero external chrome)
 * 5. Input handling logic
 * 6. Persisted data
 */

import React from 'react';

export type CalculatorModeId = 
  | 'CALC'
  | 'CMPLX'
  | 'BASE'
  | 'MATRIX'
  | 'VECTOR'
  | 'STAT'
  | 'DIST'
  | 'SHEET'
  | 'TABLE'
  | 'EQN'
  | 'INEQ'
  | 'RATIO';

export interface SubMenuItem {
  id: number;
  key: string;
  name: string;
  action: (ctx: ModeContext) => void;
}

export interface SubMenuPage {
  title?: string;
  items: SubMenuItem[];
}

export interface KeymapAction {
  label?: string; // Alternate key label shown in this mode
  description?: string;
  action: (ctx: ModeContext) => void;
}

export interface ModeKeymap {
  /**
   * Keys overridden in this mode.
   * Unlisted keys fall through to the default CALC behavior.
   */
  overrides: Record<string, KeymapAction>;
}

export interface ModeState {
  mode: CalculatorModeId;
  screen: string; // e.g. 'MAIN', 'SUBMENU', 'DATA', 'RESULT', etc.
  data: Record<string, any>;
}

export interface SharedMemory {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
  X: number;
  Y: number;
  M: number;
  Ans: number;
}

export interface ModeContext {
  // Current mode state
  modeState: ModeState;
  setModeState: React.Dispatch<React.SetStateAction<ModeState>>;
  
  // Shared persistent memory across modes
  sharedMemory: SharedMemory;
  setSharedMemory: React.Dispatch<React.SetStateAction<SharedMemory>>;

  // Common UI actions
  exitToCalc: () => void;
  openSubMenu: (page?: number) => void;
  closeSubMenu: () => void;
  
  // Feedback
  triggerHapticFeedback: (type?: string) => void;
  playAudioFeedback: (type?: string) => void;
  
  // Display helpers
  angleMode: 'DEG' | 'RAD' | 'GRA';
  displayFormat: 'NORM1' | 'NORM2' | 'FIX' | 'SCI';
  fixDigits?: number;
  sciDigits?: number;
}

export interface ModeModule {
  id: CalculatorModeId;
  code: string; // Hardware menu code
  name: string; // Long title, e.g. "Calculate", "Base-N"
  shortName: string;
  menuNumber: number; // 1..12
  isImplemented: boolean;
  
  /**
   * Status-bar indicator string (e.g. '', 'i', 'DEC', 'MAT', 'VCT', 'STAT', etc.)
   */
  getIndicator: (state: ModeState) => string;
  
  /**
   * Keymap override table. Keys not listed here fall through to CALC behavior.
   */
  keymap: ModeKeymap;

  /**
   * Initial mode state when switched into
   */
  getInitialState: () => ModeState;

  /**
   * Handle physical key press.
   * Returns true if handled by keymap or custom input logic, false to fall through to CALC.
   */
  handleKey: (key: string, ctx: ModeContext) => boolean;

  /**
   * Sub-menu pages for OPTN / SHIFT+number shortcuts
   */
  getSubMenu?: (state: ModeState) => SubMenuPage[] | null;

  /**
   * Render inside the LCD display
   */
  renderDisplay: (ctx: ModeContext) => React.ReactNode;
}
