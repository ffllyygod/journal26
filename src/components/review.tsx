'use client';

import { useState } from 'react';
import type { FeatureProps } from '@/lib/types';
import { addDays, emptyDay, formatDate, hours, todayIn, weekStart } from '@/lib/domain';
import { Field, Icon, SectionHeading } from './ui';

export function Review({ data, update, date }: FeatureProps) {
  const [offset, setOffset] = useState(0);
  const start = addDays(weekStart(date), offset * 7);
  const end = addDays(start, 6);
  const today = todayIn(data.settings.timezone);
  const days = Array.from({ length: 7 }, (_, index) => {
    const key = addDays(start, index);
    return { key, entry: data.days[key] ?? emptyDay(), recorded: !!data.days[key], future: key > today };
  });
  const elapsed = days.filter(day => !day.future);
  const careerMinutes = elapsed.reduce((sum, day) => sum + day.entry.careerMinutes, 0);
  const tradingMinutes = elapsed.reduce((sum, day) => sum + day.entry.tradingMinutes, 0);
  const totalTasks = days.reduce((sum, day) => sum + day.entry.tasks.length, 0);
  const doneTasks = elapsed.reduce((sum, day) => sum + day.entry.tasks.filter(task => task.done).length, 0);
  const journalDays = elapsed.filter(day => !!day.entry.journal.trim() || !!day.entry.win.trim() || !!day.entry.lesson.trim()).length;
  const applied = data.applications.filter(app => app.appliedOn >= start && app.appliedOn <= end && app.appliedOn <= today);
  const maxMinutes = Math.max(data.settings.careerTarget, data.settings.tradingTarget, ...elapsed.flatMap(day => [day.entry.careerMinutes, day.entry.tradingMinutes]), 60);
  const habits = [
    { key: 'smoking' as const, label: 'Smoke-free', icon: 'leaf' as const },
    { key: 'abstinence' as const, label: 'Abstinence', icon: 'flame' as const },
  ];

  return <div className="stack">
    <SectionHeading eyebrow="PAUSE. NOTICE. ADJUST." title="Your weekly reflection"><div className="inline"><button className="icon-button" aria-label="Previous week" onClick={() => setOffset(value => value - 1)}><Icon name="chevron" style={{ transform: 'rotate(180deg)' }} /></button><button className="button button-secondary button-small" onClick={() => setOffset(0)}>Selected week</button><button className="icon-button" aria-label="Next week" onClick={() => setOffset(value => value + 1)}><Icon name="chevron" /></button></div></SectionHeading>
    <p className="muted">{formatDate(start, { month: 'long', day: 'numeric' })} – {formatDate(end, { month: 'long', day: 'numeric', year: 'numeric' })}. Look for something to repeat and one thing to change.</p>
    <div className="stat-grid">
      <div className="stat-card"><span className="eyebrow">FOCUSED WORK</span><strong>{hours(careerMinutes + tradingMinutes)}</strong><small>{hours(careerMinutes)} career · {hours(tradingMinutes)} trading</small></div>
      <div className="stat-card"><span className="eyebrow">TASKS COMPLETED</span><strong>{doneTasks}<span className="stat-denominator"> / {totalTasks}</span></strong><small>Across the plans you made this week</small></div>
      <div className="stat-card"><span className="eyebrow">DAYS REFLECTED</span><strong>{journalDays}<span className="stat-denominator"> / {elapsed.length}</span></strong><small>{applied.length} job application{applied.length === 1 ? '' : 's'} sent this week</small></div>
    </div>
    <section className="panel">
      <SectionHeading title="Where your time went"><div className="inline chart-legend"><span><i className="legend-dot career-dot" />Career</span><span><i className="legend-dot trading-dot" />Trading</span></div></SectionHeading>
      <div className="weekly-chart" role="img" aria-label={`Weekly focused work: career ${hours(careerMinutes)}, trading ${hours(tradingMinutes)}. Daily totals listed below.`}>{days.map(day => <div key={day.key} className={`chart-day ${day.future ? 'chart-day-future' : ''}`}>
        <div className="chart-bars" aria-hidden="true"><div className="chart-bar career-bar" style={{ height: `${day.future ? 0 : day.entry.careerMinutes / maxMinutes * 100}%` }} /><div className="chart-bar trading-bar" style={{ height: `${day.future ? 0 : day.entry.tradingMinutes / maxMinutes * 100}%` }} /></div>
        <span>{formatDate(day.key, { weekday: 'short' })}</span><small>{day.future ? 'Upcoming' : day.entry.careerMinutes + day.entry.tradingMinutes ? hours(day.entry.careerMinutes + day.entry.tradingMinutes) : 'No time logged'}</small>
      </div>)}</div>
      <details className="details"><summary>Daily breakdown</summary><div className="table-wrap"><table className="data-table"><thead><tr><th>Day</th><th>Career</th><th>Trading</th><th>Tasks done</th></tr></thead><tbody>{days.map(day => <tr key={day.key}><td>{formatDate(day.key, { weekday: 'short', month: 'short', day: 'numeric' })}</td><td>{day.future ? '—' : hours(day.entry.careerMinutes)}</td><td>{day.future ? '—' : hours(day.entry.tradingMinutes)}</td><td>{day.future ? '—' : day.entry.tasks.filter(task => task.done).length} / {day.entry.tasks.length}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className="panel">
      <SectionHeading title="Keep showing up"><span className="muted">Unlogged days stay unknown.</span></SectionHeading>
      <div className="habit-review-grid">{habits.map(habit => {
        const logged = elapsed.filter(day => day.entry[habit.key] !== 'unset');
        const kept = logged.filter(day => day.entry[habit.key] === 'kept').length;
        return <div className="habit-review" key={habit.key}><div className="split"><span className="inline"><Icon name={habit.icon} size={19} /><strong>{habit.label}</strong></span><span className="muted">{kept} kept / {logged.length} logged</span></div><div className="habit-week">{days.map(day => <div className="habit-week-day" key={day.key}><span className={`habit-mark ${day.future ? 'habit-unknown' : day.entry[habit.key] === 'kept' ? 'habit-kept' : day.entry[habit.key] === 'slip' ? 'habit-slip' : 'habit-unknown'}`} title={`${day.key}: ${day.future ? 'upcoming' : day.entry[habit.key] === 'unset' ? 'not logged' : day.entry[habit.key]}`} aria-label={`${formatDate(day.key, { weekday: 'long' })}: ${day.future ? 'upcoming' : day.entry[habit.key] === 'unset' ? 'not logged' : day.entry[habit.key]}`}>{!day.future && day.entry[habit.key] === 'kept' ? <Icon name="check" size={15} /> : !day.future && day.entry[habit.key] === 'slip' ? '·' : '—'}</span><small>{formatDate(day.key, { weekday: 'short' }).slice(0, 1)}</small></div>)}</div></div>;
      })}</div>
    </section>
    <section className="panel">
      <SectionHeading eyebrow="TAKE SOMETHING INTO NEXT WEEK" title="What did this week teach you?" />
      <p className="muted">What worked? What got in the way? Choose one adjustment you can actually make.</p>
      <Field label="Weekly reflection"><textarea rows={7} maxLength={20000} value={data.weeklyNotes[start] ?? ''} onChange={e => { const value = e.target.value; update(current => ({ ...current, weeklyNotes: { ...current.weeklyNotes, [start]: value } })); }} placeholder={'A win I want to remember…\nA pattern I noticed…\nOne change for next week…'} /></Field>
    </section>
  </div>;
}
