'use client';

import { useState, type FormEvent } from 'react';
import type { FeatureProps, Settings as SettingsType } from '@/lib/types';
import { isWorkspace, normalizeWorkspace } from '@/lib/domain';
import { buildReminderCalendar } from '@/lib/reminders';
import { exportComplete, exportJson, exportMarkdown } from '@/lib/export';
import { Field, Icon, SectionHeading } from './ui';
import { RestartChallenge } from './restart-challenge';

const lines = (value: FormDataEntryValue | null, separator: RegExp) =>
  String(value ?? '')
    .split(separator)
    .map(item => item.trim())
    .filter(Boolean);
const optional = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim();
  return text === '' ? null : Number(text);
};

export function Settings({ data, update, demo, canRestart = true }: FeatureProps & { canRestart?: boolean }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const timezone = String(form.get('timezone')).trim();
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    } catch {
      setError('Enter a valid timezone, such as Asia/Kolkata or America/New_York.');
      return;
    }
    const settings: SettingsType = {
      ...data.settings,
      name: String(form.get('name')).trim(),
      startDate: String(form.get('startDate')),
      duration: Number(form.get('duration')),
      timezone,
      currency: String(form.get('currency')),
      careerTarget: Number(form.get('careerTarget')),
      tradingTarget: Number(form.get('tradingTarget')),
      intention: String(form.get('intention')).trim(),
      configured: true,
      habitLabels: {
        smoking: String(form.get('labelSmoking')).trim() || data.settings.habitLabels.smoking,
        abstinence: String(form.get('labelAbstinence')).trim() || data.settings.habitLabels.abstinence,
      },
      dayStartHour: Number(form.get('dayStartHour')),
      symbols: lines(form.get('symbols'), /[\n,]/).map(symbol => symbol.toUpperCase()),
      tradingRules: lines(form.get('tradingRules'), /\n/),
      maxTradesPerDay: optional(form.get('maxTradesPerDay')),
      maxDailyLoss: optional(form.get('maxDailyLoss')),
      weeklyApplicationTarget: Number(form.get('weeklyApplicationTarget')),
      morningReminder: String(form.get('morningReminder')),
      eveningReminder: String(form.get('eveningReminder')),
      urgePlan: String(form.get('urgePlan')).trim(),
    };
    if (!settings.symbols.length) {
      setError('Keep at least one market, such as XAUUSD.');
      return;
    }
    if (
      settings.currency !== data.settings.currency &&
      data.trades.length &&
      !window.confirm(
        'Changing currency only changes the display label; it does not convert any existing trade amounts. Continue?',
      )
    )
      return;
    update(current => ({ ...current, settings }));
    setSaved(true);
  }
  function markBackup() {
    const at = new Date().toISOString();
    update(current => ({ ...current, settings: { ...current.settings, lastBackupAt: at } }));
  }
  function downloadReminders() {
    const text = buildReminderCalendar(data.settings, window.location.origin);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'journal26-reminders.ics';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const candidate = (parsed as { workspace?: unknown })?.workspace ?? parsed;
      if (!isWorkspace(candidate)) throw new Error('not a journal backup');
      const doc = normalizeWorkspace(candidate);
      const summary = `${Object.keys(doc.days).length} days and ${doc.trades.length} trades`;
      if (
        !window.confirm(
          `Replace everything in this journal with the backup (${summary})? Download a backup of the current state first if you might need it.`,
        )
      )
        return;
      update(() => ({ ...doc, resetId: crypto.randomUUID() }));
    } catch {
      setError('That file is not a Journal26 JSON backup. Nothing was changed.');
    }
  }
  return (
    <div className="settings-layout">
      <section className="panel">
        <SectionHeading title="Challenge" />
        <form className="stack settings-form" onSubmit={save} onChange={() => setSaved(false)}>
          <Field label="Your name">
            <input
              name="name"
              defaultValue={data.settings.name}

              maxLength={40}
            />
          </Field>
          <div className="form-grid">
            <Field label="Challenge starts">
              <input
                name="startDate"
                type="date"
                defaultValue={data.settings.startDate}
                required
                min="2020-01-01"
                max="2100-12-31"
              />
            </Field>
            <Field label="Challenge length (days)">
              <input
                name="duration"
                type="number"
                min="7"
                max="366"
                defaultValue={data.settings.duration}
                required
              />
            </Field>
          </div>
          <Field label="Why you are doing this">
            <textarea
              className="own-words"
              name="intention"
              defaultValue={data.settings.intention}
              rows={3}
              maxLength={500}
            />
          </Field>
          <div className="form-grid">
            <Field label="Career minutes per day">
              <input
                name="careerTarget"
                type="number"
                min="15"
                max="720"
                step="15"
                defaultValue={data.settings.careerTarget}
                required
              />
            </Field>
            <Field label="Trading minutes per day">
              <input
                name="tradingTarget"
                type="number"
                min="15"
                max="720"
                step="15"
                defaultValue={data.settings.tradingTarget}
                required
              />
            </Field>
          </div>
          <Field label="Timezone" hint="Day boundaries and your challenge calendar use this timezone.">
            <input name="timezone" defaultValue={data.settings.timezone} list="timezones" required />
            <datalist id="timezones">
              <option value="Asia/Kolkata" />
              <option value="Europe/London" />
              <option value="America/New_York" />
              <option value="Asia/Dubai" />
              <option value="UTC" />
            </datalist>
          </Field>
          <Field
            label="Trading account currency"
            hint="All trade amounts use this currency. No automatic exchange-rate conversion."
          >
            <select name="currency" defaultValue={data.settings.currency}>
              <option value="USD">USD, US Dollar</option>
              <option value="INR">INR, Indian Rupee</option>
              <option value="EUR">EUR, Euro</option>
              <option value="GBP">GBP, British Pound</option>
            </select>
          </Field>
          <h3 className="settings-group">Habits</h3>
          <div className="form-grid">
            <Field label="First habit name">
              <input
                name="labelSmoking"
                defaultValue={data.settings.habitLabels.smoking}
                maxLength={30}
                required
              />
            </Field>
            <Field label="Second habit name" hint="Call it whatever you like. Only you see this.">
              <input
                name="labelAbstinence"
                defaultValue={data.settings.habitLabels.abstinence}
                maxLength={30}
                required
              />
            </Field>
          </div>
          <Field
            label="When a craving hits, I will…"
            hint="Written now, shown on the Craving screen when you need it."
          >
            <textarea
              className="own-words"
              name="urgePlan"
              rows={2}
              maxLength={500}
              defaultValue={data.settings.urgePlan}
              placeholder="Go outside, drink water, do ten push-ups"
            />
          </Field>
          <h3 className="settings-group">Trading rules</h3>
          <Field label="Markets" hint="Separate with commas. Any other symbol can still be typed on a trade.">
            <input name="symbols" defaultValue={data.settings.symbols.join(', ')} maxLength={300} />
          </Field>
          <Field label="Pre-trade checklist" hint="One rule per line. Shown every time you log a trade.">
            <textarea
              name="tradingRules"
              rows={5}
              maxLength={2000}
              defaultValue={data.settings.tradingRules.join('\n')}
            />
          </Field>
          <div className="form-grid">
            <Field label="Max trades per day" hint="Blank for no limit. Counts demo and live.">
              <input
                name="maxTradesPerDay"
                type="number"
                min="1"
                max="100"
                defaultValue={data.settings.maxTradesPerDay ?? ''}
              />
            </Field>
            <Field
              label={`Max daily loss (${data.settings.currency})`}
              hint="Blank for no limit. Live trades only."
            >
              <input
                name="maxDailyLoss"
                type="number"
                min="0"
                step="any"
                defaultValue={data.settings.maxDailyLoss ?? ''}
              />
            </Field>
          </div>
          <h3 className="settings-group">Routine</h3>
          <div className="form-grid">
            <Field label="Applications per week">
              <input
                name="weeklyApplicationTarget"
                type="number"
                min="0"
                max="200"
                defaultValue={data.settings.weeklyApplicationTarget}
                required
              />
            </Field>
            <Field
              label="New day starts at"
              hint="Late-night sessions before this hour count as the previous day."
            >
              <select name="dayStartHour" defaultValue={data.settings.dayStartHour}>
                {[0, 1, 2, 3, 4, 5, 6].map(hour => (
                  <option key={hour} value={hour}>
                    {hour === 0 ? 'Midnight' : `${hour}:00 am`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Morning reminder">
              <input
                name="morningReminder"
                type="time"
                defaultValue={data.settings.morningReminder}
                required
              />
            </Field>
            <Field label="Evening reminder">
              <input
                name="eveningReminder"
                type="time"
                defaultValue={data.settings.eveningReminder}
                required
              />
            </Field>
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="inline">
            <button className="button button-primary">Save preferences</button>
            {saved && (
              <span className="success-message" role="status">
                Preferences updated
              </span>
            )}
          </div>
        </form>
      </section>
      <div className="stack">
        <RestartChallenge data={data} update={update} canRestart={canRestart} />
        <section className="panel">
          <SectionHeading title="Backups" />
          <p className="section-description">
            The free database has no backups of its own, so these files are your safety net. Keep them
            private.
          </p>
          <div className="export-buttons">
            <button
              className="button button-secondary"
              onClick={() => {
                exportMarkdown(data);
                markBackup();
              }}
            >
              <Icon name="book" size={15} /> Journal as Markdown
            </button>
            <button
              className="button button-secondary"
              onClick={() => {
                exportJson(data);
                markBackup();
              }}
            >
              <Icon name="download" size={15} /> All records as JSON
            </button>
            <button
              className="button button-primary"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                setError('');
                try {
                  await exportComplete(data, demo);
                  markBackup();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Backup failed. Please retry.');
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Icon name="download" size={17} />
              {exporting ? 'Packing images…' : 'Complete backup with images'}
            </button>
          </div>
          <p className="microcopy">
            Complete backups embed your images. The smaller records export contains image references only.
          </p>
        </section>
        <section className="panel">
          <SectionHeading title="Reminders" />
          <p className="section-description">
            Adds a morning and an evening alert to your calendar for the whole challenge. Save your times
            first, and open this on the device you want reminded.
          </p>
          <button className="button button-secondary" type="button" onClick={downloadReminders}>
            <Icon name="clock" size={17} /> Add reminders to calendar
          </button>
        </section>
        <section className="panel">
          <SectionHeading title="Restore a backup" />
          <p className="section-description">
            Replaces this journal with a JSON backup. You will be asked to confirm first.
          </p>
          <label className="button button-secondary restore-button">
            <Icon name="download" size={17} /> Choose backup file
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={event => {
                void restore(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>

        </section>
        {demo && (
          <section className="panel">
            <h3>This demo</h3>
            <p className="section-description">
              Sample content and your edits stay in this browser. This demo is not password-protected or
              backed up online. Use the private workspace for personal journaling.
            </p>
            <a className="button button-secondary" href="/login">
              <Icon name="lock" size={16} /> Go to private sign-in
            </a>
            <button
              className="text-button danger-text"
              onClick={() => {
                if (
                  window.confirm(
                    'Reset the browser demo? This deletes all edits and images in this demo. Export first if you want to keep them.',
                  )
                ) {
                  localStorage.removeItem('journal26-demo-v1');
                  window.location.reload();
                }
              }}
            >
              Reset demo data
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
