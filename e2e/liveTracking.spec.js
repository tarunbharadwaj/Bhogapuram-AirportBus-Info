import { test, expect } from '@playwright/test';
import { createDefaultServiceData } from '../shared/serviceData.mjs';

const NOW = Date.parse('2026-09-12T10:00:00Z');
function fleet(time = NOW) {
  const make = (index, routeCode, age, position = true) => ({
    tripId: `12092026_AW0${index}_2_GAJUWAKA2`, vehicleNumber: `AP39WU398${index}`,
    routeCode, direction: index === 2 ? 'to-airport' : 'from-airport',
    position: position ? { lat: 17.84 + index * .01, lng: 83.35, updatedAt: new Date(time - age).toISOString() } : null,
  });
  return { status: 'available', partial: false, checkedAt: new Date(time).toISOString(), serverTime: new Date(time).toISOString(),
    buses: [make(1, 'ASR-1', 30_000), make(2, 'ASR-2', 600_000), make(3, null, 0, false)] };
}

function stopTracking(time = NOW) {
  const make = (index, progress, quality = 'recent') => ({
    tripId: `12092026_AW0${index}_2_GAJUWAKA2`, vehicleNumber: `AP39WU398${index}`,
    routeCode: 'ASR-1', direction: 'to-airport', quality, stopProgress: progress,
    progressQuality: 'provider-waypoint', currentStopName: index === 1 ? 'Old Gajuwaka' : 'NAD Junction',
    stopsAway: progress === 'approaching' ? 1 : null, distanceKm: 4.2 + index,
    selectedStopScheduledAt: new Date(time + index * 600_000).toISOString(),
    position: { lat: 17.70 + index * .01, lng: 83.21, updatedAt: new Date(time - (quality === 'recent' ? 30_000 : 300_000)).toISOString() }
  });
  return { status: 'available', partial: false, checkedAt: new Date(time).toISOString(), serverTime: new Date(time).toISOString(),
    refreshAfterMs: 30_000, selection: { placeId: 'nad-junction', stopName: 'NAD Junction' }, plannedTripMatch: 'not-requested',
    matchedBusPassed: false, reliableLiveResult: true, options: [make(1, 'approaching'), make(2, 'uncertain', 'stale')],
    nextPublishedServices: [] };
}

