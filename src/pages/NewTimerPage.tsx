import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { newTimer } from '../lib/timerFactory';
import { TimerRepository } from '../services/storage';
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

const createTimerOnce = async (): Promise<Timer> => {
  if (!pendingTimerCreation) {
    pendingTimerCreation = (async () => {
      const timer = newTimer();
      await TimerRepository.upsert(timer);
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

export const NewTimerPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const createAndGo = async () => {
      try {
        const timer = await createTimerOnce();
        if (active) {
          navigate(`/timer/${timer.id}`, { replace: true });
        }
      } catch {
        if (active) {
          setError('Could not create timer. Close other app tabs and try again.');
        }
      }
    };

    createAndGo();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <section className="stack">
        <p className="error-inline">{error}</p>
        <button className="primary-btn" onClick={() => window.location.reload()}>Reload App</button>
      </section>
    );
  }

  return <p className="empty">Creating timer...</p>;
};
