import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, emptyDay } from '../src/lib/domain.ts';
import { moveDayTasks, replaceDayTasks, toggleDayTask } from '../src/lib/task-operations.ts';
import type { Task } from '../src/lib/types.ts';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'one',
  title: 'Practice',
  track: 'career',
  minutes: 30,
  done: false,
  ...overrides,
});

test('completing and reopening a task preserves unrelated manual focus', () => {
  const before = { ...emptyDay(), careerMinutes: 45, tasks: [task()] };
  const completed = toggleDayTask(before, 'one');
  assert.equal(completed.careerMinutes, 75);
  assert.equal(toggleDayTask(completed, 'one').careerMinutes, 45);
  assert.equal(before.tasks[0].done, false);
});

test('editing a completed task reconciles its duration and track before reopening', () => {
  const before = { ...emptyDay(), careerMinutes: 75, tradingMinutes: 20, tasks: [task({ done: true })] };
  const longer = replaceDayTasks(before, [task({ done: true, minutes: 90 })]);
  assert.equal(longer.careerMinutes, 135);
  assert.equal(toggleDayTask(longer, 'one').careerMinutes, 45);
  const movedTrack = replaceDayTasks(longer, [task({ done: true, minutes: 90, track: 'trading' })]);
  assert.equal(movedTrack.careerMinutes, 45);
  assert.equal(movedTrack.tradingMinutes, 110);
});

test('deleting completed tasks removes only their credited planned time', () => {
  const before = { ...emptyDay(), careerMinutes: 75, tasks: [task({ done: true })] };
  const after = replaceDayTasks(before, []);
  assert.equal(after.careerMinutes, 45);
  assert.equal(after.tasks.length, 0);
});

test('moving a completed task transfers credit and preserves both dates manual time', () => {
  const data = createWorkspace('2026-11-01');
  data.days['2026-11-01'] = { ...emptyDay(), careerMinutes: 75, tasks: [task({ done: true })] };
  data.days['2026-11-02'] = { ...emptyDay(), careerMinutes: 15 };
  const after = moveDayTasks(data, '2026-11-01', '2026-11-02', ['one']);
  assert.equal(after.days['2026-11-01'].careerMinutes, 45);
  assert.equal(after.days['2026-11-02'].careerMinutes, 45);
  assert.equal(after.days['2026-11-01'].tasks.length, 0);
  assert.equal(after.days['2026-11-02'].tasks[0].done, true);
  assert.equal(moveDayTasks(after, '2026-11-02', '2026-11-02', ['one']), after);
});

test('unfinished and personal tasks do not invent focus time', () => {
  const day = { ...emptyDay(), careerMinutes: 15, tasks: [task()] };
  assert.equal(replaceDayTasks(day, [task({ minutes: 90 })]).careerMinutes, 15);
  const personal = { ...day, tasks: [task({ track: 'personal' })] };
  assert.equal(toggleDayTask(personal, 'one').careerMinutes, 15);
  assert.equal(toggleDayTask(personal, 'missing'), personal);
});

test('reopening after a manual downward correction never produces negative focus', () => {
  const day = { ...emptyDay(), careerMinutes: 10, tasks: [task({ done: true })] };
  assert.equal(toggleDayTask(day, 'one').careerMinutes, 0);
});
