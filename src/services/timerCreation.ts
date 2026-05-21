import { newTimer } from '../lib/timerFactory';
import { trackAnalyticsEvent } from './analytics';
import { TimerRepository } from './storage';
import type { Timer } from '../types';

let pendingTimerCreation: Promise<Timer> | null = null;
const CREATE_TIMER_TIMEOUT_MS = 8000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Timer creation timed out.'));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });

export const createNewTimer = async (): Promise<Timer> => {
  if (!pendingTimerCreation) {
    pendingTimerCreation = (async () => {
      const existingTimers = await TimerRepository.list();
      const timer = newTimer(existingTimers.map((item) => item.name));
      await TimerRepository.upsert(timer);
      trackAnalyticsEvent('timer_created', {
        category: timer.category,
      });
      return timer;
    })();
  }

  const inFlight = pendingTimerCreation;
  try {
    const timer = await withTimeout(inFlight, CREATE_TIMER_TIMEOUT_MS);
    if (pendingTimerCreation === inFlight) {
      pendingTimerCreation = null;
    }
    return timer;
  } catch (error) {
    if (pendingTimerCreation === inFlight) {
      pendingTimerCreation = null;
    }
    throw error;
  }
};
