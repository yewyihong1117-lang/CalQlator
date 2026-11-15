import React, { useState, useEffect } from 'react';
import { TEST_CASES, runTestCase, TestCase } from '../calcEngine';
import { runAllModeTests, ModeTestResult } from '../modes/__tests__/allModes.test';
import { CheckCircle2, XCircle, ArrowLeft, RefreshCw, Layers } from 'lucide-react';

interface TestHarnessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestHarnessModal: React.FC<TestHarnessModalProps> = ({ isOpen, onClose }) => {
  const [results, setResults] = useState<{ tc: TestCase; passed: boolean; actual: string }[]>([]);
  const [modeResults, setModeResults] = useState<ModeTestResult[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'FAIL' | 'PASS' | 'MODES'>('ALL');

  const executeAllTests = () => {
    const res = TEST_CASES.map((tc) => {
      const outcome = runTestCase(tc);
      return { tc, ...outcome };
    });
    setResults(res);
    setModeResults(runAllModeTests());
  };

  useEffect(() => {
    if (isOpen) {
      executeAllTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  const filteredResults = results.filter((r) => {
    if (filter === 'FAIL') return !r.passed;
    if (filter === 'PASS') return r.passed;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)] p-3 sm:p-5">
      <div className="w-full max-w-2xl max-h-[92vh] bg-[var(--m3-surface)] border border-[var(--m3-outline-variant)] rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans text-[var(--m3-on-surface)]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#171A23]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Return to Calculator"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide text-amber-400">CASIO fx-570EX</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                  TEST HARNESS (?test=1)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Physical calculator verification test suite (operator precedence, DMS, S⇔D, Norm1/Norm2, Fix, Sci)
              </p>
            </div>
          </div>

          <button
            onClick={executeAllTests}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-run</span>
          </button>
        </div>

        {/* Score & Filter Summary Banner */}
        <div className="p-3 bg-[#111319] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-300">
              Score: <strong className={passedCount === totalCount ? 'text-emerald-400' : 'text-amber-400'}>{passedCount} / {totalCount}</strong> ({passRate}%)
            </span>
            <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> {passedCount} Passed
            </span>
            {totalCount - passedCount > 0 && (
              <span className="flex items-center gap-1 text-red-400 text-[11px]">
                <XCircle className="w-3.5 h-3.5" /> {totalCount - passedCount} Failed
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-[11px]">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2 py-0.5 rounded transition-colors ${filter === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilter('MODES')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${filter === 'MODES' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              <Layers className="w-3 h-3" />
              12 Modes ({modeResults.reduce((acc, m) => acc + m.tests.length, 0)})
            </button>
            <button
              onClick={() => setFilter('PASS')}
              className={`px-2 py-0.5 rounded transition-colors ${filter === 'PASS' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Pass ({passedCount})
            </button>
            <button
              onClick={() => setFilter('FAIL')}
              className={`px-2 py-0.5 rounded transition-colors ${filter === 'FAIL' ? 'bg-red-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Fail ({totalCount - passedCount})
            </button>
          </div>
        </div>

        {/* Tests List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar text-xs">
          {filter === 'MODES' ? (
            <div className="space-y-3">
              {modeResults.map((mr) => (
                <div key={mr.mode} className="p-2.5 rounded-xl border border-slate-800 bg-[#161922]">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 font-bold text-amber-300">
                    <span>{mr.mode} Mode Suite</span>
                    <span className="text-emerald-400 text-[11px]">
                      {mr.tests.filter((t) => t.passed).length} / {mr.tests.length} Passed
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {mr.tests.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 text-slate-300">
                        <span className="flex items-center gap-1.5">
                          {t.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          )}
                          <span>{t.name}</span>
                        </span>
                        <span className={t.passed ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                          {t.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            filteredResults.map((r) => (
            <div
              key={r.tc.id}
              className={`p-2.5 rounded-xl border ${
                r.passed
                  ? 'bg-[#141B1F] border-emerald-900/40 hover:border-emerald-800/60'
                  : 'bg-[#221316] border-red-900/50 hover:border-red-800/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                    {r.tc.id}
                  </span>
                  <span className="font-semibold text-slate-200">{r.tc.name}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                    r.passed
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                      : 'bg-red-950 text-red-300 border border-red-800/60'
                  }`}
                >
                  {r.passed ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      PASS
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 text-red-400" />
                      FAIL
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9.5px]">INPUT / KEYS:</span>
                  <span className="text-amber-300 font-bold">
                    {r.tc.keys ? r.tc.keys.join(' ') : r.tc.expression}
                    {r.tc.action === 'sd' ? ' → [S⇔D]' : r.tc.action === 'dms' ? ' → [° \' "]' : r.tc.action === 'menu' ? '' : ' ='}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">EXPECTED:</span>
                  <span className="text-slate-200">{r.tc.expected}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">ACTUAL RESULT:</span>
                  <span className={r.passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {r.actual}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}

          {filteredResults.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs">
              No test cases match filter &quot;{filter}&quot;.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#171A23] border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Physical Casio ClassWiz fx-570EX Ground Truth Suite</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close & Return to Calculator
          </button>
        </div>
      </div>
    </div>
  );
};
