'use client';

import {
  applicationsThisWeek,
  bestStreak,
  breakdown,
  dayLoop,
  tradeAnalytics,
  urgeStats,
} from '@/lib/analytics';
import type { FeatureProps, Trade } from '@/lib/types';
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
import { Field, Icon, SectionHeading } from './ui';

export function Review({ data, update, date }: FeatureProps) {
  const start = weekStart(date);
  const end = addDays(start, 6);
  const today = currentDay(data.settings);
  const days = Array.from({ length: 7 }, (_, index) => {
    const key = addDays(start, index);
    return { key, entry: data.days[key] ?? emptyDay(), recorded: !!data.days[key], future: key > today };
  });
  const elapsed = days.filter(day => !day.future);
  const careerMinutes = elapsed.reduce((sum, day) => sum + day.entry.careerMinutes, 0);
  const tradingMinutes = elapsed.reduce((sum, day) => sum + day.entry.tradingMinutes, 0);
  const totalTasks = days.reduce((sum, day) => sum + day.entry.tasks.length, 0);
  const doneTasks = elapsed.reduce((sum, day) => sum + day.entry.tasks.filter(task => task.done).length, 0);
  const journalDays = elapsed.filter(
    day => !!day.entry.journal.trim() || !!day.entry.win.trim() || !!day.entry.lesson.trim(),
  ).length;
  const applied = data.applications.filter(
    app => app.appliedOn >= start && app.appliedOn <= end && app.appliedOn <= today,
  );
  const maxMinutes = Math.max(
    data.settings.careerTarget,
    data.settings.tradingTarget,
    ...elapsed.flatMap(day => [day.entry.careerMinutes, day.entry.tradingMinutes]),
    60,
  );
  const habits = [
    { key: 'smoking' as const, label: data.settings.habitLabels.smoking, icon: 'leaf' as const },
    { key: 'abstinence' as const, label: data.settings.habitLabels.abstinence, icon: 'flame' as const },
  ];
  const weekTrades = data.trades.filter(trade => trade.date >= start && trade.date <= end);
  const urges = urgeStats(data.urges, start, end);
  const completeDays = elapsed.filter(day => dayLoop(data, day.key).every(step => step.done)).length;
  const challengeDays = Array.from({ length: data.settings.duration }, (_, index) =>
    addDays(data.settings.startDate, index),
  );

  return (
    <div className="stack">
      <SectionHeading eyebrow="PAUSE. NOTICE. ADJUST." title="Your weekly reflection"></SectionHeading>
      <p className="muted">
        {formatDate(start, { month: 'long', day: 'numeric' })} –{' '}
        {formatDate(end, { month: 'long', day: 'numeric', year: 'numeric' })}. Look for something to repeat
        and one thing to change.
      </p>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="eyebrow">FOCUSED WORK</span>
          <strong>{hours(careerMinutes + tradingMinutes)}</strong>
          <small>
            {hours(careerMinutes)} career · {hours(tradingMinutes)} trading
          </small>
        </div>
        <div className="stat-card">
          <span className="eyebrow">TASKS COMPLETED</span>
          <strong>
            {doneTasks}
            <span className="stat-denominator"> / {totalTasks}</span>
          </strong>
          <small>Across the plans you made this week</small>
        </div>
        <div className="stat-card">
          <span className="eyebrow">DAYS REFLECTED</span>
          <strong>
            {journalDays}
            <span className="stat-denominator"> / {elapsed.length}</span>
          </strong>
          <small>
            {applied.length} job application{applied.length === 1 ? '' : 's'} sent this week
          </small>
        </div>
      </div>
      <section className="panel">
        <SectionHeading title="Where your time went">
          <div className="inline chart-legend">
            <span>
              <i className="legend-dot career-dot" />
              Career
            </span>
            <span>
              <i className="legend-dot trading-dot" />
              Trading
            </span>
          </div>
        </SectionHeading>
        <div
          className="weekly-chart"
          role="img"
          aria-label={`Weekly focused work: career ${hours(careerMinutes)}, trading ${hours(tradingMinutes)}. Daily totals listed below.`}
        >
          {days.map(day => (
            <div key={day.key} className={`chart-day ${day.future ? 'chart-day-future' : ''}`}>
              <div className="chart-bars" aria-hidden="true">
                <div
                  className="chart-bar career-bar"
                  style={{ height: `${day.future ? 0 : (day.entry.careerMinutes / maxMinutes) * 100}%` }}
                />
                <div
                  className="chart-bar trading-bar"
                  style={{ height: `${day.future ? 0 : (day.entry.tradingMinutes / maxMinutes) * 100}%` }}
                />
              </div>
              <span>{formatDate(day.key, { weekday: 'short' })}</span>
              <small>
                {day.future
                  ? 'Upcoming'
                  : day.entry.careerMinutes + day.entry.tradingMinutes
                    ? hours(day.entry.careerMinutes + day.entry.tradingMinutes)
                    : 'No time logged'}
              </small>
            </div>
          ))}
        </div>
        <details className="details">
          <summary>Daily breakdown</summary>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Career</th>
                  <th>Trading</th>
                  <th>Tasks done</th>
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day.key}>
                    <td>{formatDate(day.key, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    <td>{day.future ? '—' : hours(day.entry.careerMinutes)}</td>
                    <td>{day.future ? '—' : hours(day.entry.tradingMinutes)}</td>
                    <td>
                      {day.future ? '—' : day.entry.tasks.filter(task => task.done).length} /{' '}
                      {day.entry.tasks.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section className="panel">
        <SectionHeading title="Keep showing up">
          <span className="muted">Unlogged days stay unknown.</span>
        </SectionHeading>
        <div className="habit-review-grid">
          {habits.map(habit => {
            const logged = elapsed.filter(day => day.entry[habit.key] !== 'unset');
            const kept = logged.filter(day => day.entry[habit.key] === 'kept').length;
            return (
              <div className="habit-review" key={habit.key}>
                <div className="split">
                  <span className="inline">
                    <Icon name={habit.icon} size={19} />
                    <strong>{habit.label}</strong>
                  </span>
                  <span className="muted">
                    {kept} kept / {logged.length} logged
                  </span>
                </div>
                <div className="habit-week">
                  {days.map(day => (
                    <div className="habit-week-day" key={day.key}>
                      <span
                        className={`habit-mark ${day.future ? 'habit-unknown' : day.entry[habit.key] === 'kept' ? 'habit-kept' : day.entry[habit.key] === 'slip' ? 'habit-slip' : 'habit-unknown'}`}
                        title={`${day.key}: ${day.future ? 'upcoming' : day.entry[habit.key] === 'unset' ? 'not logged' : day.entry[habit.key]}`}
                        aria-label={`${formatDate(day.key, { weekday: 'long' })}: ${day.future ? 'upcoming' : day.entry[habit.key] === 'unset' ? 'not logged' : day.entry[habit.key]}`}
                      >
                        {!day.future && day.entry[habit.key] === 'kept' ? (
                          <Icon name="check" size={15} />
                        ) : !day.future && day.entry[habit.key] === 'slip' ? (
                          '·'
                        ) : (
                          '—'
                        )}
                      </span>
                      <small>{formatDate(day.key, { weekday: 'short' }).slice(0, 1)}</small>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="analytics-grid">
        <section className="panel">
          <SectionHeading title="Trading this week" />
          <WeekTrades trades={weekTrades} account="live" currency={data.settings.currency} />
          <WeekTrades trades={weekTrades} account="demo" currency={data.settings.currency} />
          {!weekTrades.length && <p className="muted">No trades logged this week.</p>}
        </section>
        <section className="panel">
          <SectionHeading title="Cravings this week" />
          {urges.total ? (
            <>
              <p>
                <strong>{urges.resisted}</strong> of <strong>{urges.total}</strong> rode out.{' '}
                {urges.slipped > 0 && `${urges.slipped} became a slip.`}
              </p>
              {urges.topTriggers.length > 0 && (
                <p className="muted">
                  Most common:{' '}
                  {urges.topTriggers.map(([trigger, count]) => `${trigger} (${count})`).join(', ')}. Plan
                  ahead for it next week.
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              None logged. Tap Craving next time one shows up; the pattern only appears if it is recorded.
            </p>
          )}
          <p className="muted review-apps">
            Applications: <strong>{applicationsThisWeek(data, start)}</strong> of{' '}
            {data.settings.weeklyApplicationTarget} · Full days: <strong>{completeDays}</strong> of{' '}
            {elapsed.length}
          </p>
        </section>
      </div>
      <section className="panel">
        <SectionHeading title="The whole challenge">
          <span className="muted">{data.settings.duration} days</span>
        </SectionHeading>
        <div className="habit-review-grid">
          {habits.map(habit => (
            <div key={habit.key}>
              <div className="split">
                <strong>{habit.label}</strong>
                <span className="muted">
                  {habitStreak(data.days, habit.key, today)} now · best{' '}
                  {bestStreak(data.days, habit.key, today)}
                </span>
              </div>
              <div className="challenge-grid">
                {challengeDays.map(day => {
                  const state = day > today ? 'future' : (data.days[day]?.[habit.key] ?? 'unset');
                  const name = { future: 'upcoming', unset: 'not logged', kept: 'kept', slip: 'slip' }[state];
                  return (
                    <span
                      key={day}
                      className={`challenge-cell cell-${state}`}
                      title={`${formatDate(day, { month: 'short', day: 'numeric' })}: ${name}`}
                    >
                      {state === 'slip' ? '×' : ''}
                      <span className="sr-only">
                        {day}: {name}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="microcopy">Filled: kept. ×: slip. Outlined: not logged. Faint: upcoming.</p>
      </section>
      <section className="panel">
        <SectionHeading eyebrow="TAKE SOMETHING INTO NEXT WEEK" title="What did this week teach you?" />
        <p className="muted">
          What worked? What got in the way? Choose one adjustment you can actually make.
        </p>
        <Field label="Weekly reflection">
          <textarea
            rows={7}
            maxLength={20000}
            value={data.weeklyNotes[start] ?? ''}
            onChange={e => {
              const value = e.target.value;
              update(current => ({ ...current, weeklyNotes: { ...current.weeklyNotes, [start]: value } }));
            }}
            placeholder={'A win I want to remember…\nA pattern I noticed…\nOne change for next week…'}
          />
        </Field>
      </section>
    </div>
  );
}

function WeekTrades({
  trades,
  account,
  currency,
}: {
  trades: Trade[];
  account: Trade['account'];
  currency: string;
}) {
  const scoped = trades.filter(trade => trade.account === account);
  if (!scoped.length) return null;
  const stats = tradeAnalytics(scoped);
  const costliest = breakdown(scoped, trade => trade.mistakes)[0];
  return (
    <div className="week-trades">
      <span className="eyebrow">{account === 'live' ? 'LIVE' : 'DEMO / PAPER'}</span>
      <p>
        <strong>{stats.count ? money(stats.net, currency) : 'Open only'}</strong> from {stats.count} closed
        trade{stats.count === 1 ? '' : 's'}
        {stats.winRate !== null && ` · ${Math.round(stats.winRate)}% wins`}
        {stats.avgR !== null && ` · ${stats.avgR.toFixed(2)}R avg`}
        {stats.adherence !== null && ` · ${Math.round(stats.adherence)}% to plan`}
      </p>
      {costliest && costliest.net < 0 && (
        <p className="muted">
          Costliest mistake: {costliest.key} ({money(costliest.net, currency)} across {costliest.count}).
        </p>
      )}
    </div>
  );
}
