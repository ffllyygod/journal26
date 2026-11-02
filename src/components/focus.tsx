'use client';

import { useEffect, useState } from 'react';
import { emptyDay, formatDate, hours } from '@/lib/domain';
import { elapsedMinutes, logSession, type FocusSession, type FocusTrack } from '@/lib/focus';
import type { FeatureProps } from '@/lib/types';
import { Field, Icon, Modal } from './ui';

const STORAGE_KEY = 'journal26-focus-v1';

export function forgetFocusSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function readSession(): FocusSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as FocusSession) : null;
  } catch {
    return null;
  }
}

/** Survives reloads and tab switches, because phones kill background tabs during real work. */
export function useFocusSession() {
  const [session, setSession] = useState<FocusSession | null>(readSession);
  return {
    session,
    start(next: Omit<FocusSession, 'startedAt'>) {
      const value = { ...next, startedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      setSession(value);
    },
    clear() {
      forgetFocusSession();
      setSession(null);
    },
  };
}

function clock(session: FocusSession, now: number) {
  const total = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  const h = Math.floor(total / 3600);
  return `${h ? `${h}:` : ''}${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

export function FocusLive({
  session,
  onStop,
  onDiscard,
}: {
  session: FocusSession;
  onStop: () => void;
  onDiscard: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="focus-live" role="timer" aria-label={`Focus timer: ${session.label}`}>
      <strong>{clock(session, now)}</strong>
      <span>{session.label}</span>
      <div className="inline">
        <button className="text-button" onClick={onDiscard}>
          Discard
        </button>
        <button className="button button-primary button-small" onClick={onStop}>
          <Icon name="stop" size={14} /> Stop and log
        </button>
      </div>
    </div>
  );
}

export function FocusPanel({
  data,
  update,
  date,
  today,
  focus,
}: Pick<FeatureProps, 'data' | 'update' | 'date'> & {
  today: string;
  focus: ReturnType<typeof useFocusSession>;
}) {
  const [stopping, setStopping] = useState(false);
  const [exact, setExact] = useState(false);
  const day = data.days[date] ?? emptyDay();
  const { session } = focus;
  const tracks: {
    track: FocusTrack;
    name: string;
    key: 'careerMinutes' | 'tradingMinutes';
    target: number;
  }[] = [
    { track: 'career', name: 'Career', key: 'careerMinutes', target: data.settings.careerTarget },
    { track: 'trading', name: 'Trading', key: 'tradingMinutes', target: data.settings.tradingTarget },
  ];
  const sessionTask = session?.taskId
    ? data.days[session.date]?.tasks.find(task => task.id === session.taskId)
    : undefined;

  return (
    <section className="panel focus-panel">
      <div className="section-heading">
        <h2>Focus</h2>
        <button className="text-button" onClick={() => setExact(true)}>
          Edit time
        </button>
      </div>
      {session && (
        <FocusLive
          session={session}
          onStop={() => setStopping(true)}
          onDiscard={() => {
            if (window.confirm('Discard this session without logging the time?')) focus.clear();
          }}
        />
      )}
      {tracks.map(item => (
        <div className="focus-item" key={item.track}>
          <div className="split">
            <span>
              <span className={`track-dot ${item.track}`} />
              {item.name}
            </span>
            <span>
              <strong>{hours(day[item.key])}</strong> <span className="muted">of {hours(item.target)}</span>
            </span>
          </div>
          <div className={`progress-track ${item.track}`}>
            <span style={{ width: `${Math.min(100, (day[item.key] / Math.max(1, item.target)) * 100)}%` }} />
          </div>
          {!session && date === today && (
            <button
              className="button button-secondary button-small button-full"
              onClick={() =>
                focus.start({ track: item.track, date, taskId: null, label: `${item.name} session` })
              }
            >
              <Icon name="play" size={13} /> Start {item.name.toLowerCase()} session
            </button>
          )}
        </div>
      ))}
      {stopping && session && (
        <Modal title="Log this session" onClose={() => setStopping(false)}>
          <form
            className="stack"
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const minutes = Number(form.get('minutes'));
              const finished = form.get('finished') === 'on';
              update(current => ({
                ...current,
                days: {
                  ...current.days,
                  [session.date]: logSession(
                    current.days[session.date] ?? emptyDay(),
                    session,
                    minutes,
                    finished,
                  ),
                },
              }));
              setStopping(false);
              focus.clear();
            }}
          >
            <p>{session.label}</p>
            <Field label="Minutes" hint="Left it running? Correct it here.">
              <input
                name="minutes"
                type="number"
                min="1"
                max="720"
                defaultValue={Math.min(720, elapsedMinutes(session))}
                required
              />
            </Field>
            {sessionTask && !sessionTask.done && (
              <label className="check-line">
                <input type="checkbox" name="finished" defaultChecked />
                <span>Task finished</span>
              </label>
            )}
            <div className="modal-actions">
              <button className="button button-primary">Log time</button>
            </div>
          </form>
        </Modal>
      )}
      {exact && (
        <Modal title="Edit focus time" onClose={() => setExact(false)}>
          <form
            className="stack"
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              update(current => ({
                ...current,
                days: {
                  ...current.days,
                  [date]: {
                    ...(current.days[date] ?? emptyDay()),
                    careerMinutes: Number(form.get('career')),
                    tradingMinutes: Number(form.get('trading')),
                  },
                },
              }));
              setExact(false);
            }}
          >
            <p className="muted">
              Total minutes for {formatDate(date, { month: 'short', day: 'numeric' })}. Finished tasks add
              their time automatically.
            </p>
            <Field label="Career minutes">
              <input
                name="career"
                type="number"
                min="0"
                max="1440"
                defaultValue={day.careerMinutes}
                required
              />
            </Field>
            <Field label="Trading minutes">
              <input
                name="trading"
                type="number"
                min="0"
                max="1440"
                defaultValue={day.tradingMinutes}
                required
              />
            </Field>
            <div className="modal-actions">
              <button className="button button-primary">Save time</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
