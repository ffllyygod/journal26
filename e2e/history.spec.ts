import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T19:30:00Z'));
  await page.goto('/demo');
  await expect(page.locator('.day-loop')).toBeVisible();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('journal26-demo-v1')!);
    const blank = {
      ...data.days['2026-11-01'],
      journal: '',
      win: '',
      lesson: '',
      mood: null,
      attachments: [],
      priorities: ['', '', ''],
      tasks: [],
    };
    data.days = {
      '2026-11-01': { ...blank, mood: 5 },
      '2026-10-31': { ...blank, journal: 'A quiet walk', mood: 4 },
      '2026-10-30': { ...blank, lesson: 'Rest matters', mood: 2 },
      '2026-10-29': {
        ...blank,
        attachments: [
          { id: 'photo', name: 'walk.png', path: 'sample/walk.png', mime: 'image/png', size: 100 },
        ],
      },
      '2026-10-28': { ...blank, journal: '  \n ' },
    };
    localStorage.setItem('journal26-demo-v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Write a little' }).click();
});

test('history finds mood-only entries and combines filters without changing the journal', async ({
  page,
}) => {
  const history = page.getByRole('complementary', { name: 'Journal history' });
  await expect(history.getByRole('status')).toHaveText('4 entries');
  await expect(history.getByRole('button', { name: /Nov 1, 2026 Mood: Great/ })).toHaveAttribute(
    'aria-current',
    'date',
  );
  await history.getByLabel('Filter by mood').selectOption('2');
  await expect(history.getByRole('status')).toHaveText('1 entry found');
  await expect(history.getByRole('button', { name: /Oct 30, 2026 Rest matters/ })).toBeVisible();
  await history.getByLabel('With photos only').check();
  await expect(history.getByRole('status')).toHaveText('0 entries found');
  await expect(
    history.getByText('No pages match these filters. Try another word, mood, or date.'),
  ).toBeVisible();
  await history.getByRole('button', { name: 'Clear filters' }).click();
  await expect(history.getByRole('status')).toHaveText('4 entries');
  await history.getByLabel('With photos only').check();
  await expect(history.getByRole('status')).toHaveText('1 entry found');
  await expect(history.getByRole('button', { name: /Oct 29, 2026 1 photo/ })).toBeVisible();
  await history.getByRole('button', { name: 'Clear filters' }).click();
  await history.getByLabel('Search journal').fill('  WALK ');
  await expect(history.getByRole('status')).toHaveText('1 entry found');
  await history.getByRole('button', { name: /Oct 31, 2026 A quiet walk/ }).click();
  await expect(page.getByLabel('Daily journal')).toHaveValue('A quiet walk');
  await expect(page.getByLabel('Selected date')).toHaveValue('2026-10-31');
});

test('ISO-date search locates a mood-only page and clearing search restores all results', async ({
  page,
}) => {
  const history = page.getByRole('complementary', { name: 'Journal history' });
  await history.getByLabel('Search journal').fill('2026-11-01');
  await expect(history.getByRole('status')).toHaveText('1 entry found');
  await expect(history.getByRole('button', { name: /Nov 1, 2026 Mood: Great/ })).toBeVisible();
  await history.getByLabel('Search journal').fill('No matching words');
  await expect(history.getByRole('status')).toHaveText('0 entries found');
  await history.getByRole('button', { name: 'Clear filters' }).click();
  await expect(history.getByLabel('Search journal')).toHaveValue('');
  await expect(history.getByRole('status')).toHaveText('4 entries');
  await expect(page.getByLabel('Daily journal')).toHaveValue('');
});
