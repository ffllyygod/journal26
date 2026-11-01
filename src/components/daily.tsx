'use client';

import { useState, type FormEvent } from 'react';
import {
  applicationsThisWeek,
  bestStreak,
  dayGuardrails,
  dayLoop,
  daysSinceBackup,
  loopStreak,
  needsReview,
} from '@/lib/analytics';
import {
  addDays,
  currentDay,
  emptyDay,
  formatDate,
  habitCount,
  habitStreak,
  hours,
  money,
} from '@/lib/domain';
import type { DayEntry, FeatureProps, Task, Track, Trade, View } from '@/lib/types';
import { AttachmentGallery } from './attachments';
import { TradeEditor, upsertTrade } from './trades';
import { EmptyState, Field, Icon, Modal, SectionHeading } from './ui';

type DailyProps = FeatureProps & {
  onPlanTomorrow: () => void;
  onSelectDate: (date: string) => void;
  onNavigate: (view: View) => void;
};

const minutesKey = { career: 'careerMinutes', trading: 'tradingMinutes' } as const;

function DayLoop({ data, date, today }: { data: FeatureProps['data']; date: string; today: string }) {
  const steps = dayLoop(data, date);
  const done = steps.filter(step => step.done).length;
  const streak = loopStreak(data, today);
  const target = (id: string) => () =>
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return (
    <section className="day-loop" aria-label="Today's checklist">
      <div className="day-loop-head">
        <strong>{done === steps.length ? 'Day complete.' : `${done} of ${steps.length} done`}</strong>
        <span className="muted">
          {streak ? `${streak}-day full streak` : 'Finish all five to start a streak'}
        </span>
      </div>
      <div className="day-loop-steps">
        {steps.map(step => (
          <button
            key={step.id}
            className={`loop-step ${step.done ? 'loop-done' : ''}`}
            onClick={target(step.id)}
            title={step.done ? `${step.label}: done` : step.hint}
          >
            <span className="loop-mark">{step.done && <Icon name="check" size={13} />}</span>
            <span>{step.label}</span>
            <span className="sr-only">{step.done ? 'done' : step.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Nudges({
  data,
  today,
  date,
  onNavigate,
  onEditTrade,
}: {
  data: FeatureProps['data'];
  today: string;
  date: string;
  onNavigate: (view: View) => void;
  onEditTrade: (trade: Trade) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const open = data.trades.filter(trade => trade.status === 'open');
  const unreviewed = data.trades.filter(needsReview);
  const followUps = data.applications.filter(
    app => app.followUp && app.followUp <= today && app.status !== 'closed' && app.status !== 'offer',
  );
  const applied = applicationsThisWeek(data, today);
  const target = data.settings.weeklyApplicationTarget;
  const guard = dayGuardrails(data.trades, date, data.settings);
  const backup = daysSinceBackup(data.settings.lastBackupAt, today);
  const backupDue = Object.keys(data.days).length >= 3 && (backup === null || backup >= 7);
  const items: { key: string; text: string; action: string; run: () => void; urgent?: boolean }[] = [];
  if (guard.lossLimitHit)
    items.push({
      key: 'loss',
      urgent: true,
      text: `Daily loss limit reached (${money(guard.loss, data.settings.currency)}). No more live entries today.`,
      action: 'See trades',
      run: () => onNavigate('trades'),
    });
  else if (guard.tradeLimitHit)
    items.push({
      key: 'limit',
      urgent: true,
      text: `${guard.count} trades today: your limit is reached. Chart time is still study time.`,
      action: 'See trades',
      run: () => onNavigate('trades'),
    });
  if (open[0])
    items.push({
      key: 'open',
      text: `${open.length} open trade${open.length > 1 ? 's' : ''} still to close: ${open[0].symbol} from ${formatDate(open[0].date, { month: 'short', day: 'numeric' })}${open.length > 1 ? ' and more' : ''}.`,
      action: 'Update',
      run: () => onEditTrade(open[0]),
    });
  if (unreviewed[0])
    items.push({
      key: 'review',
      text: `${unreviewed.length} closed trade${unreviewed.length > 1 ? 's' : ''} without a review: ${unreviewed[0].symbol} from ${formatDate(unreviewed[0].date, { month: 'short', day: 'numeric' })}${unreviewed.length > 1 ? ' and more' : ''}.`,
      action: 'Review',
      run: () => onEditTrade(unreviewed[0]),
    });
  if (followUps.length)
    items.push({
      key: 'followups',
      text: `Follow up with ${followUps
        .map(app => app.company)
        .slice(0, 3)
        .join(', ')}${followUps.length > 3 ? ' and more' : ''}.`,
      action: 'Open career',
      run: () => onNavigate('career'),
    });
  if (target > 0 && applied < target)
    items.push({
      key: 'apps',
      text: `${applied} of ${target} applications sent this week.`,
      action: 'Add one',
      run: () => onNavigate('career'),
    });
  if (backupDue)
    items.push({
      key: 'backup',
      text:
        backup === null
          ? 'You have no backup yet. Download one to keep your journal safe.'
          : `Last backup was ${backup} days ago.`,
      action: 'Back up',
      run: () => onNavigate('settings'),
    });
  if (!items.length) return null;
  // Two at a time: a wall of reminders on open is how a journal gets abandoned.
  const shown = expanded ? items : items.slice(0, 2);
  return (
    <ul className="nudges" aria-label="Needs attention">
      {shown.map(item => (
        <li key={item.key} className={item.urgent ? 'nudge-urgent' : ''}>
          <span>{item.text}</span>
          <button className="text-button" onClick={item.run}>
            {item.action} <Icon name="arrow" size={14} />
          </button>
        </li>
      ))}
      {items.length > 2 && (
        <button
          className="text-button nudge-more"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `${items.length - 2} more`}
        </button>
      )}
    </ul>
  );
}

export function Daily({
  data,
  update,
  date,
  demo,
  userId,
  onPlanTomorrow,
  onSelectDate,
  onNavigate,
}: DailyProps) {
  const day = data.days[date] ?? emptyDay();
  const today = currentDay(data.settings);
  const future = date > today;
  const labels = data.settings.habitLabels;
  const [taskOpen, setTaskOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [moveDate, setMoveDate] = useState(addDays(date, 1));
  const [tradeEditor, setTradeEditor] = useState<{ trade: Trade | null } | null>(null);

  function patch(value: Partial<DayEntry>) {
    update(current => ({
      ...current,
      days: { ...current.days, [date]: { ...(current.days[date] ?? emptyDay()), ...value } },
    }));
  }
  /** Finishing a planned task credits its time, so the focus log stays accurate without extra typing. */
  function toggleTask(id: string) {
    update(current => {
      const entry = current.days[date] ?? emptyDay();
      const task = entry.tasks.find(t => t.id === id);
      if (!task) return current;
      const done = !task.done;
      const next: DayEntry = { ...entry, tasks: entry.tasks.map(t => (t.id === id ? { ...t, done } : t)) };
      if (task.track !== 'personal') {
        const key = minutesKey[task.track];
        next[key] = Math.max(0, entry[key] + (done ? task.minutes : -task.minutes));
      }
      return { ...current, days: { ...current.days, [date]: next } };
    });
  }
  function addFocus(key: 'careerMinutes' | 'tradingMinutes', minutes: number) {
    patch({ [key]: Math.min(1440, day[key] + minutes) });
  }
  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const task: Task = {
      id: editing?.id ?? crypto.randomUUID(),
      title: String(values.get('title')).trim(),
      track: String(values.get('track')) as Track,
      minutes: Number(values.get('minutes')),
      done: editing?.done ?? false,
    };
    if (!task.title) return;
    patch({ tasks: editing ? day.tasks.map(t => (t.id === editing.id ? task : t)) : [...day.tasks, task] });
    setTaskOpen(false);
    setEditing(null);
  }
  function moveTasks(from: string, to: string, ids: string[]) {
    update(current => {
      const source = current.days[from] ?? emptyDay();
      const destination = current.days[to] ?? emptyDay();
      const moving = source.tasks.filter(t => ids.includes(t.id));
      return {
        ...current,
        days: {
          ...current.days,
          [from]: { ...source, tasks: source.tasks.filter(t => !ids.includes(t.id)) },
          [to]: { ...destination, tasks: [...destination.tasks, ...moving] },
        },
      };
    });
  }

  const completed = day.tasks.filter(t => t.done).length;
  const planMinutes = day.tasks.reduce((sum, t) => sum + t.minutes, 0);
  const unfinished = day.tasks.filter(t => !t.done);
  const previous = addDays(date, -1);
  const previousUnfinished = (data.days[previous]?.tasks ?? []).filter(t => !t.done);
  const dayTrades = data.trades.filter(trade => trade.date === date);
  const daySlipped = day.smoking === 'slip' || day.abstinence === 'slip';

  return (
    <>
      {!future && <DayLoop data={data} date={date} today={today} />}
      {future && (
        <div className="planning-banner">
          <strong>
            Planning{' '}
            {date === addDays(today, 1) ? 'tomorrow' : formatDate(date, { month: 'short', day: 'numeric' })}.
          </strong>
          <span>Decide now, so you wake up to a plan and not a blank page.</span>
          <button className="text-button" onClick={() => onSelectDate(today)}>
            Back to today <Icon name="arrow" size={14} />
          </button>
        </div>
      )}
      {date === today && (
        <Nudges
          data={data}
          today={today}
          date={date}
          onNavigate={onNavigate}
          onEditTrade={trade => setTradeEditor({ trade })}
        />
      )}
      <div className="daily-grid">
        <div className="daily-main">
          <section className="intention-panel order-plan" id="section-plan">
            <div className="intention-top">
              <span className="eyebrow">
                {future ? 'A LITTLE INTENTION FOR TOMORROW' : 'A LITTLE INTENTION GOES A LONG WAY'}
              </span>
              <Icon name="sun" size={22} />
            </div>
            <h2>{future ? 'Give tomorrow a direction.' : 'Make room for what matters.'}</h2>
            <p>Three meaningful outcomes. Everything else is a bonus.</p>
            <div className="priorities">
              {day.priorities.map((priority, index) => (
                <label className="priority" key={index}>
                  <span>0{index + 1}</span>
                  <input
                    aria-label={`Priority ${index + 1}`}
                    value={priority}
                    placeholder={
                      [
                        'What would make this a good day?',
                        'One thing to move your learning forward',
                        'One promise to yourself',
                      ][index]
                    }
                    maxLength={160}
                    onChange={e =>
                      patch({ priorities: day.priorities.map((p, i) => (index === i ? e.target.value : p)) })
                    }
                  />
                </label>
              ))}
            </div>
          </section>
          <section className="panel task-panel order-tasks">
            <SectionHeading title="The day's plan">
              <span className="subtle-count">
                {completed} / {day.tasks.length} done
              </span>
            </SectionHeading>
            {future && previousUnfinished.length > 0 && (
              <button
                className="button button-secondary button-small carry-button"
                onClick={() =>
                  moveTasks(
                    previous,
                    date,
                    previousUnfinished.map(t => t.id),
                  )
                }
              >
                <Icon name="arrow" size={15} /> Bring over {previousUnfinished.length} unfinished from{' '}
                {date === addDays(today, 1)
                  ? 'today'
                  : formatDate(previous, { month: 'short', day: 'numeric' })}
              </button>
            )}
            {day.tasks.length ? (
              <div className="task-list">
                {day.tasks.map(task => (
                  <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}>
                    <button
                      type="button"
                      className="task-check"
                      aria-label={`${task.done ? 'Mark incomplete' : 'Complete'}: ${task.title}`}
                      aria-pressed={task.done}
                      disabled={future}
                      onClick={() => toggleTask(task.id)}
                    >
                      {task.done && <Icon name="check" size={14} />}
                    </button>
                    <button
                      className="task-content"
                      onClick={() => {
                        setEditing(task);
                        setTaskOpen(true);
                      }}
                    >
                      <span className="task-title">{task.title}</span>
                      <span className="task-meta">
                        <span className={`track-dot ${task.track}`} />
                        {task.track === 'career'
                          ? 'Career'
                          : task.track === 'trading'
                            ? 'Trading'
                            : 'Personal'}
                        <span>·</span>
                        {task.minutes} min
                      </span>
                    </button>
                    <button
                      className="icon-button task-move"
                      aria-label={`Reschedule: ${task.title}`}
                      title="Move to another day"
                      onClick={() => {
                        setMoveDate(addDays(date, 1));
                        setMoveTask(task);
                      }}
                    >
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small-empty">
                <p>A good day starts with a small plan.</p>
                <span>Add your first task. Keep it specific and achievable.</span>
              </div>
            )}
            <button
              className="add-task"
              onClick={() => {
                setEditing(null);
                setTaskOpen(true);
              }}
            >
              <Icon name="plus" size={17} /> Add a task{' '}
              <span>{planMinutes ? `${hours(planMinutes)} planned` : ''}</span>
            </button>
          </section>
          {!future && (
            <section className="panel order-trades" id="section-trades">
              <SectionHeading title="Trades this day">
                <button
                  className="button button-secondary button-small"
                  onClick={() => setTradeEditor({ trade: null })}
                >
                  <Icon name="plus" size={15} /> Log a trade
                </button>
              </SectionHeading>
              {dayTrades.length > 0 ? (
                <ul className="day-trades">
                  {dayTrades.map(trade => (
                    <li key={trade.id}>
                      <button className="day-trade" onClick={() => setTradeEditor({ trade })}>
                        <strong>{trade.symbol}</strong>
                        <span className="muted">
                          {trade.direction === 'long' ? 'Long' : 'Short'} · {trade.account}
                        </span>
                        <span
                          className={
                            trade.netPnl !== null && trade.netPnl < 0
                              ? 'negative day-trade-result'
                              : 'day-trade-result'
                          }
                        >
                          {trade.status === 'open'
                            ? 'Open'
                            : money(trade.netPnl ?? 0, data.settings.currency)}
                        </span>
                        {(trade.status === 'open' || needsReview(trade)) && (
                          <span className="chip chip-amber">
                            {trade.status === 'open' ? 'Close it' : 'Review it'}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="no-trade">
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={day.noTrade}
                      onChange={e => patch({ noTrade: e.target.checked })}
                    />
                    <span>No trade this day, by decision</span>
                  </label>
                  {day.noTrade && (
                    <input
                      aria-label="Why no trade"
                      value={day.noTradeReason}
                      onChange={e => patch({ noTradeReason: e.target.value })}
                      maxLength={300}
                      placeholder="Why? e.g. no setup, news day, focused on interviews"
                    />
                  )}
                </div>
              )}
            </section>
          )}
          <div className="order-journal" id="section-journal">
            <JournalEditor day={day} patch={patch} demo={demo} userId={userId} future={future} />
          </div>
        </div>
        <aside className="daily-aside">
          {!future && (
            <section className="panel habits-panel order-habits" id="section-checkin">
              <SectionHeading title="Keep your promises">
                <Icon name="leaf" size={19} />
              </SectionHeading>
              {(['smoking', 'abstinence'] as const).map(habit => (
                <div className="habit" key={habit}>
                  <div className="habit-heading">
                    <div className={`habit-symbol ${habit}`}>
                      <Icon name={habit === 'smoking' ? 'leaf' : 'flame'} size={19} />
                    </div>
                    <div>
                      <h3>{labels[habit]}</h3>
                      <span>
                        {habitStreak(data.days, habit, today)} day streak · best{' '}
                        {bestStreak(data.days, habit, today)} · {habitCount(data.days, habit, 'kept', today)}{' '}
                        kept
                      </span>
                    </div>
                  </div>
                  <div className="habit-options" role="group" aria-label={`${labels[habit]} check-in`}>
                    <button
                      className={day[habit] === 'kept' ? 'selected' : ''}
                      aria-pressed={day[habit] === 'kept'}
                      onClick={() => patch({ [habit]: day[habit] === 'kept' ? 'unset' : 'kept' })}
                    >
                      <Icon name="check" size={14} /> Kept it
                    </button>
                    <button
                      className={day[habit] === 'slip' ? 'selected-slip' : ''}
                      aria-pressed={day[habit] === 'slip'}
                      onClick={() => patch({ [habit]: day[habit] === 'slip' ? 'unset' : 'slip' })}
                    >
                      Had a slip
                    </button>
                  </div>
                </div>
              ))}
              <p className="microcopy">An honest check-in counts. Your history stays.</p>
              {daySlipped && (
                <Field label="What triggered it? What will help next time?">
                  <textarea
                    value={day.trigger}
                    onChange={e => patch({ trigger: e.target.value })}
                    rows={3}
                    placeholder="No judgment. Just something to learn from."
                    maxLength={2000}
                  />
                </Field>
              )}
            </section>
          )}
          {!future && (
            <section className="panel focus-panel order-focus">
              <SectionHeading title="Time well spent">
                <Icon name="clock" size={18} />
              </SectionHeading>
              {[
                {
                  key: 'careerMinutes' as const,
                  name: 'Build your career',
                  target: data.settings.careerTarget,
                  track: 'career',
                },
                {
                  key: 'tradingMinutes' as const,
                  name: 'Learn the markets',
                  target: data.settings.tradingTarget,
                  track: 'trading',
                },
              ].map(item => (
                <div className="focus-item" key={item.key}>
                  <div className="split">
                    <span>
                      <span className={`track-dot ${item.track}`} />
                      {item.name}
                    </span>
                    <strong>{hours(day[item.key])}</strong>
                  </div>
                  <div className={`progress-track ${item.track}`}>
                    <span
                      style={{ width: `${Math.min(100, (day[item.key] / Math.max(1, item.target)) * 100)}%` }}
                    />
                  </div>
                  <div className="split">
                    <small>of {hours(item.target)} daily intention</small>
                    <button
                      className="quick-add"
                      aria-label={`Add 30 minutes to ${item.name}`}
                      onClick={() => addFocus(item.key, 30)}
                    >
                      +30m
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="button button-secondary button-full button-small"
                onClick={() => setFocusOpen(true)}
              >
                Set exact time
              </button>
            </section>
          )}
          {!future && (
            <section className="tomorrow-note order-close" id="section-tomorrow">
              <span className="eyebrow">CLOSE THE DAY</span>
              <h3>Leave tomorrow a plan.</h3>
              {unfinished.length > 0 && (
                <button
                  className="button button-secondary button-small"
                  onClick={() =>
                    moveTasks(
                      date,
                      addDays(date, 1),
                      unfinished.map(t => t.id),
                    )
                  }
                >
                  Move {unfinished.length} unfinished to the next day
                </button>
              )}
              <button className="button button-primary button-small" onClick={onPlanTomorrow}>
                Plan tomorrow <Icon name="arrow" size={15} />
              </button>
            </section>
          )}
        </aside>
      </div>
      {taskOpen && (
        <Modal title={editing ? 'Edit your task' : 'One step forward'} onClose={() => setTaskOpen(false)}>
          <form onSubmit={saveTask} className="stack">
            <Field label="What will you do?">
              <input
                name="title"
                defaultValue={editing?.title}
                placeholder="e.g. Practice three array problems"
                required
                maxLength={200}
                autoFocus
              />
            </Field>
            <div className="form-grid">
              <Field label="Focus area">
                <select name="track" defaultValue={editing?.track ?? 'career'}>
                  <option value="career">Career</option>
                  <option value="trading">Trading</option>
                  <option value="personal">Personal</option>
                </select>
              </Field>
              <Field label="Estimated minutes">
                <input
                  name="minutes"
                  type="number"
                  min="5"
                  max="720"
                  step="5"
                  defaultValue={editing?.minutes ?? 30}
                  required
                />
              </Field>
            </div>
            <div className="modal-actions">
              {editing && (
                <button
                  type="button"
                  className="button button-danger"
                  onClick={() => {
                    if (window.confirm('Delete this task?')) {
                      patch({ tasks: day.tasks.filter(t => t.id !== editing.id) });
                      setTaskOpen(false);
                    }
                  }}
                >
                  Delete task
                </button>
              )}
              <button className="button button-primary" type="submit">
                {editing ? 'Save task' : 'Add to my day'}
                <Icon name="arrow" size={17} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {focusOpen && (
        <Modal title="Give your effort some credit" onClose={() => setFocusOpen(false)}>
          <form
            className="stack"
            onSubmit={e => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              patch({
                careerMinutes: Number(form.get('career')),
                tradingMinutes: Number(form.get('trading')),
              });
              setFocusOpen(false);
            }}
          >
            <p className="muted">
              Total focused minutes for {formatDate(date, { month: 'short', day: 'numeric' })}. Finished tasks
              add their time here automatically.
            </p>
            <Field label="Career · total minutes">
              <input
                name="career"
                type="number"
                min="0"
                max="1440"
                defaultValue={day.careerMinutes}
                required
              />
            </Field>
            <Field label="Trading study · total minutes">
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
              <button className="button button-primary">Save focus time</button>
            </div>
          </form>
        </Modal>
      )}
      {moveTask && (
        <Modal title="Make a little room" onClose={() => setMoveTask(null)}>
          <form
            className="stack"
            onSubmit={e => {
              e.preventDefault();
              if (moveDate !== date) moveTasks(date, moveDate, [moveTask.id]);
              setMoveTask(null);
            }}
          >
            <p>{moveTask.title}</p>
            <Field label="Move task to">
              <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} required />
            </Field>
            <div className="modal-actions">
              <button className="button button-primary">Move task</button>
            </div>
          </form>
        </Modal>
      )}
      {tradeEditor && (
        <TradeEditor
          key={tradeEditor.trade?.id ?? 'new'}
          trade={tradeEditor.trade}
          date={date}
          settings={data.settings}
          trades={data.trades}
          defaultAccount={tradeEditor.trade?.account ?? 'demo'}
          demo={demo}
          userId={userId}
          onSave={trade => {
            update(current => upsertTrade(current, trade));
            setTradeEditor(null);
          }}
          onClose={() => setTradeEditor(null)}
        />
      )}
    </>
  );
}

export function JournalEditor({
  day,
  patch,
  demo,
  userId,
  future = false,
}: {
  day: DayEntry;
  patch: (value: Partial<DayEntry>) => void;
  demo: boolean;
  userId?: string;
  future?: boolean;
}) {
  return (
    <section className="panel journal-panel">
      <SectionHeading title={future ? 'Notes for the day ahead' : 'A page for your thoughts'}>
        <span className="handwritten">just for you</span>
      </SectionHeading>
      <p className="section-description">
        {future
          ? 'What do you want to remember when you wake up?'
          : 'What happened? How did it feel? What do you want to remember?'}
      </p>
      <textarea
        className="journal-textarea"
        aria-label="Daily journal"
        value={day.journal}
        onChange={e => patch({ journal: e.target.value })}
        placeholder={future ? 'Tomorrow, I want to…' : 'Today, I…'}
        rows={5}
        maxLength={30000}
      />
      <AttachmentGallery
        attachments={day.attachments}
        onChange={attachments => patch({ attachments })}
        demo={demo}
        userId={userId}
      />
      {!future && (
        <>
          <div className="journal-reflections">
            <Field label="One small win">
              <input
                value={day.win}
                onChange={e => patch({ win: e.target.value })}
                placeholder="Something you’re giving yourself credit for"
                maxLength={500}
              />
            </Field>
            <Field label="One thing I learned">
              <input
                value={day.lesson}
                onChange={e => patch({ lesson: e.target.value })}
                placeholder="A thought to take into tomorrow"
                maxLength={500}
              />
            </Field>
          </div>
          <div className="mood-row">
            <span>How did today feel?</span>
            <div role="group" aria-label="Daily mood">
              {['Rough', 'Low', 'Okay', 'Good', 'Great'].map((label, i) => (
                <button
                  type="button"
                  key={label}
                  className={day.mood === i + 1 ? 'selected' : ''}
                  aria-label={`Mood: ${label}`}
                  aria-pressed={day.mood === i + 1}
                  onClick={() => patch({ mood: day.mood === i + 1 ? null : i + 1 })}
                >
                  <span aria-hidden="true">{['◡', '−', '·', '⌣', '✧'][i]}</span>
                  <small>{label}</small>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function Journal({
  data,
  update,
  date,
  demo,
  userId,
  onSelectDate,
}: FeatureProps & { onSelectDate: (date: string) => void }) {
  const [query, setQuery] = useState('');
  const day = data.days[date] ?? emptyDay();
  const today = currentDay(data.settings);
  const entries = Object.entries(data.days)
    .filter(
      ([, d]) =>
        (d.journal || d.win || d.lesson || d.attachments.length) &&
        `${d.journal} ${d.win} ${d.lesson}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort(([a], [b]) => b.localeCompare(a));
  return (
    <div className="journal-layout">
      <aside className="panel journal-index">
        <div className="search-field">
          <Icon name="search" size={17} />
          <input
            aria-label="Search journal"
            placeholder="Find a thought…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <p className="eyebrow">YOUR PAGES · {entries.length}</p>
        {entries.length ? (
          entries.map(([key, d]) => (
            <button
              className={`journal-index-item ${date === key ? 'active' : ''}`}
              key={key}
              onClick={() => onSelectDate(key)}
            >
              <strong>{formatDate(key, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
              <span>{d.journal || d.win || d.lesson || 'A day in pictures'}</span>
            </button>
          ))
        ) : (
          <p className="muted">{query ? 'No matching entries.' : 'Your story starts with a sentence.'}</p>
        )}
      </aside>
      <div>
        <JournalEditor
          day={day}
          patch={value =>
            update(current => ({
              ...current,
              days: { ...current.days, [date]: { ...(current.days[date] ?? emptyDay()), ...value } },
            }))
          }
          demo={demo}
          userId={userId}
          future={date > today}
        />
        {!entries.length && (
          <EmptyState title="A place to come back to">
            Write freely, attach a memory, or start with a single sentence. Every entry is connected to its
            day.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
