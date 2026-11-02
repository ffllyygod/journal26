import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const MOCK = 'http://localhost:54399';
const row = async (page: Page) => (await page.request.get(`${MOCK}/__row`)).json();
const synced = (page: Page) => expect(page.locator('.save-status')).toContainText('All changes saved');
/** The journal step opens only when it is next, so open it before touching it. */
async function openStep(page: Page, name: string) {
  const step = page.locator('.loop-step', { hasText: name });
  if ((await step.getAttribute('aria-expanded')) === 'false') await step.click();
}
async function journal(page: Page) {
  await openStep(page, 'Journal');
  return page.getByLabel('Daily journal');
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('me@example.com');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: /Open my journal/ }).click();
  await expect(page).toHaveURL(/\/journal$/);
  // Only the first sign-in on an empty journal sees setup.
  await expect(page.locator('.day-loop, .setup-card').first()).toBeVisible();
  if (await page.locator('.setup-card').count()) {
    await page.getByRole('button', { name: 'Start the challenge' }).click();
    await synced(page);
  }
  await expect(page.locator('.day-loop')).toBeVisible();
}
/** Two tabs of one signed-in browser: both start from the same revision. */
async function twoDevices(context: BrowserContext) {
  const a = await context.newPage();
  await signIn(a);
  const b = await context.newPage();
  await b.goto('/journal');
  await expect(b.locator('.day-loop')).toBeVisible();
  return { a, b };
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('an anonymous visitor cannot reach the journal, and a wrong password stays out', async ({ page }) => {
  await page.goto('/journal');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email address').fill('me@example.com');
  await page.getByLabel('Password').fill('wrong password');
  await page.getByRole('button', { name: /Open my journal/ }).click();
  await expect(page.locator('.form-error')).toContainText('Invalid login credentials');
  await expect(page).toHaveURL(/\/login$/);
});

test('the demo is not reachable once the private journal is connected', async ({ page }) => {
  await page.goto('/demo');
  await expect(page).not.toHaveURL(/\/demo$/);
});

test('entries save to the cloud and return after reload', async ({ page }) => {
  await signIn(page);
  await (await journal(page)).fill('First real entry.');
  await synced(page);
  expect((await row(page)).revision).toBeGreaterThan(0);
  await page.reload();
  await expect(await journal(page)).toHaveValue('First real entry.');
});

test('edits to different fields on two devices merge with no prompt', async ({ context }) => {
  const { a, b } = await twoDevices(context);
  await (await journal(b)).fill('Written on the phone.');
  await synced(b);
  await a.getByLabel('Priority 1').fill('Set on the laptop');
  await synced(a);
  await expect(a.locator('.save-alert')).toHaveCount(0);
  const stored = (await row(a)).document;
  const day = Object.values<{ journal: string; priorities: string[] }>(stored.days)[0];
  expect(day.journal).toBe('Written on the phone.');
  expect(day.priorities[0]).toBe('Set on the laptop');
  await expect(await journal(a)).toHaveValue('Written on the phone.');
});

test('planning tomorrow on one device and journaling on another does not prompt', async ({ context }) => {
  const { a, b } = await twoDevices(context);
  await openStep(b, 'Tomorrow');
  await b.getByRole('button', { name: 'Plan tomorrow', exact: true }).click();
  await b.getByLabel('Priority 1').fill('Planned on the laptop');
  await synced(b);
  await (await journal(a)).fill('Journaled on the phone.');
  await synced(a);
  await expect(a.locator('.save-alert')).toHaveCount(0);
  const days = Object.values<{ journal: string; priorities: string[] }>((await row(a)).document.days);
  expect(days.some(day => day.journal === 'Journaled on the phone.')).toBe(true);
  expect(days.some(day => day.priorities[0] === 'Planned on the laptop')).toBe(true);
});

test('first sign-in sets up the challenge, and it is not asked again', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('me@example.com');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: /Open my journal/ }).click();
  await page.getByLabel('Your name').fill('Sam');
  await page.getByLabel('First habit to quit').fill('First habit');
  await page.getByRole('button', { name: 'Start the challenge' }).click();
  await expect(page.locator('h1')).toContainText('Day 1 of 60');
  await synced(page);
  await page.reload();
  await expect(page.locator('.day-loop')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First habit' })).toBeVisible();
  expect((await row(page)).document.settings.name).toBe('Sam');
});

test('the same field on two devices asks, and keeping this device wins without losing the rest', async ({
  context,
}) => {
  const { a, b } = await twoDevices(context);
  await (await journal(b)).fill('Phone words.');
  await b.getByLabel('Priority 2').fill('Phone priority');
  await synced(b);
  await (await journal(a)).fill('Laptop words.');
  await expect(a.locator('.save-alert')).toContainText('Two devices changed the same thing');
  await expect(a.locator('.conflict-list')).toContainText('journal');
  await a.getByRole('button', { name: /Keep this device/ }).click();
  await synced(a);
  const day = Object.values<{ journal: string; priorities: string[] }>((await row(a)).document.days)[0];
  expect(day.journal).toBe('Laptop words.');
  expect(day.priorities[1]).toBe('Phone priority');
});

test('returning to a stale tab pulls the latest automatically', async ({ context }) => {
  const { a, b } = await twoDevices(context);
  await (await journal(b)).fill('Fresh from the other device.');
  await synced(b);
  await a.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(await journal(a)).toHaveValue('Fresh from the other device.');
});

test('offline edits retry, and survive the tab being closed', async ({ context }) => {
  const page = await context.newPage();
  await signIn(page);
  await context.route('**/rest/v1/workspaces**', route =>
    route.request().method() === 'PATCH' ? route.abort() : route.continue(),
  );
  await (await journal(page)).fill('Typed with no signal.');
  await expect(page.locator('.save-alert')).toContainText('kept on this device');
  await page.close();
  await context.unroute('**/rest/v1/workspaces**');

  const reopened = await context.newPage();
  await reopened.goto('/journal');
  await expect(await journal(reopened)).toHaveValue('Typed with no signal.');
  await synced(reopened);
  const day = Object.values<{ journal: string }>((await row(reopened)).document.days)[0];
  expect(day.journal).toBe('Typed with no signal.');
});

test('a dropped connection recovers by itself when it returns', async ({ context }) => {
  const page = await context.newPage();
  await signIn(page);
  await context.route('**/rest/v1/workspaces**', route =>
    route.request().method() === 'PATCH' ? route.abort() : route.continue(),
  );
  await (await journal(page)).fill('Patchy network.');
  await expect(page.locator('.save-alert')).toBeVisible();
  await context.unroute('**/rest/v1/workspaces**');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await synced(page);
  await expect(page.locator('.save-alert')).toHaveCount(0);
});

test('signing out removes access and the local draft', async ({ page }) => {
  await signIn(page);
  await (await journal(page)).fill('Private.');
  await synced(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const leftovers = await page.evaluate(() =>
    Object.keys(localStorage).filter(key => key.startsWith('journal26-draft')),
  );
  expect(leftovers).toEqual([]);
  await page.goto('/journal');
  await expect(page).toHaveURL(/\/login$/);
});
