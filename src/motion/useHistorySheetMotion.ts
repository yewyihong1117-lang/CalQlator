import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  evaluateSpringProgress,
  prefersReducedMotion,
  SPRING_CONFIGS,
  SPRING_TOKENS,
} from './spring';

/**
 * 0 = Closed (HistorySheet tucked above top edge of calculator)
 * 1 = Expanded (HistorySheet covers full calculator screen like a notification drawer)
 */
export type HistorySnapState = 0 | 1;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function sheetOffsetYAtProgress(progress: number, sheetH: number): number {
  const sheetT = clamp(progress, 0, 1.04);
  return -(1 - sheetT) * Math.max(240, sheetH);
}

export function sheetOpacityAtProgress(progress: number): number {
  const sheetT = clamp(progress, 0, 1);
  return sheetT <= 0 ? 0 : clamp(sheetT * 8, 0, 1);
}

interface ActiveSnapTrack {
  fromP: number;
  toP: HistorySnapState;
  startTime: number;
  duration: number;
  reduced: boolean;
  anims: Animation[];
}

interface UseHistorySheetMotionOptions {
  enabled: boolean;
  mainRef: React.RefObject<HTMLElement | null>;
  historySheetRef: React.RefObject<HTMLDivElement | null>;
  onExpandedChange?: (expanded: boolean) => void;
}

