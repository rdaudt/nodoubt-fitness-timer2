import type { Timer, TimelineEntry } from '../types';
import {
  getCooldownDurationMs,
  getRestDurationMs,
  getTransitionDurationMs,
  getWarmupDurationMs,
  getWorkDurationMs,
} from './time';

const pushIfPositive = (timeline: TimelineEntry[], entry: TimelineEntry) => {
  if (entry.durationMs > 0) {
    timeline.push(entry);
  }
};

export const buildTimeline = (timer: Timer): TimelineEntry[] => {
  const timeline: TimelineEntry[] = [];

  pushIfPositive(timeline, {
    id: 'warmup',
    type: 'warmup',
    name: 'Warmup',
    durationMs: getWarmupDurationMs(timer),
    stationNumber: null,
    roundNumber: null,
  });

  for (let station = 1; station <= timer.stationCount; station += 1) {
    for (let round = 1; round <= timer.roundsPerStation; round += 1) {
      pushIfPositive(timeline, {
        id: `station-${station}-round-${round}-work`,
        type: 'work',
        name: 'Work',
        durationMs: getWorkDurationMs(timer),
        stationNumber: station,
        roundNumber: round,
      });

      if (round < timer.roundsPerStation) {
        pushIfPositive(timeline, {
          id: `station-${station}-round-${round}-rest`,
          type: 'rest',
          name: 'Rest',
          durationMs: getRestDurationMs(timer),
          stationNumber: station,
          roundNumber: round,
        });
      }
    }

    if (station < timer.stationCount) {
      pushIfPositive(timeline, {
        id: `station-${station}-transition`,
        type: 'stationTransition',
        name: `Transition to ${station + 1}`,
        durationMs: getTransitionDurationMs(timer),
        stationNumber: station + 1,
        roundNumber: null,
      });
    }
  }

  pushIfPositive(timeline, {
    id: 'cooldown',
    type: 'cooldown',
    name: 'Cooldown',
    durationMs: getCooldownDurationMs(timer),
    stationNumber: null,
    roundNumber: null,
  });

  return timeline;
};
