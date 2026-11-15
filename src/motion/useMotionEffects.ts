import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  animateSpringTransform,
  computeFlipDelta,
  getCurrentSpringState,
  hasActiveSpring,
  prefersReducedMotion,
  TransformState,
} from './spring';
import { HapticKeyType, triggerHaptic } from '../audioFeedback';

export interface CachedRect {
  left: number;
  top: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

export function toCachedRect(r: { left: number; top: number; width: number; height: number }): CachedRect {
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    halfW: Math.max(1, r.width / 2),
    halfH: Math.max(1, r.height / 2),
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function resolveButtonHaptic(btn: HTMLElement): HapticKeyType {
  const explicit = btn.dataset.haptic as HapticKeyType | undefined;
  if (explicit) return explicit;
  const label = (btn.getAttribute('aria-label') || '').toLowerCase();
  if (label.includes('equals')) return 'equal';
  if (label.includes('shift')) return 'shift';
  if (label.includes('alpha')) return 'alpha';
  if (label.includes('d-pad')) return 'dpad';
  if (label.includes('s to d')) return 'sd';
  if (label.includes('delete') || label.includes('clear') || label.includes('menu') || label.includes('on key')) return 'action';
  if (/^\d key$|decimal|0 key/.test(label)) return 'num';
  return 'func';
}

/**
 * Spring + flexible lean + single pre-rendered luminous radial light layer for the keypad.
 * Reads cached rects only (updated via ResizeObserver), never calls getBoundingClientRect during pointerdown.
 */
export function useSpringKeypad(
  keyBlockRef: React.RefObject<HTMLDivElement | null>,
  glowHostRef: React.RefObject<HTMLDivElement | null>
) {
  const rectMapRef = useRef<WeakMap<HTMLElement, CachedRect>>(new WeakMap());
  const glowElsRef = useRef<{ posEl: HTMLDivElement; fadeEl: HTMLDivElement } | null>(null);
  const glowTokenRef = useRef(0);
  const activePressRef = useRef<{
    btn: HTMLElement;
    pointerId: number;
    box: CachedRect;
    startTime: number;
    lastNx: number;
    lastNy: number;
  } | null>(null);

  const ensureGlowEls = () => {
    if (!glowElsRef.current && typeof document !== 'undefined') {
      const posEl = document.createElement('div');
      posEl.className = 'luminous-flow-pos';
      posEl.setAttribute('aria-hidden', 'true');
      const fadeEl = document.createElement('div');
      fadeEl.className = 'luminous-flow-fade';
      posEl.appendChild(fadeEl);
      glowElsRef.current = { posEl, fadeEl };
    }
    return glowElsRef.current;
  };

  useEffect(() => {
    return () => {
      glowElsRef.current?.posEl.remove();
    };
  }, []);

  // Precompute button rects whenever keypad layout changes or window resizes
  useLayoutEffect(() => {
    const container = keyBlockRef.current;
    if (!container) return;

    const refreshRects = () => {
      const buttons = container.querySelectorAll('button');
      buttons.forEach((b) => {
        rectMapRef.current.set(b, toCachedRect(b.getBoundingClientRect()));
      });
    };

    refreshRects();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(refreshRects);
      ro.observe(container);
    }
    window.addEventListener('resize', refreshRects, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', refreshRects);
    };
  }, [keyBlockRef]);

  const showLuminousAt = (clientX: number, clientY: number) => {
    const host = glowHostRef.current;
    const els = ensureGlowEls();
    if (!host || !els) return;
    const { posEl, fadeEl } = els;

    const wasConnected = posEl.isConnected;
    if (!wasConnected) {
      fadeEl.style.opacity = '0';
      host.appendChild(posEl);
    }

    const reduced = prefersReducedMotion();
    posEl.style.willChange = 'transform';
    posEl.style.transform = `translate3d(${(clientX - 68).toFixed(1)}px, ${(clientY - 68).toFixed(1)}px, 0)`;

    glowTokenRef.current++;
    animateSpringTransform(
      fadeEl,
      reduced ? { x: 0, y: 0, sx: 1, sy: 1, opacity: 0.72 } : { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
      'effects',
      wasConnected ? undefined : { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
    );
  };

  const hideLuminous = () => {
    const els = glowElsRef.current;
    if (!els || !els.posEl.isConnected) return;
    const { posEl, fadeEl } = els;
    const token = ++glowTokenRef.current;
    animateSpringTransform(
      fadeEl,
      { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 },
      'effects',
      undefined,
      () => {
        if (glowTokenRef.current === token) {
          posEl.style.willChange = '';
          posEl.remove();
        }
      }
    );
  };

  const releaseActiveButton = (triggerTime = performance.now()) => {
    const active = activePressRef.current;
    if (!active) return;
    activePressRef.current = null;

    if (prefersReducedMotion()) {
      animateSpringTransform(
        active.btn,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
        'effects',
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 0.78 }
      );
      hideLuminous();
      return;
    }

    // Longer hold gets a subtle deeper release recoil before springing back to identity
    const heldMs = triggerTime - active.startTime;
    const current = getCurrentSpringState(active.btn, {
      x: active.lastNx * 2.2,
      y: active.lastNy * 1.8 + 1.0,
      sx: heldMs > 180 ? 0.942 : 0.948,
      sy: heldMs > 180 ? 0.942 : 0.948,
    });

    animateSpringTransform(active.btn, { x: 0, y: 0, sx: 1, sy: 1 }, 'spatial', current);
    hideLuminous();
  };

  useEffect(() => {
    const onGlobalRelease = () => {
      if (activePressRef.current) {
        releaseActiveButton();
      }
    };
    window.addEventListener('pointerup', onGlobalRelease, { passive: true });
    window.addEventListener('pointercancel', onGlobalRelease, { passive: true });
    return () => {
      window.removeEventListener('pointerup', onGlobalRelease);
      window.removeEventListener('pointercancel', onGlobalRelease);
    };
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement | null)?.closest('button') as HTMLElement | null;
    if (!btn) return;

    // Release any previous key cleanly (interruptible)
    if (activePressRef.current && activePressRef.current.btn !== btn) {
      releaseActiveButton();
    }

    // Immediate light haptic tick on pointerdown
    triggerHaptic(resolveButtonHaptic(btn));

    const reduced = prefersReducedMotion();
    const cached = rectMapRef.current.get(btn);
    if (reduced) {
      activePressRef.current = {
        btn,
        pointerId: e.pointerId,
        box: cached || { left: 0, top: 0, width: 44, height: 40, cx: 22, cy: 20, halfW: 22, halfH: 20 },
        startTime: performance.now(),
        lastNx: 0,
        lastNy: 0,
      };
      animateSpringTransform(
        btn,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 0.78 },
        'effects',
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 }
      );
      showLuminousAt(e.clientX, e.clientY);
      return;
    }

    if (cached) {
      const nx = clamp((e.clientX - cached.cx) / cached.halfW, -1, 1);
      const ny = clamp((e.clientY - cached.cy) / cached.halfH, -1, 1);
      activePressRef.current = {
        btn,
        pointerId: e.pointerId,
        box: cached,
        startTime: performance.now(),
        lastNx: nx,
        lastNy: ny,
      };
      animateSpringTransform(
        btn,
        { x: nx * 2.2, y: ny * 1.8 + 1.0, sx: 0.948, sy: 0.948 },
        'spatialPress'
      );
    } else {
      animateSpringTransform(btn, { x: 0, y: 1.0, sx: 0.948, sy: 0.948 }, 'spatialPress');
    }

    showLuminousAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = activePressRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    const posEl = glowElsRef.current?.posEl;
    if (posEl && posEl.isConnected) {
      posEl.style.transform = `translate3d(${(e.clientX - 68).toFixed(1)}px, ${(e.clientY - 68).toFixed(1)}px, 0)`;
    }

    if (prefersReducedMotion()) return;

    const nx = clamp((e.clientX - active.box.cx) / active.box.halfW, -1, 1);
    const ny = clamp((e.clientY - active.box.cy) / active.box.halfH, -1, 1);
    if (Math.abs(nx - active.lastNx) > 0.22 || Math.abs(ny - active.lastNy) > 0.22) {
      active.lastNx = nx;
      active.lastNy = ny;
      const heldMs = performance.now() - active.startTime;
      const targetScale = heldMs > 180 ? 0.942 : 0.948;
      animateSpringTransform(
        active.btn,
        { x: nx * 2.2, y: ny * 1.8 + 1.0, sx: targetScale, sy: targetScale },
        'spatialPress'
      );
    }
  };

