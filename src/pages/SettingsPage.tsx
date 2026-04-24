import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, TYPE_LABELS } from '../config';
import { intervalColorsAreUnique } from '../lib/settingsRules';
import { useSettings } from '../services/settingsContext';
import type { AppSettings, IntervalType } from '../types';
import victorianGym3 from '../../media/victorian-gym-3.png';

const types: IntervalType[] = ['warmup', 'work', 'rest', 'cooldown'];

export const SettingsPage = () => {
  const { settings, saveSettings } = useSettings();
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const unique = useMemo(() => intervalColorsAreUnique(draft), [draft]);

  const onSave = async () => {
    if (!unique) {
      return;
    }
    await saveSettings(draft);
  };

  return (
    <section>
      <h1 className="screen-title settings-page-title">Settings</h1>

      <label className="field settings-toggle-row">
        <span>Pause between sets</span>
        <input
          className="settings-toggle-input"
          type="checkbox"
          checked={draft.pauseBetweenSets}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              pauseBetweenSets: e.target.checked,
            }))
          }
          aria-label="Pause between sets"
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
                setDraft((prev) => ({
                  ...prev,
                  intervalColors: {
                    ...prev.intervalColors,
                    [type]: e.target.value,
                  },
                }))
              }
            />
            <span>{TYPE_LABELS[type]} Color</span>
          </label>
        ))}
      </div>

      {!unique && <p className="error-inline">Each interval type must use a unique color.</p>}

      <div className="actions-row">
        <button className="primary-btn" onClick={onSave} disabled={!unique}>Save</button>
        <button className="secondary-btn" onClick={() => setDraft(DEFAULT_SETTINGS)}>Reset Defaults</button>
      </div>

      <a
        className="settings-float-cat-wrap"
        href="https://www.instagram.com/kobetheabby/"
        target="_blank"
        rel="noreferrer"
        aria-label="Kobe the Abby Instagram"
      >
        <img className="settings-float-cat" src={victorianGym3} alt="" />
      </a>
    </section>
  );
};

