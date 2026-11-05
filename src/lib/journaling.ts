import { addDays } from './domain.ts';
import type { DayEntry } from './types.ts';

/** Writing counts independently of completing the entire daily routine. */
export function writingProgress(
  days: Record<string, DayEntry>,
  today: string,
  startDate?: string,
  duration?: number,
) {
  const written = (day: DayEntry | undefined) =>
    !!day && [day.journal, day.win, day.lesson].some(value => value.trim().length > 0);
  const endDate = startDate && duration ? addDays(startDate, duration - 1) : today;
  const inChallenge = (date: string) => (!startDate || date >= startDate) && date <= endDate && date <= today;
  const total = Object.entries(days).filter(([date, day]) => inChallenge(date) && written(day)).length;
  const milestone = [1, 7, 14, 30, 60].filter(value => total >= value).at(-1) ?? 0;

  return {
    total,
    milestone,
    recent: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      return { date, written: inChallenge(date) && written(days[date]) };
    }),
  };
}
