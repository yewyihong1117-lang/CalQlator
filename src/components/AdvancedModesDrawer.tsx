import React, { useState } from 'react';
import { 
  X, BarChart3, Grid3X3, ArrowRightLeft, 
  Binary, Atom, History, Calculator, Check, Plus, Trash2, TrendingUp, CornerDownLeft
} from 'lucide-react';
import { 
  calculateStatistics, 
  matrixDet, matrixInverse, matrixTranspose, matrixMultiply,
  vectorDot, vectorCross, vectorMag,
  solveQuadratic, solveSimultaneous2,
  computeGeometricArea, computeDefiniteIntegral, computeAreaBetweenCurves,
  SCIENTIFIC_CONSTANTS, METRIC_CONVERSIONS,
  HistoryItem
} from '../calcEngine';
import { playKeyClick } from '../audioFeedback';

export type ModeTab = 'STAT' | 'MATRIX' | 'VECTOR' | 'EQUATION' | 'BASE' | 'CONST' | 'CONV' | 'HISTORY' | 'AREA';

interface AdvancedModesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ModeTab;
  setActiveTab: (tab: ModeTab) => void;
  onInsertValue: (val: string) => void;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

export const AdvancedModesDrawer: React.FC<AdvancedModesDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onInsertValue,
  history,
  onSelectHistory,
  onClearHistory,
}) => {
  // Statistics State
  const [statXInput, setStatXInput] = useState('12, 15, 18, 22, 25, 30');
  const [statYInput, setStatYInput] = useState('5, 8, 11, 14, 18, 21');
  const [useTwoVar, setUseTwoVar] = useState(false);

  // Matrix State
  const [matDim, setMatDim] = useState<2 | 3>(2);
  const [matA, setMatA] = useState<number[][]>([
    [1, 2],
    [3, 4],
  ]);
  const [matB, setMatB] = useState<number[][]>([
    [2, 0],
    [1, 2],
  ]);
  const [matrixResult, setMatrixResult] = useState<string | null>(null);

  // Vector State
  const [vctDim, setVctDim] = useState<2 | 3>(3);
  const [vctA, setVctA] = useState<number[]>([1, 2, 3]);
  const [vctB, setVctB] = useState<number[]>([4, 5, 6]);
  const [vectorResult, setVectorResult] = useState<string | null>(null);

  // Equation State
  const [eqType, setEqType] = useState<'quad' | 'sim2'>('quad');
  const [quadA, setQuadA] = useState('1');
  const [quadB, setQuadB] = useState('-5');
  const [quadC, setQuadC] = useState('6');
  const [simA1, setSimA1] = useState('2');
  const [simB1, setSimB1] = useState('3');
  const [simC1, setSimC1] = useState('8');
  const [simA2, setSimA2] = useState('5');
  const [simB2, setSimB2] = useState('-1');
  const [simC2, setSimC2] = useState('3');
  const [eqResult, setEqResult] = useState<{ x1: string; x2: string; extra?: string } | null>(null);

  // Base-N State
  const [baseVal, setBaseVal] = useState('255');
  const [baseType, setBaseType] = useState<'DEC' | 'HEX' | 'BIN' | 'OCT'>('DEC');

  // Search filter for constants/conv
  const [constSearch, setConstSearch] = useState('');
  const [convInputVal, setConvInputVal] = useState('100');

  // Area & Definite Integral State
  const [areaF, setAreaF] = useState('4 - x^2');
  const [areaA, setAreaA] = useState('-2');
  const [areaB, setAreaB] = useState('2');

  if (!isOpen) return null;

  // Compute Statistics
  const parsedX = statXInput.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
  const parsedY = statYInput.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
  const statRes = calculateStatistics(parsedX, useTwoVar ? parsedY : undefined);

  // Update Matrix Dimension
  const handleDimChange = (dim: 2 | 3) => {
    setMatDim(dim);
    if (dim === 2) {
      setMatA([[1, 2], [3, 4]]);
      setMatB([[2, 0], [1, 2]]);
    } else {
      setMatA([[1, 2, 3], [0, 1, 4], [5, 6, 0]]);
      setMatB([[2, 1, 0], [1, 3, 2], [0, 1, 1]]);
    }
    setMatrixResult(null);
  };

  // Compute Area in Drawer
  const numAreaA = parseFloat(areaA) || 0;
  const numAreaB = parseFloat(areaB) || 1;
  const drawerGeomArea = computeGeometricArea(areaF, numAreaA, numAreaB, 'DEG');
  const drawerNetIntegral = computeDefiniteIntegral(areaF, numAreaA, numAreaB, 'DEG');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--bg)]">
      <div 
        className="w-full max-w-lg h-[86vh] sm:h-[80vh] bg-[var(--m3-surface)] border border-[var(--m3-outline-variant)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--m3-on-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#16161D]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="font-sans text-sm tracking-wide font-semibold text-slate-100 uppercase">
              fx-570 Advanced Modes
            </span>
          </div>
          <button 
            onClick={() => {
              playKeyClick('action');
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0F0F14] border-b border-slate-800/80 overflow-x-auto text-xs no-scrollbar">
          {[
            { id: 'AREA', label: 'AREA / INT', icon: TrendingUp },
            { id: 'STAT', label: 'STAT', icon: BarChart3 },
            { id: 'MATRIX', label: 'MATRIX', icon: Grid3X3 },
            { id: 'VECTOR', label: 'VECTOR', icon: ArrowRightLeft },
            { id: 'EQUATION', label: 'EQN', icon: Calculator },
            { id: 'BASE', label: 'BASE-N', icon: Binary },
            { id: 'CONST', label: 'CONST', icon: Atom },
            { id: 'CONV', label: 'CONV', icon: ArrowRightLeft },
            { id: 'HISTORY', label: 'HISTORY', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  playKeyClick('func');
                  setActiveTab(tab.id as ModeTab);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans whitespace-nowrap ${
                  isActive 
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20' 
                    : 'bg-[#181820] text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* DEFINITE INTEGRAL & AREA CALCULATOR MODE */}
          {activeTab === 'AREA' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    Definite Integral & Area Calculator
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800">
                      ∫ |f(x)| dx
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Calculates geometric area between curve and axis or between curves.</p>
                </div>
              </div>

              <div className="bg-[#0B0B0E] p-3 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <label className="text-xs font-sans text-emerald-400 font-semibold block mb-1">
                    Function f(x):
                  </label>
                  <input
                    type="text"
                    value={areaF}
                    onChange={(e) => setAreaF(e.target.value)}
                    placeholder="e.g. 4 - x^2 or sin(x)"
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded font-sans text-xs text-emerald-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-sans text-slate-400 block mb-1">
                      Lower Bound (a):
                    </label>
                    <input
                      type="text"
                      value={areaA}
                      onChange={(e) => setAreaA(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded font-sans text-xs text-amber-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-sans text-slate-400 block mb-1">
                      Upper Bound (b):
                    </label>
                    <input
                      type="text"
                      value={areaB}
                      onChange={(e) => setAreaB(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded font-sans text-xs text-amber-300"
                    />
                  </div>
                </div>

                {/* Results Card */}
                <div className="bg-[#14141E] p-3 rounded-xl border border-amber-400/30 space-y-2 mt-2">
                  <div className="flex justify-between items-center text-xs font-sans">
                    <span className="text-amber-400 font-bold">Total Geometric Area:</span>
                    <span className="text-lg font-bold text-slate-100">
                      {isNaN(drawerGeomArea) ? 'Math ERROR' : drawerGeomArea.toFixed(5)} units²
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-sans text-slate-400 border-t border-slate-800 pt-1.5">
                    <span>Net Definite Integral:</span>
                    <span className="text-emerald-400 font-semibold">
                      {isNaN(drawerNetIntegral) ? 'Math ERROR' : drawerNetIntegral.toFixed(5)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      playKeyClick('action');
                      onInsertValue(`Area(${areaF}, ${areaA}, ${areaB})`);
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-sans font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    <span>Insert Area Formula</span>
                  </button>

                  <button
                    onClick={() => {
                      playKeyClick('action');
                      if (!isNaN(drawerGeomArea)) {
                        onInsertValue(drawerGeomArea.toFixed(5));
                      }
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-sans font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Insert Area Result</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STATISTICS MODE */}
          {activeTab === 'STAT' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">1-VAR & 2-VAR Statistics</h3>
                  <p className="text-xs text-slate-400">Calculates mean, variance, sample std dev, and linear regression.</p>
                </div>
                <button
                  onClick={() => setUseTwoVar(!useTwoVar)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                    useTwoVar 
                      ? 'border-magenta-500 bg-magenta-500/10 text-magenta-300' 
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                  style={{ color: useTwoVar ? '#E056FD' : undefined }}
                >
                  {useTwoVar ? '2-Variable (X, Y)' : '1-Variable (X)'}
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-sans">Dataset X (separated by space or comma):</label>
                <textarea
                  value={statXInput}
                  onChange={(e) => setStatXInput(e.target.value)}
                  rows={2}
                  className="w-full mt-1 p-2 bg-[#0B0B0E] border border-slate-700 rounded-lg text-sm font-sans text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              {useTwoVar && (
                <div>
                  <label className="text-xs text-slate-400 font-sans">Dataset Y (corresponding items):</label>
                  <textarea
                    value={statYInput}
                    onChange={(e) => setStatYInput(e.target.value)}
                    rows={2}
                    className="w-full mt-1 p-2 bg-[#0B0B0E] border border-slate-700 rounded-lg text-sm font-sans text-pink-300 focus:outline-none focus:border-pink-400"
                  />
                </div>
              )}

              {statRes && (
                <div className="bg-[#0B0B0E] p-3 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs font-sans text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                    Results Telemetry
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-sans">
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-400 block">Sample Size (n)</span>
                      <span className="text-base text-slate-100 font-bold">{statRes.n}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-400 block">Mean (x̄)</span>
                      <span className="text-base text-amber-300 font-bold">{statRes.meanX.toFixed(4)}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-400 block">Sample SD (sx)</span>
                      <span className="text-base text-slate-100 font-bold">{statRes.sX.toFixed(4)}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-400 block">Pop SD (σx)</span>
                      <span className="text-base text-slate-100 font-bold">{statRes.sigmaX.toFixed(4)}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-400 block">Sum (∑x)</span>
                      <span className="text-base text-slate-100 font-bold">{statRes.sumX.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-400 block">Median</span>
                      <span className="text-base text-slate-100 font-bold">{statRes.medianX}</span>
                    </div>
                  </div>

                  {statRes.regression && (
                    <div className="mt-3 pt-2 border-t border-slate-800 space-y-1 text-xs font-sans">
                      <span className="text-pink-400 block font-semibold">Linear Regression (y = a + bx)</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                          <span className="text-slate-400 block">Intercept (a)</span>
                          <span className="text-slate-100 font-bold">{statRes.regression.a.toFixed(4)}</span>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                          <span className="text-slate-400 block">Slope (b)</span>
                          <span className="text-slate-100 font-bold">{statRes.regression.b.toFixed(4)}</span>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                          <span className="text-slate-400 block">Correlation (r)</span>
                          <span className="text-amber-300 font-bold">{statRes.regression.r.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => {
                        playKeyClick('action');
                        onInsertValue(statRes.meanX.toString());
                        onClose();
                      }}
                      className="flex-1 py-1.5 px-3 bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-300"
                    >
                      Insert Mean into Calculator
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MATRIX MODE */}
          {activeTab === 'MATRIX' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Matrix Operations</h3>
                  <p className="text-xs text-slate-400">Determinant, Inversion, Transpose, and Multiplication.</p>
                </div>
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-xs font-sans">
                  <button 
                    onClick={() => handleDimChange(2)}
                    className={`px-2 py-1 rounded ${matDim === 2 ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'}`}
                  >
                    2×2
                  </button>
                  <button 
                    onClick={() => handleDimChange(3)}
                    className={`px-2 py-1 rounded ${matDim === 3 ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'}`}
                  >
                    3×3
                  </button>
                </div>
              </div>

              {/* MatA & MatB Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0B0B0E] p-3 rounded-xl border border-slate-800">
                  <span className="text-xs font-sans text-amber-300 font-semibold block mb-2">Matrix A</span>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${matDim}, minmax(0, 1fr))` }}>
                    {matA.map((row, r) =>
                      row.map((val, c) => (
                        <input
                          key={`a-${r}-${c}`}
                          type="number"
                          value={val}
                          onChange={(e) => {
                            const newMat = matA.map(rArr => [...rArr]);
                            newMat[r][c] = parseFloat(e.target.value) || 0;
                            setMatA(newMat);
                          }}
                          className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-center font-sans text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-[#0B0B0E] p-3 rounded-xl border border-slate-800">
                  <span className="text-xs font-sans text-pink-300 font-semibold block mb-2">Matrix B</span>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${matDim}, minmax(0, 1fr))` }}>
                    {matB.map((row, r) =>
                      row.map((val, c) => (
                        <input
                          key={`b-${r}-${c}`}
                          type="number"
                          value={val}
                          onChange={(e) => {
                            const newMat = matB.map(rArr => [...rArr]);
                            newMat[r][c] = parseFloat(e.target.value) || 0;
                            setMatB(newMat);
                          }}
                          className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-center font-sans text-sm text-slate-100 focus:outline-none focus:border-pink-400"
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Matrix Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    playKeyClick('action');
                    const d = matrixDet(matA);
                    setMatrixResult(`det(MatA) = ${parseFloat(d.toFixed(6))}`);
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-sans rounded-lg border border-slate-700 transition-colors"
                >
                  det(MatA)
                </button>
                <button
                  onClick={() => {
                    playKeyClick('action');
                    const inv = matrixInverse(matA);
                    if (!inv) {
                      setMatrixResult('MatA has no inverse (det = 0)');
                    } else {
                      const str = inv.map(r => `[ ${r.map(v => parseFloat(v.toFixed(3))).join(', ')} ]`).join('\n');
                      setMatrixResult(`MatA⁻¹ =\n${str}`);
                    }
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-sans rounded-lg border border-slate-700 transition-colors"
                >
                  MatA⁻¹
                </button>
                <button
                  onClick={() => {
                    playKeyClick('action');
                    const tr = matrixTranspose(matA);
                    const str = tr.map(r => `[ ${r.join(', ')} ]`).join('\n');
                    setMatrixResult(`MatAᵀ =\n${str}`);
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-sans rounded-lg border border-slate-700 transition-colors"
                >
                  MatAᵀ
                </button>
                <button
                  onClick={() => {
                    playKeyClick('action');
                    const mul = matrixMultiply(matA, matB);
                    if (!mul) {
                      setMatrixResult('Multiplication dimension error');
                    } else {
                      const str = mul.map(r => `[ ${r.join(', ')} ]`).join('\n');
                      setMatrixResult(`MatA × MatB =\n${str}`);
                    }
                  }}
                  className="py-2 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-sans rounded-lg transition-colors"
                >
                  MatA × MatB
                </button>
              </div>

              {matrixResult && (
                <div className="bg-[#0B0B0E] p-3 rounded-xl border border-slate-800">
                  <pre className="text-xs font-sans text-emerald-400 whitespace-pre-wrap">{matrixResult}</pre>
                </div>
              )}
            </div>
          )}

          {/* VECTOR MODE */}
          {activeTab === 'VECTOR' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Vector Operations</h3>
                  <p className="text-xs text-slate-400">Dot Product, Cross Product, and Magnitude.</p>
                </div>
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-xs font-sans">
                  <button 
                    onClick={() => {
                      setVctDim(2);
                      setVctA([1, 2]);
                      setVctB([3, 4]);
                      setVectorResult(null);
                    }}
                    className={`px-2 py-1 rounded ${vctDim === 2 ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'}`}
                  >
                    2D
                  </button>
                  <button 
                    onClick={() => {
                      setVctDim(3);
                      setVctA([1, 2, 3]);
                      setVctB([4, 5, 6]);
                      setVectorResult(null);
                    }}
                    className={`px-2 py-1 rounded ${vctDim === 3 ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'}`}
                  >
                    3D
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0B0B0E] p-3 rounded-xl border border-slate-800">
                  <span className="text-xs font-sans text-amber-300 font-semibold block mb-2">Vector A (u)</span>
                  <div className="flex gap-2">
                    {vctA.map((v, i) => (
                      <input
                        key={`vctA-${i}`}
                        type="number"
                        value={v}
                        onChange={(e) => {
                          const n = [...vctA];
                          n[i] = parseFloat(e.target.value) || 0;
                          setVctA(n);
                        }}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-center font-sans text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                        placeholder={['x', 'y', 'z'][i]}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-[#0B0B0E] p-3 rounded-xl border border-slate-800">
                  <span className="text-xs font-sans text-pink-300 font-semibold block mb-2">Vector B (v)</span>
                  <div className="flex gap-2">
                    {vctB.map((v, i) => (
                      <input
                        key={`vctB-${i}`}
                        type="number"
                        value={v}
                        onChange={(e) => {
                          const n = [...vctB];
                          n[i] = parseFloat(e.target.value) || 0;
                          setVctB(n);
                        }}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-center font-sans text-sm text-slate-100 focus:outline-none focus:border-pink-400"
                        placeholder={['x', 'y', 'z'][i]}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    playKeyClick('action');
                    const dot = vectorDot(vctA, vctB);
                    setVectorResult(`VctA · VctB = ${dot}`);
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-sans rounded-lg border border-slate-700 transition-colors"
                >
                  Dot Product (·)
                </button>
                <button
                  onClick={() => {
                    playKeyClick('action');
                    if (vctDim === 3) {
                      const cr = vectorCross(vctA, vctB);
                      setVectorResult(`VctA × VctB = [ ${cr.join(', ')} ]`);
                    } else {
                      const cross2d = vctA[0] * vctB[1] - vctA[1] * vctB[0];
                      setVectorResult(`Cross determinant (k) = ${cross2d}`);
                    }
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-sans rounded-lg border border-slate-700 transition-colors"
                >
                  Cross Product (×)
                </button>
                <button
                  onClick={() => {
                    playKeyClick('action');
                    const magA = vectorMag(vctA);
                    const magB = vectorMag(vctB);
                    setVectorResult(`|VctA| = ${magA.toFixed(4)}\n|VctB| = ${magB.toFixed(4)}`);
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-sans rounded-lg border border-slate-700 transition-colors"
                >
                  Magnitudes (|v|)
                </button>
              </div>

              {vectorResult && (
                <div className="bg-[#0B0B0E] p-3 rounded-xl border border-slate-800">
                  <pre className="text-xs font-sans text-emerald-400 whitespace-pre-wrap">{vectorResult}</pre>
                </div>
              )}
            </div>
          )}

          {/* EQUATION SOLVER MODE */}
          {activeTab === 'EQUATION' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Equation Solver</h3>
                  <p className="text-xs text-slate-400">Quadratic & 2-Variable Simultaneous systems.</p>
                </div>
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-xs font-sans">
                  <button 
                    onClick={() => { setEqType('quad'); setEqResult(null); }}
                    className={`px-2 py-1 rounded ${eqType === 'quad' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'}`}
                  >
                    ax² + bx + c = 0
                  </button>
                  <button 
                    onClick={() => { setEqType('sim2'); setEqResult(null); }}
                    className={`px-2 py-1 rounded ${eqType === 'sim2' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'}`}
                  >
                    2 Unknowns
                  </button>
                </div>
              </div>

              {eqType === 'quad' ? (
                <div className="bg-[#0B0B0E] p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-sans text-slate-400 block">Enter coefficients: ax² + bx + c = 0</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block font-sans">a</label>
                      <input
                        type="number"
                        value={quadA}
                        onChange={(e) => setQuadA(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-center font-sans text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block font-sans">b</label>
                      <input
                        type="number"
                        value={quadB}
                        onChange={(e) => setQuadB(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-center font-sans text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block font-sans">c</label>
                      <input
                        type="number"
                        value={quadC}
                        onChange={(e) => setQuadC(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-center font-sans text-sm text-slate-100"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      playKeyClick('equal');
                      const res = solveQuadratic(parseFloat(quadA) || 0, parseFloat(quadB) || 0, parseFloat(quadC) || 0);
                      setEqResult({ x1: res.x1, x2: res.x2, extra: res.minMax });
                    }}
                    className="w-full py-2 bg-amber-400 text-slate-950 font-bold text-xs rounded-lg hover:bg-amber-300 transition-colors"
                  >
                    Solve Quadratic
                  </button>
                </div>
              ) : (
                <div className="bg-[#0B0B0E] p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-sans text-slate-400 block">System: a₁x + b₁y = c₁ & a₂x + b₂y = c₂</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={simA1}
                      onChange={(e) => setSimA1(e.target.value)}
                      placeholder="a1"
                      className="p-1.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-sans"
                    />
                    <input
                      type="number"
                      value={simB1}
                      onChange={(e) => setSimB1(e.target.value)}
                      placeholder="b1"
                      className="p-1.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-sans"
                    />
                    <input
                      type="number"
                      value={simC1}
                      onChange={(e) => setSimC1(e.target.value)}
                      placeholder="c1"
                      className="p-1.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-sans"
                    />

                    <input
                      type="number"
                      value={simA2}
                      onChange={(e) => setSimA2(e.target.value)}
                      placeholder="a2"
                      className="p-1.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-sans"
                    />
                    <input
                      type="number"
                      value={simB2}
                      onChange={(e) => setSimB2(e.target.value)}
                      placeholder="b2"
                      className="p-1.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-sans"
                    />
                    <input
                      type="number"
                      value={simC2}
                      onChange={(e) => setSimC2(e.target.value)}
                      placeholder="c2"
                      className="p-1.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-sans"
                    />
                  </div>
                  <button
                    onClick={() => {
                      playKeyClick('equal');
                      const res = solveSimultaneous2(
                        parseFloat(simA1) || 0,
                        parseFloat(simB1) || 0,
                        parseFloat(simC1) || 0,
                        parseFloat(simA2) || 0,
                        parseFloat(simB2) || 0,
                        parseFloat(simC2) || 0
                      );
                      if (res) {
                        setEqResult({ x1: `x = ${parseFloat(res.x.toFixed(6))}`, x2: `y = ${parseFloat(res.y.toFixed(6))}` });
                      } else {
                        setEqResult({ x1: 'No unique solution', x2: 'Determinant is zero' });
                      }
                    }}
                    className="w-full py-2 bg-amber-400 text-slate-950 font-bold text-xs rounded-lg hover:bg-amber-300 transition-colors"
                  >
                    Solve System
                  </button>
                </div>
              )}

              {eqResult && (
                <div className="bg-[#0B0B0E] p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs font-sans text-slate-400 block border-b border-slate-800 pb-1">Roots / Solution:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                    <div className="bg-slate-900 p-2 rounded">
                      <span className="text-slate-400 block">Root 1</span>
                      <span className="text-amber-300 font-bold text-sm">{eqResult.x1}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded">
                      <span className="text-slate-400 block">Root 2</span>
                      <span className="text-amber-300 font-bold text-sm">{eqResult.x2}</span>
                    </div>
                  </div>
                  {eqResult.extra && (
                    <div className="text-xs font-sans text-slate-300 pt-1">{eqResult.extra}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BASE-N MODE */}
          {activeTab === 'BASE' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Base-N Computer Math</h3>
                <p className="text-xs text-slate-400">Dec, Hex, Bin, and Oct conversions with bitwise representation.</p>
              </div>

              <div className="bg-[#0B0B0E] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex gap-1.5">
                  {(['DEC', 'HEX', 'BIN', 'OCT'] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => {
                        playKeyClick('func');
                        setBaseType(b);
                      }}
                      className={`flex-1 py-1 text-xs font-sans rounded ${
                        baseType === b ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={baseVal}
                  onChange={(e) => setBaseVal(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-base font-sans text-amber-300 focus:outline-none focus:border-amber-400"
                  placeholder="Enter integer..."
                />

                {(() => {
                  let intVal = 0;
                  try {
                    if (baseType === 'DEC') intVal = parseInt(baseVal, 10);
                    else if (baseType === 'HEX') intVal = parseInt(baseVal, 16);
                    else if (baseType === 'BIN') intVal = parseInt(baseVal, 2);
                    else if (baseType === 'OCT') intVal = parseInt(baseVal, 8);
                  } catch {
                    intVal = 0;
                  }

                  if (isNaN(intVal)) return <div className="text-xs text-red-400 font-sans">Invalid number for {baseType}</div>;

                  return (
                    <div className="space-y-2 pt-2 border-t border-slate-800 text-xs font-sans">
                      <div className="flex justify-between items-center p-2 bg-slate-900/60 rounded">
                        <span className="text-slate-400">DEC:</span>
                        <span className="text-amber-300 font-bold">{intVal.toString(10)}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-900/60 rounded">
                        <span className="text-slate-400">HEX:</span>
                        <span className="text-pink-300 font-bold uppercase">{intVal.toString(16)}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-900/60 rounded">
                        <span className="text-slate-400">BIN:</span>
                        <span className="text-emerald-400 font-bold tracking-wider">{intVal.toString(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-900/60 rounded">
                        <span className="text-slate-400">OCT:</span>
                        <span className="text-cyan-300 font-bold">{intVal.toString(8)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* CONSTANTS LIBRARY */}
          {activeTab === 'CONST' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">fx-570 Scientific Constants</h3>
                  <p className="text-xs text-slate-400">Standard 40 scientific physical constants.</p>
                </div>
              </div>
              <input
                type="text"
                placeholder="Search constant (e.g. c, h, electron, planck)..."
                value={constSearch}
                onChange={(e) => setConstSearch(e.target.value)}
                className="w-full p-2 bg-[#0B0B0E] border border-slate-700 rounded-lg text-xs font-sans text-slate-200"
              />
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {SCIENTIFIC_CONSTANTS.filter(c => 
                  c.name.toLowerCase().includes(constSearch.toLowerCase()) || 
                  c.sym.toLowerCase().includes(constSearch.toLowerCase())
                ).map((c) => (
                  <div
                    key={c.code}
                    onClick={() => {
                      playKeyClick('action');
                      onInsertValue(c.val.toString());
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 bg-[#0B0B0E] hover:bg-slate-800/80 border border-slate-800 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-sans text-amber-400 font-bold">{c.sym}</span>
                        <span className="text-xs text-slate-200">{c.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-sans">Code [{c.code}] · {c.unit}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-sans text-slate-300">{c.val.toExponential(4)}</span>
                      <span className="block text-[10px] text-amber-400/80 font-sans">Tap to insert</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UNIT CONVERSIONS */}
          {activeTab === 'CONV' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Metric & Imperial Conversions</h3>
                <p className="text-xs text-slate-400">Exact formula conversions per Casio fx-570 library.</p>
              </div>
              <div className="flex gap-2 items-center bg-[#0B0B0E] p-2 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 font-sans">Input Value:</span>
                <input
                  type="number"
                  value={convInputVal}
                  onChange={(e) => setConvInputVal(e.target.value)}
                  className="flex-1 p-1 bg-slate-900 border border-slate-700 rounded font-sans text-xs text-amber-300"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                {METRIC_CONVERSIONS.map((conv) => {
                  const inputNum = parseFloat(convInputVal) || 0;
                  const res = conv.fn(inputNum);
                  return (
                    <div
                      key={conv.code}
                      onClick={() => {
                        playKeyClick('action');
                        onInsertValue(parseFloat(res.toFixed(6)).toString());
                        onClose();
                      }}
                      className="p-2.5 bg-[#0B0B0E] hover:bg-slate-800/80 border border-slate-800 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-center text-xs font-sans">
                        <span className="text-slate-400">[{conv.code}] {conv.name}</span>
                        <span className="text-amber-400 font-bold">{parseFloat(res.toFixed(5))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CALCULATION HISTORY TAPE */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Calculation Tape</h3>
                  <p className="text-xs text-slate-400">Previous calculation tape with expression recall.</p>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      playKeyClick('action');
                      onClearHistory();
                    }}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 font-sans">
                  No calculations recorded yet. Use the calculator to populate history.
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        playKeyClick('action');
                        onSelectHistory(item);
                        onClose();
                      }}
                      className="p-3 bg-[#0B0B0E] hover:bg-slate-800/80 border border-slate-800 rounded-xl cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center justify-between text-xs font-sans text-slate-400">
                        <span className="truncate max-w-[200px]">{item.expression}</span>
                        <span className="text-[10px] text-slate-600">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="mt-1 text-right text-base font-sans font-bold text-emerald-400 group-hover:text-amber-400 transition-colors">
                        = {item.result}
                      </div>
                      {item.exactResult && item.exactResult !== item.result && (
                        <div className="text-right text-xs font-sans text-slate-400">
                          Standard form: {item.exactResult}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
