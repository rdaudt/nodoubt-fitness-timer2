import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IntervalBadge } from '../components/IntervalBadge';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

export const TimerDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [timer, setTimer] = useState<Timer | null>(null);

  useEffect(() => {
    TimerRepository.get(id).then((value) => setTimer(value ?? null));
  }, [id]);

  const onDelete = async () => {
    if (!timer) {
      return;
    }
    const ok = window.confirm('Delete this timer?');
    if (!ok) {
      return;
    }
    await TimerRepository.remove(timer.id);
    navigate('/');
  };

  if (!timer) {
    return <p className="empty">Timer not found.</p>;
  }

  return (
    <section>
      <h1 className="screen-title">{timer.name}</h1>
      <p className="timer-meta">{timer.sets} set{timer.sets === 1 ? '' : 's'}</p>

      <div className="actions-row">
        <Link to={`/timer/${timer.id}/run`} className="primary-btn">Run</Link>
        <Link to={`/timer/${timer.id}/edit`} className="secondary-btn">Edit</Link>
        <button className="danger-btn" onClick={onDelete}>Delete</button>
      </div>

      <div className="stack">
        {timer.intervals.map((interval) => (
          <IntervalBadge key={interval.sequence} interval={interval} settings={settings} />
        ))}
      </div>
    </section>
  );
};
