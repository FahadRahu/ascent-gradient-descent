import { expect, test, type Locator, type Page } from '@playwright/test';
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

async function openReadyApp(
  page: Page,
  { lowGraphics = false }: { lowGraphics?: boolean } = {},
) {
  if (lowGraphics) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'deviceMemory', {
        configurable: true,
        value: 2,
      });
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        configurable: true,
        value: 2,
      });
    });
  }

  await page.goto('/');
  await expect(page).toHaveTitle('Ascent | Gradient Descent, Made Visible');
  await expect(page.getByRole('link', { name: 'Ascent home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Advance one iteration' })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.locator('.scene-layer canvas')).toBeVisible({ timeout: 30_000 });
}

async function expectDesktopHudRegionsSeparated(page: Page) {
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

async function expectResponsiveRegionsSeparated(page: Page) {
  const selectors = [
    '.scene-layer',
    '.mobile-control-region',
    '.responsive-tabs',
    '.transport',
    '.scene-layer canvas',
  ] as const;
  const [scene, controls, tabs, transport, canvas] = await Promise.all(
    selectors.map((selector) => page.locator(selector).boundingBox()),
  );
  const viewport = page.viewportSize();

  expect(viewport).not.toBeNull();
  for (const [index, box] of [scene, controls, tabs, transport, canvas].entries()) {
    expect(box, `${selectors[index]} should have a rendered box`).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 0.5);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 0.5);
  }

  const sceneOverlapsControls = (
    scene!.x < controls!.x + controls!.width &&
    scene!.x + scene!.width > controls!.x &&
    scene!.y < controls!.y + controls!.height &&
    scene!.y + scene!.height > controls!.y
  );
  expect(sceneOverlapsControls, 'scene and mobile controls must not overlap').toBe(false);

  for (const [name, box] of [['tabs', tabs], ['transport', transport]] as const) {
    expect(box!.x, `${name} should stay inside the control region`).toBeGreaterThanOrEqual(controls!.x);
    expect(box!.y, `${name} should stay inside the control region`).toBeGreaterThanOrEqual(controls!.y);
    expect(box!.x + box!.width).toBeLessThanOrEqual(controls!.x + controls!.width + 0.5);
    expect(box!.y + box!.height).toBeLessThanOrEqual(controls!.y + controls!.height + 0.5);
  }

  expect(canvas!.x).toBeGreaterThanOrEqual(scene!.x - 0.5);
  expect(canvas!.y).toBeGreaterThanOrEqual(scene!.y - 0.5);
  expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(scene!.x + scene!.width + 0.5);
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(scene!.y + scene!.height + 0.5);
  expect(canvas!.width).toBeGreaterThanOrEqual(scene!.width - 1);
  expect(canvas!.height).toBeGreaterThanOrEqual(scene!.height - 1);
}

async function expectMobileLearnContent(page: Page) {
  const learnPanel = page.getByRole('tabpanel', { name: 'Learn' });
  const teachingSections = [
    page.locator('.cost-definition'),
    page.locator('.height-cost-cue'),
    page.locator('.core-formula'),
    page.locator('.learning-loop'),
    page.locator('.scene-legend'),
  ];

  await expect(learnPanel).toBeVisible();
  for (const section of teachingSections) {
    await expect(section).toBeVisible();
  }

  const hasHorizontalOverflow = await learnPanel.evaluate((panel) =>
    panel.scrollWidth > panel.clientWidth + 1
  );
  expect(hasHorizontalOverflow, 'Learn content must not overflow horizontally').toBe(false);

  const finalLegendCopy = page.getByText(
    'The amber rings mark a stationary point, not a minimum.',
  );
  await finalLegendCopy.scrollIntoViewIfNeeded();
  await expect(finalLegendCopy).toBeInViewport();

  const [panelBox, finalCopyBox, transportBox] = await Promise.all([
    learnPanel.boundingBox(),
    finalLegendCopy.boundingBox(),
    page.getByRole('group', { name: 'Simulation controls' }).boundingBox(),
  ]);
  expect(panelBox).not.toBeNull();
  expect(finalCopyBox).not.toBeNull();
  expect(transportBox).not.toBeNull();
  expect(finalCopyBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
  expect(finalCopyBox!.x + finalCopyBox!.width)
    .toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 0.5);
  expect(finalCopyBox!.y).toBeGreaterThanOrEqual(panelBox!.y);
  expect(finalCopyBox!.y + finalCopyBox!.height)
    .toBeLessThanOrEqual(transportBox!.y + 0.5);
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

async function expectLocatorInsideViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 0.5);
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
  await expect(page.getByRole('link', { name: 'Ascent home' })).toBeVisible();
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

