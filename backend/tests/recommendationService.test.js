import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DATA } from '../src/data/defaultData.js';
import { nearestStop, recommendTrip } from '../src/services/recommendationService.js';

test('finds the closest boarding point', () => {
  const result = nearestStop(DEFAULT_DATA, { lat: 17.743, lng: 83.232 });
  assert.equal(result.stop.id, 'nad-stop');
  assert.equal(result.route.code, 'ASR-1');
});

test('recommends a bus that arrives before the airport safety deadline', () => {
  const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
  tomorrow.setHours(20, 30, 0, 0);
  const result = recommendTrip(DEFAULT_DATA, { locationId: 'mvp-colony', flightTime: tomorrow.toISOString(), flightType: 'domestic' });
	assert.ok(result.best);
	assert.equal(result.terminalBuffer, 120);
	assert.equal(result.extraBuffer, 0);
  assert.ok(new Date(result.best.airportArrivalTime) <= new Date(result.airportBy));
  assert.ok(new Date(result.leaveHomeTime) < new Date(result.best.departureTime));
});

test('uses a three-hour terminal buffer for international flights', () => {
  const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
  tomorrow.setHours(22, 0, 0, 0);
  const result = recommendTrip(DEFAULT_DATA, { locationId: 'railway-station', flightTime: tomorrow.toISOString(), flightType: 'international', extraBuffer: 0 });
  assert.equal(result.terminalBuffer, 180);
});
