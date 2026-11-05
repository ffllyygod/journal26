import test from 'node:test';
import assert from 'node:assert/strict';
import { writingPrompt, writingPromptCategories } from '../src/lib/writing-prompts.ts';

test('each category retains its original prompt on the first rotation date', () => {
  writingPromptCategories.forEach((category, index) => {
    assert.equal(writingPrompt('2026-11-01', index), category.questions[0]);
  });
});

test('a calendar date chooses the same prompt across calls and advances on the next date', () => {
  writingPromptCategories.forEach((category, index) => {
    assert.equal(writingPrompt('2026-11-02', index), category.questions[1]);
    assert.equal(writingPrompt('2026-11-02', index), writingPrompt('2026-11-02', index));
    assert.equal(writingPrompt('2026-10-31', index), category.questions.at(-1));
  });
});

test('another prompt cycles through every question in the selected category', () => {
  writingPromptCategories.forEach((category, index) => {
    const questions = category.questions.map((_, advance) => writingPrompt('2026-11-06', index, advance));
    assert.equal(new Set(questions).size, category.questions.length);
    assert.equal(writingPrompt('2026-11-06', index, category.questions.length), questions[0]);
    assert.ok(questions.every(question => (category.questions as readonly string[]).includes(question)));
  });
});

test('rotation advances one step through leap day, year-end and daylight-saving dates', () => {
  for (const [first, next] of [
    ['2028-02-28', '2028-02-29'],
    ['2028-02-29', '2028-03-01'],
    ['2026-12-31', '2027-01-01'],
    ['2026-03-08', '2026-03-09'],
    ['2026-11-01', '2026-11-02'],
  ]) {
    assert.equal(writingPrompt(first, 0, 1), writingPrompt(next, 0));
  }
});

test('missing or invalid dates fall back to the original prompt', () => {
  for (const date of ['', 'not-a-date', '2026-02-30', '2026-1-1']) {
    assert.equal(writingPrompt(date, 0), writingPromptCategories[0].questions[0]);
  }
});
