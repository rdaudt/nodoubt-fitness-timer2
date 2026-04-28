import type { AppSettings } from './types';

export const APP_NAME = 'HIIT Timer by NoDoubt Fitness';

export const BRAND = {
  businessName: 'NoDoubt Fitness',
  tagline: 'Results. Confidence. No Doubt.',
  coachName: 'NoDoubt Fitness Coach',
  ctaLabel: 'DM me for coaching',
  instagramUrl: 'https://www.instagram.com/nodoubt.fitness/',
  aboutBio:
    'BCRPA Certified Personal Trainer offering online coaching, personalized workout plans, and nutritional guidance. Results. Confidence. No Doubt.',
};

export const DEFAULT_SETTINGS: AppSettings = {
  coachMode: true,
  kobeEverywhere: true,
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
