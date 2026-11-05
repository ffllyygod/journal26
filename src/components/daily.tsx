'use client';

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  applicationsThisWeek,
  bestStreak,
  dayGuardrails,
  dayLoop,
  daysSinceBackup,
  loopStreak,
  needsReview,
  type LoopStep,
} from '@/lib/analytics';
import {
  addDays,
  currentDay,
  emptyDay,
  formatDate,
  habitStreak,
  hours,
  money,
  weekStart,
} from '@/lib/domain';
import { findInsights } from '@/lib/insights';
import type { Attachment, DayEntry, FeatureProps, Task, Track, Trade, View } from '@/lib/types';
import { moveDayTasks, replaceDayTasks, toggleDayTask } from '@/lib/task-operations';
import { AttachmentGallery } from './attachments';
import { FocusPanel, useFocusSession } from './focus';
import { InsightItem } from './patterns';
import { JournalHistory } from './journal-history';
import { WritingPrompts } from './writing-prompts';
import { TradeEditor, upsertTrade } from './trades';
import { Field, Icon, Modal } from './ui';

type DailyProps = FeatureProps & {
  onPlanTomorrow: () => void;
  onSelectDate: (date: string) => void;
  onNavigate: (view: View) => void;
};
type StepId = LoopStep['id'];

/** Tasks stay open while there are tasks to do; otherwise the sheet opens on whatever is next. */
function initialOpen(steps: LoopStep[], day: DayEntry): Set<StepId> {
  const open = new Set<StepId>();
  if (!steps[0].done || day.tasks.some(task => !task.done)) open.add('plan');
  const next = steps.find(step => step.id !== 'plan' && !step.done);
  if (next) open.add(next.id);
  return open;
}

function Step({
  step,
  summary,
  open,
  onToggle,
  children,
}: {
  step: LoopStep;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`sheet-step ${open ? 'sheet-open' : ''}`} id={`section-${step.id}`}>
      <h2>
        <button
          className={`loop-step ${step.done ? 'loop-done' : ''}`}
          aria-expanded={open}
          onClick={onToggle}
        >
          <span className="loop-mark">{step.done && <Icon name="check" size={13} />}</span>
          <span className="loop-label">{step.label}</span>
          <span className="loop-summary">{summary}</span>
          <Icon name="chevron" size={14} className="loop-chevron" />
        </button>
      </h2>
      {open && <div className="sheet-body">{children}</div>}
    </section>
  );
}

