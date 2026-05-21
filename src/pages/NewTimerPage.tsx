import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNewTimer } from '../services/timerCreation';
import { useTenant } from '../services/tenantContext';

export const NewTimerPage = () => {
  const navigate = useNavigate();
  const { slug } = useTenant();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const createAndGo = async () => {
      try {
        const timer = await createNewTimer();
        if (active) {
          const timerPath = slug ? `/${slug}/timer/${timer.id}` : `/timer/${timer.id}`;
          navigate(timerPath, { replace: true });
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
  }, [navigate, slug]);

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
