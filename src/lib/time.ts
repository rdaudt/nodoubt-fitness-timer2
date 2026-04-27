import type { CountdownType, Timer, TimelineEntry } from '../types';

export const durationMs = (minutes: number, seconds: number): number =>
  (Math.max(0, Math.floor(minutes || 0)) * 60 + Math.max(0, Math.min(59, Math.floor(seconds || 0)))) * 1000;

export const formatClock = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const secs = (clamped % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export const totalTimelineDurationMs = (timeline: TimelineEntry[]): number =>
  timeline.reduce((sum, item) => sum + item.durationMs, 0);

export const getWorkDurationMs = (timer: Timer): number => durationMs(timer.workMinutes, timer.workSeconds);
export const getRestDurationMs = (timer: Timer): number => durationMs(timer.restMinutes, timer.restSeconds);
export const getTransitionDurationMs = (timer: Timer): number =>
  durationMs(timer.stationTransitionMinutes, timer.stationTransitionSeconds);
export const getWarmupDurationMs = (timer: Timer): number =>
  timer.warmupEnabled ? durationMs(timer.warmupMinutes, timer.warmupSeconds) : 0;
export const getCooldownDurationMs = (timer: Timer): number =>
  timer.cooldownEnabled ? durationMs(timer.cooldownMinutes, timer.cooldownSeconds) : 0;

export const getStationWorkoutDurationMs = (timer: Timer): number => (
  getWorkDurationMs(timer) * timer.roundsPerStation
  + getRestDurationMs(timer) * Math.max(0, timer.roundsPerStation - 1)
);

export const estimateTimerDurationMs = (timer: Timer): number => (
  getWarmupDurationMs(timer)
  + getStationWorkoutDurationMs(timer) * timer.stationCount
  + getTransitionDurationMs(timer) * Math.max(0, timer.stationCount - 1)
  + getCooldownDurationMs(timer)
);

export const formatTimerTotal = (timer: Timer): string =>
  formatClock(Math.floor(estimateTimerDurationMs(timer) / 1000));

export interface TimerSummaryItem {
  type: CountdownType | 'stations' | 'rounds';
  label: string;
  value: string;
}

export const formatCompactDuration = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;

  if (mins > 0 && secs > 0) {
    return `${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m`;
  }
  return `${secs}s`;
};

export const getTimerSummaryItems = (timer: Timer, coachMode: boolean): TimerSummaryItem[] => {
  const items: TimerSummaryItem[] = [
    {
      type: 'stations',
      label: coachMode ? 'Stations' : 'Sets',
      value: String(timer.stationCount),
    },
    {
      type: 'rounds',
      label: 'Rounds',
      value: String(timer.roundsPerStation),
    },
    {
      type: 'work',
      label: 'Work',
      value: formatCompactDuration(getWorkDurationMs(timer) / 1000),
    },
  ];

  if (timer.roundsPerStation > 1) {
    items.push({
      type: 'rest',
      label: 'Rest',
      value: formatCompactDuration(getRestDurationMs(timer) / 1000),
    });
  }

  items.push({
    type: 'stationTransition',
    label: coachMode ? 'Station transition' : 'Set transition',
    value: formatCompactDuration(getTransitionDurationMs(timer) / 1000),
  });

  return items;
};
