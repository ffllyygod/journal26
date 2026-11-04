import { expect, test, type Page } from '@playwright/test';

const MOCK = 'http://localhost:54399';
const synced = (page: Page) => expect(page.locator('.save-status')).toContainText('All changes saved');
const stored = async (page: Page) => (await page.request.get(`${MOCK}/__row`)).json();
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('me@example.com');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: /Open my journal/ }).click();
  await expect(page.locator('.setup-card, .day-loop').first()).toBeVisible();
  if (await page.locator('.setup-card').count()) {
    await page.getByRole('button', { name: 'Start the challenge' }).click();
    await synced(page);
  }
}
async function restart(page: Page) {
  await page.locator('.settings-nav').click();
  await page.getByText('Restart this challenge', { exact: true }).click();
  await page.getByLabel('New challenge starts').fill('2026-11-06');
  await page.getByLabel('Type RESTART to erase old records').fill('RESTART');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up and restart' }).click();
  await download;
  await synced(page);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('a stale device cannot merge erased records back into a restarted journal', async ({ browser }) => {
  const ca = await browser.newContext();
  const cb = await browser.newContext();
  const a = await ca.newPage();
  const b = await cb.newPage();
  try {
    await signIn(a);
    await a.getByRole('button', { name: 'Write a little' }).click();
    await a.getByLabel('Daily journal').fill('Old entry to erase.');
    await synced(a);
    await signIn(b);
    await b.getByRole('button', { name: 'Keep writing' }).click();
    await restart(a);
    await b.getByLabel('Daily journal').fill('A late edit from the old challenge.');
    await expect(b.locator('.save-alert')).toContainText('A challenge restart changed this journal');
    await b.getByRole('button', { name: 'Keep restarted version' }).click();
    await synced(b);
    const row = await stored(a);
    expect(row.document.days).toEqual({});
    expect(row.document.settings.startDate).toBe('2026-11-06');
    expect(row.document.resetId).toBeTruthy();
  } finally {
    await ca.close();
    await cb.close();
  }
});

test('a persisted old offline draft cannot restore erased entries after reload', async ({ browser }) => {
  const ca = await browser.newContext();
  const cb = await browser.newContext();
  const a = await ca.newPage();
  const b = await cb.newPage();
  try {
    await signIn(a);
    await signIn(b);
    await cb.route('**/rest/v1/workspaces**', route =>
      route.request().method() === 'PATCH' ? route.abort() : route.continue(),
    );
    await b.getByRole('button', { name: 'Write a little' }).click();
    await b.getByLabel('Daily journal').fill('Offline words from the old challenge.');
    await expect(b.locator('.save-alert')).toBeVisible();
    await restart(a);
    await cb.unroute('**/rest/v1/workspaces**');
    await b.reload();
    await synced(b);
    await expect(b.locator('.sync-notice')).toContainText('older device draft was not restored');
    expect((await stored(b)).document.days).toEqual({});
    expect(
      await b.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('journal26-draft'))),
    ).toEqual([]);
  } finally {
    await ca.close();
    await cb.close();
  }
});
