import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function capturePageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

function captureActionableWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'warning') return;
    const text = message.text();
    if (
      /GPU stall due to ReadPixels/i.test(text) ||
      /Automatic fallback to software WebGL/i.test(text) ||
      /Program Info Log:.*warning X(?:3595|4008|4122)/is.test(text)
    ) {
      return;
    }
    warnings.push(text);
  });
  return warnings;
}

async function openReadyApp(page: Page) {
  await page.goto('/');
  await expect(page).toHaveTitle('Ascent | Gradient Descent, Made Visible');
  await expect(page.getByRole('heading', { name: 'Find the lowest point.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Advance one iteration' })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.locator('.scene-layer canvas')).toBeVisible({ timeout: 30_000 });
}

async function expectHudRegionsSeparated(page: Page) {
  const regions = ['.concept-panel', '.control-panel', '.transport'] as const;
  const boxes = await Promise.all(
    regions.map(async (selector) => ({
      selector,
      box: await page.locator(selector).boundingBox(),
    })),
  );
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  for (const { selector, box } of boxes) {
    expect(box, `${selector} should have a rendered box`).not.toBeNull();
    expect(box!.x, `${selector} should stay within the left edge`).toBeGreaterThanOrEqual(0);
    expect(box!.y, `${selector} should stay within the top edge`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${selector} should stay within the right edge`)
      .toBeLessThanOrEqual(viewport!.width + 0.5);
    expect(box!.y + box!.height, `${selector} should stay within the bottom edge`)
      .toBeLessThanOrEqual(viewport!.height + 0.5);
  }

  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      const a = boxes[first];
      const b = boxes[second];
      const overlaps = (
        a.box!.x < b.box!.x + b.box!.width &&
        a.box!.x + a.box!.width > b.box!.x &&
        a.box!.y < b.box!.y + b.box!.height &&
        a.box!.y + a.box!.height > b.box!.y
      );
      expect(overlaps, `${a.selector} must not overlap ${b.selector}`).toBe(false);
    }
  }
}

async function expectNewLossRun(page: Page, previousRunId: number): Promise<number> {
  const summary = page.locator('#loss-history-summary');
  await expect.poll(async () => Number(await summary.getAttribute('data-run-id')))
    .toBeGreaterThan(previousRunId);
  return Number(await summary.getAttribute('data-run-id'));
}

async function expectLabelInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

test('loads the lesson and advances one optimizer iteration', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openReadyApp(page);
  await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();

  const iteration = page.locator('.metrics-grid output').nth(3);
  await expect(iteration).toHaveText('0');
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await expect(iteration).toHaveText('1');
  expect(errors).toEqual([]);
});

test('opens the privacy policy directly and returns to the lab', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/privacy');

  await expect(page).toHaveTitle('Privacy Policy | ASCENT');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Privacy policy' }),
  ).toBeVisible();
  await expect(page.getByText(/ASCENT sets no cookies/))
    .toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Analytics and performance data' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Information processed' }))
    .toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375);

  if (browserName === 'chromium') {
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(blocking).toEqual([]);
  }

  await page.getByRole('link', { name: 'Back to lab' }).click();
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', { name: 'Find the lowest point.' }),
  ).toBeVisible();
});

test('explains the gradient descent formula', async ({ page }) => {
  await openReadyApp(page);

  const trigger = page.getByRole('button', {
    name: 'Explain Gradient descent formula',
  });
  await trigger.click();

  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Theta at t is the current position');
  await expect(tooltip).toContainText('eta is the learning rate or step size');
  await expect(tooltip).toContainText(
    'Subtracting that slope moves the point downhill',
  );

  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 812, height: 375 },
]) {
  test(`keeps HUD regions separate at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openReadyApp(page);
    await expectHudRegionsSeparated(page);
    await expect(page.locator('.scene-label-current')).toBeHidden();
    if (viewport.width <= 460 || viewport.height <= 500) {
      await expect(page.locator('.scene-label-goal')).toBeHidden();
    }

    await page.getByLabel('Landscape', { exact: true }).selectOption('saddle');
    await expect(page.getByRole('heading', { name: 'See why saddles are tricky.' }))
      .toBeVisible();
    await page.getByRole('button', { name: 'Advance one iteration' }).click();
    await expect(page.locator('.metrics-grid output').nth(3)).toHaveText('1');
    await expectHudRegionsSeparated(page);

    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);
  });
}

