'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/domain';
import { journalHistory, journalMoodLabels, journalPreview } from '@/lib/journal-history';
import type { Workspace } from '@/lib/types';
import { Field, Icon } from './ui';

export function JournalHistory({
  data,
  date,
  onSelectDate,
}: {
  data: Workspace;
  date: string;
  onSelectDate: (date: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [photosOnly, setPhotosOnly] = useState(false);
  const filtered = !!query.trim() || mood !== null || photosOnly;
  const entries = journalHistory(data.days, { query, mood, photosOnly });

  function clearFilters() {
    setQuery('');
    setMood(null);
    setPhotosOnly(false);
  }

  return (
    <aside className="panel journal-index" aria-label="Journal history">
      <h2>Your past pages</h2>
      <div className="search-field">
        <Icon name="search" size={17} />
        <input
          type="search"
          aria-label="Search journal"
          placeholder="Words or YYYY-MM-DD"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      </div>
      <Field label="Filter by mood">
        <select
          value={mood ?? ''}
          onChange={event => setMood(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">All moods</option>
          {journalMoodLabels.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <label className="check-line">
        <input type="checkbox" checked={photosOnly} onChange={event => setPhotosOnly(event.target.checked)} />
        <span>With photos only</span>
      </label>
      <div className="split">
        <p className="muted" role="status">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          {filtered ? ' found' : ''}
        </p>
        {filtered && (
          <button type="button" className="text-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      {entries.length ? (
        entries.map(([key, entry]) => (
          <button
            type="button"
            className={`journal-index-item ${date === key ? 'active' : ''}`}
            key={key}
            aria-current={date === key ? 'date' : undefined}
            onClick={() => onSelectDate(key)}
          >
            <strong>{formatDate(key, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
            <span>{journalPreview(entry)}</span>
          </button>
        ))
      ) : (
        <p className="muted">
          {filtered
            ? 'No pages match these filters. Try another word, mood, or date.'
            : 'Your pages will appear here. Write a line, choose a mood, or add a photo to begin.'}
        </p>
      )}
    </aside>
  );
}