  const handlePointerUp = () => {
    releaseActiveButton();
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

/**
 * Interruptible FLIP expand-from-touch & collapse-back-to-touch lifecycle for overlays/modals/sheets.
 * Animates ONLY transform and opacity (no blur, no backdrop-filter).
 */
export function useFlipModalTransition(
  isOpen: boolean,
  originRect: CachedRect | null,
  surfaceRef: React.RefObject<HTMLDivElement | null>,
  backdropRef: React.RefObject<HTMLDivElement | null>
) {
  const [isVisible, setIsVisible] = useState(isOpen);
  const closeTokenRef = useRef(0);
  const lastTargetRectRef = useRef<CachedRect | null>(null);
  const prevOpenRef = useRef<boolean>(false);

  // Precompute surface target box via ResizeObserver so repeated opens/closes avoid synchronous layout reads
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const measure = () => {
      const r = surface.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        lastTargetRectRef.current = toCachedRect(r);
      }
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(surface);
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [surfaceRef]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const backdrop = backdropRef.current;
    if (!surface) return;

    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (isOpen === wasOpen) return;

    const reduced = prefersReducedMotion();

    if (isOpen) {
      closeTokenRef.current++;
      setIsVisible(true);

      const targetBox = lastTargetRectRef.current || toCachedRect(surface.getBoundingClientRect());
      lastTargetRectRef.current = targetBox;
      const interruptingSurface = hasActiveSpring(surface);
      const interruptingBackdrop = backdrop ? hasActiveSpring(backdrop) : false;

      if (reduced || !originRect) {
        if (backdrop) {
          animateSpringTransform(
            backdrop,
            { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
            'effects',
            interruptingBackdrop ? undefined : { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
          );
        }
        animateSpringTransform(
          surface,
          { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
          'spatial',
          interruptingSurface
            ? undefined
            : reduced
            ? { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
            : { x: 0, y: 20, sx: 0.94, sy: 0.94, opacity: 0.1 }
        );
        return;
      }

      const delta = computeFlipDelta(originRect, targetBox);
      if (backdrop) {
        animateSpringTransform(
          backdrop,
          { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
          'effects',
          interruptingBackdrop ? undefined : { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
        );
      }
      animateSpringTransform(
        surface,
        { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
        'spatial',
        interruptingSurface ? undefined : { ...delta, opacity: 0.18 }
      );
    } else {
      const token = ++closeTokenRef.current;
      const targetBox = lastTargetRectRef.current || toCachedRect(surface.getBoundingClientRect());
      const collapseTo = !reduced && originRect
        ? { ...computeFlipDelta(originRect, targetBox), opacity: 0 }
        : { x: 0, y: reduced ? 0 : 18, sx: reduced ? 1 : 0.94, sy: reduced ? 1 : 0.94, opacity: 0 };

      const backdropAnim = backdrop
        ? animateSpringTransform(
            backdrop,
            { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 },
            'effects'
          )
        : null;
      const surfaceAnim = animateSpringTransform(
        surface,
        collapseTo,
        reduced ? 'effects' : 'spatial'
      );

      const pending = [backdropAnim?.finished, surfaceAnim?.finished].filter(
        (p): p is Promise<Animation> => Boolean(p)
      );
      if (pending.length === 0) {
        if (closeTokenRef.current === token) {
          setIsVisible(false);
        }
      } else {
        Promise.all(pending)
          .then(() => {
            if (closeTokenRef.current === token) {
              setIsVisible(false);
            }
          })
          .catch(() => {
            // Cancelled mid-close (e.g. re-opened before close finished)
          });
      }
    }
  }, [isOpen, originRect, surfaceRef, backdropRef]);

  return isVisible;
}

/**
 * Trigger a short compositor-only FLIP expand on an in-display view (MENU or active mode screen)
 * starting from a cached trigger rect without layout thrash.
 */
export function runInlineFlipExpand(
  el: HTMLElement | null,
  originRect: CachedRect | null,
  targetRect: CachedRect | null
) {
  if (!el) return;
  const reduced = prefersReducedMotion();
  if (reduced || !originRect || !targetRect) {
    animateSpringTransform(
      el,
      { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
      'effects',
      { x: 0, y: 0, sx: 1, sy: 1, opacity: 0 }
    );
    return;
  }
  const delta: TransformState = computeFlipDelta(originRect, targetRect);
  animateSpringTransform(
    el,
    { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 },
    'spatial',
    { ...delta, opacity: 0.25 }
  );
}
