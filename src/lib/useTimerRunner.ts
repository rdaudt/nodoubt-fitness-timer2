import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildTimeline } from '../lib/timerEngine';
import { totalTimelineDurationMs } from '../lib/time';
import { AudioService } from '../services/audio';
import { WakeLockService } from '../services/wakeLock';
import type { Timer } from '../types';

type RunnerStatus = 'idle' | 'running' | 'paused' | 'completed';

interface RunnerState {
  status: RunnerStatus;
  currentIndex: number;
  currentRemainingMs: number;
  totalRemainingMs: number;
}

export const useTimerRunner = (timer: Timer) => {
  const timeline = useMemo(() => buildTimeline(timer), [timer]);
  const totalMs = useMemo(() => totalTimelineDurationMs(timeline), [timeline]);

  const [state, setState] = useState<RunnerState>({
    status: 'idle',
    currentIndex: 0,
    currentRemainingMs: timeline[0]?.durationMs ?? 0,
    totalRemainingMs: totalMs,
  });

  const segmentEndRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const elapsedBeforeCurrentRef = useRef<number>(0);

  const setSegmentFromIndex = useCallback(
    (index: number, now: number) => {
      const entry = timeline[index];
      const segmentDuration = entry?.durationMs ?? 0;
      segmentEndRef.current = now + segmentDuration;
      startedAtRef.current = now;
      const elapsedFromPrevious = timeline.slice(0, index).reduce((sum, item) => sum + item.durationMs, 0);
      elapsedBeforeCurrentRef.current = elapsedFromPrevious;
      setState((prev) => ({
        ...prev,
        currentIndex: index,
        currentRemainingMs: segmentDuration,
        totalRemainingMs: Math.max(0, totalMs - elapsedFromPrevious),
      }));
    },
    [timeline, totalMs],
  );

  const start = useCallback(async () => {
    if (timeline.length === 0) {
      return;
    }

    const now = Date.now();
    await WakeLockService.acquire();
    setSegmentFromIndex(0, now);
    setState((prev) => ({ ...prev, status: 'running' }));
  }, [setSegmentFromIndex, timeline.length]);

  const pause = useCallback(async () => {
    if (state.status !== 'running') {
      return;
    }
    await WakeLockService.release();
    setState((prev) => ({
      ...prev,
      status: 'paused',
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
    startedAtRef.current = now - (timeline[state.currentIndex].durationMs - state.currentRemainingMs);
    setState((prev) => ({ ...prev, status: 'running' }));
  }, [state, timeline]);

  const stop = useCallback(async () => {
    await WakeLockService.release();
    setState({
      status: 'completed',
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
        index += 1;
        const nextDuration = timeline[index].durationMs;
        end += nextDuration;
        AudioService.playTransitionCue();
      }

      if (now >= end && index === timeline.length - 1) {
        WakeLockService.release();
        setState((prev) => ({ ...prev, status: 'completed', currentRemainingMs: 0, totalRemainingMs: 0 }));
        return;
      }

      if (index !== state.currentIndex) {
        segmentEndRef.current = end;
        startedAtRef.current = end - timeline[index].durationMs;
        elapsedBeforeCurrentRef.current = timeline.slice(0, index).reduce((sum, item) => sum + item.durationMs, 0);
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
    };

    const id = window.setInterval(tick, 120);
    tick();
    return () => window.clearInterval(id);
  }, [state.currentIndex, state.status, timeline, totalMs]);

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
