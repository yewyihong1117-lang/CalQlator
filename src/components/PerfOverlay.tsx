import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';

interface PerfOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PerfStats {
  p50: number;
  p95: number;
  worst: number;
  sampleCount: number;
  over16Count: number;
  longTaskCount: number;
  maxLongTask: number;
  nonCompositedAnims: string[];
  clsScore: number;
  rootOpacityFlags: number;
  rootBboxFlags: number;
  rootMinOpacity: number;
}

const ALLOWED_ANIM_PROPS = new Set(['transform', 'opacity', 'offset', 'computedOffset', 'composite', 'easing']);

export const PerfOverlay: React.FC<PerfOverlayProps> = ({ isOpen, onClose }) => {
  const deltasRef = useRef<number[]>([]);
  const longTasksRef = useRef<{ count: number; max: number }>({ count: 0, max: 0 });
  const nonCompRef = useRef<Set<string>>(new Set());
  const clsRef = useRef<number>(0);
  const rootOpacityFlagsRef = useRef<number>(0);
  const rootBboxFlagsRef = useRef<number>(0);
  const rootMinOpacityRef = useRef<number>(1);
  const baselineMainRef = useRef<{ node: Element; left: number; top: number; width: number; height: number } | null>(null);

  const [stats, setStats] = useState<PerfStats>({
    p50: 0,
    p95: 0,
    worst: 0,
    sampleCount: 0,
    over16Count: 0,
    longTaskCount: 0,
    maxLongTask: 0,
    nonCompositedAnims: [],
    clsScore: 0,
    rootOpacityFlags: 0,
    rootBboxFlags: 0,
    rootMinOpacity: 1,
  });

  const handleReset = () => {
    deltasRef.current = [];
    longTasksRef.current = { count: 0, max: 0 };
    nonCompRef.current.clear();
    clsRef.current = 0;
    rootOpacityFlagsRef.current = 0;
    rootBboxFlagsRef.current = 0;
    rootMinOpacityRef.current = 1;
    const mainEl = document.querySelector('main');
    if (mainEl) {
      const r = mainEl.getBoundingClientRect();
      baselineMainRef.current = { node: mainEl, left: r.left, top: r.top, width: r.width, height: r.height };
    } else {
      baselineMainRef.current = null;
    }
    setStats({
      p50: 0,
      p95: 0,
      worst: 0,
      sampleCount: 0,
      over16Count: 0,
      longTaskCount: 0,
      maxLongTask: 0,
      nonCompositedAnims: [],
      clsScore: 0,
      rootOpacityFlags: 0,
      rootBboxFlags: 0,
      rootMinOpacity: 1,
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    let rafId = 0;
    let lastTs = performance.now();
    let frameIndex = 0;

    const initialMain = document.querySelector('main');
    if (initialMain) {
      const r = initialMain.getBoundingClientRect();
      baselineMainRef.current = { node: initialMain, left: r.left, top: r.top, width: r.width, height: r.height };
    }

    // Expose inspection hook on window for automated stress harness verification
    const computeSnapshot = (): PerfStats => {
      const arr = deltasRef.current;
      if (arr.length === 0) {
        return {
          p50: 0,
          p95: 0,
          worst: 0,
          sampleCount: 0,
          over16Count: 0,
          longTaskCount: longTasksRef.current.count,
          maxLongTask: longTasksRef.current.max,
          nonCompositedAnims: Array.from(nonCompRef.current),
          clsScore: clsRef.current,
          rootOpacityFlags: rootOpacityFlagsRef.current,
          rootBboxFlags: rootBboxFlagsRef.current,
          rootMinOpacity: rootMinOpacityRef.current,
        };
      }
      const sorted = [...arr].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 0;
      const worst = sorted[sorted.length - 1] || 0;
      const over16Count = arr.filter((d) => d > 16.7).length;
      return {
        p50,
        p95,
        worst,
        sampleCount: arr.length,
        over16Count,
        longTaskCount: longTasksRef.current.count,
        maxLongTask: longTasksRef.current.max,
        nonCompositedAnims: Array.from(nonCompRef.current),
        clsScore: clsRef.current,
        rootOpacityFlags: rootOpacityFlagsRef.current,
        rootBboxFlags: rootBboxFlagsRef.current,
        rootMinOpacity: rootMinOpacityRef.current,
      };
    };

    (window as unknown as Record<string, unknown>).__calqPerf = {
      reset: handleReset,
      snapshot: computeSnapshot,
    };

    const tick = (now: number) => {
      const dt = now - lastTs;
      lastTs = now;
      // Ignore initial mount jump > 250ms (tab switch)
      if (dt > 0 && dt < 250) {
        deltasRef.current.push(dt);
        if (deltasRef.current.length > 900) {
          deltasRef.current.shift();
        }
        if (dt > 16.7) {
          // Track >16ms frame spike even if longtask observer threshold is 50ms
          if (dt > longTasksRef.current.max) {
            longTasksRef.current.max = dt;
          }
        }
      }

      // Per-frame debug check: flag any frame where calculator root opacity < 1 or bounding box shifts/unmounts
      const mainEl = document.querySelector('main');
      const base = baselineMainRef.current;
      if (!mainEl || (base && mainEl !== base.node)) {
        rootBboxFlagsRef.current++;
      } else {
        const cs = getComputedStyle(mainEl);
        const op = parseFloat(cs.opacity);
        if (op < 1 || cs.visibility !== 'visible' || cs.display === 'none') {
          rootOpacityFlagsRef.current++;
          if (op < rootMinOpacityRef.current) {
            rootMinOpacityRef.current = op;
          }
        }
        if (base) {
          const r = mainEl.getBoundingClientRect();
          if (
            Math.abs(r.left - base.left) > 0.25 ||
            Math.abs(r.top - base.top) > 0.25 ||
            Math.abs(r.width - base.width) > 0.25 ||
            Math.abs(r.height - base.height) > 0.25
          ) {
            rootBboxFlagsRef.current++;
          }
        }
      }

      frameIndex++;
      // Check active Web Animations for non-composited properties every 6th frame to avoid rAF overhead
      if (frameIndex % 6 === 0 && typeof document.getAnimations === 'function') {
        const anims = document.getAnimations();
        for (const a of anims) {
          const eff = a.effect as KeyframeEffect | null;
          if (eff && typeof eff.getKeyframes === 'function') {
            for (const kf of eff.getKeyframes()) {
              for (const prop of Object.keys(kf)) {
                if (!ALLOWED_ANIM_PROPS.has(prop)) {
                  nonCompRef.current.add(prop);
                }
              }
            }
          }
        }
      }

      if (frameIndex % 15 === 0) {
        setStats(computeSnapshot());
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    // Observe Performance Long Tasks & Layout Shifts
    const observers: PerformanceObserver[] = [];
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const ltObs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 16) {
              longTasksRef.current.count++;
              if (entry.duration > longTasksRef.current.max) {
                longTasksRef.current.max = entry.duration;
              }
            }
          }
        });
        ltObs.observe({ entryTypes: ['longtask'] });
        observers.push(ltObs);
      } catch {}

      try {
        const lsObs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
            if (!entry.hadRecentInput && entry.value) {
              clsRef.current += entry.value;
            }
          }
        });
        lsObs.observe({ entryTypes: ['layout-shift'] });
        observers.push(lsObs);
      } catch {}
    }

    return () => {
      cancelAnimationFrame(rafId);
      observers.forEach((o) => o.disconnect());
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="perf-debug-overlay"
      className="fixed top-2 left-2 z-[60] p-2.5 rounded-xl bg-[var(--m3-surface)] border border-[var(--ui-accent)] text-[var(--m3-on-surface)] font-sans text-[10px] leading-snug shadow-lg max-w-[260px] pointer-events-none select-none"
    >
      <div className="flex items-center justify-between gap-3 pb-1 mb-1 border-b border-[var(--m3-outline-variant)]">
        <span className="font-bold text-[var(--ui-accent)] tracking-wide">FRAME MONITOR</span>
        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset frame stats"
            className="p-1 rounded bg-[var(--m3-surface-container-high)] text-[var(--m3-on-surface)] cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close frame monitor"
            className="p-1 rounded bg-[var(--m3-surface-container-high)] text-[var(--m3-on-surface)] cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 tabular-nums">
        <div>
          <span className="text-[var(--m3-on-surface-variant)]">p50: </span>
          <strong data-testid="perf-p50">{stats.p50.toFixed(1)}ms</strong>
        </div>
        <div>
          <span className="text-[var(--m3-on-surface-variant)]">p95: </span>
          <strong data-testid="perf-p95">{stats.p95.toFixed(1)}ms</strong>
        </div>
        <div>
          <span className="text-[var(--m3-on-surface-variant)]">max: </span>
          <strong data-testid="perf-worst">{stats.worst.toFixed(1)}ms</strong>
        </div>
      </div>

      <div className="mt-1 pt-1 border-t border-[var(--m3-outline-variant)] space-y-0.5 tabular-nums">
        <div>
          Frames &gt;16.7ms: <strong>{stats.over16Count}</strong> / {stats.sampleCount}
        </div>
        <div>
          Long tasks &gt;16ms: <strong>{stats.longTaskCount}</strong> (peak {stats.maxLongTask.toFixed(1)}ms)
        </div>
        <div>
          Layout shift CLS: <strong>{stats.clsScore.toFixed(4)}</strong>
        </div>
        <div>
          Root stability:{' '}
          <strong
            className={
              stats.rootOpacityFlags === 0 && stats.rootBboxFlags === 0
                ? 'text-[var(--ui-accent)]'
                : 'text-[var(--ui-danger)]'
            }
          >
            {stats.rootOpacityFlags === 0 && stats.rootBboxFlags === 0
              ? 'OK (op=1, 0 shifts)'
              : `opFlags:${stats.rootOpacityFlags} bboxFlags:${stats.rootBboxFlags}`}
          </strong>
        </div>
        <div>
          Animated props:{' '}
          <strong className={stats.nonCompositedAnims.length === 0 ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-danger)]'}>
            {stats.nonCompositedAnims.length === 0 ? 'transform/opacity only' : stats.nonCompositedAnims.join(', ')}
          </strong>
        </div>
      </div>
    </div>
  );
};
