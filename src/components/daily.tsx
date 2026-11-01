'use client';

import { useState, type FormEvent } from 'react';
import { addDays, emptyDay, formatDate, habitCount, habitStreak, hours, todayIn } from '@/lib/domain';
import type { DayEntry, FeatureProps, Task, Track } from '@/lib/types';
import { AttachmentGallery } from './attachments';
import { EmptyState, Field, Icon, Modal, SectionHeading } from './ui';

export function Daily({ data, update, date, demo, userId, onPlanTomorrow }: FeatureProps & { onPlanTomorrow: () => void }) {
  const day = data.days[date] ?? emptyDay();
  const today = todayIn(data.settings.timezone);
  const future = date > today;
  const [taskOpen, setTaskOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [moveDate, setMoveDate] = useState(addDays(date, 1));
  function patch(value: Partial<DayEntry>) { update(current => ({ ...current, days: { ...current.days, [date]: { ...(current.days[date] ?? emptyDay()), ...value } } })); }
  function toggleTask(id: string) { update(current => { const entry = current.days[date] ?? emptyDay(); return { ...current, days: { ...current.days, [date]: { ...entry, tasks: entry.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) } } }; }); }
  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const task: Task = { id: editing?.id ?? crypto.randomUUID(), title: String(values.get('title')).trim(), track: String(values.get('track')) as Track, minutes: Number(values.get('minutes')), done: editing?.done ?? false };
    if (!task.title) return;
    patch({ tasks: editing ? day.tasks.map(t => t.id === editing.id ? task : t) : [...day.tasks, task] });
    setTaskOpen(false); setEditing(null);
  }
  const completed = day.tasks.filter(t => t.done).length;
  const planMinutes = day.tasks.reduce((sum, t) => sum + t.minutes, 0);
  return <>
    <div className="daily-grid">
      <div className="daily-main">
        <section className="intention-panel">
          <div className="intention-top"><span className="eyebrow">{future ? 'A LITTLE INTENTION FOR TOMORROW' : 'A LITTLE INTENTION GOES A LONG WAY'}</span><Icon name="sun" size={22}/></div>
          <h2>{future ? 'Give tomorrow a direction.' : 'Make room for what matters.'}</h2>
          <p>Three meaningful outcomes. Everything else is a bonus.</p>
          <div className="priorities">{day.priorities.map((priority, index) => <label className="priority" key={index}><span>0{index + 1}</span><input aria-label={`Priority ${index + 1}`} value={priority} placeholder={['What would make this a good day?', 'One thing to move your learning forward', 'One promise to yourself'][index]} maxLength={160} onChange={e => patch({ priorities: day.priorities.map((p, i) => index === i ? e.target.value : p) })}/></label>)}</div>
        </section>
        <section className="panel task-panel">
          <SectionHeading title="The day's plan"><span className="subtle-count">{completed} / {day.tasks.length} done</span></SectionHeading>
          {day.tasks.length ? <div className="task-list">{day.tasks.map(task => <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}>
            <button type="button" className="task-check" aria-label={`${task.done ? 'Mark incomplete' : 'Complete'}: ${task.title}`} aria-pressed={task.done} onClick={() => toggleTask(task.id)}>{task.done && <Icon name="check" size={14}/>}</button>
            <button className="task-content" onClick={() => { setEditing(task); setTaskOpen(true); }}><span className="task-title">{task.title}</span><span className="task-meta"><span className={`track-dot ${task.track}`}/>{task.track === 'career' ? 'Career' : task.track === 'trading' ? 'Trading' : 'Personal'}<span>·</span>{task.minutes} min</span></button>
            <button className="icon-button task-move" aria-label={`Reschedule: ${task.title}`} title="Move to another day" onClick={() => { setMoveDate(addDays(date, 1)); setMoveTask(task); }}><Icon name="arrow" size={17}/></button>
          </div>)}</div> : <div className="small-empty"><p>A good day starts with a small plan.</p><span>Add your first task. Keep it specific and achievable.</span></div>}
          <button className="add-task" onClick={() => { setEditing(null); setTaskOpen(true); }}><Icon name="plus" size={17}/> Add a task <span>{planMinutes ? `${hours(planMinutes)} planned` : ''}</span></button>
        </section>
        <JournalEditor day={day} patch={patch} demo={demo} userId={userId} future={future}/>
      </div>
      <aside className="daily-aside">
        <section className="panel habits-panel">
          <SectionHeading title="Keep your promises"><Icon name="leaf" size={19}/></SectionHeading>
          <p className="section-description">Small choices. A stronger you.</p>
          {(['smoking', 'abstinence'] as const).map(habit => <div className="habit" key={habit}>
            <div className="habit-heading"><div className={`habit-symbol ${habit}`}><Icon name={habit === 'smoking' ? 'leaf' : 'flame'} size={19}/></div><div><h3>{habit === 'smoking' ? 'Smoke-free' : 'Abstinence'}</h3><span>{habitStreak(data.days, habit, today)} day streak · {habitCount(data.days, habit, 'kept', today)} kept</span></div></div>
            <div className="habit-options" role="group" aria-label={habit === 'smoking' ? 'Smoking check-in' : 'Abstinence check-in'}>
              <button disabled={future} className={day[habit] === 'kept' ? 'selected' : ''} aria-pressed={day[habit] === 'kept'} onClick={() => patch({ [habit]: day[habit] === 'kept' ? 'unset' : 'kept' })}><Icon name="check" size={14}/> Kept it</button>
              <button disabled={future} className={day[habit] === 'slip' ? 'selected-slip' : ''} aria-pressed={day[habit] === 'slip'} onClick={() => patch({ [habit]: day[habit] === 'slip' ? 'unset' : 'slip' })}>Had a slip</button>
            </div>
          </div>)}
          {future ? <p className="microcopy">Check in when this day arrives.</p> : <p className="microcopy">An honest check-in counts. Your progress stays.</p>}
          {(day.smoking === 'slip' || day.abstinence === 'slip') && <Field label="What triggered it? What will help next time?"><textarea value={day.trigger} onChange={e => patch({ trigger: e.target.value })} rows={3} placeholder="No judgment. Just something to learn from." maxLength={2000}/></Field>}
        </section>
        <section className="panel focus-panel">
          <SectionHeading title="Time well spent"><Icon name="clock" size={18}/></SectionHeading>
          {[{ key: 'careerMinutes' as const, name: 'Build your career', target: data.settings.careerTarget, track: 'career' }, { key: 'tradingMinutes' as const, name: 'Learn the markets', target: data.settings.tradingTarget, track: 'trading' }].map(item => <div className="focus-item" key={item.key}><div className="split"><span><span className={`track-dot ${item.track}`}/>{item.name}</span><strong>{hours(day[item.key])}</strong></div><div className={`progress-track ${item.track}`}><span style={{ width: `${Math.min(100, day[item.key] / Math.max(1, item.target) * 100)}%` }}/></div><small>of {hours(item.target)} daily intention</small></div>)}
          <button className="button button-secondary button-full button-small" onClick={() => setFocusOpen(true)} disabled={future}><Icon name="plus" size={15}/> Log focus time</button>
        </section>
        <section className="tomorrow-note"><span className="eyebrow">DO YOUR FUTURE SELF A FAVOR</span><h3>End today with<br/>a little clarity.</h3><p>Leave a plan to wake up to.</p><button className="text-button" onClick={onPlanTomorrow}>Plan tomorrow <Icon name="arrow" size={17}/></button><span className="note-decoration" aria-hidden="true">↗</span></section>
      </aside>
    </div>
    {taskOpen && <Modal title={editing ? 'Edit your task' : 'One step forward'} onClose={() => setTaskOpen(false)}><form onSubmit={saveTask} className="stack"><Field label="What will you do?"><input name="title" defaultValue={editing?.title} placeholder="e.g. Practice three array problems" required maxLength={200} autoFocus/></Field><div className="form-grid"><Field label="Focus area"><select name="track" defaultValue={editing?.track ?? 'career'}><option value="career">Career</option><option value="trading">Trading</option><option value="personal">Personal</option></select></Field><Field label="Estimated minutes"><input name="minutes" type="number" min="5" max="720" step="5" defaultValue={editing?.minutes ?? 30} required/></Field></div><div className="modal-actions">{editing && <button type="button" className="button button-danger" onClick={() => { if (window.confirm('Delete this task?')) { patch({ tasks: day.tasks.filter(t => t.id !== editing.id) }); setTaskOpen(false); } }}>Delete task</button>}<button className="button button-primary" type="submit">{editing ? 'Save task' : 'Add to my day'}<Icon name="arrow" size={17}/></button></div></form></Modal>}
    {focusOpen && <Modal title="Give your effort some credit" onClose={() => setFocusOpen(false)}><form className="stack" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); patch({ careerMinutes: Number(form.get('career')), tradingMinutes: Number(form.get('trading')) }); setFocusOpen(false); }}><p className="muted">Set your total focused minutes for {formatDate(date, { month: 'short', day: 'numeric' })}. You can adjust these anytime.</p><Field label="Career · total minutes today"><input name="career" type="number" min="0" max="1440" defaultValue={day.careerMinutes} required/></Field><Field label="Trading study · total minutes today"><input name="trading" type="number" min="0" max="1440" defaultValue={day.tradingMinutes} required/></Field><div className="modal-actions"><button className="button button-primary">Save focus time</button></div></form></Modal>}
    {moveTask && <Modal title="Make a little room" onClose={() => setMoveTask(null)}><form className="stack" onSubmit={e => { e.preventDefault(); if (moveDate === date) { setMoveTask(null); return; } update(current => { const from = current.days[date] ?? emptyDay(); const to = current.days[moveDate] ?? emptyDay(); return { ...current, days: { ...current.days, [date]: { ...from, tasks: from.tasks.filter(t => t.id !== moveTask.id) }, [moveDate]: { ...to, tasks: [...to.tasks, moveTask] } } }; }); setMoveTask(null); }}><p>{moveTask.title}</p><Field label="Move task to"><input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} required/></Field><div className="modal-actions"><button className="button button-primary">Move task</button></div></form></Modal>}
  </>;
}

