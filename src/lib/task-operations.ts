import { emptyDay } from './domain.ts';
import type { DayEntry, Task, Workspace } from './types.ts';

const credited = (tasks: Task[], track: Task['track']) =>
  tasks.filter(task => task.done && task.track === track).reduce((sum, task) => sum + task.minutes, 0);

/** Reconcile planned-time credits without replacing unrelated manually logged focus. */
export function replaceDayTasks(day: DayEntry, tasks: Task[]): DayEntry {
  return {
    ...day,
    tasks,
    careerMinutes: Math.max(0, day.careerMinutes + credited(tasks, 'career') - credited(day.tasks, 'career')),
    tradingMinutes: Math.max(
      0,
      day.tradingMinutes + credited(tasks, 'trading') - credited(day.tasks, 'trading'),
    ),
  };
}

export function toggleDayTask(day: DayEntry, id: string): DayEntry {
  if (!day.tasks.some(task => task.id === id)) return day;
  return replaceDayTasks(
    day,
    day.tasks.map(task => (task.id === id ? { ...task, done: !task.done } : task)),
  );
}

export function moveDayTasks(data: Workspace, from: string, to: string, ids: string[]): Workspace {
  if (from === to) return data;
  const source = data.days[from] ?? emptyDay();
  const destination = data.days[to] ?? emptyDay();
  const moving = source.tasks.filter(task => ids.includes(task.id));
  if (!moving.length) return data;
  return {
    ...data,
    days: {
      ...data.days,
      [from]: replaceDayTasks(
        source,
        source.tasks.filter(task => !ids.includes(task.id)),
      ),
      [to]: replaceDayTasks(destination, [...destination.tasks, ...moving]),
    },
  };
}
