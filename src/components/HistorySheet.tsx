import React, { useState, useRef, useEffect } from 'react';
import { Pin, PinOff, Copy, Check, Trash2, X } from 'lucide-react';
import { HistoryItem } from '../calcEngine';
import { parseStringToAst } from '../mathAst';
import { NaturalDisplay } from './NaturalDisplay';
import { playKeyClick } from '../audioFeedback';

interface HistorySheetProps {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  isExpanded: boolean;
  onClose: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandlePointerMove: (e: React.PointerEvent) => void;
  onHandlePointerUp: (e: React.PointerEvent) => void;
  history: HistoryItem[];
  onLoadCard: (item: HistoryItem) => void;
  onInsertResult?: (item: HistoryItem) => void;
  onTogglePin: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearHistory: () => void;
}

export const HistorySheet: React.FC<HistorySheetProps> = ({
  sheetRef,
  isExpanded,
  onClose,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  history,
  onLoadCard,
  onInsertResult,
  onTogglePin,
  onDeleteItem,
  onClearHistory,
}) => {
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isExpanded) {
      setActionItemId(null);
      setShowClearConfirm(false);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (actionItemId) setActionItemId(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded, actionItemId, onClose]);

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
        className={`rounded-2xl px-3.5 py-2.5 border cursor-pointer select-none ${
          item.pinned
            ? 'bg-[var(--ui-accent-tonal)] border-[var(--ui-accent)]'
            : 'bg-[var(--m3-surface-container)] hover:bg-[var(--m3-surface-container-high)] border-[var(--m3-outline-variant)]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 text-[var(--m3-on-surface)]/85 overflow-x-auto no-scrollbar">
            <NaturalDisplay
              nodes={nodes}
              readOnly
              inheritColor
              fontSize={14}
            />
          </div>
          {item.pinned && (
            <Pin className="w-3.5 h-3.5 shrink-0 mt-1 text-[var(--ui-accent)]" />
          )}
        </div>

        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="text-[10.5px] text-[var(--m3-on-surface-variant)]">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span
            onClick={(e) => {
              if (!onInsertResult || longPressTriggeredRef.current || actionItemId === item.id) return;
              e.stopPropagation();
              playKeyClick('num');
              onInsertResult(item);
            }}
            title="Tap to insert result"
            className="text-base font-bold tabular-nums text-[var(--m3-on-surface)] text-right truncate hover:text-[var(--ui-accent)]"
          >
            = {item.result}
          </span>
        </div>

        {isActionsOpen && (
          <div
            data-testid={`history-card-actions-${item.id}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2 pt-2 border-t border-[var(--m3-outline-variant)] grid grid-cols-2 gap-1.5"
          >
            <button
              type="button"
              onClick={() => handleCopyText(item.result, 'Copied result')}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[var(--m3-surface-container-high)] hover:bg-[var(--ui-accent-tonal)] text-[var(--m3-on-surface)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
              <span>Copy result</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyText(item.expression, 'Copied expression')}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[var(--m3-surface-container-high)] hover:bg-[var(--ui-accent-tonal)] text-[var(--m3-on-surface)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
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
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[var(--m3-surface-container-high)] hover:bg-[var(--ui-accent-tonal)] text-[var(--m3-on-surface)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
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
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[var(--m3-surface-container-high)] hover:bg-[var(--m3-surface)] text-[var(--ui-danger)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
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
      ref={sheetRef}
      data-testid="history-sheet"
      aria-hidden={!isExpanded}
      style={{
        visibility: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      }}
      className="absolute inset-0 z-40 bg-[var(--m3-surface)] text-[var(--m3-on-surface)] border-b border-[var(--m3-outline-variant)] shadow-md flex flex-col overflow-hidden"
    >
      {/* Top Sheet Header */}
      <div
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        className="px-4 pt-[max(12px,env(safe-area-inset-top,12px))] pb-2.5 border-b border-[var(--m3-outline-variant)] flex items-center justify-between touch-none shrink-0"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-tight text-[var(--m3-on-surface)]">
            History
          </span>
          {copiedNotice && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ui-accent)]">
              <Check className="w-3 h-3" />
              {copiedNotice}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
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
                  className="px-2 py-0.5 rounded-lg bg-[var(--ui-danger)] text-[var(--ui-accent-text)] text-[11px] font-semibold cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-0.5 rounded-lg bg-[var(--m3-surface-container-high)] text-[var(--m3-on-surface-variant)] text-[11px] cursor-pointer"
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
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:text-[var(--ui-danger)] hover:bg-[var(--m3-surface-container-high)] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container-high)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable History Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2.5 space-y-2 no-scrollbar">
        {history.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs font-medium text-[var(--m3-on-surface-variant)]">
              No calculations yet
            </p>
            <p className="text-[11px] text-[var(--m3-on-surface-variant)]/75 mt-0.5">
              Tap card to load · Hold for actions
            </p>
          </div>
        ) : (
          <>
            {pinnedItems.length > 0 && (
              <div className="space-y-1.5 pb-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-accent)] px-0.5">
                  Pinned
                </div>
                {pinnedItems.map(renderCard)}
              </div>
            )}
            {unpinnedItems.length > 0 && (
              <div className="space-y-1.5">
                {pinnedItems.length > 0 && (
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--m3-on-surface-variant)] px-0.5 pt-0.5">
                    Recent
                  </div>
                )}
                {unpinnedItems.map(renderCard)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Drag / Close Handle */}
      <div
        data-testid="history-sheet-close-handle"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        className="w-full pt-3 pb-[max(12px,env(safe-area-inset-bottom,12px))] flex flex-col items-center justify-center gap-0.5 border-t border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)] cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <div className="w-9 h-1 rounded-full bg-[var(--m3-on-surface-variant)]/50" />
      </div>
    </div>
  );
};
