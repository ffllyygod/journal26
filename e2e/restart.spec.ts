import { expect, test } from '@playwright/test';

test('restart backs up records, keeps preferences, clears history and stops old timers', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
  await page.goto('/demo');
  await expect(page.locator('.day-loop')).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('journal26-demo-v1')!));
  await page.getByRole('button', { name: 'Start career session', exact: true }).click();
  await page.locator(info.project.name === 'mobile' ? '.mobile-settings' : '.settings-nav').click();
  await page.getByText('Restart this challenge', { exact: true }).click();
  await page.getByLabel('New challenge starts').fill('2026-11-06');
  const restart = page.getByRole('button', { name: 'Back up and restart' });
  await expect(restart).toBeDisabled();
  await page.getByLabel('Type RESTART to erase old records').fill('RESTART');
  const download = page.waitForEvent('download');
  await restart.click();
  const backup = await download;
  const stream = await backup.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString()).workspace.days).toEqual(before.days);
  await expect(page.locator('h1')).toContainText('Day 1 of 60');
  await expect(page.locator('.save-status')).toContainText('Saved on this device');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('journal26-demo-v1')!));
  expect(after.settings.startDate).toBe('2026-11-06');
  expect(after.settings.name).toBe(before.settings.name);
  expect(after.settings.habitLabels).toEqual(before.settings.habitLabels);
  for (const key of ['days', 'weeklyNotes', 'weeklyCommitments']) expect(after[key]).toEqual({});
  for (const key of ['trades', 'applications', 'learning', 'urges']) expect(after[key]).toEqual([]);
  expect(after.resetId).toBeTruthy();
  await page.reload();
  await expect(page.locator('.focus-live')).toHaveCount(0);
  await expect(page.locator('h1')).toContainText('Day 1 of 60');
  await expect(page.getByRole('button', { name: 'Write a little' })).toBeVisible();
});