export function JournalEditor({ day, patch, demo, userId, future = false }: { day: DayEntry; patch: (value: Partial<DayEntry>) => void; demo: boolean; userId?: string; future?: boolean }) {
  return <section className="panel journal-panel"><SectionHeading title={future ? 'Notes for the day ahead' : 'A page for your thoughts'}><span className="handwritten">just for you</span></SectionHeading><p className="section-description">{future ? 'What do you want to remember when you wake up?' : 'What happened? How did it feel? What do you want to remember?'}</p><textarea className="journal-textarea" aria-label="Daily journal" value={day.journal} onChange={e => patch({ journal: e.target.value })} placeholder={future ? 'Tomorrow, I want to…' : 'Today, I…'} rows={5} maxLength={30000}/><AttachmentGallery attachments={day.attachments} onChange={attachments => patch({ attachments })} demo={demo} userId={userId}/><div className="journal-reflections"><Field label="One small win"><input value={day.win} onChange={e => patch({ win: e.target.value })} placeholder="Something you’re giving yourself credit for" maxLength={500}/></Field><Field label="One thing I learned"><input value={day.lesson} onChange={e => patch({ lesson: e.target.value })} placeholder="A thought to take into tomorrow" maxLength={500}/></Field></div><div className="mood-row"><span>How did today feel?</span><div role="group" aria-label="Daily mood">{['Rough', 'Low', 'Okay', 'Good', 'Great'].map((label, i) => <button type="button" key={label} disabled={future} className={day.mood === i + 1 ? 'selected' : ''} aria-label={`Mood: ${label}`} aria-pressed={day.mood === i + 1} onClick={() => patch({ mood: day.mood === i + 1 ? null : i + 1 })}><span aria-hidden="true">{['◡', '−', '·', '⌣', '✧'][i]}</span><small>{label}</small></button>)}</div></div></section>;
}

