type WakeLockSentinelLike = { release: () => Promise<void> };

let sentinel: WakeLockSentinelLike | null = null;

export const WakeLockService = {
  async acquire(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    try {
      sentinel = await (navigator as Navigator & {
        wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      }).wakeLock.request('screen');
    } catch {
      sentinel = null;
    }
  },
  async release(): Promise<void> {
    if (!sentinel) {
      return;
    }

    try {
      await sentinel.release();
    } finally {
      sentinel = null;
    }
  },
};
