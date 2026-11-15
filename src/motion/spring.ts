/**
 * Shared Spring Physics Solver, CSS linear() generator, and Interruptible WAAPI helpers.
 * Runs exclusively on compositor-friendly properties (transform, opacity).
 */

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
  duration: number;
}

export const SPRING_CONFIGS = {
  /** Primary spatial spring (position, scale, FLIP open/close, key release with small overshoot) */
  spatial: {
    stiffness: 420,
    damping: 25,
    mass: 1,
    duration: 380,
  },
  /** Fast spatial press spring (scale ~0.95 + directional lean on pointerdown) */
  spatialPress: {
    stiffness: 680,
    damping: 38,
    mass: 1,
    duration: 150,
  },
  /** Critically damped effects spring (opacity, luminous fade, result pulse — no bounce) */
  effects: {
    stiffness: 380,
    damping: 39,
    mass: 1,
    duration: 210,
  },
} as const;

export type SpringTokenName = keyof typeof SPRING_CONFIGS;

/**
 * Evaluate normalized step response x(t) for a damped harmonic oscillator starting at x(0)=0, v(0)=0, target=1.
 */
export function evaluateSpringProgress(config: SpringConfig, tSeconds: number): number {
  if (tSeconds <= 0) return 0;
  const { stiffness: k, damping: c, mass: m } = config;
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));

  if (zeta < 1) {
    // Underdamped (overshoots slightly then settles)
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * w0 * tSeconds);
    const cosTerm = Math.cos(wd * tSeconds);
    const sinTerm = (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * tSeconds);
    return 1 - decay * (cosTerm + sinTerm);
  } else if (Math.abs(zeta - 1) < 1e-4) {
    // Critically damped
    const decay = Math.exp(-w0 * tSeconds);
    return 1 - decay * (1 + w0 * tSeconds);
  } else {
    // Overdamped
    const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
    const r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
    const c1 = r2 / (r2 - r1);
    const c2 = -r1 / (r2 - r1);
    return 1 - (c1 * Math.exp(r1 * tSeconds) + c2 * Math.exp(r2 * tSeconds));
  }
}

/**
 * Generate a CSS linear(...) easing string from the spring solver (precomputed once).
 */
export function buildSpringLinearEasing(config: SpringConfig, samples = 44): string {
  const values: string[] = [];
  const durationSec = config.duration / 1000;
  for (let i = 0; i <= samples; i++) {
    if (i === 0) {
      values.push('0');
    } else if (i === samples) {
      values.push('1');
    } else {
      const t = (i / samples) * durationSec;
      const val = evaluateSpringProgress(config, t);
      values.push(val.toFixed(4));
    }
  }
  return `linear(${values.join(', ')})`;
}

