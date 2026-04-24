import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { newTimer } from '../lib/timerFactory';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

let pendingTimerCreation: Promise<Timer> | null = null;

const createTimerOnce = async (): Promise<Timer> => {
  if (!pendingTimerCreation) {
    pendingTimerCreation = (async () => {
      const timer = newTimer();
      await TimerRepository.upsert(timer);
      return timer;
    })();
  }

  try {
    return await pendingTimerCreation;
  } finally {
    pendingTimerCreation = null;
  }
};

export const NewTimerPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const createAndGo = async () => {
      const timer = await createTimerOnce();
      if (active) {
        navigate(`/timer/${timer.id}`, { replace: true });
      }
    };

    createAndGo();

    return () => {
      active = false;
    };
  }, [navigate]);

  return <p className="empty">Creating timer...</p>;
};
