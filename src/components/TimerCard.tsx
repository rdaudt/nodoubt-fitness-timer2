import { useRef, useState, type PointerEventHandler } from 'react';
import { Link } from 'react-router-dom';
import type { Timer } from '../types';
import { estimateTimerDurationMs, formatClock } from '../lib/time';

const ACTION_WIDTH = 96;
const OPEN_THRESHOLD = 44;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const TimerCard = ({ timer, onDelete }: { timer: Timer; onDelete: (id: string) => void }) => {
  const intervalCount = timer.intervals.length;
  const totalSeconds = Math.floor(estimateTimerDurationMs(timer) / 1000);
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
        <Link
          className="timer-card"
          to={`/timer/${timer.id}`}
          onClick={(e) => {
            if (suppressClickRef.current || open) {
              e.preventDefault();
              suppressClickRef.current = false;
              close();
            }
          }}
        >
          <div className="timer-card-head">
            <h3>{timer.name}</h3>
            <p>{formatClock(totalSeconds)}</p>
          </div>
          <p className="timer-meta">
            {timer.sets} set{timer.sets === 1 ? '' : 's'} • {intervalCount} interval{intervalCount === 1 ? '' : 's'}
          </p>
        </Link>
      </div>
    </div>
  );
};