export const SPRING_TOKENS = {
  spatial: {
    ...SPRING_CONFIGS.spatial,
    linear: buildSpringLinearEasing(SPRING_CONFIGS.spatial, 48),
  },
  spatialPress: {
    ...SPRING_CONFIGS.spatialPress,
    linear: buildSpringLinearEasing(SPRING_CONFIGS.spatialPress, 24),
  },
  effects: {
    ...SPRING_CONFIGS.effects,
    linear: buildSpringLinearEasing(SPRING_CONFIGS.effects, 32),
  },
  reducedMotion: {
    duration: 110,
    easing: 'ease-out',
  },
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface TransformState {
  x: number;
  y: number;
  sx: number;
  sy: number;
  opacity?: number;
}

interface ActiveTrack {
  anim: Animation | null;
  from: TransformState;
  to: TransformState;
  startTime: number;
  config: SpringConfig;
  reduced: boolean;
}

const activeTracks = new WeakMap<HTMLElement, ActiveTrack>();

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

function formatTransform(s: TransformState): string {
  return `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) scale(${s.sx.toFixed(4)}, ${s.sy.toFixed(4)})`;
}

/**
 * Returns true if an element currently has an in-flight spring animation.
 */
export function hasActiveSpring(el: HTMLElement): boolean {
  const track = activeTracks.get(el);
  if (!track) return false;
  return performance.now() - track.startTime < track.config.duration;
}

/**
 * Sample exact current analytical transform/opacity state without touching layout or getComputedStyle.
 */
export function getCurrentSpringState(el: HTMLElement, fallback: TransformState): TransformState {
  const track = activeTracks.get(el);
  if (!track) return fallback;

  const elapsed = performance.now() - track.startTime;
  if (elapsed >= track.config.duration) {
    return track.to;
  }

  const p = track.reduced
    ? Math.min(1, Math.max(0, elapsed / track.config.duration))
    : evaluateSpringProgress(track.config, elapsed / 1000);

  return {
    x: lerp(track.from.x, track.to.x, p),
    y: lerp(track.from.y, track.to.y, p),
    sx: lerp(track.from.sx, track.to.sx, p),
    sy: lerp(track.from.sy, track.to.sy, p),
    opacity:
      track.from.opacity !== undefined && track.to.opacity !== undefined
        ? lerp(track.from.opacity, track.to.opacity, p)
        : track.to.opacity,
  };
}

/**
 * Animate an element smoothly from its current analytical spring state to a target state
 * using WAAPI + precomputed linear() spring easing on the compositor (transform + opacity only).
 */
export function animateSpringTransform(
  el: HTMLElement,
  target: TransformState,
  token: 'spatial' | 'spatialPress' | 'effects' = 'spatial',
  explicitFrom?: TransformState,
  onSettled?: () => void
): Animation | null {
  const reduced = prefersReducedMotion();
  const prevTrack = activeTracks.get(el);
  const restOpacity = el.style.opacity !== '' ? Number.parseFloat(el.style.opacity) : 1;
  const fallbackOpacity = Number.isFinite(restOpacity) ? restOpacity : 1;
  const current =
    explicitFrom ??
    getCurrentSpringState(el, {
      x: 0,
      y: 0,
      sx: 1,
      sy: 1,
      opacity: target.opacity !== undefined ? fallbackOpacity : undefined,
    });

  if (prevTrack?.anim) {
    try {
      prevTrack.anim.cancel();
    } catch {}
  }

  if (reduced) {
    // Respect prefers-reduced-motion: short opacity fade only, no spatial jump
    const fromOpacity = current.opacity ?? fallbackOpacity;
    const toOpacity = target.opacity ?? 1;
    if (Math.abs(fromOpacity - toOpacity) < 0.01 && Math.abs(target.x) < 0.1 && Math.abs(target.y) < 0.1) {
      el.style.transform = '';
      el.style.willChange = '';
      if (target.opacity !== undefined) {
        el.style.opacity = toOpacity === 1 ? '' : String(toOpacity);
      }
      activeTracks.delete(el);
      onSettled?.();
      return null;
    }

    el.style.willChange = 'opacity';
    const anim = el.animate(
      [{ opacity: fromOpacity }, { opacity: toOpacity }],
      {
        duration: SPRING_TOKENS.reducedMotion.duration,
        easing: SPRING_TOKENS.reducedMotion.easing,
        fill: 'forwards',
      }
    );
    const track: ActiveTrack = {
      anim,
      from: { ...target, opacity: fromOpacity },
      to: target,
      startTime: performance.now(),
      config: { ...SPRING_CONFIGS[token], duration: SPRING_TOKENS.reducedMotion.duration },
      reduced: true,
    };
    activeTracks.set(el, track);
    anim.finished
      .then(() => {
        if (activeTracks.get(el)?.anim !== anim) return;
        activeTracks.delete(el);
        el.style.willChange = '';
        el.style.opacity = toOpacity === 1 ? '' : String(toOpacity);
        try {
          anim.cancel();
        } catch {}
        onSettled?.();
      })
      .catch(() => {
        // Interrupted/cancelled by a newer animation
      });
    return anim;
  }

  const spring = SPRING_TOKENS[token];
  const hasOpacity = target.opacity !== undefined;
  const fromOpacity = current.opacity ?? fallbackOpacity;
  el.style.willChange = hasOpacity ? 'transform, opacity' : 'transform';

  const fromFrame: Keyframe = hasOpacity
    ? { transform: formatTransform(current), opacity: fromOpacity }
    : { transform: formatTransform(current) };
  const toFrame: Keyframe = hasOpacity
    ? { transform: formatTransform(target), opacity: target.opacity }
    : { transform: formatTransform(target) };

  const anim = el.animate([fromFrame, toFrame], {
    duration: spring.duration,
    easing: spring.linear,
    fill: 'forwards',
  });

  const track: ActiveTrack = {
    anim,
    from: hasOpacity ? { ...current, opacity: fromOpacity } : current,
    to: target,
    startTime: performance.now(),
    config: spring,
    reduced: false,
  };
  activeTracks.set(el, track);

  anim.finished
    .then(() => {
      if (activeTracks.get(el)?.anim !== anim) return;
      activeTracks.delete(el);
      el.style.willChange = '';
      const isIdentity =
        Math.abs(target.x) < 0.01 &&
        Math.abs(target.y) < 0.01 &&
        Math.abs(target.sx - 1) < 0.001 &&
        Math.abs(target.sy - 1) < 0.001;
      el.style.transform = isIdentity ? '' : formatTransform(target);
      if (hasOpacity && target.opacity !== undefined) {
        el.style.opacity = target.opacity === 1 ? '' : String(target.opacity);
      }
      try {
        anim.cancel();
      } catch {}
      onSettled?.();
    })
    .catch(() => {
      // Interrupted/cancelled by a newer animation
    });

  return anim;
}

/**
 * Compute FLIP transform delta from a source rect to a target rect (transform-origin: center).
 */
export function computeFlipDelta(
  sourceRect: { left: number; top: number; width: number; height: number },
  targetRect: { left: number; top: number; width: number; height: number }
): TransformState {
  const srcCx = sourceRect.left + sourceRect.width / 2;
  const srcCy = sourceRect.top + sourceRect.height / 2;
  const tgtCx = targetRect.left + targetRect.width / 2;
  const tgtCy = targetRect.top + targetRect.height / 2;

  const sx = Math.max(0.08, Math.min(1, sourceRect.width / Math.max(1, targetRect.width)));
  const sy = Math.max(0.08, Math.min(1, sourceRect.height / Math.max(1, targetRect.height)));

  return {
    x: srcCx - tgtCx,
    y: srcCy - tgtCy,
    sx,
    sy,
  };
}

/**
 * Short compositor-only opacity pulse when calculation result updates.
 */
export function animateOpacityPulse(el: HTMLElement | null, fromOpacity = 0.42, targetOpacity = 1): void {
  if (!el) return;
  const reduced = prefersReducedMotion();
  const prevTrack = activeTracks.get(el);
  if (prevTrack?.anim) {
    try {
      prevTrack.anim.cancel();
    } catch {}
  }

  el.style.willChange = 'opacity';
  const duration = reduced ? SPRING_TOKENS.reducedMotion.duration : SPRING_TOKENS.effects.duration;
  const easing = reduced ? SPRING_TOKENS.reducedMotion.easing : SPRING_TOKENS.effects.linear;

  const anim = el.animate([{ opacity: fromOpacity }, { opacity: targetOpacity }], {
    duration,
    easing,
    fill: 'forwards',
  });

  activeTracks.set(el, {
    anim,
    from: { x: 0, y: 0, sx: 1, sy: 1, opacity: fromOpacity },
    to: { x: 0, y: 0, sx: 1, sy: 1, opacity: targetOpacity },
    startTime: performance.now(),
    config: { ...SPRING_CONFIGS.effects, duration },
    reduced,
  });

  anim.finished
    .then(() => {
      if (activeTracks.get(el)?.anim !== anim) return;
      activeTracks.delete(el);
      el.style.willChange = '';
      el.style.opacity = targetOpacity === 1 ? '' : String(targetOpacity);
      try {
        anim.cancel();
      } catch {}
    })
    .catch(() => {
      // Interrupted/cancelled
    });
}
