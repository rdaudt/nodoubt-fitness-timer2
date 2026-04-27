import type { Timer, TimelineEntry } from '../types';
import { toDurationMs } from './time';

export const buildTimeline = (timer: Timer): TimelineEntry[] => {
  const warmup = timer.intervals.filter((x) => x.type === 'warmup');
  const cooldown = timer.intervals.filter((x) => x.type === 'cooldown');
  const block = timer.intervals.filter((x) => x.type === 'work' || x.type === 'rest');

  const timeline: TimelineEntry[] = [];

  warmup.forEach((segment) => {
    timeline.push({
      id: `warmup-${segment.sequence}`,
      sourceSequence: segment.sequence,
      name: segment.name,
      type: segment.type,
      durationMs: toDurationMs(segment),
      setNumber: null,
    });
  });

  const setCount = timer.repeatSetsUntilStopped ? 1 : timer.sets;

  for (let set = 1; set <= setCount; set += 1) {
    block.forEach((segment) => {
      timeline.push({
        id: `set-${set}-${segment.sequence}`,
        sourceSequence: segment.sequence,
        name: segment.name,
        type: segment.type,
        durationMs: toDurationMs(segment),
        setNumber: set,
      });
    });
  }

  if (!timer.repeatSetsUntilStopped) {
    cooldown.forEach((segment) => {
      timeline.push({
        id: `cooldown-${segment.sequence}`,
        sourceSequence: segment.sequence,
        name: segment.name,
        type: segment.type,
        durationMs: toDurationMs(segment),
        setNumber: null,
      });
    });
  }

  return timeline;
};