test('preserves the floating desktop HUD architecture', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReadyApp(page);

  await expect(page.getByRole('heading', { name: 'Find the lowest point.' })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expectDesktopHudRegionsSeparated(page);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 812, height: 375 },
]) {
  test(`separates scene and tabbed controls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openReadyApp(page);

    const tablist = page.getByRole('tablist', { name: 'Lab controls' });
    const setupTab = page.getByRole('tab', { name: 'Setup' });
    const signalTab = page.getByRole('tab', { name: 'Signal' });
    const playbackTab = page.getByRole('tab', { name: 'Playback' });
    const learnTab = page.getByRole('tab', { name: 'Learn' });
    const transport = page.getByRole('group', { name: 'Simulation controls' });

    await expect(tablist).toBeVisible();
    await expect(setupTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Setup' })).toBeVisible();
    await expect(transport).toBeVisible();
    await expectResponsiveRegionsSeparated(page);
    await expect(page.locator('.scene-label-current')).toBeHidden();
    if (viewport.width <= 460 || viewport.height <= 500) {
      await expect(page.locator('.scene-label-goal')).toBeHidden();
    }

    await page.getByLabel('Landscape', { exact: true }).selectOption('saddle');
    const learningRate = page.getByLabel('Learning rate', { exact: true });
    await learningRate.scrollIntoViewIfNeeded();
    await expect(learningRate).toBeVisible();
    const learningRateBox = await learningRate.boundingBox();
    const transportBox = await transport.boundingBox();
    expect(learningRateBox).not.toBeNull();
    expect(transportBox).not.toBeNull();
    expect(learningRateBox!.y + learningRateBox!.height)
      .toBeLessThanOrEqual(transportBox!.y);

    await learnTab.click();
    await expect(page.getByRole('heading', { name: 'See why saddles are tricky.' }))
      .toBeVisible();
    await expectMobileLearnContent(page);
    await expect(transport).toBeVisible();

    await page.getByRole('button', { name: 'Advance one iteration' }).click();
    await signalTab.click();
    await expect(page.locator('.metrics-grid output').nth(3)).toHaveText('1');
    await expect(page.getByRole('tabpanel', { name: 'Signal' })).toBeVisible();

    await playbackTab.click();
    await expect(page.getByRole('tabpanel', { name: 'Playback' })).toBeVisible();
    await expect(page.locator('.loss-chart')).toBeVisible();
    await expect(transport).toBeVisible();
    await expectResponsiveRegionsSeparated(page);

    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);
  });
}

test('explains the gradient descent formula from the mobile Learn tab', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openReadyApp(page);
  await page.getByRole('tab', { name: 'Learn' }).click();

  const trigger = page.getByRole('button', {
    name: 'Explain Gradient descent formula',
  });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Theta at t is the current position');
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375);
});

test('supports keyboard navigation across responsive tabs', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openReadyApp(page);

  const setupTab = page.getByRole('tab', { name: 'Setup' });
  const signalTab = page.getByRole('tab', { name: 'Signal' });
  const learnTab = page.getByRole('tab', { name: 'Learn' });

  await setupTab.focus();
  await setupTab.press('ArrowRight');
  await expect(signalTab).toBeFocused();
  await expect(signalTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Signal' })).toBeVisible();

  await signalTab.press('End');
  await expect(learnTab).toBeFocused();
  await expect(learnTab).toHaveAttribute('aria-selected', 'true');

  await learnTab.press('Home');
  await expect(setupTab).toBeFocused();
  await expect(setupTab).toHaveAttribute('aria-selected', 'true');
});

test('runs the opt-in guided tour with keyboard control and focus restoration', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReadyApp(page);

  const trigger = page.getByRole('button', { name: 'Guided run' });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

  await trigger.click();
  await expect(dialog).toHaveAccessibleName('Choose a landscape');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  const landscapeTarget = page.locator('[data-tour="landscape"]');
  await expect(landscapeTarget).toHaveClass(/driver-active-element/);
  await expect(landscapeTarget).not.toHaveAttribute('aria-expanded');
  await expectLocatorInsideViewport(page, dialog);

  const tourButtons = dialog.getByRole('button');
  await expect(tourButtons).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const box = await tourButtons.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  if (browserName === 'chromium') {
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(blocking).toEqual([]);
  }

  await page.keyboard.press('ArrowRight');
  await expect(dialog).toHaveAccessibleName('Choose an optimizer');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog).toHaveAccessibleName('Set the learning rate');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog).toHaveAccessibleName('Run the experiment');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog).toHaveAccessibleName('Review retained history');
  await expect(page.locator('[data-tour="scrubber"]'))
    .toHaveClass(/driver-active-element/);

  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
});

for (const viewport of [
  { width: 375, height: 667 },
  { width: 812, height: 375 },
]) {
  test(`keeps the guided tour bounded and tab-aware at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    if (viewport.width === 375) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }
    await openReadyApp(page);

    const trigger = page.getByRole('button', { name: 'Guided run' });
    const dialog = page.getByRole('dialog');
    const setupTab = page.getByRole('tab', { name: 'Setup' });
    const playbackTab = page.getByRole('tab', { name: 'Playback' });

    await trigger.click();
    await expect(dialog).toHaveAccessibleName('Choose a landscape');
    if (viewport.width === 375) {
      await expect(page.locator('body')).toHaveClass(/driver-simple/);
      await expect(page.locator('body')).not.toHaveClass(/driver-fade/);
    }

    for (const name of [
      'Choose an optimizer',
      'Set the learning rate',
      'Run the experiment',
    ]) {
      await dialog.getByRole('button', { name: 'Next' }).click();
      await expect(dialog).toHaveAccessibleName(name);
    }

    await expect(page.locator('[data-tour="transport"]'))
      .toHaveClass(/driver-active-element/);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(playbackTab).toHaveAttribute('aria-selected', 'true');
    await expect(dialog).toHaveAccessibleName('Review retained history');
    const scrubber = page.locator('[data-tour="scrubber"]');
    await expect(scrubber).toHaveClass(/driver-active-element/);
    await expectLocatorInsideViewport(page, scrubber);
    await expectLocatorInsideViewport(page, dialog);

    const visibleButtons = dialog.getByRole('button');
    for (let index = 0; index < await visibleButtons.count(); index += 1) {
      const box = await visibleButtons.nth(index).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await dialog.getByRole('button', { name: 'Previous' }).click();
    await expect(dialog).toHaveAccessibleName('Run the experiment');
    await dialog.getByRole('button', { name: 'Previous' }).click();
    await expect(setupTab).toHaveAttribute('aria-selected', 'true');
    await expect(dialog).toHaveAccessibleName('Set the learning rate');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(setupTab).toHaveAttribute('aria-selected', 'true');
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);
  });
}

