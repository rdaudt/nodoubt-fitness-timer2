import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildTimeline } from '../lib/timerEngine';
import { totalTimelineDurationMs } from '../lib/time';
import { AudioService } from '../services/audio';
import { WakeLockService } from '../services/wakeLock';
import type { TimelineEntry, Timer } from '../types';

type RunnerStatus = 'idle' | 'running' | 'paused' | 'completed';
type PauseReason = 'user' | 'stationStart' | null;

interface RunnerState {
  status: RunnerStatus;
  pauseReason: PauseReason;
  currentIndex: number;
  currentRemainingMs: number;
  totalRemainingMs: number;
}

interface RunnerSoundOptions {
  endIntervalLongBeep: boolean;
  countdownLast5Beeps: boolean;
}

const shouldPauseBeforeNext = (
  current: TimelineEntry | undefined,
  next: TimelineEntry | undefined,
  coachMode: boolean,
  startStationWorkManually: boolean,
): boolean => (
  coachMode
  && startStationWorkManually
  && Boolean(next)
  && next?.type === 'work'
  && (current?.type === 'warmup' || current?.type === 'stationTransition')
);

export const shouldPlayCountdownBeep = (
  remainingMs: number,
  previousSecond: number | null,
): number | null => {
  const second = Math.ceil(Math.max(0, remainingMs) / 1000);
  if (second >= 1 && second <= 5 && second !== previousSecond) {
    return second;
  }
  return null;
};