function Waiting({
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
  const short = (value: string) => formatDate(value, { month: 'short', day: 'numeric' });
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
      text: `${guard.count} trades today. That is your limit.`,
      action: 'See trades',
      run: () => onNavigate('trades'),
    });
  if (unreviewed[0])
    items.push({
      key: 'review',
      text: `Review ${unreviewed[0].symbol} from ${short(unreviewed[0].date)}${unreviewed.length > 1 ? ` and ${unreviewed.length - 1} more` : ''}`,
      action: 'Review',
      run: () => onEditTrade(unreviewed[0]),
    });
  if (open[0])
    items.push({
      key: 'open',
      text: `${open.length} open position${open.length > 1 ? 's' : ''}: ${open[0].symbol} from ${short(open[0].date)}`,
      action: 'Update',
      run: () => onEditTrade(open[0]),
    });
  if (followUps.length)
    items.push({
      key: 'followups',
      text: `Follow up with ${followUps
        .map(app => app.company)
        .slice(0, 3)
        .join(', ')}${followUps.length > 3 ? ' and more' : ''}`,
      action: 'Open',
      run: () => onNavigate('career'),
    });
  if (target > 0 && applied < target)
    items.push({
      key: 'apps',
      text: `${applied} of ${target} applications sent this week`,
      action: 'Add',
      run: () => onNavigate('career'),
    });
  if (backupDue)
    items.push({
      key: 'backup',
      text: backup === null ? 'No backup yet' : `Last backup was ${backup} days ago`,
      action: 'Back up',
      run: () => onNavigate('settings'),
    });
  if (!items.length) return null;
  // Three at a time: a wall of reminders on open is how a journal gets abandoned.
  const shown = expanded ? items : items.slice(0, 3);
  return (
    <section className="panel waiting">
      <h2>When you have a moment</h2>
      <ul className="nudges">
        {shown.map(item => (
          <li key={item.key} className={item.urgent ? 'nudge-urgent' : ''}>
            <span>{item.text}</span>
            <button className="text-button" onClick={item.run}>
              {item.action}
            </button>
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button className="text-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? 'Show less' : `${items.length - 3} more`}
        </button>
      )}
    </section>
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
  const steps = dayLoop(data, date);
  const [openSteps, setOpenSteps] = useState(() => initialOpen(steps, day));
  const [editing, setEditing] = useState<Task | null>(null);
  const [newTrack, setNewTrack] = useState<Track>('career');
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [moveDate, setMoveDate] = useState(addDays(date, 1));
  const [tradeEditor, setTradeEditor] = useState<{ trade: Trade | null } | null>(null);
  const focus = useFocusSession(data.resetId);

  function toggleStep(id: StepId) {
    setOpenSteps(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function patch(value: Partial<DayEntry>) {
    update(current => ({
      ...current,
      days: { ...current.days, [date]: { ...(current.days[date] ?? emptyDay()), ...value } },
    }));
  }
  function changeTasks(change: (entry: DayEntry) => Task[]) {
    update(current => {
      const entry = current.days[date] ?? emptyDay();
      return { ...current, days: { ...current.days, [date]: replaceDayTasks(entry, change(entry)) } };
    });
  }
  /** Finishing a planned task credits its time, so the focus log stays accurate without extra typing. */
  function toggleTask(id: string) {
    update(current => ({
      ...current,
      days: { ...current.days, [date]: toggleDayTask(current.days[date] ?? emptyDay(), id) },
    }));
  }
  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get('title')).trim();
    if (!title) return;
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      track: newTrack,
      minutes: Number(values.get('minutes')) || 30,
      done: false,
    };
    changeTasks(entry => [...entry.tasks, task]);
    form.reset();
    form.querySelector<HTMLInputElement>('input[name=title]')?.focus();
  }
  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const values = new FormData(event.currentTarget);
    const title = String(values.get('title')).trim();
    if (!title) return;
    const task: Task = {
      ...editing,
      title,
      track: String(values.get('track')) as Track,
      minutes: Number(values.get('minutes')),
    };
    changeTasks(entry => entry.tasks.map(t => (t.id === task.id ? task : t)));
    setEditing(null);
  }
  function moveTasks(from: string, to: string, ids: string[]) {
    update(current => moveDayTasks(current, from, to, ids));
  }

  const completed = day.tasks.filter(t => t.done).length;
  const planMinutes = day.tasks.reduce((sum, t) => sum + t.minutes, 0);
  const unfinished = day.tasks.filter(t => !t.done);
  const previous = addDays(date, -1);
  const previousUnfinished = (data.days[previous]?.tasks ?? []).filter(t => !t.done);
  const dayTrades = data.trades.filter(trade => trade.date === date);
  const daySlipped = day.smoking === 'slip' || day.abstinence === 'slip';
  const priorityCount = day.priorities.filter(p => p.trim()).length;
  const tomorrow = data.days[addDays(date, 1)];
  const done = steps.filter(step => step.done).length;
  const streak = loopStreak(data, today);
  const commitment = data.weeklyCommitments[weekStart(date)];
  const topInsight = findInsights(data, today)[0];

  const planBody = (
    <>
      <div className="priorities">
        {day.priorities.map((priority, index) => (
          <input
            key={index}
            className="own-words priority"
            aria-label={`Priority ${index + 1}`}
            value={priority}
            placeholder={index === 0 ? 'What would you like to make room for?' : 'Anything else?'}
            maxLength={160}
            onChange={e =>
              patch({ priorities: day.priorities.map((p, i) => (index === i ? e.target.value : p)) })
            }
          />
        ))}
      </div>
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
          Bring over {previousUnfinished.length} unfinished from{' '}
          {date === addDays(today, 1) ? 'today' : formatDate(previous, { month: 'short', day: 'numeric' })}
        </button>
      )}
      {day.tasks.length > 0 && (
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
              <button className="task-content" onClick={() => setEditing(task)}>
                <span className="task-title">{task.title}</span>
                <span className="task-meta">
                  <span className={`track-dot ${task.track}`} />
                  {hours(task.minutes)}
                </span>
              </button>
              {!task.done && date === today && !focus.session && task.track !== 'personal' && (
                <button
                  className="icon-button"
                  aria-label={`Start timer: ${task.title}`}
                  title="Start timer"
                  onClick={() =>
                    focus.start({
                      track: task.track as 'career' | 'trading',
                      date,
                      taskId: task.id,
                      label: task.title,
                    })
                  }
                >
                  <Icon name="play" size={15} />
                </button>
              )}
              <button
                className="icon-button task-move"
                aria-label={`Reschedule: ${task.title}`}
                title="Move to another day"
                onClick={() => {
                  setMoveDate(addDays(date, 1));
                  setMoveTask(task);
                }}
              >
                <Icon name="arrow" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <form className="quick-task" onSubmit={addTask}>
        <input name="title" aria-label="New task" placeholder="Add a task" maxLength={200} />
        <select
          aria-label="New task area"
          value={newTrack}
          onChange={e => setNewTrack(e.target.value as Track)}
        >
          <option value="career">Career</option>
          <option value="trading">Trading</option>
          <option value="personal">Personal</option>
        </select>
        <input
          name="minutes"
          type="number"
          aria-label="New task minutes"
          min="5"
          max="720"
          step="5"
          defaultValue={30}
        />
        <button className="button button-secondary" aria-label="Add task">
          <Icon name="plus" size={15} />
        </button>
      </form>
      {planMinutes > 0 && (
        <p className="microcopy">
          {hours(planMinutes)} planned. The dot shows the area: <span className="track-dot career" />
          career, <span className="track-dot trading" />
          trading, <span className="track-dot personal" />
          personal.
        </p>
      )}
    </>
  );

  const journal = (
    <JournalEditor
      key={date}
      date={date}
      day={day}
      patch={patch}
      onAddAttachment={attachment =>
        update(current => {
          const entry = current.days[date] ?? emptyDay();
          return {
            ...current,
            days: {
              ...current.days,
              [date]: { ...entry, attachments: [...entry.attachments, attachment] },
            },
          };
        })
      }
      demo={demo}
      userId={userId}
      future={future}
    />
  );

  const summaries: Record<StepId, string> = {
    plan: day.tasks.length
      ? `${completed} of ${day.tasks.length} tasks`
      : priorityCount
        ? `${priorityCount} ${priorityCount === 1 ? 'priority' : 'priorities'}`
        : 'Set priorities or tasks',
    checkin: daySlipped
      ? 'Slip logged'
      : day.smoking === 'kept' && day.abstinence === 'kept'
        ? 'Both kept'
        : 'Log both habits',
    trades: dayTrades.length
      ? `${dayTrades.length} logged${dayTrades.some(t => t.status === 'open') ? ', position open' : ''}`
      : day.noTrade
        ? 'Skipped by decision'
        : 'Log one or skip the day',
    journal: day.journal.trim() ? day.journal.trim().slice(0, 48) : day.win.trim() || 'Write a line',
    tomorrow:
      tomorrow && (tomorrow.tasks.length || tomorrow.priorities.some(p => p.trim()))
        ? tomorrow.tasks.length
          ? `${tomorrow.tasks.length} tasks ready`
          : 'Priorities set'
        : 'No plan yet',
  };

  const weekRule = commitment && (
    <p className="week-rule">
      <span>This week’s one change</span>
      <span className="own-words">{commitment}</span>
    </p>
  );

  if (future)
    return (
      <div className="future-sheet">
        <div className="planning-banner">
          <strong>
            Planning{' '}
            {date === addDays(today, 1) ? 'tomorrow' : formatDate(date, { month: 'short', day: 'numeric' })}
          </strong>
          <button className="text-button" onClick={() => onSelectDate(today)}>
            Back to today
          </button>
        </div>
        {weekRule}
        <section className="panel">{planBody}</section>
        <div id="section-journal">{journal}</div>
        {moveTask && renderMove()}
        {editing && renderEdit()}
      </div>
    );

  return (
    <>
      <div className="daily-grid">
        <section className="day-loop" aria-label="Today's steps">
          <div className="day-loop-head">
            <strong aria-live="polite">
              {done === steps.length ? 'Day complete. Room to rest.' : `${done} of ${steps.length} done`}
            </strong>
            <span className="muted">
              {date === today && streak ? `${streak} day streak` : formatDate(date, { weekday: 'long' })}
            </span>
          </div>
          {weekRule}
          <Step
            step={steps[0]}
            summary={summaries.plan}
            open={openSteps.has('plan')}
            onToggle={() => toggleStep('plan')}
          >
            {planBody}
          </Step>
          <Step
            step={steps[1]}
            summary={summaries.checkin}
            open={openSteps.has('checkin')}
            onToggle={() => toggleStep('checkin')}
          >
            {(['smoking', 'abstinence'] as const).map(habit => (
              <div className="habit" key={habit}>
                <div className="habit-heading">
                  <h3>{labels[habit]}</h3>
                  <span className="muted">
                    {habitStreak(data.days, habit, today)} day streak, best{' '}
                    {bestStreak(data.days, habit, today)}
                  </span>
                </div>
                <div className="habit-options" role="group" aria-label={`${labels[habit]} check-in`}>
                  <button
                    className={day[habit] === 'kept' ? 'selected' : ''}
                    aria-pressed={day[habit] === 'kept'}
                    onClick={() => patch({ [habit]: day[habit] === 'kept' ? 'unset' : 'kept' })}
                  >
                    Kept it
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
            {daySlipped && (
              <Field label="What triggered it? What will help next time?">
                <textarea
                  className="own-words"
                  value={day.trigger}
                  onChange={e => patch({ trigger: e.target.value })}
                  rows={3}
                  maxLength={2000}
                />
              </Field>
            )}
          </Step>
          <Step
            step={steps[2]}
            summary={summaries.trades}
            open={openSteps.has('trades')}
            onToggle={() => toggleStep('trades')}
          >
            {dayTrades.length > 0 ? (
              <ul className="day-trades">
                {dayTrades.map(trade => {
                  const undocumented =
                    trade.status === 'open' && (!trade.thesis.trim() || trade.followedPlan === 'unset');
                  return (
                    <li key={trade.id}>
                      <button className="day-trade" onClick={() => setTradeEditor({ trade })}>
                        <strong>{trade.symbol}</strong>
                        <span className="muted">
                          {trade.direction === 'long' ? 'Long' : 'Short'}, {trade.account}
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
                        {(undocumented || needsReview(trade)) && (
                          <span className="chip chip-amber">
                            {undocumented ? 'Document it' : 'Review it'}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
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
                    placeholder="Why? No setup, news day, interviews"
                  />
                )}
              </div>
            )}
            <button
              className="button button-secondary button-small"
              onClick={() => setTradeEditor({ trade: null })}
            >
              <Icon name="plus" size={14} /> Log a trade
            </button>
          </Step>
          <Step
            step={steps[3]}
            summary={summaries.journal}
            open={openSteps.has('journal')}
            onToggle={() => toggleStep('journal')}
          >
            {journal}
          </Step>
          <Step
            step={steps[4]}
            summary={summaries.tomorrow}
            open={openSteps.has('tomorrow')}
            onToggle={() => toggleStep('tomorrow')}
          >
            <div className="inline tomorrow-actions">
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
                Plan tomorrow
              </button>
            </div>
          </Step>
        </section>
        <aside className="daily-aside">
          <FocusPanel data={data} update={update} date={date} today={today} focus={focus} />
          {date === today && topInsight && (
            <section className="panel">
              <h2>Worth noticing</h2>
              <ul className="insight-list">
                <InsightItem insight={topInsight} />
              </ul>
              <button className="text-button" onClick={() => onNavigate('review')}>
                All patterns
              </button>
            </section>
          )}
          {date === today && (
            <Waiting
              data={data}
              today={today}
              date={date}
              onNavigate={onNavigate}
              onEditTrade={trade => setTradeEditor({ trade })}
            />
          )}
        </aside>
      </div>
      {editing && renderEdit()}
      {moveTask && renderMove()}
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

  function renderEdit() {
    if (!editing) return null;
    return (
      <Modal title="Edit task" onClose={() => setEditing(null)}>
        <form onSubmit={saveTask} className="stack">
          <Field label="Task">
            <input name="title" defaultValue={editing.title} required maxLength={200} autoFocus />
          </Field>
          <div className="form-grid">
            <Field label="Area">
              <select name="track" defaultValue={editing.track}>
                <option value="career">Career</option>
                <option value="trading">Trading</option>
                <option value="personal">Personal</option>
              </select>
            </Field>
            <Field label="Minutes">
              <input
                name="minutes"
                type="number"
                min="5"
                max="720"
                step="5"
                defaultValue={editing.minutes}
                required
              />
            </Field>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button button-danger"
              onClick={() => {
                if (window.confirm('Delete this task?')) {
                  changeTasks(entry => entry.tasks.filter(t => t.id !== editing.id));
                  setEditing(null);
                }
              }}
            >
              Delete task
            </button>
            <button className="button button-primary" type="submit">
              Save task
            </button>
          </div>
        </form>
      </Modal>
    );
  }
  function renderMove() {
    if (!moveTask) return null;
    return (
      <Modal title="Move task" onClose={() => setMoveTask(null)}>
        <form
          className="stack"
          onSubmit={e => {
            e.preventDefault();
            if (moveDate !== date) moveTasks(date, moveDate, [moveTask.id]);
            setMoveTask(null);
          }}
        >
          <p>{moveTask.title}</p>
          <Field label="Move to">
            <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} required />
          </Field>
          <div className="modal-actions">
            <button className="button button-primary">Move task</button>
          </div>
        </form>
      </Modal>
    );
  }
}

export function JournalEditor({
  date,
  day,
  patch,
  onAddAttachment,
  demo,
  userId,
  future = false,
  autoFocus = false,
}: {
  date: string;
  day: DayEntry;
  patch: (value: Partial<DayEntry>) => void;
  onAddAttachment: (attachment: Attachment) => void;
  demo: boolean;
  userId?: string;
  future?: boolean;
  autoFocus?: boolean;
}) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const promptId = useId();
  const hasReflection = !!(day.journal.trim() || day.win.trim() || day.lesson.trim());
  return (
    <div className="journal-panel">
      {!future && (
        <WritingPrompts date={date} onChoose={() => editor.current?.focus()} descriptionId={promptId} />
      )}
      <textarea
        ref={editor}
        autoFocus={autoFocus}
        className="journal-textarea own-words"
        aria-label="Daily journal"
        aria-describedby={future ? undefined : promptId}
        value={day.journal}
        onChange={e => patch({ journal: e.target.value })}
        placeholder={future ? 'Notes for when you wake up' : 'Start anywhere. A sentence is enough…'}
        rows={5}
        maxLength={30000}
      />
      {!future && (
        <p className={`writing-feedback ${hasReflection ? 'reflection-written' : ''}`} role="status">
          {hasReflection ? (
            <>
              <Icon name="check" size={15} /> A reflection for this day. That counts.
            </>
          ) : (
            'No minimum length. No perfect words.'
          )}
        </p>
      )}
      <AttachmentGallery
        attachments={day.attachments}
        onChange={attachments => patch({ attachments })}
        onAdd={onAddAttachment}
        demo={demo}
        userId={userId}
      />
      {!future && (
        <>
          <div className="journal-reflections">
            <Field label="One win">
              <input
                className="own-words"
                value={day.win}
                onChange={e => patch({ win: e.target.value })}
                maxLength={500}
              />
            </Field>
            <Field label="One lesson">
              <input
                className="own-words"
                value={day.lesson}
                onChange={e => patch({ lesson: e.target.value })}
                maxLength={500}
              />
            </Field>
          </div>
          <div className="mood-row">
            <span>How did the day feel?</span>
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
                  <span className="mood-face" aria-hidden="true">
                    {['☁', '☂', '◒', '☀', '✺'][i]}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Journal({
  data,
  update,
  date,
  demo,
  userId,
  onSelectDate,
  autoFocus = false,
}: FeatureProps & { onSelectDate: (date: string) => void; autoFocus?: boolean }) {
  const day = data.days[date] ?? emptyDay();
  const today = currentDay(data.settings);
  return (
    <div className="journal-layout">
      <JournalHistory data={data} date={date} onSelectDate={onSelectDate} />
      <section className="panel">
        <h2>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
        <JournalEditor
          key={date}
          date={date}
          autoFocus={autoFocus}
          day={day}
          onAddAttachment={attachment =>
            update(current => {
              const entry = current.days[date] ?? emptyDay();
              return {
                ...current,
                days: {
                  ...current.days,
                  [date]: { ...entry, attachments: [...entry.attachments, attachment] },
                },
              };
            })
          }
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
      </section>
    </div>
  );
}
