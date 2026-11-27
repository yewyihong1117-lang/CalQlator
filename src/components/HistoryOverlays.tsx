import React, { useLayoutEffect, useRef } from 'react';
import { Copy, Pin, PinOff, Trash2, RotateCcw, ArrowUpRight, X } from 'lucide-react';
import { MergedHistoryEntry, formatHistoryTimestamp } from '../historyUtils';
import { formatDisplayNumberWithCommas } from '../displayFormat';
import { animateSpringTransform, computeFlipDelta, prefersReducedMotion } from '../motion/spring';
import { playKeyClick } from '../audioFeedback';

interface HistoryContextMenuProps {
  entry: MergedHistoryEntry | null;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onCopyResult: (entry: MergedHistoryEntry) => void;
  onCopyExpression: (entry: MergedHistoryEntry) => void;
  onLoadExpression?: (entry: MergedHistoryEntry) => void;
  onTogglePin: (entry: MergedHistoryEntry) => void;
  onDelete: (entry: MergedHistoryEntry) => void;
}

export const HistoryContextMenu: React.FC<HistoryContextMenuProps> = ({
  entry,
  anchorRect,
  onClose,
  onCopyResult,
  onCopyExpression,
  onLoadExpression,
  onTogglePin,
  onDelete,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!entry || !el) return;
    if (prefersReducedMotion() || !anchorRect) {
      animateSpringTransform(
        el,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
        'effects',
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
      );
      return;
    }
    const targetRect = el.getBoundingClientRect();
    const delta = computeFlipDelta(anchorRect, targetRect);
    animateSpringTransform(
      el,
      { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
      'spatial',
      { ...delta, opacity: 0.2 }
    );
  }, [entry, anchorRect]);

  if (!entry) return null;

  return (
    <div
      data-testid="history-context-menu-backdrop"
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg)]/80"
    >
      <div
        ref={cardRef}
        data-testid="history-context-menu"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[300px] rounded-2xl bg-[var(--display-surface)] border border-[var(--display-divider)] shadow-2xl p-3 text-[var(--display-text)] select-none"
      >
        <div className="flex items-start justify-between gap-2 pb-2.5 mb-2 border-b border-[var(--display-divider)]">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-[var(--display-muted)] truncate">
              {formatDisplayNumberWithCommas(entry.primary.expression)}
            </div>
            <div className="text-base font-bold tabular-nums text-[var(--display-text)] truncate">
              = {formatDisplayNumberWithCommas(entry.primary.result)}
            </div>
            <div
              data-testid="history-context-timestamp"
              className="text-[11px] tabular-nums text-[var(--ui-accent)] mt-0.5"
            >
              {formatHistoryTimestamp(entry.primary.timestamp)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close actions menu"
            className="min-w-[48px] min-h-[48px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[var(--display-muted)] hover:text-[var(--display-text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            data-testid="history-ctx-copy-result"
            onClick={() => {
              playKeyClick('action');
              onCopyResult(entry);
              onClose();
            }}
            className="w-full min-h-[48px] px-3 rounded-xl hover:bg-[var(--ui-accent-tonal)] flex items-center gap-2.5 text-sm font-medium text-[var(--display-text)] cursor-pointer"
          >
            <Copy className="w-4 h-4 text-[var(--ui-accent)]" />
            <span>Copy result</span>
          </button>

          <button
            type="button"
            data-testid="history-ctx-copy-expr"
            onClick={() => {
              playKeyClick('action');
              onCopyExpression(entry);
              onClose();
            }}
            className="w-full min-h-[48px] px-3 rounded-xl hover:bg-[var(--ui-accent-tonal)] flex items-center gap-2.5 text-sm font-medium text-[var(--display-text)] cursor-pointer"
          >
            <Copy className="w-4 h-4 text-[var(--ui-accent)]" />
            <span>Copy expression</span>
          </button>

          {onLoadExpression && (
            <button
              type="button"
              data-testid="history-ctx-load-expr"
              onClick={() => {
                playKeyClick('action');
                onLoadExpression(entry);
                onClose();
              }}
              className="w-full min-h-[48px] px-3 rounded-xl hover:bg-[var(--ui-accent-tonal)] flex items-center gap-2.5 text-sm font-medium text-[var(--display-text)] cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-[var(--ui-accent)]" />
              <span>Edit expression</span>
            </button>
          )}

          <button
            type="button"
            data-testid="history-ctx-toggle-pin"
            onClick={() => {
              playKeyClick('action');
              onTogglePin(entry);
              onClose();
            }}
            className="w-full min-h-[48px] px-3 rounded-xl hover:bg-[var(--ui-accent-tonal)] flex items-center gap-2.5 text-sm font-medium text-[var(--display-text)] cursor-pointer"
          >
            {entry.pinned ? (
              <>
                <PinOff className="w-4 h-4 text-[var(--ui-accent)]" />
                <span>Unpin</span>
              </>
            ) : (
              <>
                <Pin className="w-4 h-4 text-[var(--ui-accent)]" />
                <span>Pin</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="history-ctx-delete"
            onClick={() => {
              playKeyClick('action');
              onDelete(entry);
              onClose();
            }}
            className="w-full min-h-[48px] px-3 rounded-xl hover:bg-[var(--display-bg)] flex items-center gap-2.5 text-sm font-medium text-[var(--ui-danger)] cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ExpressionCopyMenuProps {
  isOpen: boolean;
  expressionText: string;
  resultText: string;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onCopyExpression: () => void;
  onCopyResult: () => void;
}

export const ExpressionCopyMenu: React.FC<ExpressionCopyMenuProps> = ({
  isOpen,
  expressionText,
  resultText,
  anchorRect,
  onClose,
  onCopyExpression,
  onCopyResult,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!isOpen || !el) return;
    if (prefersReducedMotion() || !anchorRect) {
      animateSpringTransform(
        el,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
        'effects',
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
      );
      return;
    }
    const targetRect = el.getBoundingClientRect();
    const delta = computeFlipDelta(anchorRect, targetRect);
    animateSpringTransform(
      el,
      { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
      'spatial',
      { ...delta, opacity: 0.25 }
    );
  }, [isOpen, anchorRect]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="expression-copy-menu-backdrop"
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg)]/75"
    >
      <div
        ref={cardRef}
        data-testid="expression-copy-menu"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[270px] rounded-2xl bg-[var(--display-surface)] border border-[var(--display-divider)] shadow-2xl p-2.5 text-[var(--display-text)] select-none"
      >
        <div className="px-2 pb-2 mb-1.5 border-b border-[var(--display-divider)] flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--display-muted)] truncate">
            {formatDisplayNumberWithCommas(expressionText || '0')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close copy menu"
            className="min-w-[48px] min-h-[48px] -mr-2 -my-2 flex items-center justify-center rounded-xl text-[var(--display-muted)] hover:text-[var(--display-text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          type="button"
          data-testid="expr-ctx-copy-expression"
          onClick={() => {
            playKeyClick('action');
            onCopyExpression();
            onClose();
          }}
          className="w-full min-h-[48px] px-3 rounded-xl hover:bg-[var(--ui-accent-tonal)] flex items-center gap-2.5 text-sm font-medium text-[var(--display-text)] cursor-pointer"
        >
          <Copy className="w-4 h-4 text-[var(--ui-accent)]" />
          <span>Copy expression</span>
        </button>
        {resultText && (
          <button
            type="button"
            data-testid="expr-ctx-copy-result"
            onClick={() => {
              playKeyClick('action');
              onCopyResult();
              onClose();
            }}
            className="w-full min-h-[48px] px-3 rounded-xl hover:bg-[var(--ui-accent-tonal)] flex items-center gap-2.5 text-sm font-medium text-[var(--display-text)] cursor-pointer"
          >
            <Copy className="w-4 h-4 text-[var(--ui-accent)]" />
            <span>Copy result</span>
          </button>
        )}
      </div>
    </div>
  );
};

