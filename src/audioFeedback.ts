/**
 * Audio and Haptic feedback generator for tactile Casio calculator feel.
 * Pure Web Audio API synthesized clicks - no external files or latency.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let hapticEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setHapticEnabled(enabled: boolean) {
  hapticEnabled = enabled;
}

export function isHapticEnabled(): boolean {
  return hapticEnabled;
}

// Tactile Vibration Patterns (in milliseconds)
// Tailored for modern smartphone linear resonance actuators (Taptic / LRA)
export const HAPTIC_PATTERNS = {
  // Numeric Keys (0-9, dot, exp, Ans): Crisp, micro-tick dome switch feel
  num: 8,

  // Mathematical & Function Keys (sin, cos, tan, log, x², brackets): Firmer tactile click
  func: 14,

  // Directional Cursor & History Navigation (D-Pad): Subtle directional tick
  dpad: 10,

  // Primary Action Keys (DEL, AC, ON, CLR): Double-pulse tactile bump
  action: [18, 28, 12],

  // SHIFT Toggle: Stepped ascending mode latch
  shift: [10, 20, 18],

  // ALPHA Toggle: Stepped descending mode latch
  alpha: [16, 20, 12],

  // EQUALS (=): Deep, decisive calculation confirmation
  equal: [22, 32, 25],

  // S<=>D Conversion: Snappy double-tap
  sd: [9, 18, 11],

  // Error State: Alert rumble warning
  error: [40, 35, 40, 35, 60],
} as const;

export type HapticKeyType = keyof typeof HAPTIC_PATTERNS;

let lastVibrateTime = 0;

/**
 * Directly trigger the Vibration API with the appropriate tactile pattern
 */
export function triggerHaptic(type: HapticKeyType = 'num') {
  if (!hapticEnabled) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

  const now = Date.now();
  if (now - lastVibrateTime < 40) return; // Prevent double-trigger from pointerdown + click
  lastVibrateTime = now;

  try {
    const pattern = HAPTIC_PATTERNS[type];
    if (typeof pattern === 'number') {
      navigator.vibrate(pattern);
    } else {
      navigator.vibrate(pattern as unknown as number[]);
    }
  } catch {
    // Graceful fallback if device/browser restricts Vibration API
  }
}

/**
 * Trigger synthesized audio click and coordinated haptic vibration
 */
export function playKeyClick(type: HapticKeyType = 'num') {
  // Fire haptic immediately
  triggerHaptic(type);

  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'error') {
      // Soft Casio error buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    if (type === 'shift') {
      // Amber mode activate chirp
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1600, now + 0.04);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
      return;
    }

    if (type === 'alpha') {
      // Magenta mode activate chirp
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.setValueAtTime(1400, now + 0.04);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
      return;
    }

    // Realistic plastic key switch sound: white noise click + bandpass thud
    const bufferSize = ctx.sampleRate * 0.025; // 25ms
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';

    // Different center frequencies for numeric vs function vs equal key
    if (type === 'equal') {
      filter.frequency.setValueAtTime(2400, now);
      filter.Q.setValueAtTime(3, now);
    } else if (type === 'action') {
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(2, now);
    } else if (type === 'func') {
      filter.frequency.setValueAtTime(3200, now);
      filter.Q.setValueAtTime(3, now);
    } else if (type === 'dpad') {
      filter.frequency.setValueAtTime(3400, now);
      filter.Q.setValueAtTime(3.5, now);
    } else if (type === 'sd') {
      filter.frequency.setValueAtTime(3000, now);
      filter.Q.setValueAtTime(2.8, now);
    } else {
      filter.frequency.setValueAtTime(2800, now);
      filter.Q.setValueAtTime(2.5, now);
    }

    const gainNode = ctx.createGain();
    const peakVolume = type === 'equal' ? 0.06 : 0.035;
    gainNode.gain.setValueAtTime(peakVolume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Subtle tactile low-end body resonance
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(type === 'equal' ? 120 : 160, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.03);
    oscGain.gain.setValueAtTime(0.04, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    whiteNoise.start(now);
    osc.start(now);
    whiteNoise.stop(now + 0.025);
    osc.stop(now + 0.03);
  } catch {
    // Ignore audio errors
  }
}
