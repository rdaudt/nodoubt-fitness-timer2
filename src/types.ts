export type IntervalType = 'warmup' | 'work' | 'rest' | 'cooldown';
export type CountdownType = IntervalType | 'stationTransition';
export type WorkoutCategory = 'GENERAL' | 'FAT-LOSS' | 'PERFORMANCE';
export type TemplateSource = 'builtin' | 'user' | 'portal';

export interface Timer {
  id: string;
  name: string;
  stationCount: number;
  stationWorkoutTypes?: string[];
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
  category: WorkoutCategory;
  createdAt: string;
  updatedAt: string;
}

export interface TimerRun {
  id: string;
  timerId: string;
  timerNameAtRun: string;
  timerSnapshot: Timer;
  stationWorkoutTypes?: string[];
  totalPerStationMs: number;
  totalWorkMs: number;
  category: WorkoutCategory;
  complete: boolean;
  ranAt: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface HiitClass extends TimerRun {
  classDate: string | null;
  startTime: string | null;
  endTime: string | null;
  locationId: string | null;
  locationLabelAtRun: string | null;
}

export interface HiitClassLocation {
  id: string;
  label: string;
  isDefault: boolean;
  sortOrder: number;
  logoUrl?: string;
}

export interface AppSettings {
  kobeEverywhere: boolean;
  imagesInAllTimers: boolean;
  bwTimerImages: boolean;
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

export interface Template {
  id: string;
  name: string;
  stationCount: number;
  stationWorkoutTypes?: string[];
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
  category: WorkoutCategory;
  createdAt: string;
  updatedAt: string;
  source: TemplateSource;
  builtinTemplateId?: string;
}

export interface TenantPublicProfile {
  id: string;
  slug: string;
  businessName: string;
  coachName: string;
  headerTagline: string;
  igUsername: string;
  bio: string;
  logoUrl: string;
  coachPhotoUrl: string;
  qrCodeUrl: string;
  socialLinks: Array<{
    label: string;
    url: string;
    sortOrder: number;
  }>;
}

export interface PublicTemplate {
  id: string;
  name: string;
  stationCount: number;
  stationWorkoutTypes?: string[];
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
  category: WorkoutCategory;
  createdAt: string;
  updatedAt: string;
}

export interface CoachDirectoryItem {
  slug: string;
  coachName: string;
  businessName: string;
  coachPhotoUrl: string;
  igUsername: string;
}

export interface CoachDirectoryResponse {
  items: CoachDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
