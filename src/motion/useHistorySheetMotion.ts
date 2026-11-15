import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  evaluateSpringProgress,
  prefersReducedMotion,
  SPRING_CONFIGS,
  SPRING_TOKENS,
} from './spring';

/**
 * 0 = Collapsed (active input/result LARGE, inline history & sheet hidden)
 * 1 = Peek (default: active input/result NORMAL, inline history visible)
 * 2 = Expanded (active input/result COMPACT pinned above keypad, HistorySheet fills space above)
 */
export type HistorySnapState = 0 | 1 | 2;

export const SCALE_COLLAPSED = 1.0;
export const SCALE_PEEK = 0.75;
export const SCALE_EXPANDED = 0.56;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function scaleAtProgress(progress: number): number {
  const p = clamp(progress, -0.15, 2.15);
  if (p <= 1) {
    return SCALE_COLLAPSED + (SCALE_PEEK - SCALE_COLLAPSED) * p;
  }
  return SCALE_PEEK + (SCALE_EXPANDED - SCALE_PEEK) * (p - 1);
}

export function inlineOpacityAtProgress(progress: number): number {
  return clamp(1 - Math.abs(progress - 1) * 1.25, 0, 1);
}

export function inlineOffsetYAtProgress(progress: number, activeBaseH: number): number {
  const scale = scaleAtProgress(progress);
  const growthShift = (SCALE_PEEK - scale) * activeBaseH;
  if (progress < 1) {
    return growthShift - (1 - progress) * 14;
  }
  return growthShift;
}

export function sheetOffsetYAtProgress(progress: number, sheetH: number): number {
  const sheetT = clamp(progress - 1, 0, 1);
  return -(1 - sheetT) * Math.max(120, sheetH);
}

export function sheetOpacityAtProgress(progress: number): number {
  const sheetT = clamp(progress - 1, 0, 1);
  return sheetT <= 0 ? 0 : clamp(sheetT * 1.25, 0, 1);
}

interface ActiveSnapTrack {
  fromP: number;
  toP: HistorySnapState;
  startTime: number;
  duration: number;
  reduced: boolean;
  anims: Animation[];
}

export interface HistoryLayoutMetrics {
  displayH: number;
  activeBaseH: number;
  activeResH: number;
  inlineVisibleH: number;
  compactReservedBottomPx: number;
  peekReservedBottomPx: number;
}

interface UseHistorySheetMotionOptions {
  enabled: boolean;
  displayRef: React.RefObject<HTMLDivElement | null>;
  activeInputScaleRef: React.RefObject<HTMLDivElement | null>;
  activeResScaleRef: React.RefObject<HTMLDivElement | null>;
  inlineHistoryRef: React.RefObject<HTMLDivElement | null>;
  historySheetRef: React.RefObject<HTMLDivElement | null>;
  onStateCommitted?: (state: HistorySnapState) => void;
}

