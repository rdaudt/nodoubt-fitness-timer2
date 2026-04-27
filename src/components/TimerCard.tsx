import { useRef, useState, type MouseEventHandler, type PointerEventHandler } from 'react';
import { Link } from 'react-router-dom';
import type { AppSettings, Timer } from '../types';
import { formatTimerTotal, getTimerSummaryItems } from '../lib/time';

const ACTION_WIDTH = 96;
const OPEN_THRESHOLD = 44;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const TimerCard = ({
  timer,
  intervalColors,
  coachMode,
  featureImage,
  onDelete,
}: {
  timer: Timer;
  intervalColors: AppSettings['intervalColors'];
  coachMode: boolean;
  featureImage?: string;
  onDelete: (id: string) => void;
}) => {
  const summaryItems = getTimerSummaryItems(timer, coachMode);
  const [translateX, setTranslateX] = useState(0);
  const [open, setOpen] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);

  const close = () => {
    setOpen(false);
    setTranslateX(0);
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startOffsetRef.current = translateX;
    movedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    if (pointerIdRef.current !== e.pointerId) {
      return;
    }
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 4) {
      movedRef.current = true;
    }
    const next = clamp(startOffsetRef.current + delta, -ACTION_WIDTH, 0);
    setTranslateX(next);
  };

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
    if (pointerIdRef.current !== e.pointerId) {
      return;
    }
    pointerIdRef.current = null;
    if (movedRef.current) {
      suppressClickRef.current = true;
    }
    if (translateX <= -OPEN_THRESHOLD) {
      setTranslateX(-ACTION_WIDTH);
      setOpen(true);
      return;
    }
    close();
  };

  const onCardLinkClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (suppressClickRef.current || open) {
      e.preventDefault();
      suppressClickRef.current = false;
      close();
    }
  };

  return (
    <div className="timer-swipe-row">
      <div className="timer-swipe-action">
        <button className="timer-swipe-delete" onClick={() => onDelete(timer.id)} type="button">Delete</button>
      </div>

      <div
        className="timer-swipe-surface"
        style={{ transform: `translateX(${translateX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={close}
      >
        <div className={featureImage ? 'timer-card timer-card-featured' : 'timer-card'}>
          {featureImage && (
            <div
              className="timer-card-feature-image"
              style={{ backgroundImage: `url(${featureImage})` }}
              aria-hidden="true"
            />
          )}
          <Link className="timer-card-main" to={`/timer/${timer.id}`} onClick={onCardLinkClick}>
            <div className="timer-card-copy">
              <h3>{timer.name}</h3>
              <div className="timer-card-meta-row">
                {summaryItems.map((item) => (
                  <span className="timer-type-total" key={`${item.type}-${item.label}`}>
                    {item.type === 'warmup' || item.type === 'work' || item.type === 'rest' || item.type === 'cooldown'
                      ? (
                          <span
                            className="timer-type-dot"
                            style={{ backgroundColor: intervalColors[item.type] }}
                            aria-hidden="true"
                          />
                        )
                      : null}
                    {item.label} {item.value}
                  </span>
                ))}
              </div>
            </div>
          </Link>

          <div className="timer-card-actions">
            <div className="timer-card-total">
              <strong>{formatTimerTotal(timer)}</strong>
              <span>Total Time</span>
            </div>
            <Link className="timer-run-btn" to={`/timer/${timer.id}/run?from=home`} aria-label={`Run ${timer.name}`} onClick={onCardLinkClick}>
              <span aria-hidden="true">▶</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
