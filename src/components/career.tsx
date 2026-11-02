'use client';

import { useState, type FormEvent } from 'react';
import type { Application, FeatureProps, LearningNote } from '@/lib/types';
import { applicationsThisWeek } from '@/lib/analytics';
import { formatDate, safeUrl, todayIn } from '@/lib/domain';
import { EmptyState, Field, Icon, Modal, SectionHeading } from './ui';

const statusLabels: Record<Application['status'], string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  closed: 'Closed',
};

function ApplicationEditor({
  application,
  date,
  onSave,
  onClose,
}: {
  application: Application | null;
  date: string;
  onSave: (value: Application) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const close = () => {
    if (!dirty || window.confirm('Discard changes to this application?')) onClose();
  };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    if (!value('company') || !value('role')) return setError('Add a company and role.');
    if (value('url') && !safeUrl(value('url')))
      return setError('Use a complete http:// or https:// job link.');
    onSave({
      id: application?.id ?? crypto.randomUUID(),
      company: value('company'),
      role: value('role'),
      url: value('url'),
      status: value('status') as Application['status'],
      appliedOn: value('appliedOn'),
      followUp: value('followUp'),
      notes: value('notes'),
    });
  }
  return (
    <Modal title={application ? 'Edit application' : 'Add application'} onClose={close}>
      <form onSubmit={submit} onChange={() => setDirty(true)} className="stack">
        <div className="form-grid">
          <Field label="Company">
            <input
              name="company"
              maxLength={160}
              defaultValue={application?.company ?? ''}
              placeholder="Company name"
              required
              autoFocus
            />
          </Field>
          <Field label="Role">
            <input
              name="role"
              maxLength={160}
              defaultValue={application?.role ?? ''}
              placeholder="e.g. Frontend developer"
              required
            />
          </Field>
          <Field label="Stage">
            <select name="status" defaultValue={application?.status ?? 'saved'}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Application date" hint="Leave blank for a role you have only saved.">
            <input name="appliedOn" type="date" defaultValue={application?.appliedOn ?? ''} max={date} />
          </Field>
          <Field label="Next follow-up">
            <input name="followUp" type="date" defaultValue={application?.followUp ?? ''} />
          </Field>
          <Field label="Job / company link">
            <input
              name="url"
              type="url"
              defaultValue={application?.url ?? ''}
              placeholder="https://…"
              maxLength={2000}
            />
          </Field>
        </div>
        <Field label="Notes & next action">
          <textarea
            name="notes"
            rows={5}
            maxLength={10000}
            defaultValue={application?.notes ?? ''}
            placeholder="Who did you contact? What is the next concrete step?"
          />
        </Field>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button button-secondary" onClick={close} type="button">
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            Save application
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LearningEditor({
  note,
  date,
  onSave,
  onClose,
}: {
  note: LearningNote | null;
  date: string;
  onSave: (value: LearningNote) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const close = () => {
    if (!dirty || window.confirm('Discard this learning note?')) onClose();
  };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    if (!value('topic')) return setError('Give this learning note a topic.');
    if (value('url') && !safeUrl(value('url'))) return setError('Use a complete http:// or https:// link.');
    onSave({
      id: note?.id ?? crypto.randomUUID(),
      date: value('date'),
      topic: value('topic'),
      notes: value('notes'),
      url: value('url'),
    });
  }
  return (
    <Modal title={note ? 'Edit note' : 'Add learning note'} onClose={close}>
      <form onSubmit={submit} onChange={() => setDirty(true)} className="stack">
        <Field label="Topic / what you built">
          <input
            name="topic"
            maxLength={200}
            defaultValue={note?.topic ?? ''}
            placeholder="e.g. Built a paginated API"
            required
            autoFocus
          />
        </Field>
        <Field label="Date">
          <input name="date" type="date" defaultValue={note?.date ?? date} required />
        </Field>
        <Field label="What can you explain or do now?">
          <textarea
            name="notes"
            rows={5}
            maxLength={10000}
            defaultValue={note?.notes ?? ''}
            placeholder="Write it in your own words. Add a question to revisit or an interview explanation."
          />
        </Field>
        <Field label="Evidence / resource link">
          <input
            name="url"
            type="url"
            maxLength={2000}
            defaultValue={note?.url ?? ''}
            placeholder="A commit, demo, article, or exercise…"
          />
        </Field>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            Save note
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Career({ data, update, date }: FeatureProps) {
  const [stage, setStage] = useState('all');
  const [search, setSearch] = useState('');
  const [applicationEditor, setApplicationEditor] = useState<{ application: Application | null } | null>(
    null,
  );
  const [learningEditor, setLearningEditor] = useState<{ note: LearningNote | null } | null>(null);
  const today = todayIn(data.settings.timezone);
  const applications = data.applications.filter(
    app =>
      (stage === 'all' || app.status === stage) &&
      `${app.company} ${app.role} ${app.notes}`.toLowerCase().includes(search.toLowerCase()),
  );
  const due = data.applications.filter(
    app => app.followUp && app.followUp <= today && app.status !== 'closed' && app.status !== 'offer',
  );
  const submitted = data.applications.filter(app => !!app.appliedOn);
  const learning = [...data.learning].sort((a, b) => b.date.localeCompare(a.date));

  function saveApplication(application: Application) {
    update(current => ({
      ...current,
      applications: current.applications.some(a => a.id === application.id)
        ? current.applications.map(a => (a.id === application.id ? application : a))
        : [application, ...current.applications],
    }));
    setApplicationEditor(null);
  }
  function saveLearning(note: LearningNote) {
    update(current => ({
      ...current,
      learning: current.learning.some(n => n.id === note.id)
        ? current.learning.map(n => (n.id === note.id ? note : n))
        : [note, ...current.learning],
    }));
    setLearningEditor(null);
  }

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Sent this week</span>
          <strong>
            {applicationsThisWeek(data, today)}
            <span className="stat-denominator"> / {data.settings.weeklyApplicationTarget}</span>
          </strong>
          <small>{submitted.length} sent in total</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Interviewing</span>
          <strong>{data.applications.filter(app => app.status === 'interview').length}</strong>
          <small>{data.applications.filter(app => app.status === 'offer').length} offers</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Follow-ups due</span>
          <strong>{due.length}</strong>
          <small>{due.length ? 'Listed below' : 'None waiting'}</small>
        </div>
      </div>
      {due.length > 0 && (
        <div className="notice">
          <div>
            Follow up with{' '}
            {due.map((app, index) => (
              <span key={app.id}>
                {index > 0 ? ', ' : ' '}
                <button className="text-button" onClick={() => setApplicationEditor({ application: app })}>
                  {app.company}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <section className="panel">
        <div className="filter-bar">
          <button
            className="button button-primary"
            onClick={() => setApplicationEditor({ application: null })}
          >
            <Icon name="plus" size={15} /> Add application
          </button>
          <select
            aria-label="Filter application stage"
            value={stage}
            onChange={e => setStage(e.target.value)}
          >
            <option value="all">All stages</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Search opportunities"
            placeholder="Search company, role or notes"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {applications.length === 0 ? (
          <EmptyState
            icon="briefcase"
            title={data.applications.length ? 'No matching applications' : 'No applications yet'}
            action={
              <button
                className="button button-secondary"
                onClick={() => setApplicationEditor({ application: null })}
              >
                Add application
              </button>
            }
          >
            Save a role, track where it stands, and set a follow-up date so it shows up on Today.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company / role</th>
                  <th>Stage</th>
                  <th>Applied</th>
                  <th>Follow-up</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setApplicationEditor({ application: app })}
                      >
                        <strong>{app.company}</strong>
                      </button>
                      <small className="muted table-subtext">{app.role}</small>
                    </td>
                    <td>
                      <select
                        aria-label={`Stage for ${app.company}`}
                        value={app.status}
                        onChange={e =>
                          update(current => ({
                            ...current,
                            applications: current.applications.map(a =>
                              a.id === app.id ? { ...a, status: e.target.value as Application['status'] } : a,
                            ),
                          }))
                        }
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {app.appliedOn ? formatDate(app.appliedOn, { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td>
                      {app.followUp ? (
                        <span className={due.some(a => a.id === app.id) ? 'chip chip-amber' : ''}>
                          {formatDate(app.followUp, { month: 'short', day: 'numeric' })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="inline">
                        {safeUrl(app.url) && (
                          <a
                            className="icon-button"
                            href={safeUrl(app.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open job link for ${app.company}`}
                          >
                            <Icon name="external" size={17} />
                          </a>
                        )}
                        <button
                          className="icon-button"
                          aria-label={`Edit ${app.company}`}
                          onClick={() => setApplicationEditor({ application: app })}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${app.company}`}
                          onClick={() => {
                            if (window.confirm(`Delete the ${app.role} opportunity at ${app.company}?`))
                              update(current => ({
                                ...current,
                                applications: current.applications.filter(a => a.id !== app.id),
                              }));
                          }}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <SectionHeading title="Learning log">
          <button
            className="button button-secondary button-small"
            onClick={() => setLearningEditor({ note: null })}
          >
            <Icon name="plus" size={14} /> Add note
          </button>
        </SectionHeading>
        {learning.length === 0 ? (
          <EmptyState icon="book" title="Nothing logged yet">
            Record what you built or can now explain, and link the commit. Useful in interviews.
          </EmptyState>
        ) : (
          <div className="learning-list">
            {learning.map(note => (
              <article className="learning-item" key={note.id}>
                <div className="split">
                  <div>
                    <h3>{note.topic}</h3>
                    <small className="muted">
                      {formatDate(note.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </small>
                  </div>
                  <div className="inline">
                    <button
                      className="icon-button"
                      aria-label={`Edit learning note: ${note.topic}`}
                      onClick={() => setLearningEditor({ note })}
                    >
                      <Icon name="edit" size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete learning note: ${note.topic}`}
                      onClick={() => {
                        if (window.confirm('Delete this learning note?'))
                          update(current => ({
                            ...current,
                            learning: current.learning.filter(n => n.id !== note.id),
                          }));
                      }}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>
                {note.notes && <p className="preserve-whitespace">{note.notes}</p>}
                {safeUrl(note.url) && (
                  <a
                    className="text-button inline"
                    href={safeUrl(note.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open link <Icon name="external" size={14} />
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {applicationEditor && (
        <ApplicationEditor
          application={applicationEditor.application}
          date={today}
          onSave={saveApplication}
          onClose={() => setApplicationEditor(null)}
        />
      )}
      {learningEditor && (
        <LearningEditor
          note={learningEditor.note}
          date={date}
          onSave={saveLearning}
          onClose={() => setLearningEditor(null)}
        />
      )}
    </div>
  );
}
