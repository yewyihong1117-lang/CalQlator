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
        className={`rounded-2xl pl-3.5 pr-2 py-2.5 border cursor-pointer select-none ${
          item.pinned
            ? 'bg-[var(--ui-accent-tonal)] border-[var(--ui-accent)]'
            : 'bg-[var(--m3-surface-container)] hover:bg-[var(--m3-surface-container-high)] border-[var(--m3-outline-variant)]'
        }`}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0 pt-0.5 text-[var(--m3-on-surface)]/85 overflow-x-auto no-scrollbar">
            <NaturalDisplay
              nodes={nodes}
              readOnly
              inheritColor
              fontSize={14}
            />
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {item.pinned && (
              <Pin className="w-3.5 h-3.5 text-[var(--ui-accent)] mr-0.5" />
            )}
            <button
              type="button"
              data-testid={`history-remove-btn-${item.id}`}
              aria-label="Remove history entry"
              title="Remove from history"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                playKeyClick('action');
                if (actionItemId === item.id) setActionItemId(null);
                onDeleteItem(item.id);
              }}
              className="min-w-[36px] min-h-[36px] -my-1 flex items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)]/75 hover:text-[var(--ui-danger)] hover:bg-[var(--m3-surface-container-high)] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-1 pr-1.5 flex items-center justify-between gap-2">
          <span className="text-[10.5px] text-[var(--m3-on-surface-variant)] shrink-0">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={(e) => {
              if (!onInsertResult || longPressTriggeredRef.current || actionItemId === item.id) return;
              e.stopPropagation();
              playKeyClick('num');
              onInsertResult(item);
            }}
            title="Tap to insert result"
            className="max-w-[78%] overflow-x-auto no-scrollbar whitespace-nowrap px-2 py-0.5 -mr-2 rounded-lg text-base font-bold tabular-nums text-[var(--m3-on-surface)] text-right hover:text-[var(--ui-accent)] hover:bg-[var(--m3-surface-container-high)] cursor-pointer"
          >
            = {item.result}
          </button>
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
      {/* Taller Top Sheet Header & Drag-to-Collapse Zone */}
      <div
        data-testid="history-sheet-top-bar"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        className="px-4 pt-[max(14px,env(safe-area-inset-top,14px))] pb-3.5 min-h-[76px] border-b border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)] flex flex-col justify-between gap-2 touch-none shrink-0 cursor-grab active:cursor-grabbing"
      >
        {/* Top Pull/Collapse Pill */}
        <div
          data-testid="history-sheet-top-handle"
          className="w-full flex items-center justify-center py-1"
        >
          <div className="w-10 h-1 rounded-full bg-[var(--m3-on-surface-variant)]/45" />
        </div>

        {/* Title & Actions Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-[var(--m3-on-surface)]">
              History
            </span>
            {history.length > 0 && (
              <span className="text-[11px] font-medium tabular-nums text-[var(--m3-on-surface-variant)]">
                ({history.length})
              </span>
            )}
            {copiedNotice && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ui-accent)]">
                <Check className="w-3 h-3" />
                {copiedNotice}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              showClearConfirm ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playKeyClick('action');
                      onClearHistory();
                      setShowClearConfirm(false);
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[var(--ui-danger)] text-[var(--ui-accent-text)] text-xs font-semibold cursor-pointer"
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[var(--m3-surface-container-high)] text-[var(--m3-on-surface-variant)] text-xs cursor-pointer"
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
                  aria-label="Clear all history"
                  title="Clear all history"
                  className="min-w-[40px] min-h-[40px] px-2.5 flex items-center justify-center gap-1 rounded-xl text-[var(--m3-on-surface-variant)] hover:text-[var(--ui-danger)] hover:bg-[var(--m3-surface-container-high)] text-xs font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
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
              title="Collapse history"
              className="min-w-[44px] min-h-[44px] -mr-1.5 flex items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container-high)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable History Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3.5 pb-4 space-y-2.5 no-scrollbar">
        {history.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs font-medium text-[var(--m3-on-surface-variant)]">
              No calculations yet
            </p>
            <p className="text-[11px] text-[var(--m3-on-surface-variant)]/75 mt-0.5">
              Tap expression to edit · Tap = to insert · Hold for actions
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
        className="w-full min-h-[48px] pt-3.5 pb-[max(14px,env(safe-area-inset-bottom,14px))] flex flex-col items-center justify-center gap-0.5 border-t border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)] cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <div className="w-10 h-1 rounded-full bg-[var(--m3-on-surface-variant)]/55" />
      </div>
    </div>
  );
};
