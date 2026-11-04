import { replaceDayTasks } from './task-operations.ts';
import type { DayEntry } from './types.ts';

export type FocusTrack = 'career' | 'trading';
/** A running timer. Device-local: it is only ever stopped where it was started. */
export type FocusSession = {
  resetId?: string;
  track: FocusTrack;
  /** The journal day it started on, so a session crossing the day boundary credits that day. */
  date: string;
  taskId: string | null;
  label: string;
  startedAt: number;
};

const KEY: Record<FocusTrack, 'careerMinutes' | 'tradingMinutes'> = {
  career: 'careerMinutes',
  trading: 'tradingMinutes',
};

export function elapsedMinutes(session: Pick<FocusSession, 'startedAt'>, now = Date.now()): number {
  return Math.max(1, Math.round((now - session.startedAt) / 60000));
}

/**
 * Credits a stopped session exactly once. A task's minutes are its remaining estimate, and finishing
 * a task credits its minutes, so timed work must not be added on top of that:
 * finished means the task's minutes become the time actually spent; unfinished credits the time and
 * shrinks what is left.
 */
export function logSession(
  day: DayEntry,
  session: Pick<FocusSession, 'track' | 'taskId'>,
  minutes: number,
  finished: boolean,
): DayEntry {
  const task = session.taskId ? day.tasks.find(t => t.id === session.taskId) : undefined;
  if (task && (finished || task.done))
    return replaceDayTasks(
      day,
      day.tasks.map(t => (t.id === task.id ? { ...t, minutes, done: true } : t)),
    );
  const key = KEY[session.track];
  const credited = { ...day, [key]: Math.min(1440, day[key] + minutes) };
  if (!task) return credited;
  return {
    ...credited,
    tasks: day.tasks.map(t => (t.id === task.id ? { ...t, minutes: Math.max(5, t.minutes - minutes) } : t)),
  };
}
