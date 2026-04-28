import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatClock } from '../lib/time';
import { useTimerRunner } from '../lib/useTimerRunner';
import { useSettings } from '../services/settingsContext';
import { TimerRepository, TimerRunRepository } from '../services/storage';
import type { AppSettings, CountdownType, Timer, TimerRun, TimelineEntry } from '../types';

const currentImageByType: Partial<Record<CountdownType, string>> = {
  warmup: '/assets/cat-in-pajama-transparent-v3.png',
  work: '/assets/jab-throwing-cat.png',
  rest: '/assets/resting-cat.png',
  cooldown: '/assets/tired-cat-transparent-v1.png',
};

const workImages = [
  '/assets/jab-throwing-cat.png',
  '/assets/vintage-apparel-pushup.png',
  '/assets/vintage-apparel-crunches.png',
  '/assets/pullup-cat.png',
];

type SessionCircleType = 'warmup' | 'work' | 'rest' | 'cooldown';

interface SessionCircle {
  id: string;
  type: SessionCircleType;
  active: boolean;
}

interface SessionMapModel {
  showWarmup: boolean;
  warmupActive: boolean;
  stationRows: SessionCircle[][];
  activeStationRow: number | null;
  transitionTargetRow: number | null;
  showCooldown: boolean;
  cooldownActive: boolean;
}

