import React, { useState, useMemo } from 'react';
import { X, Sparkles, TrendingUp, CornerDownLeft, Copy, Check, RefreshCw, Layers } from 'lucide-react';
import { 
  computeGeometricArea, computeDefiniteIntegral, computeAreaBetweenCurves,
  sampleFunctionCurve, AngleMode, CurvePoint 
} from '../calcEngine';
import { playKeyClick } from '../audioFeedback';

interface AreaCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  angleMode: AngleMode;
  onInsertExpression: (expr: string) => void;
  onInsertValue: (val: string) => void;
}

export const AreaCalculatorModal: React.FC<AreaCalculatorModalProps> = ({
  isOpen,
  onClose,
  angleMode,
  onInsertExpression,
  onInsertValue,
}) => {
  const [calcMode, setCalcMode] = useState<'GEOMETRIC' | 'NET' | 'BETWEEN'>('GEOMETRIC');
  const [fExpr, setFExpr] = useState('4 - x^2');
  const [f2Expr, setF2Expr] = useState('x');
  const [boundA, setBoundA] = useState('-2');
  const [boundB, setBoundB] = useState('2');
  const [copied, setCopied] = useState(false);

  // Common quick presets
  const presets = [
    { label: 'Parabola: 4 - x²', f: '4 - x^2', a: '-2', b: '2', mode: 'GEOMETRIC' as const },
    { label: 'Quadratic: x²', f: 'x^2', a: '0', b: '3', mode: 'GEOMETRIC' as const },
    { label: 'Sine wave: sin(x)', f: 'sin(x)', a: '0', b: '180', mode: 'GEOMETRIC' as const },
    { label: 'Between: x² & 4', f: 'x^2', f2: '4', a: '-2', b: '2', mode: 'BETWEEN' as const },
    { label: 'Between: 4 - x² & x', f: '4 - x^2', f2: 'x', a: '-1', b: '2', mode: 'BETWEEN' as const },
  ];

  const parsedA = useMemo(() => {
    if (boundA.trim() === 'π') return Math.PI;
    const num = parseFloat(boundA);
    return isNaN(num) ? 0 : num;
  }, [boundA]);

  const parsedB = useMemo(() => {
    if (boundB.trim() === 'π') return Math.PI;
    const num = parseFloat(boundB);
    return isNaN(num) ? 1 : num;
  }, [boundB]);

  // Compute calculated area values
  const results = useMemo(() => {
    try {
      const netVal = computeDefiniteIntegral(fExpr, parsedA, parsedB, angleMode);
      const geomVal = computeGeometricArea(fExpr, parsedA, parsedB, angleMode);
      const betweenVal = calcMode === 'BETWEEN' 
        ? computeAreaBetweenCurves(fExpr, f2Expr, parsedA, parsedB, angleMode) 
        : 0;

      return {
        net: isNaN(netVal) ? null : parseFloat(netVal.toFixed(6)),
        geometric: isNaN(geomVal) ? null : parseFloat(geomVal.toFixed(6)),
        between: isNaN(betweenVal) ? null : parseFloat(betweenVal.toFixed(6)),
        activeVal: calcMode === 'BETWEEN' 
          ? (isNaN(betweenVal) ? null : parseFloat(betweenVal.toFixed(6)))
          : calcMode === 'GEOMETRIC'
          ? (isNaN(geomVal) ? null : parseFloat(geomVal.toFixed(6)))
          : (isNaN(netVal) ? null : parseFloat(netVal.toFixed(6)))
      };
    } catch {
      return { net: null, geometric: null, between: null, activeVal: null };
    }
  }, [fExpr, f2Expr, parsedA, parsedB, calcMode, angleMode]);

  // Generate curve plot data
  const plotData = useMemo(() => {
    const minX = Math.min(parsedA, parsedB);
    const maxX = Math.max(parsedA, parsedB);
    const range = Math.max(0.1, maxX - minX);
    const viewMinX = minX - range * 0.25;
    const viewMaxX = maxX + range * 0.25;

    const points = sampleFunctionCurve(
      fExpr,
      calcMode === 'BETWEEN' ? f2Expr : null,
      viewMinX,
      viewMaxX,
      100,
      angleMode
    );

    let minY = 0;
    let maxY = 0;
    points.forEach((pt) => {
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
      if (pt.y2 !== undefined) {
        if (pt.y2 < minY) minY = pt.y2;
        if (pt.y2 > maxY) maxY = pt.y2;
      }
    });

    if (Math.abs(maxY - minY) < 1e-4) {
      maxY += 1;
      minY -= 1;
    }
    const yPad = (maxY - minY) * 0.2;
    minY -= yPad;
    maxY += yPad;

    return { points, viewMinX, viewMaxX, minY, maxY };
  }, [fExpr, f2Expr, parsedA, parsedB, calcMode, angleMode]);

  if (!isOpen) return null;

  // Convert real graph coordinates to SVG viewBox (width: 380, height: 200)
  const svgWidth = 380;
  const svgHeight = 200;
  const toSvgX = (x: number) => {
    return ((x - plotData.viewMinX) / (plotData.viewMaxX - plotData.viewMinX)) * svgWidth;
  };
  const toSvgY = (y: number) => {
    return svgHeight - ((y - plotData.minY) / (plotData.maxY - plotData.minY)) * svgHeight;
  };

  // Generate SVG path for f(x)
  const fPathD = plotData.points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(pt.x).toFixed(1)} ${toSvgY(pt.y).toFixed(1)}`)
    .join(' ');

  // Generate SVG path for f2(x) if active
  const f2PathD = calcMode === 'BETWEEN'
    ? plotData.points
        .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(pt.x).toFixed(1)} ${toSvgY(pt.y2 || 0).toFixed(1)}`)
        .join(' ')
    : '';

  // Shaded area polygon between a and b
  const boundedPoints = plotData.points.filter((pt) => {
    const minB = Math.min(parsedA, parsedB);
    const maxB = Math.max(parsedA, parsedB);
    return pt.x >= minB && pt.x <= maxB;
  });

  let shadedAreaPath = '';
  if (boundedPoints.length > 0) {
    if (calcMode === 'BETWEEN') {
      const topPts = boundedPoints.map((pt) => `${toSvgX(pt.x).toFixed(1)},${toSvgY(Math.max(pt.y, pt.y2 || 0)).toFixed(1)}`);
      const bottomPts = [...boundedPoints].reverse().map((pt) => `${toSvgX(pt.x).toFixed(1)},${toSvgY(Math.min(pt.y, pt.y2 || 0)).toFixed(1)}`);
      shadedAreaPath = `M ${topPts.join(' L ')} L ${bottomPts.join(' L ')} Z`;
    } else {
      const zeroY = toSvgY(0);
      const curvePts = boundedPoints.map((pt) => `${toSvgX(pt.x).toFixed(1)},${toSvgY(pt.y).toFixed(1)}`);
      const startX = toSvgX(boundedPoints[0].x);
      const endX = toSvgX(boundedPoints[boundedPoints.length - 1].x);
      shadedAreaPath = `M ${startX.toFixed(1)},${zeroY.toFixed(1)} L ${curvePts.join(' L ')} L ${endX.toFixed(1)},${zeroY.toFixed(1)} Z`;
    }
  }

  const handleCopy = () => {
    if (results.activeVal === null) return;
    playKeyClick('action');
    navigator.clipboard.writeText(`${results.activeVal}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleInsertExpr = () => {
    playKeyClick('action');
    if (calcMode === 'BETWEEN') {
      onInsertExpression(`Area(${fExpr}, ${f2Expr}, ${boundA}, ${boundB})`);
    } else if (calcMode === 'GEOMETRIC') {
      onInsertExpression(`Area(${fExpr}, ${boundA}, ${boundB})`);
    } else {
      onInsertExpression(`∫(${fExpr}, ${boundA}, ${boundB})`);
    }
    onClose();
  };

  const handleInsertVal = () => {
    playKeyClick('action');
    if (results.activeVal !== null) {
      onInsertValue(`${results.activeVal}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#111116] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 bg-[#16161D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold font-mono text-slate-100 flex items-center gap-2">
                Definite Integral & Area Calculator
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  ∫ |f(x)| dx
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Visual geometric area under curve & between functions
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playKeyClick('action');
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-2.5 bg-[#14141A] border-b border-slate-800 flex gap-1.5 text-xs font-mono">
          <button
            onClick={() => {
              playKeyClick('action');
              setCalcMode('GEOMETRIC');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
              calcMode === 'GEOMETRIC' 
                ? 'bg-amber-400 text-slate-950 shadow-md' 
                : 'bg-[#1C1C24] text-slate-300 hover:bg-[#252530]'
            }`}
          >
            <span>Geometric Area</span>
            <span className="text-[9px] opacity-75">∫|f|dx</span>
          </button>

          <button
            onClick={() => {
              playKeyClick('action');
              setCalcMode('NET');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
              calcMode === 'NET' 
                ? 'bg-emerald-400 text-slate-950 shadow-md' 
                : 'bg-[#1C1C24] text-slate-300 hover:bg-[#252530]'
            }`}
          >
            <span>Net Integral</span>
            <span className="text-[9px] opacity-75">∫fdx</span>
          </button>

          <button
            onClick={() => {
              playKeyClick('action');
              setCalcMode('BETWEEN');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
              calcMode === 'BETWEEN' 
                ? 'bg-cyan-400 text-slate-950 shadow-md' 
                : 'bg-[#1C1C24] text-slate-300 hover:bg-[#252530]'
            }`}
          >
            <span>Between Curves</span>
            <span className="text-[9px] opacity-75">∫|f-g|dx</span>
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
          
          {/* Interactive Visual Graph Canvas */}
          <div className="bg-[#0B0B0E] border border-slate-800 rounded-xl p-2.5 relative shadow-inner">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 bg-emerald-400 rounded-full inline-block"></span>
                <span>f(x) = {fExpr}</span>
                {calcMode === 'BETWEEN' && (
                  <>
                    <span className="w-2.5 h-1 bg-cyan-400 rounded-full inline-block ml-2"></span>
                    <span>g(x) = {f2Expr}</span>
                  </>
                )}
              </span>
              <span className="text-amber-400 font-bold">
                [{boundA}, {boundB}]
              </span>
            </div>

            {/* SVG Plot */}
            <div className="w-full h-44 bg-[#08080B] rounded-lg border border-slate-800/80 overflow-hidden relative">
              <svg 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                {/* Horizontal Zero Line (X-Axis) */}
                <line 
                  x1="0" 
                  y1={toSvgY(0)} 
                  x2={svgWidth} 
                  y2={toSvgY(0)} 
                  stroke="#334155" 
                  strokeWidth="1.2" 
                  strokeDasharray="3 3"
                />

                {/* Vertical Zero Line (Y-Axis) */}
                {plotData.viewMinX <= 0 && plotData.viewMaxX >= 0 && (
                  <line 
                    x1={toSvgX(0)} 
                    y1="0" 
                    x2={toSvgX(0)} 
                    y2={svgHeight} 
                    stroke="#334155" 
                    strokeWidth="1.2" 
                    strokeDasharray="3 3"
                  />
                )}

                {/* Shaded Area Polygon */}
                {shadedAreaPath && (
                  <path 
                    d={shadedAreaPath} 
                    fill="url(#areaGrad)" 
                    opacity="0.75"
                  />
                )}

                {/* Boundary Line a */}
                <line 
                  x1={toSvgX(parsedA)} 
                  y1="0" 
                  x2={toSvgX(parsedA)} 
                  y2={svgHeight} 
                  stroke="#F59E0B" 
                  strokeWidth="1.5" 
                  strokeDasharray="4 2"
                />

                {/* Boundary Line b */}
                <line 
                  x1={toSvgX(parsedB)} 
                  y1="0" 
                  x2={toSvgX(parsedB)} 
                  y2={svgHeight} 
                  stroke="#F59E0B" 
                  strokeWidth="1.5" 
                  strokeDasharray="4 2"
                />

                {/* Curve f(x) */}
                <path 
                  d={fPathD} 
                  fill="none" 
                  stroke="#10B981" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                />

                {/* Curve f2(x) if Between */}
                {calcMode === 'BETWEEN' && f2PathD && (
                  <path 
                    d={f2PathD} 
                    fill="none" 
                    stroke="#06B6D4" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                  />
                )}

                {/* Gradient Definition */}
                <defs>
                  <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Boundary Labels */}
              <div 
                className="absolute top-1 text-[9px] font-mono text-amber-400 bg-slate-900/90 px-1 py-0.5 rounded border border-amber-400/40"
                style={{ left: `${Math.min(90, Math.max(5, (toSvgX(parsedA) / svgWidth) * 100))}%` }}
              >
                a = {boundA}
              </div>
              <div 
                className="absolute bottom-1 text-[9px] font-mono text-amber-400 bg-slate-900/90 px-1 py-0.5 rounded border border-amber-400/40"
                style={{ left: `${Math.min(90, Math.max(5, (toSvgX(parsedB) / svgWidth) * 100))}%` }}
              >
                b = {boundB}
              </div>
            </div>
          </div>

          {/* Input Formula Fields */}
          <div className="space-y-2 bg-[#141419] p-3 rounded-xl border border-slate-800">
            {/* Function f(x) */}
            <div>
              <label className="text-[11px] font-mono text-emerald-400 font-semibold block mb-1">
                Function f(x):
              </label>
              <input
                type="text"
                value={fExpr}
                onChange={(e) => setFExpr(e.target.value)}
                placeholder="e.g. 4 - x^2 or sin(x)"
                className="w-full px-3 py-1.5 bg-[#0B0B0E] border border-slate-700 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Optional Function g(x) for between-curves */}
            {calcMode === 'BETWEEN' && (
              <div>
                <label className="text-[11px] font-mono text-cyan-400 font-semibold block mb-1">
                  Second Function g(x):
                </label>
                <input
                  type="text"
                  value={f2Expr}
                  onChange={(e) => setF2Expr(e.target.value)}
                  placeholder="e.g. x"
                  className="w-full px-3 py-1.5 bg-[#0B0B0E] border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}

            {/* Interval Bounds [a, b] */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Lower Limit (a):
                </label>
                <input
                  type="text"
                  value={boundA}
                  onChange={(e) => setBoundA(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0B0E] border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Upper Limit (b):
                </label>
                <input
                  type="text"
                  value={boundB}
                  onChange={(e) => setBoundB(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0B0E] border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-mono text-slate-400 block mb-1.5">
              Quick Calculation Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    playKeyClick('action');
                    setFExpr(p.f);
                    if (p.f2) setF2Expr(p.f2);
                    setBoundA(p.a);
                    setBoundB(p.b);
                    setCalcMode(p.mode);
                  }}
                  className="px-2.5 py-1 rounded bg-[#1C1C24] hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="bg-[#14141D] border border-amber-400/30 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-400">
                {calcMode === 'GEOMETRIC' 
                  ? 'Total Geometric Area (Units²)' 
                  : calcMode === 'NET' 
                  ? 'Net Definite Integral' 
                  : 'Bounded Area Between Curves'}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="text-2xl sm:text-3xl font-mono font-bold text-slate-100 lcd-dot-text tracking-tight">
              = {results.activeVal !== null ? results.activeVal : 'Math ERROR'}
            </div>

            {/* Comparison detail */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800 text-slate-400">
              <div>
                <span>Net Integral: </span>
                <span className="text-emerald-300 font-semibold">{results.net ?? 'N/A'}</span>
              </div>
              <div>
                <span>Geometric Area: </span>
                <span className="text-amber-300 font-semibold">{results.geometric ?? 'N/A'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-[#0D0D11] border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* Insert Formula into calculator */}
            <button
              onClick={handleInsertExpr}
              className="px-3 py-1.5 rounded-lg bg-[#22222E] hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-mono text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <CornerDownLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>Insert Formula</span>
            </button>

            {/* Insert Value into calculator */}
            <button
              onClick={handleInsertVal}
              className="px-3 py-1.5 rounded-lg bg-[#22222E] hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-mono text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <CornerDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Insert Value</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold text-xs shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
