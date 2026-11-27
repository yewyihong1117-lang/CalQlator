import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  evaluateSpringProgress,
  prefersReducedMotion,
  SPRING_CONFIGS,
  SPRING_TOKENS,
} from './spring';
import { triggerHaptic } from '../audioFeedback';

/**
 * 0 = CLOSED (Calculator display active)
 * 1 = FULL   (Full-screen history list)
 */
export type HistoryDetent = 0 | 1;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

interface ActiveSnapTrack {
  fromP: number;
  toP: HistoryDetent;
  startTime: number;
  duration: number;
  reduced: boolean;
  rafId: number;
}

interface UseHistorySheetMotionOptions {
  enabled: boolean;
  mainRef: React.RefObject<HTMLElement | null>;
  fullSheetRef: React.RefObject<HTMLDivElement | null>;
  onDetentChange?: (detent: HistoryDetent) => void;
}

export function useHistorySheetMotion({
  enabled,
  mainRef,
  fullSheetRef,
  onDetentChange,
}: UseHistorySheetMotionOptions) {
  const [detent, setDetent] = useState<HistoryDetent>(0);
  const detentRef = useRef<HistoryDetent>(0);
  const progressRef = useRef<number>(0);
  const animTokenRef = useRef<number>(0);
  const activeSnapRef = useRef<ActiveSnapTrack | null>(null);

  const dimsRef = useRef({ mainH: 844 });

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startP: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    axis: 'pending' | 'y' | 'cancelled';
    source: 'display' | 'full';
  } | null>(null);

  const applyProgressToDom = useCallback(
    (p: number, isMoving: boolean) => {
      const { mainH } = dimsRef.current;
      const fullEl = fullSheetRef.current;
      if (!fullEl) return;

      const t = clamp(p, 0, 1.04);
      const showFull = p > 0.004 || (isMoving && p > 0);
      const fullY = (1 - t) * Math.max(320, mainH);
      const fullOp = t <= 0 ? 0 : clamp(t * 4.5, 0, 1);

      fullEl.style.willChange = isMoving ? 'transform, opacity' : '';
      fullEl.style.visibility = showFull ? 'visible' : 'hidden';
      fullEl.style.pointerEvents = !isMoving && p >= 0.96 ? 'auto' : 'none';
      fullEl.style.transform =
        !isMoving && Math.abs(fullY) < 0.1 ? '' : `translate3d(0, ${fullY.toFixed(2)}px, 0)`;
      fullEl.style.opacity = fullOp >= 0.999 ? '' : fullOp.toFixed(3);
    },
    [fullSheetRef]
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

  const cancelRunningSnap = useCallback(() => {
    const track = activeSnapRef.current;
    if (track) {
      if (track.rafId) cancelAnimationFrame(track.rafId);
      activeSnapRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const main = mainRef.current;
      if (main && main.clientHeight > 0) dimsRef.current.mainH = main.clientHeight;
      if (!activeSnapRef.current && !dragRef.current) {
        applyProgressToDom(progressRef.current, false);
      }
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      if (mainRef.current) ro.observe(mainRef.current);
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mainRef, applyProgressToDom]);

  const snapToDetent = useCallback(
    (targetDetent: HistoryDetent, immediate = false, playHaptic = true) => {
      const fromP = getCurrentProgress();
      cancelRunningSnap();
      const token = ++animTokenRef.current;
      const prevDetent = detentRef.current;

      detentRef.current = targetDetent;
      setDetent(targetDetent);
      if (targetDetent !== prevDetent) {
        if (playHaptic) triggerHaptic('dpad');
        onDetentChange?.(targetDetent);
      }

      if (immediate || Math.abs(targetDetent - fromP) < 0.002) {
        progressRef.current = targetDetent;
        applyProgressToDom(targetDetent, false);
        return;
      }

      const reduced = prefersReducedMotion();
      const duration = reduced ? SPRING_TOKENS.reducedMotion.duration : SPRING_TOKENS.spatial.duration;
      const startTime = performance.now();

      const track: ActiveSnapTrack = {
        fromP,
        toP: targetDetent,
        startTime,
        duration,
        reduced,
        rafId: 0,
      };
      activeSnapRef.current = track;

      const step = () => {
        if (animTokenRef.current !== token) return;
        const elapsed = performance.now() - startTime;
        if (elapsed >= duration) {
          activeSnapRef.current = null;
          progressRef.current = targetDetent;
          applyProgressToDom(targetDetent, false);
          return;
        }
        const t = reduced
          ? clamp(elapsed / duration, 0, 1)
          : evaluateSpringProgress(SPRING_CONFIGS.spatial, elapsed / 1000);
        const p = fromP + (targetDetent - fromP) * t;
        progressRef.current = p;
        applyProgressToDom(p, true);
        track.rafId = requestAnimationFrame(step);
      };

      track.rafId = requestAnimationFrame(step);
    },
    [applyProgressToDom, cancelRunningSnap, getCurrentProgress, onDetentChange]
  );

  const handleDragStart = useCallback(
    (e: React.PointerEvent, source: 'display' | 'full') => {
      if (source !== 'display' || !enabled) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      // Require touch to begin at least 80px below top edge and 24px above bottom edge
      const winH = typeof window !== 'undefined' ? window.innerHeight : 9999;
      if (e.clientY < 80 || e.clientY > winH - 24) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) return;

      const startP = getCurrentProgress();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startP,
        lastY: e.clientY,
        lastTime: performance.now(),
        velocityY: 0,
        axis: 'pending',
        source,
      };
    },
    [enabled, getCurrentProgress]
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (drag.axis === 'cancelled') return;

      if (drag.axis === 'pending') {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15) {
          drag.axis = 'cancelled';
          dragRef.current = null;
          return;
        }
        // Only swipe UP on display opens History; swipe-down is completely disabled
        const wantsUpOpen = drag.source === 'display' && dy < -14 && Math.abs(dy) > Math.abs(dx) * 1.2;
        if (!wantsUpOpen) return;

        drag.axis = 'y';
        animTokenRef.current++;
        cancelRunningSnap();
        drag.startP = progressRef.current;
        drag.startY = e.clientY;
        drag.lastY = e.clientY;
        drag.lastTime = performance.now();
        try {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        } catch {}
      }

      const now = performance.now();
      const dt = Math.max(1, now - drag.lastTime);
      const instVy = (e.clientY - drag.lastY) / dt;
      drag.velocityY = drag.velocityY * 0.65 + instVy * 0.35;
      drag.lastY = e.clientY;
      drag.lastTime = now;

      const span = Math.max(240, dimsRef.current.mainH * 0.52);
      const effectiveDy = e.clientY - drag.startY;
      const rawP = drag.startP + (-effectiveDy) / span;
      const nextP =
        rawP > 1
          ? 1 + Math.min(0.04, (rawP - 1) * 0.12)
          : rawP < 0
          ? Math.max(-0.04, rawP * 0.12)
          : rawP;

      progressRef.current = nextP;
      applyProgressToDom(nextP, true);
    },
    [applyProgressToDom, cancelRunningSnap]
  );

  const handleDragEnd = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;

      if (drag.axis !== 'y') return;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}

      const p = clamp(progressRef.current, 0, 1);
      const vy = drag.velocityY;
      let target: HistoryDetent;

      if (vy < -0.35) {
        target = 1;
      } else if (vy > 0.35) {
        target = 0;
      } else {
        target = p >= 0.25 ? 1 : 0;
      }

      snapToDetent(target);
    },
    [snapToDetent]
  );

  return {
    detent,
    isExpanded: detent === 1,
    snapToDetent,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
