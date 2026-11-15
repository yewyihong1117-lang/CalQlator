import React, { useState } from 'react';
import { X, Trash2, Search, ArrowUpRight, Copy, Check, Clock, Calculator, CornerDownLeft } from 'lucide-react';
import { HistoryItem } from '../calcEngine';
import { playKeyClick } from '../audioFeedback';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
  onInsertAns: (val: string) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistory,
  onInsertAns,
  onClearHistory,
  onDeleteItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.expression.toLowerCase().includes(term) ||
      item.result.toLowerCase().includes(term) ||
      (item.exactResult && item.exactResult.toLowerCase().includes(term))
    );
  });

  const handleCopy = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    playKeyClick('action');
    const textToCopy = `${item.expression} = ${item.result}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--bg)]">
      <div 
        className="w-full max-w-lg bg-[var(--m3-surface)] border border-[var(--m3-outline-variant)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--m3-on-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-4 py-3.5 border-b border-slate-800/80 bg-[#16161D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold font-sans text-slate-100 flex items-center gap-2">
                Calculation History Log
                <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-slate-800 text-amber-400 border border-slate-700">
                  {history.length} {history.length === 1 ? 'entry' : 'entries'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Casio fx-570EX memory tape & recall
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {history.length > 0 && (
              <>
                {showClearConfirm ? (
                  <div className="flex items-center gap-1 bg-red-950/60 p-1 rounded border border-red-800">
                    <span className="text-[10px] text-red-300 font-sans">Clear all?</span>
                    <button
                      onClick={() => {
                        playKeyClick('action');
                        onClearHistory();
                        setShowClearConfirm(false);
                      }}
                      className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold hover:bg-red-500"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      playKeyClick('action');
                      setShowClearConfirm(true);
                    }}
                    title="Clear All History"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

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
        </div>

        {/* Search Bar */}
        {history.length > 0 && (
          <div className="p-3 border-b border-slate-800/80 bg-[#141419]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search past equations or answers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0B0B0E] border border-slate-800 rounded-lg text-xs font-sans text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-400/50"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* History Entries List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {history.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-3">
                <Calculator className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300 font-sans">No Calculations Yet</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                Perform calculations like integrals, derivatives, or algebra to record them into your Casio fx-570EX history tape.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[11px] font-sans text-amber-400/80">
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">∫(x², 0, 3)</span>
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">d/dx(x³, 2)</span>
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">Σ(x, 1, 10)</span>
              </div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-sans">
              No calculations matching &quot;{searchTerm}&quot;
            </div>
          ) : (
            filteredHistory.map((item, idx) => (
              <div
                key={item.id}
                className="bg-[#14141A] border border-slate-800 hover:border-slate-700 rounded-xl p-3 hover:bg-[#181822] group shadow-sm"
              >
                {/* Top Item Meta */}
                <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mb-1.5">
                  <span className="font-semibold text-amber-400/90 flex items-center gap-1">
                    #{history.length - idx}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                {/* Mathematical Expression */}
                <div className="font-sans text-sm sm:text-base text-[var(--display-text)] py-1 break-all tracking-wide">
                  {item.expression}
                </div>

                {/* Computed Result */}
                <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/60 mt-1">
                  <div className="text-xs font-sans text-slate-400">
                    {item.exactResult && item.exactResult !== item.result && (
                      <span className="text-amber-400/80 mr-2">Exact: {item.exactResult}</span>
                    )}
                  </div>
                  <div className="text-right text-lg sm:text-xl font-sans font-bold text-slate-100 lcd-dot-text">
                    = {item.result}
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-xs font-sans">
                  <div className="flex items-center gap-1.5">
                    {/* Load Expression Button */}
                    <button
                      onClick={() => {
                        playKeyClick('action');
                        onSelectHistory(item);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded bg-[#22222E] hover:bg-slate-700 text-slate-200 border border-slate-700/60 flex items-center gap-1 text-[11px] font-semibold transition-colors active:scale-95"
                    >
                      <ArrowUpRight className="w-3 h-3 text-amber-400" />
                      <span>Load Expr</span>
                    </button>

                    {/* Insert Answer Button */}
                    <button
                      onClick={() => {
                        playKeyClick('action');
                        onInsertAns(item.result);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded bg-[#22222E] hover:bg-slate-700 text-slate-200 border border-slate-700/60 flex items-center gap-1 text-[11px] font-semibold transition-colors active:scale-95"
                    >
                      <CornerDownLeft className="w-3 h-3 text-emerald-400" />
                      <span>Insert Ans</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Copy Button */}
                    <button
                      onClick={(e) => handleCopy(item, e)}
                      title="Copy Expression & Answer"
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Delete Item Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playKeyClick('action');
                        onDeleteItem(item.id);
                      }}
                      title="Delete this record"
                      className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2.5 bg-[#0D0D11] border-t border-slate-800/80 text-[10px] sm:text-xs font-sans text-slate-500 flex items-center justify-between">
          <span>Tip: Use REPLAY ▲/▼ D-Pad on the calculator to cycle expressions</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
