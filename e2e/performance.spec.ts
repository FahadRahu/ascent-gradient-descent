import { expect, test } from '@playwright/test';

const CONTROLS_READY_SLO_MS = 4_000;
const CANVAS_VISIBLE_SLO_MS = 9_000;

test('meets the mobile slow-4G readiness SLO', async ({ page, browserName }) => {
  test.skip(
    process.env.PERFORMANCE_TEST !== '1' || browserName !== 'chromium',
    'Run explicitly with npm run test:performance.',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const session = await page.context().newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 90_000,
    connectionType: 'cellular4g',
  });

  const startedAt = Date.now();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Landscape', { exact: true })).toBeEnabled({
    timeout: CONTROLS_READY_SLO_MS,
  });
  const controlsReadyMs = Date.now() - startedAt;

  await expect(page.locator('.scene-layer canvas')).toBeVisible({
    timeout: Math.max(1, CANVAS_VISIBLE_SLO_MS - controlsReadyMs),
  });
  const canvasVisibleMs = Date.now() - startedAt;

  console.log(JSON.stringify({
    profile: 'mobile-slow-4g',
    controlsReadyMs,
    canvasVisibleMs,
    budgets: {
      controlsReadyMs: CONTROLS_READY_SLO_MS,
      canvasVisibleMs: CANVAS_VISIBLE_SLO_MS,
    },
  }));

  expect(controlsReadyMs).toBeLessThanOrEqual(CONTROLS_READY_SLO_MS);
  expect(canvasVisibleMs).toBeLessThanOrEqual(CANVAS_VISIBLE_SLO_MS);
});
