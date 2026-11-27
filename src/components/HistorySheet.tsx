import React, { useEffect, useMemo, useState } from 'react';
import { Search, Settings, Trash2, X } from 'lucide-react';
import { HistoryItem } from '../calcEngine';
import { buildVirtualHistoryLayout, MergedHistoryEntry } from '../historyUtils';
import { VirtualizedHistoryList } from './VirtualizedHistoryList';
import { playKeyClick } from '../audioFeedback';

interface HistorySheetProps {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  isExpanded: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandlePointerMove: (e: React.PointerEvent) => void;
  onHandlePointerUp: (e: React.PointerEvent) => void;
  history: HistoryItem[];
  onLoadCard: (entry: MergedHistoryEntry) => void;
  onInsertResult: (entry: MergedHistoryEntry) => void;
  onTogglePinEntry: (entry: MergedHistoryEntry) => void;
  onDeleteEntry: (entry: MergedHistoryEntry) => void;
  onLongPressEntry: (entry: MergedHistoryEntry, rect: DOMRect) => void;
  onClearHistory: () => void;
}

export const HistorySheet: React.FC<HistorySheetProps> = ({
  sheetRef,
  isExpanded,
  onClose,
  onOpenSettings,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  history,
  onLoadCard,
  onInsertResult,
  onTogglePinEntry,
  onDeleteEntry,
  onLongPressEntry,
  onClearHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isExpanded) {
      setSearchQuery('');
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded, onClose]);

  const layout = useMemo(
    () => buildVirtualHistoryLayout(history, 'full', searchQuery),
    [history, searchQuery]
  );

  return (
    <div
      ref={sheetRef}
      data-testid="history-sheet"
      aria-hidden={!isExpanded}
      onPointerDown={onHandlePointerDown}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onPointerCancel={onHandlePointerUp}
      style={{
        visibility: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      }}
      className="absolute inset-0 z-40 bg-[var(--display-bg)] text-[var(--display-text)] flex flex-col overflow-hidden"
    >
      {/* Top Bar */}
      <div
        data-testid="history-sheet-top-bar"
        className="px-4 pt-[max(24px,env(safe-area-inset-top,24px))] pb-2.5 border-b border-[var(--display-divider)] bg-[var(--display-bg)] flex flex-col gap-2 shrink-0"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-bold tracking-tight text-[var(--display-text)] whitespace-nowrap">
              History
            </h2>
            <span className="text-xs font-medium tabular-nums text-[var(--display-muted)]">
              · {layout.mergedCount}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {history.length > 0 && (
              <button
                type="button"
                data-testid="history-clear-all-btn"
                onClick={() => {
                  playKeyClick('action');
                  onClearHistory();
                }}
                aria-label="Clear all history"
                className="min-h-[48px] px-3 flex items-center justify-center gap-1.5 rounded-xl text-[var(--ui-danger)] hover:bg-[var(--display-surface)] text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear all</span>
              </button>
            )}
            <button
              type="button"
              data-testid="history-settings-btn"
              onClick={() => {
                playKeyClick('action');
                onOpenSettings();
              }}
              aria-label="Settings and Modes"
              className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-[var(--display-muted)] active:text-[var(--display-text)] focus-visible:text-[var(--display-text)] cursor-pointer transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              data-testid="history-full-close-btn"
              onClick={() => {
                playKeyClick('action');
                onClose();
              }}
              aria-label="Close history"
              className="min-w-[48px] min-h-[48px] -mr-2 flex items-center justify-center rounded-xl text-[var(--display-muted)] active:text-[var(--display-text)] focus-visible:text-[var(--display-text)] cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center w-full">
          <Search className="w-3.5 h-3.5 text-[var(--display-muted)] absolute left-3 pointer-events-none" />
          <input
            type="text"
            data-testid="history-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search expressions or results..."
            aria-label="Search history"
            className="w-full min-h-[48px] pl-9 pr-10 py-1.5 rounded-xl bg-[var(--display-surface)] border border-[var(--display-divider)] focus:border-[var(--ui-accent)] focus:outline-none text-xs text-[var(--display-text)] placeholder:text-[var(--display-muted)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-0 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-[var(--display-muted)] active:text-[var(--display-text)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Virtualized History List */}
      <div className="flex-1 min-h-0 px-3 py-2 overflow-hidden">
        <VirtualizedHistoryList
          layout={layout}
          variant="full"
          isActive={isExpanded}
          onLoadExpression={onLoadCard}
          onInsertResult={onInsertResult}
          onDeleteEntry={onDeleteEntry}
          onTogglePinEntry={onTogglePinEntry}
          onLongPressEntry={onLongPressEntry}
          emptyTitle={searchQuery.trim() ? 'No matching calculations' : 'No calculations yet'}
          emptySubtitle={
            searchQuery.trim()
              ? 'Try another search term'
              : 'Tap any line to insert result into expression'
          }
          testId="history-full-virtual-list"
        />
      </div>

      {/* Bottom Close Bar (>=24px clear of bottom screen edge) */}
      <div className="shrink-0 w-full pb-[max(24px,env(safe-area-inset-bottom,24px))] border-t border-[var(--display-divider)] bg-[var(--display-bg)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          className="w-full min-h-[48px] flex items-center justify-center text-xs font-medium text-[var(--display-muted)] active:text-[var(--display-text)] cursor-pointer transition-colors"
        >
          Close history
        </button>
      </div>
    </div>
  );
};
