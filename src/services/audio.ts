let audioContext: AudioContext | null = null;

const ensureContext = async (): Promise<AudioContext | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!audioContext) {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return null;
    }
    audioContext = new Ctx();
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  return audioContext;
};

export const AudioService = {
  async unlock(): Promise<void> {
    await ensureContext();
  },
  async playTransitionCue(): Promise<void> {
    const ctx = await ensureContext();
    if (!ctx) {
      return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 900;
    oscillator.type = 'triangle';
    gain.gain.value = 0.0001;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    oscillator.start(now);
    oscillator.stop(now + 0.13);
  },
  async playShortCountdownBeep(): Promise<void> {
    const ctx = await ensureContext();
    if (!ctx) {
      return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 1200;
    oscillator.type = 'triangle';
    gain.gain.value = 0.0001;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    oscillator.start(now);
    oscillator.stop(now + 0.13);
  },
  async playLongIntervalEndBeep(): Promise<void> {
    const ctx = await ensureContext();
    if (!ctx) {
      return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 880;
    oscillator.type = 'triangle';
    gain.gain.value = 0.0001;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.32, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2);

    oscillator.start(now);
    oscillator.stop(now + 2.02);
  },
};
