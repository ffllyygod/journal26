import { addDays } from './domain.ts';
import type { DayEntry } from './types.ts';

/** Writing counts independently of completing the entire daily routine. */
export function writingProgress(days: Record<string, DayEntry>, today: string) {
  const written = (day: DayEntry | undefined) =>
    !!day && [day.journal, day.win, day.lesson].some(value => value.trim().length > 0);

  return {
    total: Object.entries(days).filter(([date, day]) => date <= today && written(day)).length,
    recent: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      return { date, written: written(days[date]) };
    }),
  };
}