interface CopiedToastProps {
  visible: boolean;
  label?: string;
}

export const CopiedToast: React.FC<CopiedToastProps> = ({ visible, label = 'Copied' }) => {
  const toastRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = toastRef.current;
    if (!visible || !el) return;
    animateSpringTransform(
      el,
      { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
      'effects',
      { x: 0, y: -8, sx: 0.94, sy: 0.94, opacity: 0 }
    );
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={toastRef}
      data-testid="copied-toast"
      role="status"
      aria-live="polite"
      className="absolute top-[max(24px,env(safe-area-inset-top,24px))] left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-[var(--display-surface)] border border-[var(--display-divider)] text-xs font-semibold text-[var(--display-text)] shadow-lg pointer-events-none select-none"
    >
      {label}
    </div>
  );
};

interface HistoryUndoSnackbarProps {
  message: string | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export const HistoryUndoSnackbar: React.FC<HistoryUndoSnackbarProps> = ({
  message,
  onUndo,
  onDismiss,
}) => {
  const snackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = snackRef.current;
    if (!message || !el) return;
    if (prefersReducedMotion()) {
      animateSpringTransform(
        el,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
        'effects',
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
      );
    } else {
      animateSpringTransform(
        el,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
        'spatial',
        { x: 0, y: 20, sx: 0.94, sy: 0.94, opacity: 0 }
      );
    }
  }, [message]);

  if (!message) return null;

  return (
    <div
      ref={snackRef}
      data-testid="history-undo-snackbar"
      role="status"
      aria-live="polite"
      className="absolute bottom-[max(24px,env(safe-area-inset-bottom,24px))] left-3 right-3 z-50 min-h-[48px] px-3.5 py-1.5 rounded-2xl bg-[var(--display-surface)] border border-[var(--ui-accent)]/45 shadow-xl flex items-center justify-between gap-2 text-xs text-[var(--display-text)]"
    >
      <span className="font-medium truncate">{message}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          data-testid="history-undo-btn"
          onClick={() => {
            playKeyClick('action');
            onUndo();
          }}
          className="min-h-[48px] px-3 rounded-xl bg-[var(--ui-accent-tonal)] text-[var(--ui-accent)] font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Undo</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-[var(--display-muted)] hover:text-[var(--display-text)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