export function Journal({ data, update, date, demo, userId, onSelectDate }: FeatureProps & { onSelectDate: (date: string) => void }) {
  const [query, setQuery] = useState('');
  const day = data.days[date] ?? emptyDay();
  const entries = Object.entries(data.days).filter(([, d]) => (d.journal || d.win || d.lesson || d.attachments.length) && `${d.journal} ${d.win} ${d.lesson}`.toLowerCase().includes(query.toLowerCase())).sort(([a], [b]) => b.localeCompare(a));
  return <div className="journal-layout"><aside className="panel journal-index"><div className="search-field"><Icon name="search" size={17}/><input aria-label="Search journal" placeholder="Find a thought…" value={query} onChange={e => setQuery(e.target.value)}/></div><p className="eyebrow">YOUR PAGES · {entries.length}</p>{entries.length ? entries.map(([key, d]) => <button className={`journal-index-item ${date === key ? 'active' : ''}`} key={key} onClick={() => onSelectDate(key)}><strong>{formatDate(key, { month: 'short', day: 'numeric', year: 'numeric' })}</strong><span>{d.journal || d.win || d.lesson || 'A day in pictures'}</span></button>) : <p className="muted">{query ? 'No matching entries.' : 'Your story starts with a sentence.'}</p>}</aside><div><JournalEditor day={day} patch={value => update(current => ({ ...current, days: { ...current.days, [date]: { ...(current.days[date] ?? emptyDay()), ...value } } }))} demo={demo} userId={userId} future={date > todayIn(data.settings.timezone)}/>{!entries.length && <EmptyState title="A place to come back to">Write freely, attach a memory, or start with a single sentence. Every entry is connected to its day.</EmptyState>}</div></div>;
}
