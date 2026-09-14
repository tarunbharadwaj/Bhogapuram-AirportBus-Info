import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStopTrackingSnapshot, validateTrackingSnapshot, visibleTrackingBuses, gpsAgeLabel } from '../src/lib/liveTracking.js';

const now = Date.parse('2026-09-12T10:00:00Z');
const bus = { tripId: '12092026_AW05_2_GAJUWAKA2', vehicleNumber: 'AP39WU3983', routeCode: 'ASR-1', direction: 'from-airport',
  position: { lat: 17.84, lng: 83.35, updatedAt: new Date(now - 30_000).toISOString() } };
const snapshot = { status: 'available', serverTime: new Date(now).toISOString(), checkedAt: new Date(now).toISOString(), buses: [bus] };

test('validates fleet response; rejects bad status, duplicate registrations and unsafe trip IDs', () => {
  assert.equal(validateTrackingSnapshot(snapshot), snapshot);
  for (const value of [null, {}, { ...snapshot, status: 'bad' }, { ...snapshot, serverTime: 'invalid' },
    { ...snapshot, buses: [bus, bus] }, { ...snapshot, buses: [{ ...bus, tripId: '../../bad' }] },
    { ...snapshot, buses: [{ ...bus, vehicleNumber: '<script>' }] }, { ...snapshot, buses: [{ ...bus, direction: 'bad' }] }]) {
    assert.throws(() => validateTrackingSnapshot(value));
  }
});

test('route, direction and whitespace-insensitive registration filters compose', () => {
  assert.equal(visibleTrackingBuses(snapshot, now, { route: 'ASR-1', direction: 'from-airport', search: 'ap39 wu' }).length, 1);
  assert.equal(visibleTrackingBuses(snapshot, now, { route: 'ASR-2' }).length, 0);
  assert.equal(visibleTrackingBuses(snapshot, now, { direction: 'to-airport' }).length, 0);
});

test('stale/offline/paused data is not labelled recent and expired snapshots disappear', () => {
  assert.equal(visibleTrackingBuses(snapshot, now)[0].quality, 'recent');
  for (const options of [{ paused: true }, { failed: true }]) {
    assert.equal(visibleTrackingBuses(snapshot, now, options)[0].quality, 'stale');
  }
  assert.equal(visibleTrackingBuses({ ...snapshot, status: 'unavailable' }, now)[0].quality, 'stale');
  assert.equal(visibleTrackingBuses({ ...snapshot, buses: [{ ...bus, positionUnavailable: true }] }, now)[0].quality, 'stale');
  assert.equal(visibleTrackingBuses(snapshot, now + 300_001).length, 0);
  assert.equal(visibleTrackingBuses({ ...snapshot, status: 'disabled' }, now).length, 0);
});

test('invalid, future and expired GPS never reaches the map', () => {
  for (const position of [null, { ...bus.position, lat: 0 }, { ...bus.position, lat: '17.84' },
    { ...bus.position, updatedAt: new Date(now + 61_000).toISOString() },
    { ...bus.position, updatedAt: new Date(now - 1_800_001).toISOString() }]) {
    const result = visibleTrackingBuses({ ...snapshot, buses: [{ ...bus, position }] }, now)[0];
    assert.equal(result.position, null);
    assert.equal(result.quality, 'unavailable');
  }
});

test('age labels are nonnegative and tolerate missing GPS', () => {
  assert.equal(gpsAgeLabel(bus.position, now), '30s ago');
  assert.equal(gpsAgeLabel(bus.position, now + 60_000), '1 min ago');
  assert.equal(gpsAgeLabel(null, now), 'GPS unavailable');
});

test('validates stop tracking responses and rejects unsafe or over-broad payloads', () => {
  const option = { ...bus, direction: 'to-airport', quality: 'recent', stopProgress: 'approaching',
    progressQuality: 'provider-waypoint', stopsAway: 1, distanceKm: 4.2 };
  const value = { status: 'available', serverTime: new Date(now).toISOString(), checkedAt: new Date(now).toISOString(),
    selection: { placeId: 'nad-junction', stopName: 'NAD Junction' }, plannedTripMatch: 'exact',
    options: [option], nextPublishedServices: [], reliableLiveResult: true };
  assert.equal(validateStopTrackingSnapshot(value), value);
  for (const invalid of [
    { ...value, selection: { placeId: '../../secret', stopName: 'bad' } },
    { ...value, plannedTripMatch: 'invented' },
    { ...value, options: Array(4).fill(option) },
    { ...value, options: [{ ...option, direction: 'from-airport' }] },
    { ...value, options: [{ ...option, progressQuality: 'simulated' }] },
    { ...value, options: [{ ...option, vehicleNumber: '<script>' }] }
  ]) assert.throws(() => validateStopTrackingSnapshot(invalid));
});
