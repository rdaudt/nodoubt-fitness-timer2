import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildTimeline } from '../lib/timerEngine';
import { getSetTransitionDurationMs, totalTimelineDurationMs } from '../lib/time';
import { AudioService } from '../services/audio';
import { WakeLockService } from '../services/wakeLock';
import type { TimelineEntry, Timer } from '../types';

type RunnerStatus = 'idle' | 'running' | 'paused' | 'completed';
type PauseReason = 'user' | 'afterWarmup' | 'betweenSets' | null;
type RunnerPhase = 'interval' | 'setTransition';

interface RunnerState {
  status: RunnerStatus;
  phase: RunnerPhase;
  pauseReason: PauseReason;
  currentIndex: number;
  currentSetNumber: number;
  currentRemainingMs: number;
  totalRemainingMs: number;
}

export const isSetBoundaryTransition = (
  current: TimelineEntry | undefined,
  next: TimelineEntry | undefined,
): boolean => (
  Boolean(current)
  && Boolean(next)
  && current?.setNumber !== null
  && next?.setNumber !== null
  && (next?.setNumber ?? 0) > (current?.setNumber ?? 0)
);

export const useTimerRunner = (timer: Timer) => {
  const timeline = useMemo(() => buildTimeline(timer), [timer]);
  const repeatSetsUntilStopped = timer.repeatSetsUntilStopped;
  const setTransitionMs = useMemo(() => getSetTransitionDurationMs(timer), [timer]);
  const coreStartIndex = useMemo(() => timeline.findIndex((entry) => entry.setNumber !== null), [timeline]);
  const coreEndIndex = useMemo(() => {
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
      if (timeline[i].setNumber !== null) {
        return i;
      }
    }
    return -1;
  }, [timeline]);
  const elapsedBeforeByIndex = useMemo(() => {
    const values: number[] = [];
    let total = 0;
    for (let i = 0; i < timeline.length; i += 1) {
      values[i] = total;
      total += timeline[i].durationMs;
    }
    return values;
  }, [timeline]);
  const finiteSetTransitionCount = useMemo(() => {
    if (repeatSetsUntilStopped || coreStartIndex < 0) {
      return 0;
    }
    return Math.max(0, timer.sets - 1);
  }, [coreStartIndex, repeatSetsUntilStopped, timer.sets]);
  const totalMs = useMemo(
    () => totalTimelineDurationMs(timeline) + finiteSetTransitionCount * setTransitionMs,
    [finiteSetTransitionCount, setTransitionMs, timeline],
  );

  const [state, setState] = useState<RunnerState>({
    status: 'idle',
    phase: 'interval',
    pauseReason: null,
    currentIndex: 0,
    currentSetNumber: timeline[0]?.setNumber ?? 1,
    currentRemainingMs: timeline[0]?.durationMs ?? 0,
    totalRemainingMs: repeatSetsUntilStopped ? 0 : totalMs,
  });

  const segmentEndRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const elapsedBeforeCurrentRef = useRef<number>(0);
  const elapsedTransitionsCompletedRef = useRef<number>(0);
  const transitionTargetIndexRef = useRef<number>(0);
  const transitionTargetSetRef = useRef<number>(1);
  const transitionPauseAfterRef = useRef<boolean>(false);

  const setSegmentFromIndex = useCallback(
    (index: number, now: number, nextSetNumber?: number) => {
      const entry = timeline[index];
      const segmentDuration = entry?.durationMs ?? 0;
      const elapsedFromPrevious = elapsedBeforeByIndex[index] ?? 0;
      segmentEndRef.current = now + segmentDuration;
      startedAtRef.current = now;
      elapsedBeforeCurrentRef.current = elapsedFromPrevious;
      setState((prev) => ({
        ...prev,
        phase: 'interval',
        currentIndex: index,
        currentSetNumber: nextSetNumber ?? entry?.setNumber ?? prev.currentSetNumber,
        pauseReason: null,
        currentRemainingMs: segmentDuration,
        totalRemainingMs: repeatSetsUntilStopped
          ? 0
          : Math.max(0, totalMs - elapsedFromPrevious - elapsedTransitionsCompletedRef.current),
      }));
    },
    [elapsedBeforeByIndex, repeatSetsUntilStopped, timeline, totalMs],
  );

  const startSetTransition = useCallback((
    nextIndex: number,
    nextSetNumber: number,
    pauseAfterTransition: boolean,
    now: number,
  ) => {
    const nextEntry = timeline[nextIndex];
    const nextDuration = nextEntry?.durationMs ?? 0;
    const elapsedBeforeNext = elapsedBeforeByIndex[nextIndex] ?? 0;

    if (setTransitionMs <= 0) {
      if (pauseAfterTransition) {
        WakeLockService.release();
        elapsedBeforeCurrentRef.current = elapsedBeforeNext;
        setState((prev) => ({
          ...prev,
          status: 'paused',
          phase: 'interval',
          pauseReason: 'betweenSets',
          currentIndex: nextIndex,
          currentSetNumber: nextSetNumber,
          currentRemainingMs: nextDuration,
          totalRemainingMs: repeatSetsUntilStopped
            ? 0
            : Math.max(0, totalMs - elapsedBeforeNext - elapsedTransitionsCompletedRef.current),
        }));
        return;
      }
      setSegmentFromIndex(nextIndex, now, nextSetNumber);
      setState((prev) => ({ ...prev, status: 'running', phase: 'interval', pauseReason: null }));
      return;
    }

    transitionTargetIndexRef.current = nextIndex;
    transitionTargetSetRef.current = nextSetNumber;
    transitionPauseAfterRef.current = pauseAfterTransition;
    segmentEndRef.current = now + setTransitionMs;
    startedAtRef.current = now;
    elapsedBeforeCurrentRef.current = elapsedBeforeNext;
    setState((prev) => ({
      ...prev,
      status: 'running',
      phase: 'setTransition',
      pauseReason: null,
      currentIndex: nextIndex,
      currentSetNumber: nextSetNumber,
      currentRemainingMs: setTransitionMs,
      totalRemainingMs: repeatSetsUntilStopped
        ? 0
        : Math.max(0, totalMs - elapsedBeforeNext - elapsedTransitionsCompletedRef.current),
    }));
  }, [elapsedBeforeByIndex, repeatSetsUntilStopped, setSegmentFromIndex, setTransitionMs, timeline, totalMs]);

  const start = useCallback(async () => {
    if (timeline.length === 0) {
      return;
    }

    const now = Date.now();
    await WakeLockService.acquire();
    elapsedTransitionsCompletedRef.current = 0;
    setSegmentFromIndex(0, now);
    setState((prev) => ({ ...prev, status: 'running', phase: 'interval', pauseReason: null }));
  }, [setSegmentFromIndex, timeline.length]);

  const pause = useCallback(async () => {
    if (state.status !== 'running' || state.phase !== 'interval') {
      return;
    }
    await WakeLockService.release();
    setState((prev) => ({
      ...prev,
      status: 'paused',
      phase: 'interval',
      pauseReason: 'user',
      currentRemainingMs: Math.max(0, segmentEndRef.current - Date.now()),
    }));
  }, [state.phase, state.status]);

  const resume = useCallback(async () => {
    if (state.status !== 'paused' || state.phase !== 'interval') {
      return;
    }
    const now = Date.now();
    await WakeLockService.acquire();
    segmentEndRef.current = now + state.currentRemainingMs;
    startedAtRef.current = now - (timeline[state.currentIndex].durationMs - state.currentRemainingMs);
    setState((prev) => ({ ...prev, status: 'running', pauseReason: null }));
  }, [state, timeline]);

  const stop = useCallback(async () => {
    await WakeLockService.release();
    setState({
      status: 'completed',
      phase: 'interval',
      pauseReason: null,
      currentIndex: timeline.length > 0 ? Math.min(state.currentIndex, timeline.length - 1) : 0,
      currentSetNumber: state.currentSetNumber,
      currentRemainingMs: 0,
      totalRemainingMs: 0,
    });
  }, [state.currentIndex, state.currentSetNumber, timeline]);

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

      if (state.phase === 'setTransition') {
        const transitionRemainingMs = Math.max(0, segmentEndRef.current - now);
        const elapsedTransition = Math.max(0, now - startedAtRef.current);
        const totalRemainingMs = repeatSetsUntilStopped
          ? 0
          : Math.max(0, totalMs - elapsedBeforeCurrentRef.current - elapsedTransitionsCompletedRef.current - elapsedTransition);

        if (transitionRemainingMs <= 0) {
          elapsedTransitionsCompletedRef.current += setTransitionMs;
          const nextIndex = transitionTargetIndexRef.current;
          const nextSetNumber = transitionTargetSetRef.current;
          if (transitionPauseAfterRef.current) {
            WakeLockService.release();
            const nextDuration = timeline[nextIndex]?.durationMs ?? 0;
            setState((prev) => ({
              ...prev,
              status: 'paused',
              phase: 'interval',
              pauseReason: 'betweenSets',
              currentIndex: nextIndex,
              currentSetNumber: nextSetNumber,
              currentRemainingMs: nextDuration,
              totalRemainingMs: repeatSetsUntilStopped
                ? 0
                : Math.max(0, totalMs - (elapsedBeforeByIndex[nextIndex] ?? 0) - elapsedTransitionsCompletedRef.current),
            }));
            return;
          }

          setSegmentFromIndex(nextIndex, now, nextSetNumber);
          setState((prev) => ({ ...prev, status: 'running', phase: 'interval', pauseReason: null }));
          return;
        }

        setState((prev) => ({
          ...prev,
          currentRemainingMs: transitionRemainingMs,
          totalRemainingMs,
        }));
        return;
      }

      let index = state.currentIndex;
      let end = segmentEndRef.current;

      while (now >= end && index < timeline.length - 1) {
        const nextIndex = index + 1;
        const current = timeline[index];
        const next = timeline[nextIndex];

        const movingFromWarmupToFirstSet = current?.type === 'warmup' && next?.setNumber !== null;
        const movingToNextSet = isSetBoundaryTransition(current, next);
        if (repeatSetsUntilStopped && movingFromWarmupToFirstSet) {
          const nextDuration = next?.durationMs ?? 0;
          segmentEndRef.current = now + nextDuration;
          startedAtRef.current = now;
          elapsedBeforeCurrentRef.current = elapsedBeforeByIndex[nextIndex] ?? 0;
          WakeLockService.release();
          setState((prev) => ({
            ...prev,
            status: 'paused',
            phase: 'interval',
            pauseReason: 'afterWarmup',
            currentIndex: nextIndex,
            currentSetNumber: next?.setNumber ?? prev.currentSetNumber,
            currentRemainingMs: nextDuration,
            totalRemainingMs: 0,
          }));
          return;
        }
        if (movingToNextSet) {
          const nextSetNumber = next?.setNumber ?? (state.currentSetNumber + 1);
          startSetTransition(nextIndex, nextSetNumber, repeatSetsUntilStopped, now);
          return;
        }

        index = nextIndex;
        const nextDuration = timeline[index].durationMs;
        end += nextDuration;
        AudioService.playTransitionCue();
      }

      if (now >= end && repeatSetsUntilStopped && index === coreEndIndex && coreStartIndex >= 0) {
        startSetTransition(coreStartIndex, state.currentSetNumber + 1, true, now);
        return;
      }

      if (now >= end && index === timeline.length - 1) {
        WakeLockService.release();
        setState((prev) => ({
          ...prev,
          status: 'completed',
          phase: 'interval',
          pauseReason: null,
          currentRemainingMs: 0,
          totalRemainingMs: 0,
        }));
        return;
      }

      if (index !== state.currentIndex) {
        segmentEndRef.current = end;
        startedAtRef.current = end - timeline[index].durationMs;
        elapsedBeforeCurrentRef.current = elapsedBeforeByIndex[index] ?? 0;
        setState((prev) => ({ ...prev, currentIndex: index, currentSetNumber: timeline[index]?.setNumber ?? prev.currentSetNumber }));
      }

      const currentRemainingMs = Math.max(0, segmentEndRef.current - now);
      const elapsedCurrent = Math.max(0, now - startedAtRef.current);
      const totalRemainingMs = repeatSetsUntilStopped
        ? 0
        : Math.max(0, totalMs - elapsedBeforeCurrentRef.current - elapsedTransitionsCompletedRef.current - elapsedCurrent);

      setState((prev) => ({
        ...prev,
        currentRemainingMs,
        totalRemainingMs,
      }));
    };

    const id = window.setInterval(tick, 120);
    tick();
    return () => window.clearInterval(id);
  }, [
    coreEndIndex,
    coreStartIndex,
    elapsedBeforeByIndex,
    repeatSetsUntilStopped,
    setSegmentFromIndex,
    setTransitionMs,
    startSetTransition,
    state.currentIndex,
    state.currentSetNumber,
    state.phase,
    state.status,
    timeline,
    totalMs,
  ]);

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
