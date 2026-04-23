import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TYPE_LABELS } from '../config';
import { newTimer } from '../lib/timerFactory';
import { normalizeIntervals, validateIntervals } from '../lib/timerRules';
import { TimerRepository } from '../services/storage';
import type { Interval, IntervalType, Timer } from '../types';

const createInterval = (type: IntervalType): Interval => ({
  sequence: 1,
  name: TYPE_LABELS[type],
  type,
  durationMinutes: 0,
  durationSeconds: type === 'work' ? 30 : 15,
});

const resequence = (intervals: Interval[]): Interval[] =>
  intervals.map((interval, idx) => ({ ...interval, sequence: idx + 1 }));

const toDisplayNumber = (value: number): string =>
  Number.isNaN(value) ? '' : String(value);

export const TimerEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Timer>(newTimer());
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      setDraft(newTimer());
      setLoading(false);
      return;
    }

    TimerRepository.get(id).then((existing) => {
      if (existing) {
        setDraft(existing);
      }
      setLoading(false);
    });
  }, [id]);

  const validation = useMemo(() => validateIntervals(draft.intervals), [draft.intervals]);

  const patchIntervalsWithRules = (next: Interval[]) => {
    const normalized = normalizeIntervals(next);
    setDraft((prev) => ({ ...prev, intervals: normalized }));
  };

  const patchIntervalsForTyping = (next: Interval[]) => {
    setDraft((prev) => ({ ...prev, intervals: resequence(next) }));
  };

  const addInterval = (type: IntervalType) => {
    patchIntervalsWithRules([...draft.intervals, createInterval(type)]);
  };

  const updateIntervalField = (index: number, update: Partial<Interval>) => {
    const copy = [...draft.intervals];
    copy[index] = { ...copy[index], ...update };
    patchIntervalsForTyping(copy);
  };

  const updateIntervalType = (index: number, type: IntervalType) => {
    const copy = [...draft.intervals];
    copy[index] = { ...copy[index], type, name: TYPE_LABELS[type] };
    patchIntervalsWithRules(copy);
  };

  const removeInterval = (index: number) => {
    const copy = draft.intervals.filter((_, idx) => idx !== index);
    patchIntervalsWithRules(copy.length > 0 ? copy : [createInterval('work')]);
  };

  const moveInterval = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.intervals.length) {
      return;
    }
    const copy = [...draft.intervals];
    const [picked] = copy.splice(index, 1);
    copy.splice(target, 0, picked);
    patchIntervalsWithRules(copy);
  };

  const onSave = async () => {
    const checked = validateIntervals(draft.intervals);
    if (!checked.valid || !draft.name.trim() || draft.sets < 1) {
      return;
    }

    const now = new Date().toISOString();
    const next: Timer = {
      ...draft,
      name: draft.name.trim(),
      sets: Math.max(1, Math.floor(draft.sets)),
      intervals: checked.normalized,
      updatedAt: now,
      createdAt: draft.createdAt || now,
    };

    await TimerRepository.upsert(next);
    navigate(`/timer/${next.id}`);
  };

  if (loading) {
    return <p className="empty">Loading...</p>;
  }

  return (
    <section>
      <h1 className="screen-title">{id ? 'Edit Timer' : 'Create Timer'}</h1>

      <label className="field">
        Timer Name
        <input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
      </label>

      <label className="field">
        Sets
        <input
          type="number"
          min={1}
          value={draft.sets}
          onChange={(e) => setDraft((prev) => ({ ...prev, sets: Number(e.target.value) || 1 }))}
        />
      </label>

      <div className="actions-row wrap">
        <button className="secondary-btn" onClick={() => addInterval('warmup')}>+ Warmup</button>
        <button className="secondary-btn" onClick={() => addInterval('work')}>+ Work</button>
        <button className="secondary-btn" onClick={() => addInterval('rest')}>+ Rest</button>
        <button className="secondary-btn" onClick={() => addInterval('cooldown')}>+ Cooldown</button>
      </div>

      <div className="stack">
        {draft.intervals.map((interval, index) => (
          <article className="interval-edit" key={`${interval.sequence}-${index}`}>
            <div className="interval-edit-head">
              <strong>#{interval.sequence}</strong>
              <select value={interval.type} onChange={(e) => updateIntervalType(index, e.target.value as IntervalType)}>
                <option value="warmup">Warmup</option>
                <option value="work">Work</option>
                <option value="rest">Rest</option>
                <option value="cooldown">Cooldown</option>
              </select>
            </div>
            <label className="field compact">
              Name
              <input value={interval.name} onChange={(e) => updateIntervalField(index, { name: e.target.value })} />
            </label>
            <div className="duration-grid">
              <label className="field compact">
                Minutes
                <input
                  type="number"
                  min={0}
                  value={toDisplayNumber(interval.durationMinutes)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      updateIntervalField(index, { durationMinutes: Number.NaN });
                      return;
                    }
                    updateIntervalField(index, { durationMinutes: Math.max(0, Number(raw)) });
                  }}
                />
              </label>
              <label className="field compact">
                Seconds
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={toDisplayNumber(interval.durationSeconds)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      updateIntervalField(index, { durationSeconds: Number.NaN });
                      return;
                    }
                    updateIntervalField(index, { durationSeconds: Math.max(0, Math.min(59, Number(raw))) });
                  }}
                />
              </label>
            </div>
            <div className="actions-row wrap">
              <button className="secondary-btn" onClick={() => moveInterval(index, -1)}>Move Up</button>
              <button className="secondary-btn" onClick={() => moveInterval(index, 1)}>Move Down</button>
              <button className="danger-btn" onClick={() => removeInterval(index)}>Remove</button>
            </div>
          </article>
        ))}
      </div>

      {validation.errors.length > 0 && (
        <ul className="error-list">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <button className="primary-btn full" disabled={!validation.valid || !draft.name.trim() || draft.sets < 1} onClick={onSave}>
        Save Timer
      </button>
    </section>
  );
};
