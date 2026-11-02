import { expect, test, type Page } from '@playwright/test';

// 01:00 in Kolkata is still the previous journal day with the default 03:00 boundary.
const NOW = new Date('2026-11-01T19:30:00Z');
const DAY = '2026-11-01';
const PREVIOUS = '2026-10-31';
const saved = (page: Page) => expect(page.locator('.save-status')).toContainText('Saved on this device');

async function openStep(page: Page, name: string) {
  const step = page.locator('.loop-step', { hasText: name });
  if ((await step.getAttribute('aria-expanded')) === 'false') await step.click();
}

async function imageFile(page: Page, name: string) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    canvas.getContext('2d')!.fillRect(0, 0, 10, 10);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name, mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
}

async function delayImageDecode(page: Page) {
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      const decodeThisImage = original.bind(this);
      return new Promise<void>((resolve, reject) => {
        Object.assign(window, {
          releaseImageDecode: async () => {
            HTMLImageElement.prototype.decode = original;
            try {
              await decodeThisImage();
              resolve();
            } catch (error) {
              reject(error);
            }
          },
        });
      });
    };
  });
}

async function releaseImageDecode(page: Page) {
  await page.evaluate(async () => {
    await (window as unknown as { releaseImageDecode: () => Promise<void> }).releaseImageDecode();
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto('/demo');
  await expect(page.locator('.day-loop')).toBeVisible();
});

test('a fresh 1am demo uses the journal day and shows its planned tasks', async ({ page }) => {
  await expect(page.getByLabel('Selected date')).toHaveValue(DAY);
  await expect(page.getByRole('button', { name: 'Complete: Ship one portfolio improvement' })).toBeVisible();
  const actual = await page.evaluate(
    key => JSON.parse(localStorage.getItem('journal26-demo-v1')!).days[key].tasks.length,
    DAY,
  );
  expect(actual).toBe(4);
});

test('editing a completed task then reopening it preserves unrelated focus time', async ({ page }) => {
  const minutes = () =>
    page.evaluate(key => JSON.parse(localStorage.getItem('journal26-demo-v1')!).days[key].careerMinutes, DAY);
  const initial = await minutes();
  await page.getByRole('button', { name: 'Complete: Ship one portfolio improvement' }).click();
  await saved(page);
  expect(await minutes()).toBe(initial + 90);
  await page.locator('.task-content', { hasText: 'Ship one portfolio improvement' }).click();
  await page.locator('dialog [name=minutes]').fill('120');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await saved(page);
  expect(await minutes()).toBe(initial + 120);
  await page.getByRole('button', { name: 'Mark incomplete: Ship one portfolio improvement' }).click();
  await saved(page);
  expect(await minutes()).toBe(initial);
});

test('an upload follows its original date without replacing the other dates images', async ({ page }) => {
  const priorImage = await imageFile(page, 'previous-day.png');
  await page.getByLabel('Selected date').fill(PREVIOUS);
  await openStep(page, 'Journal');
  await page.locator('.journal-panel input[type=file]').setInputFiles(priorImage);
  await expect(page.locator('.journal-panel img[alt="previous-day.png"]')).toBeVisible();
  await saved(page);

  await page.getByLabel('Selected date').fill(DAY);
  await openStep(page, 'Journal');
  const currentImage = await imageFile(page, 'original-day.png');
  await delayImageDecode(page);
  await page.locator('.journal-panel input[type=file]').setInputFiles(currentImage);
  await expect(page.getByRole('button', { name: 'Uploading image…' })).toBeVisible();
  await page.getByLabel('Selected date').fill(PREVIOUS);
  await openStep(page, 'Journal');
  await releaseImageDecode(page);

  await expect
    .poll(() =>
      page.evaluate(
        key =>
          JSON.parse(localStorage.getItem('journal26-demo-v1')!).days[key].attachments.map(
            (a: { name: string }) => a.name,
          ),
        DAY,
      ),
    )
    .toEqual(['original-day.png']);
  const previousAttachments = await page.evaluate(
    key =>
      JSON.parse(localStorage.getItem('journal26-demo-v1')!).days[key].attachments.map(
        (a: { name: string }) => a.name,
      ),
    PREVIOUS,
  );
  expect(previousAttachments).toEqual(['previous-day.png']);
  await expect(page.locator('.journal-panel img[alt="previous-day.png"]')).toBeVisible();
  await page.getByLabel('Selected date').fill(DAY);
  await openStep(page, 'Journal');
  await expect(page.locator('.journal-panel img[alt="original-day.png"]')).toBeVisible();
});

test('trade uploads block submission and Escape until the image has been attached', async ({ page }) => {
  await openStep(page, 'Trades');
  await page.getByRole('button', { name: 'Log a trade', exact: true }).click();
  const dialog = page.locator('dialog');
  await dialog.locator('[name=entry]').fill('2700');
  const file = await imageFile(page, 'trade-chart.png');
  await delayImageDecode(page);
  await dialog.locator('input[type=file]').setInputFiles(file);
  await expect(dialog.locator('button[type=submit]')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('Wait for the image upload');
  await releaseImageDecode(page);
  await expect(dialog.locator('img[alt="trade-chart.png"]')).toBeVisible();
  await expect(dialog.locator('button[type=submit]')).toBeEnabled();
  await dialog.getByRole('button', { name: 'Save trade', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await saved(page);
  const trade = await page.evaluate(
    key =>
      JSON.parse(localStorage.getItem('journal26-demo-v1')!).trades.find(
        (t: { date: string }) => t.date === key,
      ),
    DAY,
  );
  expect(trade.attachments).toHaveLength(1);
  expect(trade.attachments[0].name).toBe('trade-chart.png');
});

test('a documented open position completes the daily trade step without closing it', async ({ page }) => {
  const step = page.locator('.loop-step', { hasText: 'Trades' });
  await expect(step).not.toHaveClass(/loop-done/);
  await openStep(page, 'Trades');
  await page.locator('.day-trade', { hasText: 'BTC' }).click();
  const dialog = page.locator('dialog');
  await dialog
    .locator('[name=thesis]')
    .fill('Holding overnight while the planned invalidation remains intact.');
  await dialog.locator('[name=followedPlan]').selectOption('yes');
  await dialog.getByRole('button', { name: 'Save trade', exact: true }).click();
  await expect(step).toHaveClass(/loop-done/);
  await saved(page);
  const trade = await page.evaluate(
    key =>
      JSON.parse(localStorage.getItem('journal26-demo-v1')!).trades.find(
        (t: { date: string }) => t.date === key,
      ),
    DAY,
  );
  expect(trade.status).toBe('open');
  expect(trade.netPnl).toBeNull();
});
