'use client';

import { useEffect, useState } from 'react';
import { emptyDay, URGE_TRIGGERS } from '@/lib/domain';
import type { HabitKey, UpdateWorkspace, Urge, Workspace } from '@/lib/types';
import { Icon, Modal } from './ui';

const SECONDS = 5 * 60;
const STEPS = [
  'Drink a full glass of water',
  'Stand up and leave the room',
  'Walk until the timer ends',
  'Message someone, or open the next task',
];

/**
 * One tap from anywhere, because a craving will not wait for you to find the right page.
 * Delay, distract, then record what happened: the log is what makes triggers visible in the
 * weekly review.
 */
export function UrgeButton({
  data,
  update,
  today,
}: {
  data: Workspace;
  update: UpdateWorkspace;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="urge-fab" onClick={() => setOpen(true)}>
        <Icon name="flame" size={18} /> <span>Craving</span>
      </button>
      {open && <UrgeModal data={data} update={update} today={today} onClose={() => setOpen(false)} />}
    </>
  );
}

function UrgeModal({
  data,
  update,
  today,
  onClose,
}: {
  data: Workspace;
  update: UpdateWorkspace;
  today: string;
  onClose: () => void;
}) {
  const [habit, setHabit] = useState<HabitKey>('smoking');
  const [intensity, setIntensity] = useState(3);
  const [trigger, setTrigger] = useState('');
  const [note, setNote] = useState('');
  const [endsAt] = useState(() => Date.now() + SECONDS * 1000);
  const [remaining, setRemaining] = useState(SECONDS);
  const labels = data.settings.habitLabels;

  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, Math.round((endsAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  function finish(outcome: Urge['outcome']) {
    const urge: Urge = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      date: today,
      habit,
      intensity,
      trigger,
      note: note.trim(),
      outcome,
    };
    update(current => {
      const next = { ...current, urges: [urge, ...current.urges] };
      if (outcome !== 'slipped') return next;
      const day = current.days[today] ?? emptyDay();
      const reflection = [trigger, note.trim()].filter(Boolean).join(': ');
      return {
        ...next,
        days: { ...current.days, [today]: { ...day, [habit]: 'slip', trigger: day.trigger || reflection } },
      };
    });
    onClose();
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');
  return (
    <Modal title="Give it five minutes" onClose={onClose}>
      <div className="stack urge-modal">
        <div
          className="urge-timer"
          role="timer"
          aria-label={`${minutes} minutes ${seconds} seconds remaining`}
        >
          <strong>
            {minutes}:{seconds}
          </strong>
          <span>
            {remaining
              ? 'Cravings rise and fall. You only need to outlast this one.'
              : 'Time. How do you feel now?'}
          </span>
        </div>
        {data.settings.urgePlan && (
          <p className="urge-plan">
            <strong>Your plan:</strong> {data.settings.urgePlan}
          </p>
        )}
        <p className="urge-why">&ldquo;{data.settings.intention}&rdquo;</p>
        <ol className="urge-steps">
          {STEPS.map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="segmented" role="group" aria-label="Which habit">
          {(['smoking', 'abstinence'] as const).map(key => (
            <button
              key={key}
              type="button"
              className={habit === key ? 'active' : ''}
              aria-pressed={habit === key}
              onClick={() => setHabit(key)}
            >
              {labels[key]}
            </button>
          ))}
        </div>
        <div>
          <span className="eyebrow">WHAT SET IT OFF?</span>
          <div className="tag-row">
            {URGE_TRIGGERS.map(item => (
              <button
                key={item}
                type="button"
                className={`tag ${trigger === item ? 'tag-on' : ''}`}
                aria-pressed={trigger === item}
                onClick={() => setTrigger(trigger === item ? '' : item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Strength: {intensity} of 5</span>
          <input
            type="range"
            min="1"
            max="5"
            value={intensity}
            onChange={e => setIntensity(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Anything to note? (optional)</span>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={500}
            placeholder="Where were you, what were you doing?"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={() => finish('slipped')}>
            I slipped
          </button>
          <button type="button" className="button button-primary" onClick={() => finish('resisted')}>
            It passed <Icon name="check" size={17} />
          </button>
        </div>
        <p className="microcopy">
          A slip is logged as a slip and your history stays. Then you start the next hour.
        </p>
      </div>
    </Modal>
  );
}
