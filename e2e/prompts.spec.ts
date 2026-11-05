import { expect, test } from '@playwright/test';

test('another prompt changes the invitation but preserves the entry and daily rotation', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Write a little' }).click();
  const first = await page.locator('.prompt-question').innerText();
  await page.getByLabel('Daily journal').fill('Words I want to keep.');
  await page.getByRole('button', { name: 'Another prompt' }).click();
  await expect(page.locator('.prompt-question')).not.toHaveText(first);
  await expect(page.getByLabel('Daily journal')).toHaveValue('Words I want to keep.');
  await expect(page.getByLabel('Daily journal')).toBeFocused();
  await page.getByLabel('Selected date').fill('2026-11-05');
  const previous = await page.locator('.prompt-question').innerText();
  expect(previous).not.toBe(first);
  await page.getByLabel('Selected date').fill('2026-11-06');
  await expect(page.locator('.prompt-question')).toHaveText(first);
  await expect(page.getByLabel('Daily journal')).toHaveValue('Words I want to keep.');
});
