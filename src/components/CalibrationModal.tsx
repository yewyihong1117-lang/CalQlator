import React from 'react';
import { CreditCard, Check, RotateCcw, X, Sliders } from 'lucide-react';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  onReset: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  scale,
  onScaleChange,
  onReset,
}) => {
  if (!isOpen) return null;

  // Standard credit card / driving license ISO/IEC 7810 ID-1 standard: 85.6mm x 53.98mm
  const cardWidthMm = 85.6 * scale;
  const cardHeightMm = 53.98 * scale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-[#13151D] border border-slate-700/80 rounded-2xl shadow-2xl p-5 font-mono text-slate-100 flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm tracking-wide text-slate-100">
              Screen Calibration (1:1 mm Scale)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-slate-300 leading-relaxed">
          Hold any standard physical card (credit card, driving license, or student ID) against the screen.
          Adjust the slider until the outline matches your card&apos;s physical edge exactly.
        </p>

        {/* Physical Card Visual Target */}
        <div className="py-2 flex flex-col items-center justify-center">
          <div
            style={{
              width: `${cardWidthMm}mm`,
              height: `${cardHeightMm}mm`,
              maxWidth: '90vw',
              maxHeight: '40vh',
            }}
            className="border-2 border-dashed border-amber-400 bg-amber-950/20 rounded-xl flex flex-col items-center justify-center relative p-3 text-center shadow-[0_0_15px_rgba(245,166,35,0.2)] transition-all duration-75"
          >
            <CreditCard className="w-8 h-8 text-amber-400/70 mb-1" />
            <span className="text-xs font-bold text-amber-300">
              ALIGN PHYSICAL CARD HERE
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Standard ISO 85.6 mm × 53.98 mm
            </span>
            <span className="text-[10px] font-bold text-emerald-400 mt-1">
              Scale: {Math.round(scale * 100)}%
            </span>

            {/* Corner Markers */}
            <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-400"></div>
            <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-400"></div>
            <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-400"></div>
            <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-400"></div>
          </div>
        </div>

        {/* Slider Controls */}
        <div className="space-y-1.5 bg-[#171A24] p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Smaller (75%)</span>
            <span className="text-amber-400 font-bold">{Math.round(scale * 100)}%</span>
            <span>Larger (135%)</span>
          </div>
          <input
            type="range"
            min="0.75"
            max="1.35"
            step="0.005"
            value={scale}
            onChange={(e) => onScaleChange(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset 100%</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Calibration</span>
          </button>
        </div>

      </div>
    </div>
  );
};