export const useTimerRunner = (timer: Timer, coachMode: boolean, sound: RunnerSoundOptions) => {
  const timeline = useMemo(() => buildTimeline(timer), [timer]);
  const totalMs = useMemo(() => totalTimelineDurationMs(timeline), [timeline]);
  const manualStart = coachMode && timer.startStationWorkManually;

  const [state, setState] = useState<RunnerState>({
    status: 'idle',
    pauseReason: null,
    currentIndex: 0,
    currentRemainingMs: timeline[0]?.durationMs ?? 0,
    totalRemainingMs: totalMs,
  });

  const segmentEndRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const elapsedBeforeCurrentRef = useRef<number>(0);
  const lastCountdownSecondRef = useRef<number | null>(null);
  const lastCountdownEntryIdRef = useRef<string | null>(null);

  const elapsedBeforeIndex = useCallback((index: number): number =>
    timeline.slice(0, index).reduce((sum, item) => sum + item.durationMs, 0), [timeline]);

  const setSegmentFromIndex = useCallback((index: number, now: number) => {
    const entry = timeline[index];
    const duration = entry?.durationMs ?? 0;
    const elapsed = elapsedBeforeIndex(index);
    segmentEndRef.current = now + duration;
    startedAtRef.current = now;
    elapsedBeforeCurrentRef.current = elapsed;
    setState((prev) => ({
      ...prev,
      currentIndex: index,
      pauseReason: null,
      currentRemainingMs: duration,
      totalRemainingMs: Math.max(0, totalMs - elapsed),
    }));
    const entryId = timeline[index]?.id ?? null;
    lastCountdownEntryIdRef.current = entryId;
    lastCountdownSecondRef.current = null;
  }, [elapsedBeforeIndex, timeline, totalMs]);

  const start = useCallback(async () => {
    if (timeline.length === 0) {
      return;
    }
    const now = Date.now();
    await WakeLockService.acquire();
    setSegmentFromIndex(0, now);
    setState((prev) => ({ ...prev, status: 'running', pauseReason: null }));
  }, [setSegmentFromIndex, timeline.length]);

  const pause = useCallback(async () => {
    if (state.status !== 'running') {
      return;
    }
    await WakeLockService.release();
    setState((prev) => ({
      ...prev,
      status: 'paused',
      pauseReason: 'user',
      currentRemainingMs: Math.max(0, segmentEndRef.current - Date.now()),
    }));
  }, [state.status]);

  const resume = useCallback(async () => {
    if (state.status !== 'paused') {
      return;
    }
    const now = Date.now();
    await WakeLockService.acquire();
    segmentEndRef.current = now + state.currentRemainingMs;
    startedAtRef.current = now - ((timeline[state.currentIndex]?.durationMs ?? 0) - state.currentRemainingMs);
    setState((prev) => ({ ...prev, status: 'running', pauseReason: null }));
  }, [state, timeline]);

  const stop = useCallback(async () => {
    await WakeLockService.release();
    setState({
      status: 'completed',
      pauseReason: null,
      currentIndex: timeline.length > 0 ? Math.min(state.currentIndex, timeline.length - 1) : 0,
      currentRemainingMs: 0,
      totalRemainingMs: 0,
    });
  }, [state.currentIndex, timeline]);

  useEffect(() => {
    const unlock = () => {
      AudioService.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (state.status !== 'running') {
      return;
    }

    const tick = () => {
      const now = Date.now();
      let index = state.currentIndex;
      let end = segmentEndRef.current;

      while (now >= end && index < timeline.length - 1) {
        const nextIndex = index + 1;
        const current = timeline[index];
        const next = timeline[nextIndex];

        if (shouldPauseBeforeNext(current, next, coachMode, manualStart)) {
          const elapsed = elapsedBeforeIndex(nextIndex);
          const duration = next?.durationMs ?? 0;
          segmentEndRef.current = now + duration;
          startedAtRef.current = now;
          elapsedBeforeCurrentRef.current = elapsed;
          WakeLockService.release();
          setState((prev) => ({
            ...prev,
            status: 'paused',
            pauseReason: 'stationStart',
            currentIndex: nextIndex,
            currentRemainingMs: duration,
            totalRemainingMs: Math.max(0, totalMs - elapsed),
          }));
          const entryId = timeline[nextIndex]?.id ?? null;
          lastCountdownEntryIdRef.current = entryId;
          lastCountdownSecondRef.current = null;
          return;
        }

        if (sound.endIntervalLongBeep) {
          AudioService.playLongIntervalEndBeep();
        }
        index = nextIndex;
        const nextDuration = timeline[index].durationMs;
        end += nextDuration;
      }

      if (now >= end && index === timeline.length - 1) {
        if (sound.endIntervalLongBeep) {
          AudioService.playLongIntervalEndBeep();
        }
        WakeLockService.release();
        setState((prev) => ({
          ...prev,
          status: 'completed',
          pauseReason: null,
          currentRemainingMs: 0,
          totalRemainingMs: 0,
        }));
        return;
      }

      if (index !== state.currentIndex) {
        segmentEndRef.current = end;
        startedAtRef.current = end - timeline[index].durationMs;
        elapsedBeforeCurrentRef.current = elapsedBeforeIndex(index);
        lastCountdownEntryIdRef.current = timeline[index]?.id ?? null;
        lastCountdownSecondRef.current = null;
        setState((prev) => ({ ...prev, currentIndex: index }));
      }

      const currentRemainingMs = Math.max(0, segmentEndRef.current - now);
      const elapsedCurrent = Math.max(0, now - startedAtRef.current);
      const totalRemainingMs = Math.max(0, totalMs - elapsedBeforeCurrentRef.current - elapsedCurrent);

      setState((prev) => ({
        ...prev,
        currentRemainingMs,
        totalRemainingMs,
      }));

      if (sound.countdownLast5Beeps) {
        const activeEntryId = timeline[index]?.id ?? null;
        if (activeEntryId !== lastCountdownEntryIdRef.current) {
          lastCountdownEntryIdRef.current = activeEntryId;
          lastCountdownSecondRef.current = null;
        }
        const beepSecond = shouldPlayCountdownBeep(currentRemainingMs, lastCountdownSecondRef.current);
        if (beepSecond !== null) {
          lastCountdownSecondRef.current = beepSecond;
          AudioService.playShortCountdownBeep();
        }
      }
    };

    const id = window.setInterval(tick, 120);
    tick();
    return () => window.clearInterval(id);
  }, [coachMode, elapsedBeforeIndex, manualStart, sound.countdownLast5Beeps, sound.endIntervalLongBeep, state.currentIndex, state.status, timeline, totalMs]);

  useEffect(() => {
    return () => {
      WakeLockService.release();
    };
  }, []);

  return {
    timeline,
    state,
    start,
    pause,
    resume,
    stop,
  };
};
