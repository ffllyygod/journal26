import type { DayEntry } from './types.ts';

export const journalMoodLabels = ['Rough', 'Low', 'Okay', 'Good', 'Great'] as const;

export type JournalHistoryFilters = {
  query?: string;
  mood?: number | null;
  photosOnly?: boolean;
};

/** A mood or photo is a journal entry too; unfinished task plans alone are not. */
export function journalHistory(
  days: Record<string, DayEntry>,
  { query = '', mood = null, photosOnly = false }: JournalHistoryFilters = {},
) {
  const search = query.trim().toLowerCase();
  return Object.entries(days)
    .filter(([date, day]) => {
      const text = [day.journal, day.win, day.lesson].map(value => value.trim()).join(' ');
      const hasMood = day.mood !== null && day.mood >= 1 && day.mood <= 5;
      const hasEntry = !!text.trim() || hasMood || day.attachments.length > 0;
      return (
        hasEntry &&
        (mood === null || day.mood === mood) &&
        (!photosOnly || day.attachments.length > 0) &&
        `${date} ${text}`.toLowerCase().includes(search)
      );
    })
    .sort(([a], [b]) => b.localeCompare(a));
}

export function journalPreview(day: DayEntry) {
  const reflection = [day.journal, day.win, day.lesson].find(value => value.trim());
  if (reflection) return reflection.trim();
  if (day.attachments.length)
    return `${day.attachments.length} ${day.attachments.length === 1 ? 'photo' : 'photos'}`;
  const mood = day.mood === null ? undefined : journalMoodLabels[day.mood - 1];
  return mood ? `Mood: ${mood}` : '';
}
