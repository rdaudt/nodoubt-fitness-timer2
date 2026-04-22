export type IntervalType = 'warmup' | 'work' | 'rest' | 'cooldown';

export interface Interval {
  sequence: number;
  name: string;
  type: IntervalType;
  durationMinutes: number;
  durationSeconds: number;
}

export interface Timer {
  id: string;
  name: string;
  sets: number;
  intervals: Interval[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  intervalColors: Record<IntervalType, string>;
}

export interface TimelineEntry {
  id: string;
  sourceSequence: number;
  name: string;
  type: IntervalType;
  durationMs: number;
  setNumber: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized: Interval[];
}
