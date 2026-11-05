import { expect, test } from '@playwright/test';

test('focused writing keeps autosave and Escape returns the full journal', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Write a little' }).click();
  await page.getByRole('button', { name: 'Focus on writing' }).click();
  await expect(page.getByLabel('Daily journal')).toBeFocused();
  await expect(page.getByRole('complementary', { name: 'Journal history' })).toBeHidden();
  await expect(page.getByLabel('One win', { exact: true })).toBeHidden();
  await page.getByLabel('Daily journal').fill('A quieter page helped me begin.');
  await expect(page.locator('.save-status')).toContainText('Saved on this device');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Focus on writing' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByLabel('One win', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Journal history' })).toBeVisible();
  await expect(page.getByLabel('Daily journal')).toHaveValue('A quieter page helped me begin.');
});
