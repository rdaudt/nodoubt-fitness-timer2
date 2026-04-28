import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, TYPE_LABELS } from '../config';
import { intervalColorsAreUnique } from '../lib/settingsRules';
import { exportTimersToDevice, importTimersFromFile } from '../services/timerTransfer';
import { useSettings } from '../services/settingsContext';
import type { AppSettings, IntervalType } from '../types';
import kobeSmiling from '../../media/kobe-smiling.png';
import kobeAngry from '../../media/kobe-angry.png';
import victorianGym3 from '../../media/victorian-gym-3.png';

const types: IntervalType[] = ['warmup', 'work', 'rest', 'cooldown'];

export const SettingsPage = () => {
  const { settings, saveSettings } = useSettings();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [transferMessage, setTransferMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

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

  const onExport = async () => {
    try {
      await exportTimersToDevice();
      setTransferMessage({ type: 'success', text: 'Timers exported to your device.' });
    } catch {
      setTransferMessage({ type: 'error', text: 'Failed to export timers. Please try again.' });
    }
  };

  const onImportClick = () => {
    importFileRef.current?.click();
  };

  const onImportChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const ok = window.confirm('Importing will replace all current timers in this browser. Continue?');
    if (!ok) {
      return;
    }
    try {
      const importedCount = await importTimersFromFile(file);
      setTransferMessage({ type: 'success', text: `Imported ${importedCount} timer${importedCount === 1 ? '' : 's'}.` });
      window.dispatchEvent(new Event('timers:changed'));
    } catch (error) {
      setTransferMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to import timers.',
      });
    }
  };

  return (
    <section className="settings-page">
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

      <div className="stack settings-stack settings-transfer-section">
        <h2 className="settings-subtitle">Import / Export Timers</h2>
        <p className="timer-meta settings-section-note">
          Export all timer metadata to a JSON file. Import replaces all current timers in this browser.
          Run history is not included.
        </p>
        <div className="actions-row settings-actions-row">
          <button className="secondary-btn" onClick={() => void onExport()}>Export Timers</button>
          <button className="secondary-btn" onClick={onImportClick}>Import Timers</button>
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void onImportChange(e)}
          aria-label="Import timers file"
          hidden
        />
        {transferMessage && (
          <p className={transferMessage.type === 'error' ? 'error-inline' : 'settings-success-inline'}>
            {transferMessage.text}
          </p>
        )}
      </div>

      {draft.kobeEverywhere && (
        <div className="settings-float-cat-wrap" aria-hidden="true">
          <img className="settings-float-cat" src={victorianGym3} alt="" />
        </div>
      )}
    </section>
  );
};

