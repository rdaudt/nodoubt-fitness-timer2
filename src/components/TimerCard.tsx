import { Link } from 'react-router-dom';
import type { Timer } from '../types';
import { estimateTimerDurationMs, formatClock } from '../lib/time';

export const TimerCard = ({ timer }: { timer: Timer }) => {
  const intervalCount = timer.intervals.length;
  const totalSeconds = Math.floor(estimateTimerDurationMs(timer) / 1000);

  return (
    <Link className="timer-card" to={`/timer/${timer.id}`}>
      <div className="timer-card-head">
        <h3>{timer.name}</h3>
        <p>{formatClock(totalSeconds)}</p>
      </div>
      <p className="timer-meta">
        {timer.sets} set{timer.sets === 1 ? '' : 's'} • {intervalCount} interval{intervalCount === 1 ? '' : 's'}
      </p>
    </Link>
  );
};
