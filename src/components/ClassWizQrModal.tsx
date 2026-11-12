import React from 'react';
import { X, QrCode, ExternalLink, Share2, Sparkles } from 'lucide-react';
import { playKeyClick } from '../audioFeedback';

interface ClassWizQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  expression: string;
  result: string;
}

export const ClassWizQrModal: React.FC<ClassWizQrModalProps> = ({
  isOpen,
  onClose,
  expression,
  result,
}) => {
  if (!isOpen) return null;

  // Generate QR code SVG URL from public reliable service
  const qrData = encodeURIComponent(`https://classwiz.casio.com/qr?expr=${encodeURIComponent(expression || '0')}&res=${encodeURIComponent(result || '0')}`);
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}&bgcolor=FFFFFF&color=121216&margin=4`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-sm bg-[#131318] border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col items-center text-center text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-sans font-bold text-amber-400">
            <QrCode className="w-4 h-4" />
            <span>CLASSWIZ QR CODE</span>
          </div>
          <button
            onClick={() => {
              playKeyClick('action');
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Presentation */}
        <div className="my-4 p-3 bg-white rounded-xl shadow-lg border-4 border-slate-800 flex items-center justify-center">
          <img 
            src={qrImgUrl} 
            alt="ClassWiz Calculation QR Code"
            className="w-44 h-44 object-contain"
          />
        </div>

        {/* Calculation Preview */}
        <div className="w-full bg-[#0B0B0E] p-2.5 rounded-lg border border-slate-800 mb-3 text-left font-sans">
          <div className="text-[11px] text-slate-400 truncate">
            {expression || '0'}
          </div>
          <div className="text-base font-bold text-emerald-400">
            = {result || '0'}
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Scan with your smartphone to view textbook formulas, interactive graphs, and manuals via Casio Worldwide Education Service.
        </p>

        <button
          onClick={() => {
            playKeyClick('action');
            onClose();
          }}
          className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-sans font-bold text-xs shadow-md active:scale-98 transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
};
