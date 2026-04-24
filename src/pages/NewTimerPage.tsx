import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { newTimer } from '../lib/timerFactory';
import { TimerRepository } from '../services/storage';

export const NewTimerPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const createAndGo = async () => {
      const timer = newTimer();
      await TimerRepository.upsert(timer);
      navigate(`/timer/${timer.id}`, { replace: true });
    };

    createAndGo();
  }, [navigate]);

  return <p className="empty">Creating timer...</p>;
};