test('has no serious mobile accessibility violations across tabs', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'One mobile axe pass is sufficient.');
  await page.setViewportSize({ width: 375, height: 667 });
  await openReadyApp(page);

  for (const tabName of ['Setup', 'Signal', 'Playback', 'Learn']) {
    await page.getByRole('tab', { name: tabName }).click();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(blocking, `${tabName} tab accessibility violations`).toEqual([]);
  }
});

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

test('reviews retained iterations and continues from the true live endpoint', async ({
  page,
}) => {
  await openReadyApp(page, { lowGraphics: true });
  const step = page.getByRole('button', { name: 'Advance one iteration' });
  const iteration = page.locator('.metrics-grid output').nth(3);
  const slider = page.getByRole('slider', { name: 'Retained iteration' });

  for (let index = 1; index <= 4; index += 1) {
    await step.dispatchEvent('click');
    await expect(slider).toHaveAttribute('max', String(index));
  }
  await expect(iteration).toHaveText('4');

  await page.getByRole('button', { name: 'Previous retained iteration' }).click();

  await expect(page.getByText('Review mode')).toBeVisible();
  await expect(page.locator('.step-result-heading').getByText('Selected step'))
    .toBeVisible();
  await expect(page.locator('.primary-action')).toBeDisabled();
  await expect(step).toBeDisabled();
  await expect(slider).toHaveAttribute('aria-valuetext', /Iteration 3,/);
  await expect(iteration).toHaveText('3');

  await slider.focus();
  await slider.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuetext', /Iteration 2,/);
  await slider.press('Shift+ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuetext', /Iteration 0,/);
  await expect(iteration).toHaveText('0');

  await page.getByRole('button', { name: 'Latest retained iteration' })
    .dispatchEvent('click');
  await expect(slider).toHaveAttribute('aria-valuetext', /Iteration 4,/);
  await page.getByRole('button', { name: 'Previous retained iteration' })
    .dispatchEvent('click');
  await expect(slider).toHaveAttribute('aria-valuetext', /Iteration 3,/);
  await page.getByLabel('Playback speed').selectOption('62.5');
  await page.getByRole('button', { name: 'Play playback' }).click();
  await expect(slider).toHaveAttribute('aria-valuetext', /Iteration 4,/, {
    timeout: 5_000,
  });
  await expect(iteration).toHaveText('4', { timeout: 5_000 });
  await expect(page.getByText('Review mode')).toBeHidden();
  await expect(page.locator('.primary-action')).toBeEnabled();
  await expect(step).toBeEnabled();

  await step.click();
  await expect(slider).toHaveAttribute('max', '5');
  await expect(iteration).toHaveText('5');
});

test('keeps scrubber controls touch-sized without mobile landscape overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await openReadyApp(page);
  const step = page.getByRole('button', { name: 'Advance one iteration' });
  for (let index = 0; index < 3; index += 1) await step.click();

  await page.getByRole('tab', { name: 'Playback' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Playback' })).toBeVisible();
  const controls = page.locator('.scrubber-controls button');
  await expect(controls).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await expectResponsiveRegionsSeparated(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(812);
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
