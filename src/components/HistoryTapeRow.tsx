import React, { useMemo, useRef } from 'react';
import { Pin, Trash2 } from 'lucide-react';
import { MergedHistoryEntry, formatHistoryTimestamp, HISTORY_ROW_HEIGHT } from '../historyUtils';
import { formatDisplayNumberWithCommas } from '../displayFormat';
import { parseStringToAst } from '../mathAst';
import { NaturalDisplay } from './NaturalDisplay';
import { animateSpringTransform, prefersReducedMotion } from '../motion/spring';
import { playKeyClick, triggerHaptic } from '../audioFeedback';

interface HistoryTapeRowProps {
  entry: MergedHistoryEntry;
  variant: 'peek' | 'expanded' | 'full';
  onLoadExpression: (entry: MergedHistoryEntry) => void;
  onInsertResult: (entry: MergedHistoryEntry) => void;
  onDeleteEntry: (entry: MergedHistoryEntry) => void;
  onTogglePinEntry: (entry: MergedHistoryEntry) => void;
  onLongPressEntry: (entry: MergedHistoryEntry, rect: DOMRect) => void;
  enterDelayMs?: number;
  animateEnter?: boolean;
}

export const HistoryTapeRow: React.FC<HistoryTapeRowProps> = React.memo(({
  entry,
  variant,
  onInsertResult,
  onDeleteEntry,
  onTogglePinEntry,
  onLongPressEntry,
  enterDelayMs = 0,
  animateEnter = false,
}) => {
  const rowWrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const swipeLeftBgRef = useRef<HTMLDivElement>(null);
  const swipeRightBgRef = useRef<HTMLDivElement>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const swipeConsumedClickRef = useRef(false);

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dx: number;
    lockedAxis: 'none' | 'x' | 'y';
  } | null>(null);

  const nodes = useMemo(() => {
    if (entry.primary.astRoot && entry.primary.astRoot.length > 0) {
      return entry.primary.astRoot;
    }
    return parseStringToAst(entry.primary.expression).root;
  }, [entry.primary.astRoot, entry.primary.expression]);

  // Living Flow stagger animation on visible enter (compositor-only transform + opacity)
  React.useLayoutEffect(() => {
    const el = rowWrapRef.current;
    if (!animateEnter || !el) return;
    if (prefersReducedMotion()) {
      animateSpringTransform(
        el,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
        'effects',
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
      );
      return;
    }
    const timer = enterDelayMs > 0
      ? window.setTimeout(() => {
          animateSpringTransform(
            el,
            { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
            'spatial',
            { x: 0, y: -12, sx: 0.96, sy: 0.96, opacity: 0 }
          );
        }, enterDelayMs)
      : null;

    if (enterDelayMs <= 0) {
      animateSpringTransform(
        el,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
        'spatial',
        { x: 0, y: -12, sx: 0.96, sy: 0.96, opacity: 0 }
      );
    } else {
      el.style.opacity = '0';
    }

    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [animateEnter, enterDelayMs]);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const resetSwipeVisuals = (immediate = false) => {
    const card = cardRef.current;
    const leftBg = swipeLeftBgRef.current;
    const rightBg = swipeRightBgRef.current;
    if (leftBg) leftBg.style.opacity = '0';
    if (rightBg) rightBg.style.opacity = '0';
    if (!card) return;
    if (immediate || prefersReducedMotion()) {
      card.style.transform = '';
      card.style.willChange = '';
    } else {
      animateSpringTransform(card, { x: 0, y: 0, sx: 1, sy: 1 });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    longPressFiredRef.current = false;
    swipeConsumedClickRef.current = false;

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      lockedAxis: 'none',
    };

    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      swipeConsumedClickRef.current = true;
      dragRef.current = null;
      triggerHaptic('action');
      playKeyClick('action');
      const rect = rowWrapRef.current?.getBoundingClientRect() || new DOMRect(e.clientX - 40, e.clientY - 24, 80, 48);
      onLongPressEntry(entry, rect);
    }, 420);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      clearLongPress();
    }

    if (drag.lockedAxis === 'none') {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        drag.lockedAxis = 'x';
        swipeConsumedClickRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else if (Math.abs(dy) > 10) {
        drag.lockedAxis = 'y';
        dragRef.current = null;
        return;
      } else {
        return;
      }
    }

    if (drag.lockedAxis === 'x') {
      const clampedDx = Math.max(-132, Math.min(132, dx));
      drag.dx = clampedDx;
      const card = cardRef.current;
      if (card) {
        card.style.willChange = 'transform';
        card.style.transform = `translate3d(${clampedDx.toFixed(1)}px, 0, 0)`;
      }
      if (swipeLeftBgRef.current) {
        swipeLeftBgRef.current.style.opacity = clampedDx < -8 ? Math.min(1, Math.abs(clampedDx) / 68).toFixed(2) : '0';
      }
      if (swipeRightBgRef.current) {
        swipeRightBgRef.current.style.opacity = clampedDx > 8 ? Math.min(1, clampedDx / 68).toFixed(2) : '0';
      }
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.lockedAxis !== 'x') return;

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}

    const dx = drag.dx;
    if (dx <= -64) {
      triggerHaptic('action');
      playKeyClick('action');
      const card = cardRef.current;
      if (card && !prefersReducedMotion()) {
        animateSpringTransform(
          card,
          { x: -240, y: 0, sx: 1, sy: 1, opacity: 0 },
          'effects',
          { x: dx, y: 0, sx: 1, sy: 1, opacity: 1 },
          () => onDeleteEntry(entry)
        );
      } else {
        onDeleteEntry(entry);
      }
    } else if (dx >= 64) {
      triggerHaptic('dpad');
      playKeyClick('action');
      onTogglePinEntry(entry);
      resetSwipeVisuals();
    } else {
      resetSwipeVisuals();
    }
  };

  const rowHeightPx = variant === 'peek' ? 48 : HISTORY_ROW_HEIGHT;
  const formattedResult = formatDisplayNumberWithCommas(entry.primary.result);

  return (
    <div
      ref={rowWrapRef}
      data-testid={`history-row-${entry.key}`}
      data-history-row="true"
      onContextMenu={(e) => {
        e.preventDefault();
        clearLongPress();
        triggerHaptic('action');
        playKeyClick('action');
        const rect = rowWrapRef.current?.getBoundingClientRect() || new DOMRect(e.clientX - 40, e.clientY - 24, 80, 48);
        onLongPressEntry(entry, rect);
      }}
      style={{ height: `${rowHeightPx}px` }}
      className="relative w-full overflow-hidden select-none touch-pan-y"
    >
      {/* Swipe Right Background (Pin / Unpin) */}
      <div
        ref={swipeRightBgRef}
        style={{ opacity: 0 }}
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-start px-3.5 bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] rounded-xl pointer-events-none"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Pin className="w-3.5 h-3.5" />
          <span>{entry.pinned ? 'Unpin' : 'Pin'}</span>
        </div>
      </div>

      {/* Swipe Left Background (Delete) */}
      <div
        ref={swipeLeftBgRef}
        style={{ opacity: 0 }}
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end px-3.5 bg-[var(--display-surface)] text-[var(--ui-danger)] rounded-xl pointer-events-none"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span>Delete</span>
          <Trash2 className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Foreground Sliding Row: tapping anywhere inserts result into current expression */}
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        className={`relative w-full h-full flex items-center rounded-xl transition-colors ${
          entry.pinned
            ? 'bg-[var(--ui-accent-tonal)] border border-[var(--ui-accent)]/40'
            : 'bg-[var(--display-surface)] border border-[var(--display-divider)]'
        }`}
      >
        <button
          type="button"
          data-testid={`history-res-btn-${entry.key}`}
          aria-label={`Insert result ${formattedResult} from ${entry.primary.expression}`}
          onClick={(e) => {
            e.stopPropagation();
            if (longPressFiredRef.current || swipeConsumedClickRef.current) {
              longPressFiredRef.current = false;
              swipeConsumedClickRef.current = false;
              return;
            }
            playKeyClick('num');
            onInsertResult(entry);
          }}
          className="w-full min-h-[48px] h-full px-3 flex items-center justify-between gap-2 text-right cursor-pointer overflow-hidden rounded-xl hover:bg-[var(--display-text)]/5 active:bg-[var(--display-text)]/10"
        >
          {/* Left metadata (Pin / Repeat badge / Timestamp) */}
          <div className="shrink-0 flex items-center gap-1.5 text-left">
            {entry.pinned && (
              <Pin
                className="w-3.5 h-3.5 text-[var(--ui-accent)]"
                aria-label="Pinned"
              />
            )}
            {entry.count > 1 && (
              <span
                data-testid={`history-repeat-badge-${entry.key}`}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)]"
              >
                ×{entry.count}
              </span>
            )}
            <span className="text-[10.5px] tabular-nums text-[var(--display-muted-pale)]">
              {formatHistoryTimestamp(entry.primary.timestamp)}
            </span>
          </div>

          {/* Right-aligned ColorOS expression & = result */}
          <div className="flex-1 min-w-0 flex flex-col items-end justify-center overflow-hidden">
            <div className="w-full overflow-hidden flex justify-end text-[var(--display-muted)] leading-tight">
              <NaturalDisplay
                nodes={nodes}
                readOnly
                inheritColor
                align="right"
                fontSize={13}
                className="!overflow-hidden !py-0"
              />
            </div>
            <span className="max-w-full truncate font-semibold text-[16px] tabular-nums leading-tight text-[var(--display-text)]">
              = {formattedResult}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
});
