import { expect, test, type Page } from '@playwright/test';

const dayKey = () => {
  const now = new Date(Date.now() - 3 * 3600000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
};
const saved = (page: Page) => expect(page.locator('.save-status')).toContainText('Saved on this device');
const openTrades = async (page: Page, mobile: boolean) => {
  if (mobile) await page.locator('.mobile-nav button', { hasText: 'Trades' }).click();
  else await page.locator('.sidebar button', { hasText: 'Trade journal' }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/demo');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.day-loop')).toBeVisible();
});

test('no page scrolls sideways on any view', async ({ page }, info) => {
  const nav = info.project.name === 'mobile' ? '.mobile-nav button' : '.sidebar nav button';
  for (let i = 0; i < (await page.locator(nav).count()); i++) {
    await page.locator(nav).nth(i).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `view ${i}`).toBeLessThanOrEqual(0);
  }
});

test('habit check-in and journal text survive a reload', async ({ page }) => {
  await page
    .getByRole('group', { name: 'Smoke-free check-in' })
    .getByRole('button', { name: 'Kept it' })
    .click();
  await page.getByLabel('Daily journal').fill('Stayed with the plan.');
  await saved(page);
  await page.reload();
  await expect(page.getByLabel('Daily journal')).toHaveValue('Stayed with the plan.');
  await expect(
    page.getByRole('group', { name: 'Smoke-free check-in' }).getByRole('button', { name: 'Kept it' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('finishing a task credits focus time, and un-finishing removes it', async ({ page }) => {
  const stored = async () =>
    page.evaluate(
      key => JSON.parse(localStorage.getItem('journal26-demo-v1')!).days[key].careerMinutes,
      dayKey(),
    );
  const before = await stored();
  await page.getByRole('button', { name: 'Complete: Ship one portfolio improvement' }).click();
  await saved(page);
  expect(await stored()).toBe(before + 90);
  await page.getByRole('button', { name: 'Mark incomplete: Ship one portfolio improvement' }).click();
  await saved(page);
  expect(await stored()).toBe(before);
});

test('plan tomorrow: unfinished work carries over', async ({ page }) => {
  await page.getByRole('button', { name: 'Plan tomorrow', exact: true }).click();
  await expect(page.locator('.planning-banner')).toBeVisible();
  await page.getByRole('button', { name: /Bring over 3 unfinished/ }).click();
  await expect(page.getByText('Send two thoughtful job applications')).toBeVisible();
  await page.getByLabel('Priority 1').fill('Finish the portfolio');
  await saved(page);
  await page.getByRole('button', { name: 'Back to today' }).click();
  await expect(page.locator('.loop-step', { hasText: 'Tomorrow' })).toHaveClass(/loop-done/);
});

test('a trade flows from open to reviewed and updates analytics', async ({ page }, info) => {
  await openTrades(page, info.project.name === 'mobile');
  await page.getByRole('button', { name: 'Log a trade' }).click();
  const form = page.locator('dialog');
  await form.locator('[name=symbol]').fill('xagusd');
  await form.locator('[name=entry]').fill('100');
  await form.locator('[name=stop]').fill('105');
  await form.locator('[name=target]').fill('110');
  await form.getByRole('button', { name: 'Save trade' }).click();
  await expect(form.getByRole('alert')).toContainText('stop belongs below');
  await form.locator('[name=stop]').fill('95');
  await expect(form).toContainText('1 : 2.00');
  await form.getByRole('button', { name: 'Save trade' }).click();
  await expect(page.locator('.trade-card', { hasText: 'XAGUSD' })).toContainText('Open');

  await page.locator('.trade-card', { hasText: 'XAGUSD' }).locator('.trade-card-main').click();
  await form.getByRole('combobox', { name: 'Status' }).selectOption('closed');
  await form.locator('[name=netPnl]').fill('50');
  await form.locator('[name=followedPlan]').selectOption('yes');
  await form.locator('[name=review]').fill('Patient entry.');
  await form.getByRole('button', { name: 'Chased entry' }).click();
  await form.getByRole('button', { name: 'Save trade' }).click();
  await expect(page.locator('.trade-card', { hasText: 'XAGUSD' })).toContainText('Reviewed');
  await page.getByRole('button', { name: 'Mistakes', exact: true }).click();
  await expect(page.locator('.compact-table')).toContainText('Chased entry');
});

test('a craving logs an outcome, and a slip marks the day honestly', async ({ page }) => {
  await page.locator('.urge-fab').click();
  await expect(page.getByRole('timer')).toContainText(/4:5\d|5:00/);
  await page.getByRole('button', { name: 'Late night' }).click();
  await page.getByRole('button', { name: 'I slipped' }).click();
  await expect(
    page.getByRole('group', { name: 'Smoke-free check-in' }).getByRole('button', { name: 'Had a slip' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await saved(page);
  const urges = await page.evaluate(() => JSON.parse(localStorage.getItem('journal26-demo-v1')!).urges);
  expect(urges[0]).toMatchObject({ trigger: 'Late night', outcome: 'slipped', habit: 'smoking' });
});

test('renaming a habit shows everywhere, and a backup restores', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile';
  await page.locator(mobile ? '.mobile-settings' : '.settings-nav').click();
  await page.locator('[name=labelAbstinence]').fill('Custom habit');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Preferences updated')).toBeVisible();
  await saved(page);

  const backup = {
    workspace: JSON.parse(await page.evaluate(() => localStorage.getItem('journal26-demo-v1')!)),
  };
  backup.workspace.settings.name = 'Restored name';
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.restore-button input').setInputFiles({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole('status').filter({ hasText: 'Restored 9 days' })).toBeVisible();
  await saved(page);
  await page.reload();
  await expect(page.locator('h1')).toContainText('Restored name');
  await expect(page.getByRole('heading', { name: 'Custom habit' })).toBeVisible();
});

test('a bad backup file changes nothing', async ({ page }, info) => {
  await page.locator(info.project.name === 'mobile' ? '.mobile-settings' : '.settings-nav').click();
  await page
    .locator('.restore-button input')
    .setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
  await expect(page.getByText('not a Journal26 JSON backup')).toBeVisible();
});

test('the reminder file downloads', async ({ page }, info) => {
  await page.locator(info.project.name === 'mobile' ? '.mobile-settings' : '.settings-nav').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add reminders to calendar' }).click();
  expect((await download).suggestedFilename()).toBe('journal26-reminders.ics');
});
