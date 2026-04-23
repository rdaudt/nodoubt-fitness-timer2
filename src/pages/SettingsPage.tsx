import { useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, TYPE_LABELS } from '../config';
import { intervalColorsAreUnique } from '../lib/settingsRules';
import { useSettings } from '../services/settingsContext';
import type { AppSettings, IntervalType } from '../types';

const types: IntervalType[] = ['warmup', 'work', 'rest', 'cooldown'];

export const SettingsPage = () => {
  const { settings, saveSettings } = useSettings();
  const [draft, setDraft] = useState<AppSettings>(settings);

  const unique = useMemo(() => intervalColorsAreUnique(draft), [draft]);

  const onSave = async () => {
    if (!unique) {
      return;
    }
    await saveSettings(draft);
  };

  return (
    <section>
      <h1 className="screen-title">Settings</h1>
      <p className="timer-meta">Set one unique color for each interval type.</p>

      <div className="stack">
        {types.map((type) => (
          <label key={type} className="field settings-row">
            <span className="settings-color-label">
              <span className="settings-color-swatch" style={{ backgroundColor: draft.intervalColors[type] }} aria-hidden="true" />
              {TYPE_LABELS[type]} Color
            </span>
            <input
              className="settings-color-input"
              aria-label={`${TYPE_LABELS[type]} Color`}
              type="color"
              value={draft.intervalColors[type]}
              onChange={(e) =>
                setDraft((prev) => ({
                  intervalColors: {
                    ...prev.intervalColors,
                    [type]: e.target.value,
                  },
                }))
              }
            />
          </label>
        ))}
      </div>

      {!unique && <p className="error-inline">Each interval type must use a unique color.</p>}

      <div className="actions-row">
        <button className="primary-btn" onClick={onSave} disabled={!unique}>Save Colors</button>
        <button className="secondary-btn" onClick={() => setDraft(DEFAULT_SETTINGS)}>Reset Defaults</button>
      </div>
    </section>
  );
};

