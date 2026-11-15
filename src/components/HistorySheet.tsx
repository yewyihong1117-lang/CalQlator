import React, { useState, useRef, useEffect } from 'react';
import { Pin, PinOff, Copy, Check, Trash2, X } from 'lucide-react';
import { HistoryItem } from '../calcEngine';
import { parseStringToAst } from '../mathAst';
import { NaturalDisplay } from './NaturalDisplay';
import { playKeyClick } from '../audioFeedback';
import { CachedRect, useFlipModalTransition } from '../motion/useMotionEffects';

interface HistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onLoadCard: (item: HistoryItem) => void;
  onTogglePin: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearHistory: () => void;
  originRect?: CachedRect | null;
}

export const HistorySheet: React.FC<HistorySheetProps> = ({
  isOpen,
  onClose,
  history,
  onLoadCard,
  onTogglePin,
  onDeleteItem,
  onClearHistory,
  originRect = null,
}) => {
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const isVisible = useFlipModalTransition(isOpen, originRect, sheetRef, backdropRef);

  useEffect(() => {
    if (!isOpen) {
      setActionItemId(null);
      setShowClearConfirm(false);
      setDragOffsetY(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (actionItemId) setActionItemId(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, actionItemId, onClose]);

  const pinnedItems = history.filter((item) => item.pinned);
  const unpinnedItems = history.filter((item) => !item.pinned);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCardPointerDown = (id: string, e: React.PointerEvent) => {
    longPressTriggeredRef.current = false;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      playKeyClick('action');
      setActionItemId((prev) => (prev === id ? null : id));
    }, 450);
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    if (!pointerStartPosRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartPosRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartPosRef.current.y);
    if (dx > 8 || dy > 8) {
      clearLongPressTimer();
    }
  };

  const handleCardPointerUpOrCancel = () => {
    clearLongPressTimer();
    pointerStartPosRef.current = null;
  };

  const handleCardClick = (item: HistoryItem) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (actionItemId === item.id) {
      setActionItemId(null);
      return;
    }
    playKeyClick('num');
    onLoadCard(item);
  };

  const handleCopyText = async (text: string, label: string) => {
    playKeyClick('action');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(label);
      setTimeout(() => setCopiedNotice(null), 1500);
    } catch {}
    setActionItemId(null);
  };

  // Swipe-up gesture on sheet handle / header to close
  const handleSwipeStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest('button')) {
      swipeStartYRef.current = null;
      return;
    }
    swipeStartYRef.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleSwipeMove = (e: React.PointerEvent) => {
    if (swipeStartYRef.current === null) return;
    const delta = e.clientY - swipeStartYRef.current;
    if (delta < 0) {
      setDragOffsetY(delta);
    }
  };

  const handleSwipeEnd = (e: React.PointerEvent) => {
    if (swipeStartYRef.current === null) return;
    const delta = e.clientY - swipeStartYRef.current;
    swipeStartYRef.current = null;
    if (delta < -36) {
      setDragOffsetY(0);
      playKeyClick('action');
      onClose();
    } else {
      setDragOffsetY(0);
    }
  };

  const renderCard = (item: HistoryItem) => {
    const isActionsOpen = actionItemId === item.id;
    const nodes = item.astRoot && item.astRoot.length > 0
      ? item.astRoot
      : parseStringToAst(item.expression).root;

    return (
      <div
        key={item.id}
        data-testid={`history-sheet-card-${item.id}`}
        onPointerDown={(e) => handleCardPointerDown(item.id, e)}
        onPointerMove={handleCardPointerMove}
        onPointerUp={handleCardPointerUpOrCancel}
        onPointerCancel={handleCardPointerUpOrCancel}
        onContextMenu={(e) => {
          e.preventDefault();
          clearLongPressTimer();
          playKeyClick('action');
          setActionItemId((prev) => (prev === item.id ? null : item.id));
        }}
        onClick={() => handleCardClick(item)}
        className={`rounded-2xl px-4 py-3 border cursor-pointer select-none ${
          item.pinned
            ? 'bg-[var(--ui-accent-tonal)] border-[var(--ui-accent)]'
            : 'bg-[var(--m3-surface-container)] hover:bg-[var(--m3-surface-container-high)] border-[var(--m3-outline-variant)]'
        }`}
      >
        {/* Top Row: Structured AST Expression + Optional Pin */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 text-[var(--m3-on-surface)]/85 overflow-x-auto no-scrollbar">
            <NaturalDisplay
              nodes={nodes}
              readOnly
              inheritColor
              fontSize={15}
            />
          </div>
          {item.pinned && (
            <Pin className="w-3.5 h-3.5 shrink-0 mt-1 text-[var(--ui-accent)]" />
          )}
        </div>

        {/* Bottom Row: Result right-aligned */}
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-[var(--m3-on-surface-variant)]">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-lg font-bold tabular-nums text-[var(--m3-on-surface)] text-right truncate">
            = {item.result}
          </span>
        </div>

        {/* Long-press Contextual Actions */}
        {isActionsOpen && (
          <div
            data-testid={`history-card-actions-${item.id}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2.5 pt-2.5 border-t border-[var(--m3-outline-variant)] grid grid-cols-2 gap-1.5"
          >
            <button
              type="button"
              onClick={() => handleCopyText(item.result, 'Copied result')}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[var(--m3-surface-container-high)] hover:bg-[var(--ui-accent-tonal)] text-[var(--m3-on-surface)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
              <span>Copy result</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyText(item.expression, 'Copied expression')}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[var(--m3-surface-container-high)] hover:bg-[var(--ui-accent-tonal)] text-[var(--m3-on-surface)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
              <span>Copy expr</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playKeyClick('action');
                onTogglePin(item.id);
                setActionItemId(null);
              }}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[var(--m3-surface-container-high)] hover:bg-[var(--ui-accent-tonal)] text-[var(--m3-on-surface)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {item.pinned ? (
                <>
                  <PinOff className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                  <span>Unpin</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                  <span>Pin</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                playKeyClick('action');
                onDeleteItem(item.id);
                setActionItemId(null);
              }}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[var(--m3-surface-container-high)] hover:bg-[var(--m3-surface)] text-[var(--ui-danger)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={backdropRef}
      data-testid="history-sheet-backdrop"
      aria-hidden={!isVisible}
      style={{
        visibility: isVisible ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-center items-start bg-[var(--bg)]"
    >
      <div
        ref={sheetRef}
        data-testid="history-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: dragOffsetY < 0 ? `translate3d(0, ${dragOffsetY}px, 0)` : undefined,
          transformOrigin: 'center center',
        }}
        className="w-full max-w-[440px] max-h-[82dvh] bg-[var(--m3-surface)] text-[var(--m3-on-surface)] border-x border-b border-[var(--m3-outline-variant)] rounded-b-[24px] shadow-lg flex flex-col overflow-hidden"
      >
        {/* Top Sheet Header (Shared 16px / 8px-grid horizontal margin) */}
        <div
          onPointerDown={handleSwipeStart}
          onPointerMove={handleSwipeMove}
          onPointerUp={handleSwipeEnd}
          className="px-4 pt-[max(12px,env(safe-area-inset-top,12px))] pb-3 border-b border-[var(--m3-outline-variant)] flex items-center justify-between touch-none shrink-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-[var(--m3-on-surface)]">
              History
            </span>
            {copiedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ui-accent)]">
                <Check className="w-3.5 h-3.5" />
                {copiedNotice}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {history.length > 0 && (
              showClearConfirm ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      playKeyClick('action');
                      onClearHistory();
                      setShowClearConfirm(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--ui-danger)] text-[var(--ui-accent-text)] text-xs font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 rounded-lg bg-[var(--m3-surface-container-high)] text-[var(--m3-on-surface-variant)] text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    playKeyClick('action');
                    setShowClearConfirm(true);
                  }}
                  aria-label="Clear history"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:text-[var(--ui-danger)] hover:bg-[var(--m3-surface-container-high)] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => {
                playKeyClick('action');
                onClose();
              }}
              aria-label="Close history"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container-high)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable History Cards */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
          {history.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-[var(--m3-on-surface-variant)]">
                No calculations yet
              </p>
              <p className="text-xs text-[var(--m3-on-surface-variant)]/75 mt-1">
                Tap any card to load it, or press & hold for actions
              </p>
            </div>
          ) : (
            <>
              {pinnedItems.length > 0 && (
                <div className="space-y-2 pb-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ui-accent)] px-0.5">
                    Pinned
                  </div>
                  {pinnedItems.map(renderCard)}
                </div>
              )}
              {unpinnedItems.length > 0 && (
                <div className="space-y-2">
                  {pinnedItems.length > 0 && (
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--m3-on-surface-variant)] px-0.5 pt-1">
                      Recent
                    </div>
                  )}
                  {unpinnedItems.map(renderCard)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Swipe-Up Grab Handle */}
        <div
          data-testid="history-sheet-close-handle"
          onPointerDown={handleSwipeStart}
          onPointerMove={handleSwipeMove}
          onPointerUp={handleSwipeEnd}
          onClick={onClose}
          className="w-full py-3 flex flex-col items-center justify-center gap-1 border-t border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)] cursor-pointer touch-none shrink-0"
        >
          <div className="w-10 h-1 rounded-full bg-[var(--m3-on-surface-variant)]/45" />
          <span className="text-[10px] text-[var(--m3-on-surface-variant)]/80">
            Tap card to load · Hold for actions · Swipe up to close
          </span>
        </div>
      </div>
    </div>
  );
};
