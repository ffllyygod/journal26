import { expect, test } from '@playwright/test';

test('preferences preview the last challenge day before saving without clearing entries', async ({
  page,
}, info) => {
  await page.goto('/demo');
  await expect(page.locator('.day-loop')).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('journal26-demo-v1')!).days);
  await page.locator(info.project.name === 'mobile' ? '.mobile-settings' : '.settings-nav').click();
  await page.getByLabel('Challenge starts', { exact: true }).fill('2026-11-06');
  await page.getByLabel('Challenge length (days)').fill('60');
  await expect(page.locator('.settings-form').getByRole('status')).toContainText('January 4, 2027');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.locator('.save-status')).toContainText('Saved on this device');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('journal26-demo-v1')!).days)).toEqual(
    before,
  );
});
