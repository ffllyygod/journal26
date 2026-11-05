'use client';

import { addDays, formatDate } from '@/lib/domain';
import { writingProgress } from '@/lib/journaling';
import type { Workspace } from '@/lib/types';
import { Icon } from './ui';

export function WritingWelcome({
  data,
  date,
  today,
  onWrite,
  onSelect,
}: {
  data: Workspace;
  date: string;
  today: string;
  onWrite: () => void;
  onSelect: (date: string) => void;
}) {
  const progress = writingProgress(data.days, today, data.settings.startDate, data.settings.duration);
  const challengeEnd = addDays(data.settings.startDate, data.settings.duration - 1);
  const day = data.days[date];
  const written = !!day && !!(day.journal.trim() || day.win.trim() || day.lesson.trim());
  const recentCount = progress.recent.filter(day => day.written).length;
  return (
    <section className={`writing-welcome ${written ? 'has-writing' : ''}`} aria-label="Your writing ritual">
      <div className="writing-invitation">
        <div>
          <p className="ritual-eyebrow">A little space for you</p>
          <h2>{written ? 'A little more of your story.' : 'Small entry. Fresh perspective.'}</h2>
          <p className="ritual-description">
            {written
              ? 'You made room for a reflection. You can leave it here or keep going.'
              : date === today
                ? 'A good day, a messy day, an ordinary day. One line is enough.'
                : `Make a little room for ${formatDate(date, { month: 'short', day: 'numeric' })}. One line is enough.`}
          </p>
          <button className="button button-primary ritual-write" onClick={onWrite}>
            <Icon name="book" size={17} /> {written ? 'Keep writing' : 'Write a little'}
            <Icon name="arrow" size={16} />
          </button>
        </div>
        <svg className="ritual-flower" viewBox="0 0 120 150" fill="none" aria-hidden="true">
          <path
            d="M60 145V65M60 123C35 123 29 112 29 105C46 102 60 112 60 123ZM60 105C80 105 91 94 91 87C73 85 60 95 60 105Z"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g className="flower-head">
            {[0, 60, 120, 180, 240, 300].map(angle => (
              <ellipse key={angle} cx="60" cy="31" rx="14" ry="23" transform={`rotate(${angle} 60 55)`} />
            ))}
            <circle cx="60" cy="55" r="17" className="flower-center" />
            <path
              d="M53 58Q60 64 67 58M54 51V52M66 51V52"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
      <div className="writing-trail">
        <div className="trail-heading">
          <span>Your last seven days</span>
          <span>
            <strong>{recentCount}</strong> writing {recentCount === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="trail-days">
          {progress.recent.map(item => (
            <button
              key={item.date}
              className={`trail-day ${item.written ? 'written' : ''}`}
              disabled={item.date < data.settings.startDate || item.date > challengeEnd}
              aria-label={`${formatDate(item.date, { month: 'short', day: 'numeric' })}: ${item.date < data.settings.startDate || item.date > challengeEnd ? 'outside this challenge' : item.written ? 'reflection written' : 'no reflection yet'}`}
              aria-pressed={item.date === date}
              onClick={() => onSelect(item.date)}
            >
              <span>{formatDate(item.date, { weekday: 'short' })}</span>
              <span className="trail-dot">
                {item.written ? <Icon name="check" size={16} /> : formatDate(item.date, { day: 'numeric' })}
              </span>
            </button>
          ))}
        </div>
        <p className="trail-note">
          {progress.total
            ? `${progress.total} ${progress.total === 1 ? 'day' : 'days'} with a reflection. Every return counts.`
            : 'Your first line starts the trail. No catching up required.'}
        </p>
        {progress.milestone > 0 && (
          <p className="writing-milestone">
            <Icon name="leaf" size={15} />
            {progress.milestone === 1
              ? 'Your first reflection. A beginning worth keeping.'
              : `${progress.milestone} writing days reached. Look how much you have noticed.`}
          </p>
        )}
      </div>
    </section>
  );
}
