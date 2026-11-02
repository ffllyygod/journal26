import { expect, test, type Page } from '@playwright/test';

const NOW = new Date('2026-11-01T19:30:00Z');
const DAY = '2026-11-01';
const saved = (page: Page) => expect(page.locator('.save-status')).toContainText('Saved on this device');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto('/demo');
  await expect(page.locator('.day-loop')).toBeVisible();
});

test('the writing invitation opens a focused editor and prompts never replace writing', async ({ page }) => {
  await page.getByRole('button', { name: 'Write a little' }).click();
  const editor = page.getByLabel('Daily journal');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('');
  await page.getByRole('button', { name: 'On my mind', exact: true }).click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('');
  await expect(page.locator('.prompt-question')).toHaveText('What has been taking up space in your head?');
  await editor.fill('I made time to notice the quiet today.');
  await page.getByRole('button', { name: 'Let it go', exact: true }).click();
  await expect(editor).toHaveValue('I made time to notice the quiet today.');
  await expect(page.getByRole('button', { name: 'Let it go', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await saved(page);
});

test('a single reflection survives reload and counts without completing the routine', async ({ page }) => {
  await expect(page.locator('.trail-heading')).toContainText('6 writing days');
  await page.getByRole('button', { name: 'Write a little' }).click();
  await page.getByLabel('Daily journal').fill('One small reflection is enough for tonight.');
  await expect(page.locator('.writing-feedback')).toContainText('That counts.');
  await saved(page);
  await page.reload();
  await expect(page.locator('.trail-heading')).toContainText('7 writing days');
  await expect(page.locator('.day-loop-head')).toContainText('2 of 5 done');
  await expect(page.getByRole('button', { name: 'Nov 1: reflection written', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Keep writing' }).click();
  await expect(page.getByLabel('Daily journal')).toHaveValue('One small reflection is enough for tonight.');
});

test('the writing trail opens its date and planning follows that date', async ({ page }) => {
  await page.getByRole('button', { name: 'Oct 30: reflection written', exact: true }).click();
  await expect(page.getByLabel('Selected date')).toHaveValue('2026-10-30');
  await page.locator('.loop-step', { hasText: 'Tomorrow' }).click();
  await page.getByRole('button', { name: 'Plan tomorrow', exact: true }).click();
  await expect(page.getByLabel('Selected date')).toHaveValue('2026-10-31');
  await expect(page.getByLabel('Selected date')).not.toHaveValue('2026-11-02');
});

test('setup previews the end date from the selected start date', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('journal26-demo-v1')!);
    data.settings.configured = false;
    localStorage.setItem('journal26-demo-v1', JSON.stringify(data));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Set up your 60 days' })).toBeVisible();
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue(DAY);
  await page.getByLabel('Start date', { exact: true }).fill('2026-12-01');
  await expect(page.locator('.setup-card > p')).toContainText('January 29');
  await page.getByRole('button', { name: 'Start the challenge' }).click();
  await saved(page);
  const startDate = await page.evaluate(
    () => JSON.parse(localStorage.getItem('journal26-demo-v1')!).settings.startDate,
  );
  expect(startDate).toBe('2026-12-01');
});

test('browsing dates keeps focus on navigation instead of reopening the keyboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Write a little' }).click();
  await expect(page.getByLabel('Daily journal')).toBeFocused();
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(page.getByLabel('Selected date')).toHaveValue('2026-10-31');
  await expect(page.getByLabel('Daily journal')).not.toBeFocused();
  await expect(page.getByRole('button', { name: 'Previous day', exact: true })).toBeFocused();
});

test('writing and challenge navigation fit small screens and respect reduced motion', async ({
  page,
}, info) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.locator('.challenge-map summary').click();
  const day = page.getByRole('button', { name: /^Day 4,/ });
  const box = await day.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await day.click();
  await expect(day).toHaveAttribute('aria-pressed', 'true');
  const animation = await page.locator('.flower-head').evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
  await page.getByRole('button', { name: 'Keep writing' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  if (info.project.name === 'mobile') {
    const editor = await page.locator('.journal-layout > section').boundingBox();
    const history = await page.locator('.journal-index').boundingBox();
    expect(editor!.y).toBeLessThan(history!.y);
  }
});