async function setup(page, response = () => fleet(), stopResponse = () => stopTracking()) {
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(() => {
    window.geoCalls = 0;
    navigator.geolocation.getCurrentPosition = () => { window.geoCalls++; };
  });
  let requests = 0;
  let stopRequests = 0;
  await page.route('**/api/service', (route) => route.fulfill({ json: createDefaultServiceData() }));
  await page.route('**/api/live-buses', async (route) => {
    requests++;
    const value = response(requests);
    if (value === 'abort') return route.abort();
    if (value === 'html') return route.fulfill({ contentType: 'text/html', body: '<html>Bad proxy</html>' });
    await route.fulfill({ json: value });
  });
  await page.route('**/api/stop-tracking**', async (route) => {
    stopRequests++;
    const value = stopResponse(stopRequests, route.request().url());
    if (value === 'abort') return route.abort();
    await route.fulfill({ json: value });
  });
  // Never use OSM's public tile servers in automated tests.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e1ece8"/><path d="M0 90H256M110 0V256" stroke="#fff" stroke-width="12"/></svg>' }));
  await page.route(/google-analytics|googletagmanager/, (route) => route.abort());
  await page.goto('/');
  const count = () => requests;
  count.stop = () => stopRequests;
  return count;
}
async function start(page) {
  await page.locator('#live-tracking').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Browse all buses' }).click({ force: true });
  await page.getByRole('button', { name: 'Start live tracking', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Tracked AeroExpress buses' }).getByRole('listitem')).toHaveCount(3);
}

test('Find my bus is the default, requests no location and shows stop-focused candidates', async ({ page }) => {
  const count = await setup(page);
  await page.locator('#live-tracking').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Find my bus' })).toHaveAttribute('aria-pressed', 'true');
  expect(count()).toBe(0);
  expect(count.stop()).toBe(0);
  await page.locator('#live-tracking').getByRole('option', { name: /NAD Junction/ }).click();
  await page.getByRole('button', { name: 'Find buses for this stop' }).click();
  await expect.poll(count.stop).toBe(1);
  await expect(page.getByText('Most likely next bus')).toBeVisible();
  await expect(page.getByText('Approaching your stop')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Buses approaching NAD Junction' }).getByRole('listitem')).toHaveCount(2);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  expect(await page.evaluate(() => window.geoCalls)).toBe(0);
});

test('unmapped selectable stops explain uncertain waypoint coverage', async ({ page }) => {
  await setup(page, () => fleet(), () => ({ ...stopTracking(), reliableLiveResult: false,
    selection: { placeId: 'railway-station', stopName: 'Railway Station' },
    options: [{ ...stopTracking().options[0], routeCode: 'ASR-2', stopProgress: 'uncertain',
      progressQuality: 'surrounding-waypoints', stopsAway: null }],
    nextPublishedServices: [{ routeCode: 'ASR-2', routeName: 'Route', routeOriginDepartureAt: new Date(NOW + 600_000).toISOString(),
      stopArrivalAt: new Date(NOW + 1_200_000).toISOString(), timeQuality: 'estimated' }] }));
  await page.locator('#live-tracking').scrollIntoViewIfNeeded();
  await page.locator('#live-tracking').getByRole('option', { name: /Railway Station/ }).click();
  await page.getByRole('button', { name: 'Find buses for this stop' }).click();
  await expect(page.getByText(/APSRTC does not publish this stop as a waypoint/)).toBeVisible();
  await expect(page.getByText(/Progress is based only on the confirmed stops around it/)).toBeVisible();
  await expect(page.getByText('Next published schedule')).toBeVisible();
});

test('opt-in only, no geolocation, map/list support route, direction and vehicle filtering', async ({ page }) => {
  const count = await setup(page);
  await page.locator('#live-tracking').scrollIntoViewIfNeeded();
  expect(count()).toBe(0);
  await start(page);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByText('Recent GPS', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Stale GPS', { exact: true })).toHaveCount(1);
  await expect(page.getByText('No GPS', { exact: true })).toHaveCount(1);
  await page.getByLabel('Bus route', { exact: true }).selectOption('ASR-2');
  await expect(page.getByRole('list', { name: 'Tracked AeroExpress buses' }).getByRole('listitem')).toHaveCount(1);
  await page.getByLabel('Direction', { exact: true }).selectOption('from-airport');
  await expect(page.getByText(/No buses are available in this view/)).toBeVisible();
  await page.getByLabel('Bus route', { exact: true }).selectOption('all');
  await page.getByLabel('Direction', { exact: true }).selectOption('all');
  await page.getByLabel('Vehicle number (optional)').fill('AP39 WU3981');
  await expect(page.getByRole('list', { name: 'Tracked AeroExpress buses' }).getByRole('listitem')).toHaveCount(1);
  expect(await page.evaluate(() => window.geoCalls)).toBe(0);
});

test('pause stops polling and ages old snapshots out instead of showing fake live positions', async ({ page }) => {
  const count = await setup(page);
  await start(page);
  await page.getByRole('button', { name: 'Pause tracking' }).click();
  await expect(page.getByText('Recent GPS', { exact: true })).toHaveCount(0);
  const before = count();
  await page.clock.fastForward(310_000);
  expect(count()).toBe(before);
  await expect(page.getByRole('list', { name: 'Tracked AeroExpress buses' }).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resume tracking' })).toBeVisible();
});

test('offline state pauses polling and removes recent GPS claim', async ({ page, context }) => {
  const count = await setup(page);
  await start(page);
  await context.setOffline(true);
  await expect(page.getByText(/You’re offline/)).toBeVisible();
  const before = count();
  await page.clock.fastForward(65_000);
  expect(count()).toBe(before);
  await expect(page.getByText('Recent GPS', { exact: true })).toHaveCount(0);
  await context.setOffline(false);
});

test('non-JSON response, network error, retry and recovery do not break planner', async ({ page }) => {
  const count = await setup(page, (attempt) => attempt === 1 ? 'html' : attempt === 2 ? 'abort' : fleet(NOW + 181_000));
  await page.getByRole('button', { name: 'Browse all buses' }).click({ force: true });
  await page.getByRole('button', { name: 'Start live tracking' }).click();
  await expect(page.getByText(/Tracking could not be refreshed/)).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect.poll(count).toBe(2);
  await page.clock.fastForward(121_000);
  await expect(page.getByRole('list', { name: 'Tracked AeroExpress buses' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.locator('#planner')).toBeAttached();
});

test('empty fleet and provider kill switch show honest fallback, not no-services assertion', async ({ page }) => {
  await setup(page, () => ({ ...fleet(), buses: [], status: 'disabled' }));
  await page.getByRole('button', { name: 'Browse all buses' }).click({ force: true });
  await page.getByRole('button', { name: 'Start live tracking' }).click();
  await expect(page.getByText(/Live tracking is temporarily disabled/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open APSRTC', exact: true })).toHaveAttribute('href', 'https://apsrtclivetrack.com/');
});

test('tile failure leaves list, safe external links, and accessible map selection', async ({ page }) => {
  await setup(page);
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await start(page);
  await expect(page.getByText(/Map background unavailable/)).toBeVisible();
  const item = page.getByRole('list', { name: 'Tracked AeroExpress buses' }).getByRole('listitem').first();
  await item.getByRole('button', { name: 'Locate on map' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.leaflet-tooltip')).toContainText('AP39WU3981');
  await expect(item.getByRole('link', { name: 'APSRTC trip' })).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(item.getByRole('link', { name: 'GPS pin' })).toHaveAttribute('href', /query=17\.85/);
});

test('light/dark layouts have no horizontal overflow and retain attribution', async ({ page }, testInfo) => {
  await setup(page);
  await start(page);
  await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('#live-tracking').screenshot({ path: testInfo.outputPath(dark ? 'tracking-dark.png' : 'tracking-light.png') });
  }
});

test('feedback and admin do not request tracking', async ({ page }) => {
  const count = await setup(page);
  await page.goto('/feedback');
  await page.goto('/service-admin');
  expect(count()).toBe(0);
});

test('offscreen and hidden-tab polling pauses and restarts when visible', async ({ page }) => {
  const count = await setup(page, (attempt) => fleet(NOW + (attempt - 1) * 70_000));
  await start(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.locator('#live-tracking').getByRole('status')).toContainText('out of view');
  const before = count();
  await page.clock.fastForward(65_000);
  expect(count()).toBe(before);
  await page.locator('#live-tracking').scrollIntoViewIfNeeded();
  await expect.poll(count).toBe(before + 1);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#live-tracking').getByRole('status')).toContainText('out of view');
  const hiddenCount = count();
  await page.clock.fastForward(65_000);
  expect(count()).toBe(hiddenCount);
});

test('slow cold-start request times out without a permanently busy state', async ({ page }) => {
  await setup(page);
  await page.route('**/api/live-buses', () => {});
  await page.getByRole('button', { name: 'Browse all buses' }).click({ force: true });
  await page.getByRole('button', { name: 'Start live tracking' }).click();
  await expect(page.getByText(/server may need up to a minute/)).toBeVisible();
  await expect(page.locator('#planner')).toBeAttached();
  await page.clock.fastForward(76_000);
  await expect(page.getByText(/Tracking could not be refreshed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause tracking' })).toBeEnabled();
});
