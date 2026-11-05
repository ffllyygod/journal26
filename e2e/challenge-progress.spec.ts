import { expect, test } from '@playwright/test';

test('a restarted challenge has no missed days before its start and earns a first reflection', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
  await page.goto('/demo');
  await expect(page.locator('.day-loop')).toBeVisible();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('journal26-demo-v1')!);
    data.settings.startDate = '2026-11-06';
    data.days = {};
    localStorage.setItem('journal26-demo-v1', JSON.stringify(data));
  });
  await page.reload();
  await expect(page.locator('.trail-heading')).toContainText('0 writing days');
  await expect(page.locator('.trail-days button:disabled')).toHaveCount(6);
  await page.getByRole('button', { name: 'Write a little' }).click();
  await page.getByLabel('Daily journal').fill('Starting again, with one honest line.');
  await expect(page.locator('.save-status')).toContainText('Saved on this device');
  await page.reload();
  await expect(page.locator('.trail-heading')).toContainText('1 writing day');
  await expect(page.locator('.writing-milestone')).toContainText('Your first reflection');
});
