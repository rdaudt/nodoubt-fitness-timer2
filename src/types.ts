export type IntervalType = 'warmup' | 'work' | 'rest' | 'cooldown';
export type CountdownType = IntervalType | 'stationTransition';

export interface Timer {
  id: string;
  name: string;
  stationCount: number;
  roundsPerStation: number;
  workMinutes: number;
  workSeconds: number;
  restMinutes: number;
  restSeconds: number;
  stationTransitionMinutes: number;
  stationTransitionSeconds: number;
  startStationWorkManually: boolean;
  warmupEnabled: boolean;
  warmupMinutes: number;
  warmupSeconds: number;
  cooldownEnabled: boolean;
  cooldownMinutes: number;
  cooldownSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimerRun {
  id: string;
  timerId: string;
  timerNameAtRun: string;
  timerSnapshot: Timer;
  complete: boolean;
  ranAt: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  coachMode: boolean;
  kobeEverywhere: boolean;
  endIntervalLongBeep: boolean;
  countdownLast5Beeps: boolean;
  intervalColors: Record<IntervalType, string>;
}

export interface TimelineEntry {
  id: string;
  type: CountdownType;
  name: string;
  durationMs: number;
  stationNumber: number | null;
  roundNumber: number | null;
}

export interface TimerValidationResult {
  valid: boolean;
  errors: string[];
  normalized: Timer;
}