test('shows a recoverable state when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).startsWith('webgl')) return null;
      return original.call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('3D visualization unavailable');
  await expect(page.locator('.primary-action')).toBeDisabled();
  await expect(page.locator('.run-status')).toHaveText('Unavailable');
});

test('retains negative Saddle costs in the loss history', async ({ page }) => {
  await openReadyApp(page);
  await page.getByLabel('Landscape', { exact: true }).selectOption('saddle');
  const step = page.getByRole('button', { name: 'Advance one iteration' });
  await step.click();
  await step.click();

  await expect(page.locator('#loss-history-summary')).toContainText('-');
  await expect(page.locator('.chart-scale')).toHaveText('symlog scale');
});

test('refreshes accessible loss history for every run reset at iteration zero', async ({
  page,
}) => {
  await openReadyApp(page);
  const summary = page.locator('#loss-history-summary');
  await expect(summary).toContainText('Starting cost 18.500 at iteration 0.');
  let runId = Number(await summary.getAttribute('data-run-id'));

  await page.getByLabel('Landscape', { exact: true }).selectOption('matyas');
  runId = await expectNewLossRun(page, runId);
  await expect(summary).toContainText('Starting cost');
  await expect(summary).not.toContainText('18.500');

  await page.getByLabel('Optimizer', { exact: true }).selectOption('adam');
  runId = await expectNewLossRun(page, runId);

  const learningRate = page.getByLabel('Learning rate', { exact: true });
  await learningRate.focus();
  await learningRate.press('ArrowLeft');
  runId = await expectNewLossRun(page, runId);

  await page.getByRole('button', { name: 'Restart optimization' }).click();
  await expectNewLossRun(page, runId);
  await expect(summary).toContainText('at iteration 0.');
});

test('keeps keyboard shortcuts scoped away from interactive controls', async ({ page }) => {
  await openReadyApp(page);
  const primary = page.locator('.primary-action');
  const iteration = page.locator('.metrics-grid output').nth(3);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Space');
  await expect(primary).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(primary).toHaveAttribute('aria-pressed', 'false');

  const beforeStep = Number(await iteration.textContent());
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await expect(iteration).toHaveText(String(beforeStep + 1));
  await page.getByLabel('Learning rate', { exact: true }).focus();
  await page.keyboard.press('r');
  await expect(iteration).toHaveText(String(beforeStep + 1));

  const restart = page.getByRole('button', { name: 'Restart optimization' });
  await restart.focus();
  await page.keyboard.press('Space');
  await expect(iteration).toHaveText('0');
});

test('prioritizes scene labels through initial, descent, and converged states', async ({
  page,
}) => {
  await openReadyApp(page);
  const current = page.locator('.scene-label-current');
  const goal = page.locator('.scene-label-goal');
  await expect(current).toBeVisible();
  await expect(goal).toBeVisible();
  await expectLabelInsideViewport(page, '.scene-label-current');
  await expectLabelInsideViewport(page, '.scene-label-goal');

  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await expect(page.locator('.metrics-grid output').nth(3)).toHaveText('1');
  await expectLabelInsideViewport(page, '.scene-label-current');
  await expectLabelInsideViewport(page, '.scene-label-goal');

  await page.getByLabel('Optimizer', { exact: true }).selectOption('newton');
  await expect(page.locator('.metrics-grid output').nth(3)).toHaveText('0');
  await page.getByRole('button', { name: 'Advance one iteration' })
    .dispatchEvent('click');
  await expect(page.locator('.primary-action')).toContainText('Minimum reached', {
    timeout: 10_000,
  });
  await expect(current).toBeHidden();
  await expect(goal).toBeVisible();
  await expectLabelInsideViewport(page, '.scene-label-goal');
});

test('emits no actionable browser console warnings', async ({ page }) => {
  const warnings = captureActionableWarnings(page);
  await openReadyApp(page);
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await expect(page.locator('.metrics-grid output').nth(3)).toHaveText('1');
  await page.waitForTimeout(500);
  expect(warnings).toEqual([]);
});

test('has no serious or critical automated accessibility violations', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'One axe pass is sufficient; interactions run in both engines.');
  await openReadyApp(page);

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking).toEqual([]);
});
