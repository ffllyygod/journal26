'use client';

import { useState, type FormEvent } from 'react';
import { addDays, formatDate } from '@/lib/domain';
import type { FeatureProps } from '@/lib/types';
import { Field } from './ui';

/** First run. Only what changes the daily screen; everything else keeps a default and lives in Settings. */
export function Setup({
  data,
  update,
  today,
}: {
  data: FeatureProps['data'];
  update: FeatureProps['update'];
  today: string;
}) {
  const { settings } = data;
  const [startDate, setStartDate] = useState(today);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    update(current => ({
      ...current,
      settings: {
        ...current.settings,
        configured: true,
        name: text('name'),
        startDate: text('startDate') || today,
        intention: text('intention') || current.settings.intention,
        urgePlan: text('urgePlan'),
        habitLabels: {
          smoking: text('habitOne') || current.settings.habitLabels.smoking,
          abstinence: text('habitTwo') || current.settings.habitLabels.abstinence,
        },
      },
    }));
  }
  return (
    <main className="setup-page">
      <form className="setup-card" onSubmit={submit}>
        <span className="brand">journal26</span>
        <h1>Set up your {settings.duration} days</h1>
        <p className="muted">
          Runs until{' '}
          {formatDate(addDays(startDate || today, settings.duration - 1), { month: 'long', day: 'numeric' })}.
          Only you can see this, and you can change all of it later in Settings.
        </p>
        <div className="form-grid">
          <Field label="Your name">
            <input name="name" defaultValue={settings.name} maxLength={40} autoFocus />
          </Field>
          <Field label="Start date">
            <input
              name="startDate"
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
              required
            />
          </Field>
          <Field label="First habit to quit">
            <input name="habitOne" defaultValue={settings.habitLabels.smoking} maxLength={30} required />
          </Field>
          <Field label="Second habit to quit">
            <input name="habitTwo" defaultValue={settings.habitLabels.abstinence} maxLength={30} required />
          </Field>
        </div>
        <Field label="Why are you doing this?" hint="You will see this when a craving hits.">
          <textarea
            className="own-words"
            name="intention"
            rows={2}
            maxLength={500}
            defaultValue={settings.intention}
          />
        </Field>
        <Field label="When a craving hits, I will…" hint="Write it now, while your head is clear.">
          <textarea
            className="own-words"
            name="urgePlan"
            rows={2}
            maxLength={500}
            defaultValue={settings.urgePlan}
            placeholder="Go outside, drink water, message someone"
          />
        </Field>
        <button className="button button-primary" type="submit">
          Start the challenge
        </button>
      </form>
    </main>
  );
}
