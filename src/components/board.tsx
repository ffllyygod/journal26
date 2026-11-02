'use client';

import { dayLoop, loopStreak } from '@/lib/analytics';
import { addDays, formatDate } from '@/lib/domain';
import type { Workspace } from '@/lib/types';

/**
 * The challenge at a glance, and the way around it: one square per day, darker as more of the
 * day's five steps get done, marked when a habit slipped. Tap any square to open that day.
 */
export function Board({
  data,
  date,
  today,
  onSelect,
}: {
  data: Workspace;
  date: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const { startDate, duration } = data.settings;
  const cells = Array.from({ length: duration }, (_, index) => {
    const key = addDays(startDate, index);
    const future = key > today;
    const day = data.days[key];
    const done = future ? 0 : dayLoop(data, key).filter(step => step.done).length;
    const slipped = !!day && !future && (day.smoking === 'slip' || day.abstinence === 'slip');
    return { key, index, future, done, slipped };
  });
  const fullDays = cells.filter(cell => cell.done === 5).length;
  const elapsed = cells.filter(cell => !cell.future).length;
  const streak = loopStreak(data, today);
  return (
    <section className="board" aria-label="Challenge days">
      <div className="board-grid">
        {cells.map(cell => {
          const name = formatDate(cell.key, { month: 'short', day: 'numeric' });
          const state = cell.future
            ? 'upcoming'
            : `${cell.done} of 5 steps${cell.slipped ? ', slip logged' : ''}`;
          return (
            <button
              key={cell.key}
              type="button"
              className={[
                'board-cell',
                cell.future ? 'board-future' : `board-level-${cell.done}`,
                cell.key === today ? 'board-today' : '',
                cell.key === date ? 'board-selected' : '',
                cell.slipped ? 'board-slip' : '',
              ].join(' ')}
              aria-label={`Day ${cell.index + 1}, ${name}: ${state}`}
              aria-current={cell.key === today ? 'date' : undefined}
              title={`Day ${cell.index + 1}, ${name}: ${state}`}
              onClick={() => onSelect(cell.key)}
            >
              {(cell.key === today || (cell.index + 1) % 10 === 0) && <span>{cell.index + 1}</span>}
            </button>
          );
        })}
      </div>
      <p className="board-caption">
        <span>
          <strong>{fullDays}</strong> of {elapsed} {elapsed === 1 ? 'day' : 'days'} complete
        </span>
        <span>
          <strong>{streak}</strong> day streak
        </span>
        <span>
          <strong>{Math.max(0, duration - elapsed)}</strong> days left
        </span>
        <span className="board-key">Stronger color means more steps done. A red corner marks a slip.</span>
      </p>
    </section>
  );
}