export function useHistorySheetMotion({
  enabled,
  displayRef,
  activeInputScaleRef,
  activeResScaleRef,
  inlineHistoryRef,
  historySheetRef,
  onStateCommitted,
}: UseHistorySheetMotionOptions) {
  const [snapState, setSnapState] = useState<HistorySnapState>(1);
  const snapStateRef = useRef<HistorySnapState>(1);
  const progressRef = useRef<number>(1);
  const animTokenRef = useRef<number>(0);
  const activeSnapRef = useRef<ActiveSnapTrack | null>(null);

  const metricsRef = useRef<HistoryLayoutMetrics>({
    displayH: 420,
    activeBaseH: 106,
    activeResH: 52,
    inlineVisibleH: 260,
    compactReservedBottomPx: 68,
    peekReservedBottomPx: 80,
  });

  const [reservedLayout, setReservedLayout] = useState<{
    compactBottomPx: number;
    peekBottomPx: number;
  }>({
    compactBottomPx: 68,
    peekBottomPx: 80,
  });

  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startP: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    moved: boolean;
    source: 'top' | 'sheet';
  } | null>(null);

  const applyProgressToDom = useCallback((p: number, isMoving: boolean) => {
    const { displayH, activeBaseH, activeResH, compactReservedBottomPx } = metricsRef.current;
    const sheetH = Math.max(120, displayH - compactReservedBottomPx);
    const scale = scaleAtProgress(p);
    const inputDy = activeResH * (1 - scale);
    const inlineY = inlineOffsetYAtProgress(p, activeBaseH);
    const inlineOp = inlineOpacityAtProgress(p);
    const sheetY = sheetOffsetYAtProgress(p, sheetH);
    const sheetOp = sheetOpacityAtProgress(p);
    const showSheet = p > 1.001 || (isMoving && p > 0.99);

    const inputEl = activeInputScaleRef.current;
    if (inputEl) {
      inputEl.style.willChange = isMoving ? 'transform' : '';
      if (!isMoving && Math.abs(scale - 1) < 0.001 && Math.abs(inputDy) < 0.05) {
        inputEl.style.transform = '';
      } else if (isMoving) {
        inputEl.style.transform = `translate3d(0, ${inputDy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      } else {
        inputEl.style.transform = `translate(0px, ${inputDy.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      }
    }

    const resEl = activeResScaleRef.current;
    if (resEl) {
      resEl.style.willChange = isMoving ? 'transform' : '';
      if (!isMoving && Math.abs(scale - 1) < 0.001) {
        resEl.style.transform = '';
      } else if (isMoving) {
        resEl.style.transform = `translate3d(0, 0, 0) scale(${scale.toFixed(4)})`;
      } else {
        resEl.style.transform = `scale(${scale.toFixed(4)})`;
      }
    }

    const inlineEl = inlineHistoryRef.current;
    if (inlineEl) {
      inlineEl.style.willChange = isMoving ? 'transform, opacity' : '';
      inlineEl.style.transform = isMoving
        ? `translate3d(0, ${inlineY.toFixed(2)}px, 0)`
        : Math.abs(inlineY) < 0.1
        ? ''
        : `translate(0px, ${inlineY.toFixed(2)}px)`;
      inlineEl.style.opacity = inlineOp >= 0.999 ? '' : inlineOp.toFixed(3);
      inlineEl.style.pointerEvents = !isMoving && Math.abs(p - 1) < 0.05 ? 'auto' : 'none';
    }

    const sheetEl = historySheetRef.current;
    if (sheetEl) {
      sheetEl.style.willChange = isMoving ? 'transform, opacity' : '';
      sheetEl.style.visibility = showSheet ? 'visible' : 'hidden';
      sheetEl.style.pointerEvents = !isMoving && p >= 1.99 ? 'auto' : 'none';
      sheetEl.style.transform =
        !isMoving && Math.abs(sheetY) < 0.1
          ? ''
          : `translate3d(0, ${sheetY.toFixed(2)}px, 0)`;
      sheetEl.style.opacity = sheetOp >= 0.999 ? '' : sheetOp.toFixed(3);
    }
  }, [activeInputScaleRef, activeResScaleRef, historySheetRef, inlineHistoryRef]);

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

  // Precompute display & active area sizes via ResizeObserver (no layout reads during drag/animation)
  useLayoutEffect(() => {
    if (!enabled) return;

    const measure = () => {
      const disp = displayRef.current;
      const inEl = activeInputScaleRef.current;
      const resEl = activeResScaleRef.current;
      const inlineEl = inlineHistoryRef.current;

      const displayH = disp ? disp.clientHeight : metricsRef.current.displayH;
      const inH = inEl ? inEl.offsetHeight : 54;
      const resH = resEl ? resEl.offsetHeight : 52;
      const activeBaseH = inH + resH + 6;
      const inlineVisibleH = inlineEl ? inlineEl.clientHeight : metricsRef.current.inlineVisibleH;
      const compactReservedBottomPx = Math.round(activeBaseH * SCALE_EXPANDED + 8);
      const peekReservedBottomPx = Math.round(activeBaseH * SCALE_PEEK);

      metricsRef.current = {
        displayH,
        activeBaseH,
        activeResH: resH,
        inlineVisibleH,
        compactReservedBottomPx,
        peekReservedBottomPx,
      };

      setReservedLayout((prev) => {
        if (
          prev.compactBottomPx === compactReservedBottomPx &&
          prev.peekBottomPx === peekReservedBottomPx
        ) {
          return prev;
        }
        return {
          compactBottomPx: compactReservedBottomPx,
          peekBottomPx: peekReservedBottomPx,
        };
      });

      if (!activeSnapRef.current && !dragRef.current) {
        applyProgressToDom(progressRef.current, false);
      }
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      if (displayRef.current) ro.observe(displayRef.current);
      if (activeInputScaleRef.current) ro.observe(activeInputScaleRef.current);
      if (activeResScaleRef.current) ro.observe(activeResScaleRef.current);
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [
    enabled,
    displayRef,
    activeInputScaleRef,
    activeResScaleRef,
    inlineHistoryRef,
    applyProgressToDom,
  ]);

  const snapToState = useCallback(
    (targetState: HistorySnapState, immediate = false) => {
      const fromP = getCurrentProgress();
      cancelRunningAnims();
      const token = ++animTokenRef.current;
      const reduced = prefersReducedMotion();

      snapStateRef.current = targetState;
      setSnapState(targetState);

      if (immediate || Math.abs(targetState - fromP) < 0.002) {
        progressRef.current = targetState;
        applyProgressToDom(targetState, false);
        onStateCommitted?.(targetState);
        return;
      }

      const { displayH, activeBaseH, activeResH, compactReservedBottomPx } = metricsRef.current;
      const sheetH = Math.max(120, displayH - compactReservedBottomPx);
      const inputEl = activeInputScaleRef.current;
      const resEl = activeResScaleRef.current;
      const inlineEl = inlineHistoryRef.current;
      const sheetEl = historySheetRef.current;

      // Ensure sheet is visible during any transition involving > 1
      if (sheetEl && (fromP > 1 || targetState > 1)) {
        sheetEl.style.visibility = 'visible';
      }

      const anims: Animation[] = [];

      if (reduced) {
        const duration = SPRING_TOKENS.reducedMotion.duration;
        const easing = SPRING_TOKENS.reducedMotion.easing;

        const targetScale = scaleAtProgress(targetState);
        const targetDy = activeResH * (1 - targetScale);
        const fromScale = scaleAtProgress(fromP);
        const fromDy = activeResH * (1 - fromScale);

        if (inputEl) {
          inputEl.style.willChange = 'transform';
          anims.push(
            inputEl.animate(
              [
                { transform: `translate3d(0, ${fromDy.toFixed(2)}px, 0) scale(${fromScale.toFixed(4)})` },
                { transform: `translate3d(0, ${targetDy.toFixed(2)}px, 0) scale(${targetScale.toFixed(4)})` },
              ],
              { duration, easing, fill: 'forwards' }
            )
          );
        }
        if (resEl) {
          resEl.style.willChange = 'transform';
          anims.push(
            resEl.animate(
              [
                { transform: `scale(${fromScale.toFixed(4)})` },
                { transform: `scale(${targetScale.toFixed(4)})` },
              ],
              { duration, easing, fill: 'forwards' }
            )
          );
        }
        if (inlineEl) {
          inlineEl.style.willChange = 'opacity';
          anims.push(
            inlineEl.animate(
              [
                { opacity: inlineOpacityAtProgress(fromP) },
                { opacity: inlineOpacityAtProgress(targetState) },
              ],
              { duration, easing, fill: 'forwards' }
            )
          );
        }
        if (sheetEl && (fromP > 1 || targetState > 1)) {
          sheetEl.style.willChange = 'opacity';
          anims.push(
            sheetEl.animate(
              [
                { opacity: sheetOpacityAtProgress(fromP) },
                { opacity: sheetOpacityAtProgress(targetState) },
              ],
              { duration, easing, fill: 'forwards' }
            )
          );
        }

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
        const samples = 28;
        const inputFrames: Keyframe[] = [];
        const resFrames: Keyframe[] = [];
        const inlineFrames: Keyframe[] = [];
        const sheetFrames: Keyframe[] = [];

        for (let i = 0; i <= samples; i++) {
          const frac = i / samples;
          const springT =
            i === 0
              ? 0
              : i === samples
              ? 1
              : evaluateSpringProgress(SPRING_CONFIGS.spatial, (frac * duration) / 1000);
          const p = fromP + (targetState - fromP) * springT;
          const scale = scaleAtProgress(p);
          const inputDy = activeResH * (1 - scale);
          const inlineY = inlineOffsetYAtProgress(p, activeBaseH);
          const inlineOp = inlineOpacityAtProgress(p);
          const sheetY = sheetOffsetYAtProgress(p, sheetH);
          const sheetOp = sheetOpacityAtProgress(p);

          inputFrames.push({
            offset: frac,
            transform: `translate3d(0, ${inputDy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
          });
          resFrames.push({
            offset: frac,
            transform: `scale(${scale.toFixed(4)})`,
          });
          inlineFrames.push({
            offset: frac,
            transform: `translate3d(0, ${inlineY.toFixed(2)}px, 0)`,
            opacity: inlineOp,
          });
          sheetFrames.push({
            offset: frac,
            transform: `translate3d(0, ${sheetY.toFixed(2)}px, 0)`,
            opacity: sheetOp,
          });
        }

        const timing: KeyframeAnimationOptions = {
          duration,
          easing: 'linear',
          fill: 'forwards',
        };

        if (inputEl) {
          inputEl.style.willChange = 'transform';
          anims.push(inputEl.animate(inputFrames, timing));
        }
        if (resEl) {
          resEl.style.willChange = 'transform';
          anims.push(resEl.animate(resFrames, timing));
        }
        if (inlineEl) {
          inlineEl.style.willChange = 'transform, opacity';
          anims.push(inlineEl.animate(inlineFrames, timing));
        }
        if (sheetEl && (fromP > 1 || targetState > 1)) {
          sheetEl.style.willChange = 'transform, opacity';
          anims.push(sheetEl.animate(sheetFrames, timing));
        }

        activeSnapRef.current = {
          fromP,
          toP: targetState,
          startTime: performance.now(),
          duration,
          reduced: false,
          anims,
        };
      }

      if (anims.length === 0) {
        progressRef.current = targetState;
        applyProgressToDom(targetState, false);
        onStateCommitted?.(targetState);
        return;
      }

      const primary = anims[0];
      primary.finished
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
          onStateCommitted?.(targetState);
        })
        .catch(() => {
          // Interrupted/cancelled by user drag or subsequent snap
        });
    },
    [
      activeInputScaleRef,
      activeResScaleRef,
      applyProgressToDom,
      cancelRunningAnims,
      getCurrentProgress,
      historySheetRef,
      inlineHistoryRef,
      onStateCommitted,
    ]
  );

  const handleDragStart = useCallback(
    (e: React.PointerEvent, source: 'top' | 'sheet') => {
      if (!enabled) return;
      if (source === 'sheet' && (e.target as HTMLElement | null)?.closest('button')) {
        return;
      }
      if (source === 'top' && (e.target as HTMLElement | null)?.closest('button[aria-label="Settings and Modes"]')) {
        return;
      }

      const startP = getCurrentProgress();
      animTokenRef.current++;
      cancelRunningAnims();
      progressRef.current = startP;
      applyProgressToDom(startP, true);

      dragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startP,
        lastY: e.clientY,
        lastTime: performance.now(),
        velocityY: 0,
        moved: false,
        source,
      };

      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [applyProgressToDom, cancelRunningAnims, enabled, getCurrentProgress]
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const totalDy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(totalDy) > 5) {
        drag.moved = true;
      }

      const now = performance.now();
      const dt = Math.max(1, now - drag.lastTime);
      const instVy = (e.clientY - drag.lastY) / dt;
      drag.velocityY = drag.velocityY * 0.65 + instVy * 0.35;
      drag.lastY = e.clientY;
      drag.lastTime = now;

      const { displayH, compactReservedBottomPx, inlineVisibleH } = metricsRef.current;
      const sheetSpanPx = Math.max(130, displayH - compactReservedBottomPx);
      const collapseSpanPx = clamp(inlineVisibleH * 0.55, 76, 130);

      // Piecewise mapping so finger sticks 1:1 to sheet handle in [1,2] and smoothly maps collapse in [0,1]
      const rawPxFromPeek =
        drag.startP >= 1
          ? (drag.startP - 1) * sheetSpanPx + totalDy
          : (drag.startP - 1) * collapseSpanPx + totalDy;

      let nextP: number;
      if (rawPxFromPeek >= 0) {
        const rawP = 1 + rawPxFromPeek / sheetSpanPx;
        nextP = rawP > 2 ? 2 + (rawP - 2) * 0.2 : rawP;
      } else {
        const rawP = 1 + rawPxFromPeek / collapseSpanPx;
        nextP = rawP < 0 ? rawP * 0.2 : rawP;
      }

      nextP = clamp(nextP, -0.15, 2.15);
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
        // Pure tap on handle
        if (drag.source === 'sheet') {
          snapToState(1);
        } else {
          const cur = snapStateRef.current;
          snapToState(cur === 0 ? 1 : 2);
        }
        return;
      }

      const currentP = progressRef.current;
      const vy = drag.velocityY; // positive = dragging downward -> increasing progress
      let target: HistorySnapState;

      if (Math.abs(vy) > 0.35) {
        const dir = vy > 0 ? 1 : -1;
        if (dir > 0) {
          target = currentP > 1.12 ? 2 : currentP > 0.12 ? 1 : 0;
        } else {
          target = currentP < 0.88 ? 0 : currentP < 1.88 ? 1 : 2;
        }
      } else {
        target = clamp(Math.round(currentP), 0, 2) as HistorySnapState;
      }

      snapToState(target);
    },
    [snapToState]
  );

  return {
    snapState,
    reservedLayout,
    snapToState,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