export function useHistorySheetMotion({
  enabled,
  mainRef,
  historySheetRef,
  onExpandedChange,
}: UseHistorySheetMotionOptions) {
  const [isExpanded, setIsExpanded] = useState(false);
  const snapStateRef = useRef<HistorySnapState>(0);
  const progressRef = useRef<number>(0);
  const animTokenRef = useRef<number>(0);
  const activeSnapRef = useRef<ActiveSnapTrack | null>(null);
  const mainHRef = useRef<number>(844);
  const handledPointerTapAtRef = useRef<number>(0);

  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startP: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    moved: boolean;
    source: 'top' | 'sheet';
    startedOnGrab: boolean;
    startedOnCloseHandle: boolean;
  } | null>(null);

  const applyProgressToDom = useCallback(
    (p: number, isMoving: boolean) => {
      const sheetEl = historySheetRef.current;
      if (!sheetEl) return;

      const sheetH = Math.max(240, mainHRef.current);
      const sheetY = sheetOffsetYAtProgress(p, sheetH);
      const sheetOp = sheetOpacityAtProgress(p);
      const showSheet = p > 0.002 || (isMoving && p > 0);

      sheetEl.style.willChange = isMoving ? 'transform, opacity' : '';
      sheetEl.style.visibility = showSheet ? 'visible' : 'hidden';
      sheetEl.style.pointerEvents = !isMoving && p >= 0.98 ? 'auto' : 'none';
      sheetEl.style.transform =
        !isMoving && Math.abs(sheetY) < 0.1
          ? ''
          : `translate3d(0, ${sheetY.toFixed(2)}px, 0)`;
      sheetEl.style.opacity = sheetOp >= 0.999 ? '' : sheetOp.toFixed(3);
    },
    [historySheetRef]
  );

  const getCurrentProgress = useCallback((): number => {
    const track = activeSnapRef.current;
    if (!track) return progressRef.current;
    const elapsed = performance.now() - track.startTime;
    if (elapsed >= track.duration) {
      return track.toP;
    }
    const t = track.reduced
      ? Math.min(1, Math.max(0, elapsed / track.duration))
      : evaluateSpringProgress(SPRING_CONFIGS.spatial, elapsed / 1000);
    return track.fromP + (track.toP - track.fromP) * t;
  }, []);

  const cancelRunningAnims = useCallback(() => {
    const track = activeSnapRef.current;
    if (track) {
      for (const anim of track.anims) {
        try {
          anim.cancel();
        } catch {}
      }
      activeSnapRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const main = mainRef.current;
      if (main && main.clientHeight > 0) {
        mainHRef.current = main.clientHeight;
      }
      if (!activeSnapRef.current && !dragRef.current) {
        applyProgressToDom(progressRef.current, false);
      }
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mainRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(mainRef.current);
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mainRef, applyProgressToDom]);

  const snapToExpanded = useCallback(
    (expanded: boolean, immediate = false) => {
      const targetState: HistorySnapState = expanded ? 1 : 0;
      const fromP = getCurrentProgress();
      cancelRunningAnims();
      const token = ++animTokenRef.current;
      const reduced = prefersReducedMotion();

      snapStateRef.current = targetState;
      setIsExpanded(expanded);
      onExpandedChange?.(expanded);

      if (immediate || Math.abs(targetState - fromP) < 0.002) {
        progressRef.current = targetState;
        applyProgressToDom(targetState, false);
        return;
      }

      const sheetEl = historySheetRef.current;
      if (!sheetEl) {
        progressRef.current = targetState;
        return;
      }

      const sheetH = Math.max(240, mainHRef.current);
      sheetEl.style.visibility = 'visible';

      const anims: Animation[] = [];

      if (reduced) {
        const duration = SPRING_TOKENS.reducedMotion.duration;
        const easing = SPRING_TOKENS.reducedMotion.easing;
        sheetEl.style.willChange = 'opacity';
        sheetEl.style.transform = '';
        anims.push(
          sheetEl.animate(
            [
              { opacity: sheetOpacityAtProgress(fromP) },
              { opacity: sheetOpacityAtProgress(targetState) },
            ],
            { duration, easing, fill: 'forwards' }
          )
        );
        activeSnapRef.current = {
          fromP,
          toP: targetState,
          startTime: performance.now(),
          duration,
          reduced: true,
          anims,
        };
      } else {
        const duration = SPRING_TOKENS.spatial.duration;
        const samples = 24;
        const frames: Keyframe[] = [];
        for (let i = 0; i <= samples; i++) {
          const frac = i / samples;
          const springT =
            i === 0
              ? 0
              : i === samples
              ? 1
              : evaluateSpringProgress(SPRING_CONFIGS.spatial, (frac * duration) / 1000);
          const p = fromP + (targetState - fromP) * springT;
          const y = sheetOffsetYAtProgress(p, sheetH);
          const op = sheetOpacityAtProgress(p);
          frames.push({
            offset: frac,
            transform: `translate3d(0, ${y.toFixed(2)}px, 0)`,
            opacity: op,
          });
        }
        sheetEl.style.willChange = 'transform, opacity';
        anims.push(
          sheetEl.animate(frames, {
            duration,
            easing: 'linear',
            fill: 'forwards',
          })
        );
        activeSnapRef.current = {
          fromP,
          toP: targetState,
          startTime: performance.now(),
          duration,
          reduced: false,
          anims,
        };
      }

      anims[0].finished
        .then(() => {
          if (animTokenRef.current !== token) return;
          activeSnapRef.current = null;
          progressRef.current = targetState;
          applyProgressToDom(targetState, false);
          for (const anim of anims) {
            try {
              anim.cancel();
            } catch {}
          }
        })
        .catch(() => {
          // Cancelled by subsequent drag or snap
        });
    },
    [applyProgressToDom, cancelRunningAnims, getCurrentProgress, historySheetRef, onExpandedChange]
  );

  const handleDragStart = useCallback(
    (e: React.PointerEvent, source: 'top' | 'sheet') => {
      if (source === 'top' && !enabled) return;
      const target = e.target as HTMLElement | null;
      if (source === 'sheet' && target?.closest('button')) {
        return;
      }
      if (source === 'top' && target?.closest('button[aria-label="Settings and Modes"]')) {
        return;
      }

      const startP = getCurrentProgress();
      animTokenRef.current++;
      cancelRunningAnims();
      progressRef.current = startP;

      dragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startP,
        lastY: e.clientY,
        lastTime: performance.now(),
        velocityY: 0,
        moved: false,
        source,
        startedOnGrab: Boolean(target?.closest('[data-testid="history-grab-handle"]')),
        startedOnCloseHandle: Boolean(
          target?.closest('[data-testid="history-sheet-close-handle"], [data-testid="history-sheet-top-handle"]')
        ),
      };

      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [cancelRunningAnims, enabled, getCurrentProgress]
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const totalDy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(totalDy) > 6) {
        drag.moved = true;
      }
      if (!drag.moved) return;

      const now = performance.now();
      const dt = Math.max(1, now - drag.lastTime);
      const instVy = (e.clientY - drag.lastY) / dt;
      drag.velocityY = drag.velocityY * 0.65 + instVy * 0.35;
      drag.lastY = e.clientY;
      drag.lastTime = now;

      const sheetSpanPx = Math.max(240, mainHRef.current);
      const rawP = drag.startP + totalDy / sheetSpanPx;
      const nextP = rawP > 1 ? 1 + (rawP - 1) * 0.15 : clamp(rawP, 0, 1.04);

      progressRef.current = nextP;
      applyProgressToDom(nextP, true);
    },
    [applyProgressToDom]
  );

  const handleDragEnd = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}

      if (!drag.moved) {
        if (drag.source === 'sheet' && drag.startedOnCloseHandle) {
          handledPointerTapAtRef.current = performance.now();
          snapToExpanded(false);
        } else if (drag.source === 'top' && drag.startedOnGrab) {
          handledPointerTapAtRef.current = performance.now();
          snapToExpanded(true);
        }
        return;
      }

      const currentP = progressRef.current;
      const vy = drag.velocityY;
      let shouldExpand: boolean;

      if (Math.abs(vy) > 0.3) {
        shouldExpand = vy > 0;
      } else {
        shouldExpand = currentP >= 0.35;
      }

      snapToExpanded(shouldExpand);
    },
    [snapToExpanded]
  );

  const wasRecentPointerTap = useCallback(() => {
    return performance.now() - handledPointerTapAtRef.current < 120;
  }, []);

  return {
    isExpanded,
    snapToExpanded,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    wasRecentPointerTap,
  };
}
