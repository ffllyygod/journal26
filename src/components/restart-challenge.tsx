'use client';

import { useState, type FormEvent } from 'react';
import { currentDay, addDays, formatDate } from '@/lib/domain';
import { exportJson } from '@/lib/export';
import { restartWorkspace } from '@/lib/restart';
import type { Workspace, UpdateWorkspace } from '@/lib/types';
import { forgetFocusSession } from './focus';
import { Field } from './ui';

export function RestartChallenge({
  data,
  update,
  canRestart,
}: {
  data: Workspace;
  update: UpdateWorkspace;
  canRestart: boolean;
}) {
  const [date, setDate] = useState(currentDay(data.settings));
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  function restart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRestart || confirmation !== 'RESTART') return;
    try {
      const fresh = restartWorkspace(data, date);
      exportJson(data);
      forgetFocusSession();
      update(() => fresh);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not restart. Your journal is unchanged.');
    }
  }
  return (
    <section className="panel">
      <h2>A fresh start</h2>
      <p className="section-description">
        Start a new challenge with your current preferences. Erases all daily entries, tasks, trades,
        applications, learning notes, weekly reflections and craving logs from this journal.
      </p>
      <details>
        <summary className="restart-disclosure">Restart this challenge</summary>
        <form className="stack" onSubmit={restart}>
          <p className="microcopy">
            A private JSON backup downloads before the reset. Image files stay in storage and are referenced
            in the backup. Close other journal tabs and reload the app on other devices first.
          </p>
          <Field label="New challenge starts">
            <input
              type="date"
              min="2020-01-01"
              max="2100-12-31"
              required
              value={date}
              onChange={event => setDate(event.target.value)}
            />
          </Field>
          {date && (
            <p className="microcopy">
              {data.settings.duration} days, through{' '}
              {formatDate(addDays(date, data.settings.duration - 1), {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              .
            </p>
          )}
          <Field label="Type RESTART to erase old records">
            <input
              autoComplete="off"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
            />
          </Field>
          {!canRestart && (
            <p role="status" className="microcopy">
              Wait for your changes to finish syncing before restarting.
            </p>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="button button-danger"
            disabled={!canRestart || confirmation !== 'RESTART' || !date}
          >
            Back up and restart
          </button>
        </form>
      </details>
    </section>
  );
}
