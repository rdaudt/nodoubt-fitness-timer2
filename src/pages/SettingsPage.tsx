import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, TYPE_LABELS } from '../config';
import { intervalColorsAreUnique } from '../lib/settingsRules';
import { useSettings } from '../services/settingsContext';
import type { AppSettings, IntervalType } from '../types';
import kobeSmiling from '../../media/kobe-smiling.png';
import kobeAngry from '../../media/kobe-angry.png';
import victorianGym3 from '../../media/victorian-gym-3.png';

const types: IntervalType[] = ['warmup', 'work', 'rest', 'cooldown'];

export const SettingsPage = () => {
  const { settings, saveSettings } = useSettings();
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const unique = useMemo(() => intervalColorsAreUnique(draft), [draft]);

  const updateDraft = (next: AppSettings) => {
    setDraft(next);
    if (intervalColorsAreUnique(next)) {
      void saveSettings(next);
    }
  };

  return (
    <section>
      <h1 className="screen-title settings-page-title">Settings</h1>

      <label className="field settings-toggle-row settings-kobe-row">
        <span>Kobe Everywhere</span>
        <div className="settings-kobe-control">
          <img
            className="settings-kobe-face"
            src={draft.kobeEverywhere ? kobeSmiling : kobeAngry}
            alt={draft.kobeEverywhere ? 'Kobe smiling' : 'Kobe angry'}
          />
          <input
            className="settings-toggle-input"
            type="checkbox"
            checked={draft.kobeEverywhere}
            onChange={(e) => updateDraft({ ...draft, kobeEverywhere: e.target.checked })}
            aria-label="Kobe Everywhere"
          />
        </div>
      </label>

      <label className="field settings-toggle-row">
        <span>Long beep at end of interval</span>
        <input
          className="settings-toggle-input"
          type="checkbox"
          checked={draft.endIntervalLongBeep}
          onChange={(e) => updateDraft({ ...draft, endIntervalLongBeep: e.target.checked })}
          aria-label="Long beep at end of interval"
        />
      </label>

      <label className="field settings-toggle-row">
        <span>5-second beeps at end of interval</span>
        <input
          className="settings-toggle-input"
          type="checkbox"
          checked={draft.countdownLast5Beeps}
          onChange={(e) => updateDraft({ ...draft, countdownLast5Beeps: e.target.checked })}
          aria-label="5-second beeps at end of interval"
        />
      </label>

      <div className="stack settings-stack settings-color-section">
        <p className="timer-meta settings-section-note">Set unique colors for each interval type.</p>
        {types.map((type) => (
          <label key={type} className="field settings-row">
            <input
              className="settings-color-swatch"
              aria-label={`${TYPE_LABELS[type]} Color`}
              type="color"
              value={draft.intervalColors[type]}
              onChange={(e) =>
                updateDraft({
                  ...draft,
                  intervalColors: {
                    ...draft.intervalColors,
                    [type]: e.target.value,
                  },
                })
              }
            />
            <span>{TYPE_LABELS[type]} Color</span>
          </label>
        ))}
      </div>

      {!unique && <p className="error-inline">Each interval type must use a unique color.</p>}

      <div className="actions-row settings-actions-row">
        <button className="secondary-btn" onClick={() => updateDraft(DEFAULT_SETTINGS)}>Reset Defaults</button>
      </div>

      {draft.kobeEverywhere && (
        <div className="settings-float-cat-wrap" aria-hidden="true">
          <img className="settings-float-cat" src={victorianGym3} alt="" />
        </div>
      )}
    </section>
  );
};