const emptyTimer = (): Timer => ({
  id: 'empty',
  name: 'Missing Timer',
  stationCount: 1,
  stationWorkoutTypes: [],
  roundsPerStation: 1,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 0,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 30,
  startStationWorkManually: false,
  warmupEnabled: false,
  warmupMinutes: 0,
  warmupSeconds: 0,
  cooldownEnabled: false,
  cooldownMinutes: 0,
  cooldownSeconds: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const entryTitle = (entry: TimelineEntry | undefined, coachMode: boolean): string => {
  if (!entry) {
    return 'Done';
  }
  if (entry.type === 'stationTransition') {
    return `${coachMode ? 'Station Transition' : 'Set Transition'} ${entry.stationNumber}`;
  }
  if (entry.type === 'work') {
    return 'Work';
  }
  if (entry.type === 'rest') {
    return 'Rest';
  }
  if (entry.type === 'warmup') {
    return 'Warmup';
  }
  return 'Cooldown';
};

const entryContext = (entry: TimelineEntry | undefined, coachMode: boolean): string => {
  if (!entry) {
    return '';
  }
  const stationLabel = coachMode ? 'Station' : 'Set';
  if (entry.type === 'work') {
    return `${stationLabel} ${entry.stationNumber} - Round ${entry.roundNumber}`;
  }
  if (entry.type === 'rest') {
    return `${stationLabel} ${entry.stationNumber} - Round ${entry.roundNumber}`;
  }
  return '';
};
const entryCardStyle = (
  entry: TimelineEntry | undefined,
  intervalColors: AppSettings['intervalColors'],
) => {
  if (!entry) {
    return {};
  }
  if (entry.type === 'stationTransition') {
    return { backgroundColor: '#ffffff', color: '#111111' };
  }
  if (entry.type in intervalColors) {
    return { backgroundColor: intervalColors[entry.type as keyof typeof intervalColors], color: '#ffffff' };
  }
  return {};
};

const hasConfiguredWarmup = (timer: Timer | null): boolean => Boolean(
  timer
  && timer.warmupEnabled
  && (timer.warmupMinutes > 0 || timer.warmupSeconds > 0),
);

const hasConfiguredCooldown = (timer: Timer | null): boolean => Boolean(
  timer
  && timer.cooldownEnabled
  && (timer.cooldownMinutes > 0 || timer.cooldownSeconds > 0),
);

const toCircleIndex = (entry: TimelineEntry | undefined): number | null => {
  if (!entry || !entry.roundNumber) {
    return null;
  }
  if (entry.type === 'work') {
    return (entry.roundNumber - 1) * 2;
  }
  if (entry.type === 'rest') {
    return (entry.roundNumber - 1) * 2 + 1;
  }
  return null;
};

const formatSessionMapRowNumber = (stationNumber: number): string => String(stationNumber).padStart(2, '0');

export const RunningTimerPage = () => {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { settings, saveSettings } = useSettings();
  const [timer, setTimer] = useState<Timer | null>(null);
  const [showSessionMap, setShowSessionMap] = useState(true);
  const [confirmAction, setConfirmAction] = useState<'stop' | null>(null);
  const autoStartedRef = useRef(false);
  const runLoggedRef = useRef(false);
  const mainColumnRef = useRef<HTMLDivElement | null>(null);
  const currentCardRef = useRef<HTMLElement | null>(null);
  const [sessionMapOffsetPx, setSessionMapOffsetPx] = useState(0);

  useEffect(() => {
    TimerRepository.get(id).then((value) => setTimer(value ?? null));
  }, [id]);

  const runner = useTimerRunner(timer ?? emptyTimer(), settings.coachMode, {
    endIntervalLongBeep: settings.endIntervalLongBeep,
    countdownLast5Beeps: settings.countdownLast5Beeps,
  });

  useEffect(() => {
    if (!timer || autoStartedRef.current || runner.state.status !== 'idle' || runner.timeline.length === 0) {
      return;
    }
    autoStartedRef.current = true;
    runner.start();
  }, [runner, timer]);

  const logRun = async (complete: boolean) => {
    if (!timer || runLoggedRef.current) {
      return;
    }
    runLoggedRef.current = true;
    const nowIso = new Date().toISOString();
    const run: TimerRun = {
      id: crypto.randomUUID(),
      timerId: timer.id,
      timerNameAtRun: timer.name,
      timerSnapshot: timer,
      stationWorkoutTypes: timer.stationWorkoutTypes ?? [],
      complete,
      ranAt: nowIso,
      location: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await TimerRunRepository.create(run);
  };

  useEffect(() => {
    if (!timer || runner.state.status !== 'completed') {
      return;
    }
    void logRun(true);
  }, [runner.state.status, timer]);

  useEffect(() => {
    const updateOffset = () => {
      const currentCardEl = currentCardRef.current;
      const mainColEl = mainColumnRef.current;
      if (!currentCardEl || !mainColEl) {
        return;
      }
      const mainRect = mainColEl.getBoundingClientRect();
      const currentRect = currentCardEl.getBoundingClientRect();
      setSessionMapOffsetPx(Math.max(0, currentRect.top - mainRect.top));
    };

    updateOffset();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateOffset())
      : null;
    if (observer) {
      if (mainColumnRef.current) {
        observer.observe(mainColumnRef.current);
      }
      if (currentCardRef.current) {
        observer.observe(currentCardRef.current);
      }
    } else {
      window.addEventListener('resize', updateOffset);
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateOffset);
    };
  }, [settings.coachMode, timer?.startStationWorkManually, runner.state.status, confirmAction]);

  const donePath = searchParams.get('from') === 'home' ? '/' : `/timer/${timer?.id ?? id}`;
  const activeEntry = runner.timeline[runner.state.currentIndex];
  const nextEntry = runner.timeline[runner.state.currentIndex + 1];
  const isStationStartPause = runner.state.status === 'paused' && runner.state.pauseReason === 'stationStart';
  const workImageByStation = useMemo(() => {
    const imageByStation: Record<number, string> = {};
    let stationIndex = 0;

    runner.timeline.forEach((entry) => {
      if (entry.type !== 'work' || !entry.stationNumber) {
        return;
      }
      if (!(entry.stationNumber in imageByStation)) {
        imageByStation[entry.stationNumber] = workImages[stationIndex % workImages.length];
        stationIndex += 1;
      }
    });

    return imageByStation;
  }, [runner.timeline]);
  const currentImage = useMemo(() => {
    if (!settings.kobeEverywhere) {
      return undefined;
    }
    if (!activeEntry) {
      return undefined;
    }
    if (activeEntry.type === 'work') {
      if (!activeEntry.stationNumber) {
        return currentImageByType.work;
      }
      return workImageByStation[activeEntry.stationNumber] ?? currentImageByType.work;
    }
    return currentImageByType[activeEntry.type];
  }, [activeEntry, settings.kobeEverywhere, workImageByStation]);
  const currentStyle = useMemo(
    () => entryCardStyle(activeEntry, settings.intervalColors),
    [activeEntry, settings.intervalColors],
  );
  const nextStyle = useMemo(
    () => entryCardStyle(nextEntry, settings.intervalColors),
    [nextEntry, settings.intervalColors],
  );
  const sessionMap = useMemo<SessionMapModel>(() => {
    const stationCount = timer?.stationCount ?? 0;
    const roundsPerStation = Math.max(1, timer?.roundsPerStation ?? 1);
    const circlesPerStation = roundsPerStation * 2 - 1;

    const activeStation = activeEntry?.stationNumber ?? null;
    const activeStationRow = (activeEntry?.type === 'work' || activeEntry?.type === 'rest') && activeStation
      ? activeStation - 1
      : null;
    const activeCircleIndex = toCircleIndex(activeEntry);
    const transitionTargetRow = activeEntry?.type === 'stationTransition' && activeEntry.stationNumber
      ? activeEntry.stationNumber - 1
      : null;

    const stationRows: SessionCircle[][] = Array.from({ length: stationCount }, (_, rowIndex) =>
      Array.from({ length: circlesPerStation }, (_, circleIndex) => {
        const type: SessionCircleType = circleIndex % 2 === 0 ? 'work' : 'rest';
        const stationNumber = rowIndex + 1;
        const active = activeEntry?.type === type
          && activeStation === stationNumber
          && activeCircleIndex === circleIndex;
        return {
          id: `station-${stationNumber}-circle-${circleIndex}`,
          type,
          active,
        };
      }));

    return {
      showWarmup: hasConfiguredWarmup(timer),
      warmupActive: activeEntry?.type === 'warmup',
      stationRows,
      activeStationRow,
      transitionTargetRow,
      showCooldown: hasConfiguredCooldown(timer),
      cooldownActive: activeEntry?.type === 'cooldown',
    };
  }, [activeEntry, timer]);
  const sessionMapCircleCount = useMemo(() => {
    const roundsPerStation = Math.max(1, timer?.roundsPerStation ?? 1);
    return roundsPerStation * 2 - 1;
  }, [timer?.roundsPerStation]);

  const requestPause = async () => {
    if (runner.state.status === 'running') {
      await runner.pause();
    }
  };

  const persistTimerPatch = async (patch: Partial<Timer>) => {
    if (!timer) {
      return;
    }
    const nextTimer: Timer = {
      ...timer,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setTimer(nextTimer);
    await TimerRepository.upsert(nextTimer);
  };

  const requestStop = () => {
    if (runner.state.status === 'running') {
      setConfirmAction('stop');
      return;
    }
    runner.stop();
  };

  const confirm = async () => {
    if (confirmAction === 'stop') {
      await logRun(false);
      await runner.stop();
    }
    setConfirmAction(null);
  };

  if (!timer) {
    return <p className="empty">Timer not found.</p>;
  }

  return (
    <section className="run-page">
      <div
        className={`run-layout${showSessionMap ? ' has-session-map' : ''}`}
        style={{
          '--session-map-circle-count': sessionMapCircleCount,
          '--run-session-map-offset': `${sessionMapOffsetPx}px`,
        } as CSSProperties}
      >
        <div className="run-main-column" ref={mainColumnRef}>
          <header className="run-header">
            <p className="run-name">{timer.name}</p>
            <p className="run-remaining">Total remaining: {formatClock(runner.state.totalRemainingMs / 1000)}</p>
            {isStationStartPause && <p className="run-paused-flag run-set-start-flag pulse">Prepare to start</p>}
          </header>

          <article
            ref={currentCardRef}
            className={`run-current-card ${activeEntry?.type === 'stationTransition' ? 'station-transition' : ''}`}
            style={currentStyle}
          >
            {currentImage && <img className="run-current-image" src={currentImage} alt="" aria-hidden="true" />}
            <div className="run-current-copy">
              <p className="run-current-context">{entryContext(activeEntry, settings.coachMode)}</p>
              <h1>{entryTitle(activeEntry, settings.coachMode)}</h1>
              <p className="run-current-time">{formatClock(runner.state.currentRemainingMs / 1000)}</p>
            </div>
          </article>

          <article className="run-next-card" style={nextStyle}>
            <span>next</span>
            <strong>{entryTitle(nextEntry, settings.coachMode)}</strong>
            {nextEntry && <p>{entryContext(nextEntry, settings.coachMode)} ({formatClock(nextEntry.durationMs / 1000)})</p>}
          </article>

          <div className="actions-row wrap run-actions">
            {confirmAction === 'stop' ? (
              <>
                <p className="run-confirm-inline-text">Stop the timer?</p>
                <button className="danger-btn" onClick={confirm}>Confirm Stop</button>
                <button className="secondary-btn" onClick={() => setConfirmAction(null)}>Cancel</button>
              </>
            ) : (
              <>
                {runner.state.status === 'running' && <button className="secondary-btn" onClick={requestPause}>Pause Timer</button>}
                {runner.state.status === 'paused' && (
                  <button className="primary-btn" onClick={runner.resume}>
                    {isStationStartPause ? 'Start' : 'Resume'}
                  </button>
                )}
                {(runner.state.status === 'running' || runner.state.status === 'paused') && (
                  <button className="danger-btn" onClick={requestStop}>{isStationStartPause ? 'Cancel' : 'Stop Timer'}</button>
                )}
                {runner.state.status === 'completed' && <Link className="primary-btn" to={donePath}>Done</Link>}
              </>
            )}
          </div>

          {!confirmAction && (
            <div className="run-bottom-toggles" aria-label="Running page controls">
            <label className="run-map-toggle-row">
              <span>Kobe Everywhere</span>
              <input
                className="settings-toggle-input"
                type="checkbox"
                checked={settings.kobeEverywhere}
                onChange={(e) => void saveSettings({ ...settings, kobeEverywhere: e.target.checked })}
                aria-label="Kobe Everywhere"
              />
            </label>
            <label className="run-map-toggle-row">
              <span>Session Map</span>
              <input
                className="settings-toggle-input"
                type="checkbox"
                checked={showSessionMap}
                onChange={(e) => setShowSessionMap(e.target.checked)}
                aria-label="Show session map"
              />
            </label>
            {settings.coachMode && (
              <label className="run-map-toggle-row">
                <span>Start Set Manually</span>
                <input
                  className="settings-toggle-input"
                  type="checkbox"
                  checked={timer.startStationWorkManually}
                  onChange={(e) => void persistTimerPatch({ startStationWorkManually: e.target.checked })}
                  aria-label="Start Set Manually"
                />
              </label>
            )}
            <label className="run-map-toggle-row">
              <span>5-second beeps at end of interval</span>
              <input
                className="settings-toggle-input"
                type="checkbox"
                checked={settings.countdownLast5Beeps}
                onChange={(e) => void saveSettings({ ...settings, countdownLast5Beeps: e.target.checked })}
                aria-label="5-second beeps at end of interval"
              />
            </label>
            <label className="run-map-toggle-row">
              <span>Long beep at end of interval</span>
              <input
                className="settings-toggle-input"
                type="checkbox"
                checked={settings.endIntervalLongBeep}
                onChange={(e) => void saveSettings({ ...settings, endIntervalLongBeep: e.target.checked })}
                aria-label="Long beep at end of interval"
              />
            </label>
            </div>
          )}
        </div>

        {showSessionMap && (
          <aside className="run-session-map" aria-label="HIIT session progress map">
            {sessionMap.showWarmup && (
              <div className="run-session-map-standalone">
                <span
                  className={`run-session-map-circle${sessionMap.warmupActive ? ' active' : ''}`}
                  style={{ backgroundColor: settings.intervalColors.warmup }}
                  aria-label={`Warmup${sessionMap.warmupActive ? ' active' : ''}`}
                />
              </div>
            )}

            {sessionMap.stationRows.map((row, rowIndex) => (
              <div
                className={`run-session-map-row${sessionMap.activeStationRow === rowIndex ? ' station-active' : ''}${sessionMap.transitionTargetRow === rowIndex ? ' transition-target' : ''}`}
                key={`station-row-${rowIndex + 1}`}
              >
                <span className="run-session-map-row-number" aria-hidden="true">
                  {formatSessionMapRowNumber(rowIndex + 1)}
                </span>
                {row.map((circle) => (
                  <span
                    key={circle.id}
                    className={`run-session-map-circle${circle.active ? ' active' : ''}`}
                    style={{ backgroundColor: settings.intervalColors[circle.type] }}
                    aria-label={`Station ${rowIndex + 1} ${circle.type}${circle.active ? ' active' : ''}`}
                  />
                ))}
                {sessionMap.transitionTargetRow === rowIndex && (
                  <span className="run-session-map-transition-arrow" aria-label={`Transition to station ${rowIndex + 1}`}>
                    ➜
                  </span>
                )}
              </div>
            ))}

            {sessionMap.showCooldown && (
              <div className="run-session-map-standalone">
                <span
                  className={`run-session-map-circle${sessionMap.cooldownActive ? ' active' : ''}`}
                  style={{ backgroundColor: settings.intervalColors.cooldown }}
                  aria-label={`Cooldown${sessionMap.cooldownActive ? ' active' : ''}`}
                />
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
};


