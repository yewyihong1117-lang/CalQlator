import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  VirtualHistoryLayout,
  MergedHistoryEntry,
  HISTORY_HEADER_HEIGHT,
  computeVirtualSlice,
} from '../historyUtils';
import { HistoryTapeRow } from './HistoryTapeRow';
import { animateSpringTransform, prefersReducedMotion } from '../motion/spring';

interface VirtualizedHistoryListProps {
  layout: VirtualHistoryLayout;
  variant: 'expanded' | 'full';
  isActive: boolean;
  onLoadExpression: (entry: MergedHistoryEntry) => void;
  onInsertResult: (entry: MergedHistoryEntry) => void;
  onDeleteEntry: (entry: MergedHistoryEntry) => void;
  onTogglePinEntry: (entry: MergedHistoryEntry) => void;
  onLongPressEntry: (entry: MergedHistoryEntry, rect: DOMRect) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
  testId?: string;
}

export const VirtualizedHistoryList: React.FC<VirtualizedHistoryListProps> = ({
  layout,
  variant,
  isActive,
  onLoadExpression,
  onInsertResult,
  onDeleteEntry,
  onTogglePinEntry,
  onLongPressEntry,
  emptyTitle = 'No calculations yet',
  emptySubtitle = 'Tap expression to edit · Tap = to insert · Swipe left/right or hold',
  testId = 'virtualized-history-list',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  const [viewportH, setViewportH] = useState(320);
  const [scrollTop, setScrollTop] = useState(0);
  const [enterBatchId, setEnterBatchId] = useState(0);
  const wasActiveRef = useRef(false);

  const scrollRafRef = useRef<number>(0);
  const overscrollRef = useRef<{
    active: boolean;
    startY: number;
    currentOverscroll: number;
  }>({ active: false, startY: 0, currentOverscroll: 0 });

  // Trigger short stagger enter wave whenever list becomes active
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      setEnterBatchId((n) => n + 1);
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientHeight > 0) {
        setViewportH(el.clientHeight);
      }
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => ro?.disconnect();
  }, []);

  // Clamp scrollTop cleanly if layout shrinks (e.g., search filter)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, layout.totalHeight - viewportH);
    if (el.scrollTop > maxScroll) {
      el.scrollTop = maxScroll;
      setScrollTop(maxScroll);
    }
  }, [layout.totalHeight, viewportH]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      setScrollTop(el.scrollTop);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  // Elastic overscroll at list ends (touch & wheel fallback-free, compositor translate3d only)
  const applyOverscroll = useCallback((offsetPx: number) => {
    overscrollRef.current.currentOverscroll = offsetPx;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.willChange = Math.abs(offsetPx) > 0.1 ? 'transform' : '';
    canvas.style.transform = Math.abs(offsetPx) > 0.1 ? `translate3d(0, ${offsetPx.toFixed(1)}px, 0)` : '';
  }, []);

  const releaseOverscroll = useCallback(() => {
    if (Math.abs(overscrollRef.current.currentOverscroll) < 0.5) {
      overscrollRef.current.active = false;
      overscrollRef.current.currentOverscroll = 0;
      applyOverscroll(0);
      return;
    }
    const fromY = overscrollRef.current.currentOverscroll;
    overscrollRef.current.active = false;
    overscrollRef.current.currentOverscroll = 0;
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) {
      applyOverscroll(0);
      return;
    }
    animateSpringTransform(
      canvas,
      { x: 0, y: 0, sx: 1, sy: 1 },
      'spatial',
      { x: 0, y: fromY, sx: 1, sy: 1 }
    );
  }, [applyOverscroll]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (prefersReducedMotion() || e.touches.length !== 1) return;
    overscrollRef.current.active = true;
    overscrollRef.current.startY = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !overscrollRef.current.active || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - overscrollRef.current.startY;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const atTop = el.scrollTop <= 0.5;
    const atBottom = el.scrollTop >= maxScroll - 0.5;

    if (atTop && dy > 0) {
      const elastic = Math.min(44, dy * 0.28);
      applyOverscroll(elastic);
    } else if (atBottom && dy < 0) {
      const elastic = Math.max(-44, dy * 0.28);
      applyOverscroll(elastic);
    } else if (overscrollRef.current.currentOverscroll !== 0) {
      applyOverscroll(0);
    }
  };

  const slice = computeVirtualSlice(layout, scrollTop, viewportH, 4);
  const visibleRows = slice.endIdx >= slice.startIdx ? layout.rows.slice(slice.startIdx, slice.endIdx + 1) : [];

  if (layout.rows.length === 0) {
    return (
      <div
        data-testid={testId}
        className="w-full h-full flex flex-col items-center justify-center px-4 text-center select-none"
      >
        <p className="text-xs font-semibold text-[var(--display-muted)]">
          {emptyTitle}
        </p>
        <p className="text-[11px] mt-1 text-[var(--display-muted-pale)]">
          {emptySubtitle}
        </p>
      </div>
    );
  }

  let animatedItemOrdinal = 0;

  return (
    <div
      ref={scrollRef}
      data-testid={testId}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={releaseOverscroll}
      onTouchCancel={releaseOverscroll}
      className="relative w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar touch-pan-y"
    >
      {/* Sticky Group Header Overlay (Pinned, Today, Yesterday, Earlier) */}
      {slice.activeHeader && (
        <div
          ref={stickyHeaderRef}
          data-testid="sticky-history-header"
          style={{
            height: `${HISTORY_HEADER_HEIGHT}px`,
            transform: `translate3d(0, ${slice.activeHeader.pushY.toFixed(1)}px, 0)`,
          }}
          className="sticky top-0 left-0 right-0 z-20 px-2.5 flex items-center justify-between text-[10.5px] font-bold tracking-wide select-none bg-[var(--display-bg)] text-[var(--ui-accent)] border-b border-[var(--display-divider)]"
        >
          <span>{slice.activeHeader.title}</span>
          <span className="opacity-65 font-medium tabular-nums">{slice.activeHeader.count}</span>
        </div>
      )}

      {/* Virtualized Inner Canvas (Compensates for sticky header height cleanly) */}
      <div
        ref={canvasRef}
        style={{
          height: `${layout.totalHeight}px`,
          marginTop: slice.activeHeader ? `-${HISTORY_HEADER_HEIGHT}px` : '0px',
        }}
        className="relative w-full"
      >
        {visibleRows.map((row) => {
          if (row.kind === 'header') {
            // Hide static header underneath when it matches the currently pinned sticky header at top
            const isCurrentlyStickyTop =
              slice.activeHeader &&
              slice.activeHeader.title === row.title &&
              row.top <= scrollTop + 1;

            return (
              <div
                key={row.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${row.height}px`,
                  transform: `translate3d(0, ${row.top}px, 0)`,
                  opacity: isCurrentlyStickyTop ? 0 : 1,
                }}
                className="px-2.5 flex items-center justify-between text-[10.5px] font-bold tracking-wide select-none pointer-events-none text-[var(--ui-accent)]"
              >
                <span>{row.title}</span>
                <span className="opacity-65 font-medium tabular-nums">{row.groupCount}</span>
              </div>
            );
          }

          const shouldStagger = enterBatchId > 0 && animatedItemOrdinal < 6 && row.top < scrollTop + viewportH;
          const delayMs = shouldStagger ? animatedItemOrdinal * 24 : 0;
          if (shouldStagger) animatedItemOrdinal++;

          return (
            <div
              key={`${row.key}_${shouldStagger ? enterBatchId : 's'}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: `${row.height}px`,
                transform: `translate3d(0, ${row.top}px, 0)`,
              }}
              className="px-1"
            >
              <HistoryTapeRow
                entry={row.entry}
                variant={variant}
                onLoadExpression={onLoadExpression}
                onInsertResult={onInsertResult}
                onDeleteEntry={onDeleteEntry}
                onTogglePinEntry={onTogglePinEntry}
                onLongPressEntry={onLongPressEntry}
                animateEnter={shouldStagger}
                enterDelayMs={delayMs}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
