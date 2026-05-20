import type { AppSettings } from './types';
import type { WorkoutCategory } from './types';

export const APP_NAME = 'Best HIIT Timer';

export const BRAND = {
  businessName: 'NoDoubt Training Co.',
  tagline: 'Results. Confidence. No Doubt.',
  coachName: 'NoDoubt Training Co. Coach',
  ctaLabel: 'DM me for coaching',
  instagramUrl: 'https://www.instagram.com/nodoubt.fitness/',
  aboutBio:
    'BCRPA Certified Personal Trainer offering online coaching, personalized workout plans, and nutritional guidance. Results. Confidence. No Doubt.',
};

export const DEFAULT_SETTINGS: AppSettings = {
  kobeEverywhere: true,
  imagesInAllTimers: false,
  bwTimerImages: true,
  endIntervalLongBeep: true,
  countdownLast5Beeps: true,
  intervalColors: {
    warmup: '#FF8C00',
    work: '#FF4444',
    rest: '#2ECC71',
    cooldown: '#3B82F6',
  },
};

export const TYPE_LABELS = {
  warmup: 'Warmup',
  work: 'Work',
  rest: 'Rest',
  cooldown: 'Cooldown',
} as const;

export const WORKOUT_CATEGORIES: readonly WorkoutCategory[] = ['GENERAL', 'FAT-LOSS', 'PERFORMANCE'] as const;

export const WORKOUT_CATEGORY_FILTERS = ['ALL', ...WORKOUT_CATEGORIES] as const;
export type WorkoutCategoryFilter = typeof WORKOUT_CATEGORY_FILTERS[number];
