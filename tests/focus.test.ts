import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDay } from '../src/lib/domain.ts';
import { elapsedMinutes, logSession } from '../src/lib/focus.ts';
import type { Task } from '../src/lib/types.ts';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't',
  title: 'Practice',
  track: 'career',
  minutes: 60,
  done: false,
  ...overrides,
});

test('a free session credits its track and leaves the other alone', () => {
  const day = { ...emptyDay(), careerMinutes: 10, tradingMinutes: 20 };
  const after = logSession(day, { track: 'trading', taskId: null }, 45, false);
  assert.equal(after.tradingMinutes, 65);
  assert.equal(after.careerMinutes, 10);
});

test('finishing a timed task credits actual time, not the estimate on top of it', () => {
  const day = { ...emptyDay(), careerMinutes: 10, tasks: [task()] };
  const after = logSession(day, { track: 'career', taskId: 't' }, 45, true);
  assert.equal(after.careerMinutes, 55);
  assert.equal(after.tasks[0].done, true);
  assert.equal(after.tasks[0].minutes, 45);
});

test('stopping early credits the time and later finishing credits only what is left', () => {
  const day = { ...emptyDay(), tasks: [task()] };
  const paused = logSession(day, { track: 'career', taskId: 't' }, 20, false);
  assert.equal(paused.careerMinutes, 20);
  assert.equal(paused.tasks[0].minutes, 40);
  assert.equal(paused.tasks[0].done, false);
});

test('a task ticked during its session is reconciled instead of double counted', () => {
  const day = { ...emptyDay(), careerMinutes: 60, tasks: [task({ done: true })] };
  const after = logSession(day, { track: 'career', taskId: 't' }, 30, false);
  assert.equal(after.careerMinutes, 30);
});

test('a task deleted during its session still credits the time', () => {
  const after = logSession(emptyDay(), { track: 'career', taskId: 'gone' }, 25, true);
  assert.equal(after.careerMinutes, 25);
});

test('elapsed time rounds to minutes and never reports zero', () => {
  assert.equal(elapsedMinutes({ startedAt: 1000 }, 1000), 1);
  assert.equal(elapsedMinutes({ startedAt: 0 }, 25 * 60000), 25);
});
