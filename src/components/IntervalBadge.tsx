import { TYPE_LABELS } from '../config';
import { withAlpha } from '../lib/color';
import type { AppSettings, Interval } from '../types';
import { formatClock } from '../lib/time';

export const IntervalBadge = ({ interval, settings }: { interval: Interval; settings: AppSettings }) => {
  const totalSeconds = interval.durationMinutes * 60 + interval.durationSeconds;
  const intervalColor = settings.intervalColors[interval.type];
  const surfaceColor = withAlpha(intervalColor, 0.72);
  return (
    <div
      className="interval-row"
      style={{
        backgroundColor: surfaceColor,
      }}
    >
      <div>
        <p className="interval-title">{interval.sequence}. {interval.name}</p>
        <p className="interval-sub">{TYPE_LABELS[interval.type]}</p>
      </div>
      <p className="interval-time">{formatClock(totalSeconds)}</p>
    </div>
  );
};
