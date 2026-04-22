import { TYPE_LABELS } from '../config';
import type { AppSettings, Interval } from '../types';
import { formatClock } from '../lib/time';

export const IntervalBadge = ({ interval, settings }: { interval: Interval; settings: AppSettings }) => {
  const totalSeconds = interval.durationMinutes * 60 + interval.durationSeconds;
  return (
    <div className="interval-row" style={{ borderLeftColor: settings.intervalColors[interval.type] }}>
      <div>
        <p className="interval-title">{interval.sequence}. {interval.name}</p>
        <p className="interval-sub">{TYPE_LABELS[interval.type]}</p>
      </div>
      <p className="interval-time">{formatClock(totalSeconds)}</p>
    </div>
  );
};
