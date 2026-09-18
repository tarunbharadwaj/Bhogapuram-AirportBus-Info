import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultServiceData } from '../../shared/serviceData.mjs';
import {
	MAX_TRACKING_ACCURACY_METERS,
	createJourney,
	createJourneySession,
	initialJourneyProgress,
	journeyNavigationLink,
	restoreJourneySession,
	updateJourneyProgress
} from '../src/lib/journeyTracking.js';

const service = createDefaultServiceData();
const now = Date.parse('2026-09-18T12:00:00+05:30');
const readingAt = (point, overrides = {}) => ({
	lat: point.lat,
	lng: point.lng,
	accuracy: 20,
	timestamp: now,
	...overrides
});

test('creates an airport-bound journey beginning at the selected route stop', () => {
	const journey = createJourney(service, 'ASR-2', 'railway-stop');
	assert.equal(journey.points[0].name, 'Railway Station');
	assert.equal(journey.points.at(-1).name, 'Vizag Airport');
	assert.equal(journey.points.some((point) => point.name === 'Scindia'), false);
	assert.equal(journey.estimatedJourneyMinutes, journey.boardingStop.journeyMinutes);
});

test('requires two accurate readings before advancing and never moves backwards', () => {
	const journey = createJourney(service, 'ASR-1', 'gajuwaka-stop');
	let progress = initialJourneyProgress();
	const nad = journey.points[1];
	progress = updateJourneyProgress(journey, progress, readingAt(nad), now);
	assert.equal(progress.confirmedIndex, 0);
	assert.equal(progress.pendingIndex, 1);
	progress = updateJourneyProgress(journey, progress, readingAt(nad), now);
	assert.equal(progress.confirmedIndex, 1);

	const oldGajuwaka = journey.points[0];
	progress = updateJourneyProgress(
		journey,
		progress,
		readingAt(oldGajuwaka),
		now
	);
	assert.equal(progress.confirmedIndex, 1);
});

test('recovers from missed readings when a later route stop is confirmed', () => {
	const journey = createJourney(service, 'ASR-1', 'gajuwaka-stop');
	let progress = initialJourneyProgress();
	const marikavalasaIndex = journey.points.findIndex(
		(point) => point.name === 'Marikavalasa'
	);
	const marikavalasa = journey.points[marikavalasaIndex];
	progress = updateJourneyProgress(
		journey,
		progress,
		readingAt(marikavalasa),
		now
	);
	progress = updateJourneyProgress(
		journey,
		progress,
		readingAt(marikavalasa),
		now
	);
	assert.equal(progress.confirmedIndex, marikavalasaIndex);
});

test('poor, stale and off-route readings cannot advance journey progress', () => {
	const journey = createJourney(service, 'ASR-1', 'gajuwaka-stop');
	const nad = journey.points[1];
	const initial = initialJourneyProgress();
	const weak = updateJourneyProgress(
		journey,
		initial,
		readingAt(nad, { accuracy: MAX_TRACKING_ACCURACY_METERS + 1 }),
		now
	);
	assert.equal(weak.status, 'weak');
	assert.equal(weak.confirmedIndex, 0);
	const stale = updateJourneyProgress(
		journey,
		initial,
		readingAt(nad, { timestamp: now - 61_000 }),
		now
	);
	assert.equal(stale.status, 'stale');
	assert.equal(stale.confirmedIndex, 0);
	const offRoute = updateJourneyProgress(
		journey,
		initial,
		readingAt({ lat: 17.25, lng: 82.75 }),
		now
	);
	assert.equal(offRoute.status, 'off-route');
	assert.equal(offRoute.confirmedIndex, 0);
});

test('session data contains no coordinates and is validated against active service data', () => {
	const journey = createJourney(service, 'ASR-2', 'railway-stop');
	const session = createJourneySession(journey, 999);
	assert.deepEqual(Object.keys(session).sort(), [
		'boardingStopId',
		'confirmedIndex',
		'routeCode',
		'version'
	]);
	assert.equal(session.confirmedIndex, journey.points.length - 1);
	assert.equal(JSON.stringify(session).includes('lat'), false);
	assert.equal(JSON.stringify(session).includes('lng'), false);
	assert.equal(restoreJourneySession(service, session).journey.routeCode, 'ASR-2');
	assert.equal(
		restoreJourneySession(service, { ...session, routeCode: 'UNKNOWN' }),
		null
	);
});

test('Google Maps navigation uses device location by omitting the origin', () => {
	const url = new URL(journeyNavigationLink(service.airport));
	assert.equal(url.origin, 'https://www.google.com');
	assert.equal(url.searchParams.get('api'), '1');
	assert.equal(
		url.searchParams.get('destination'),
		`${service.airport.lat},${service.airport.lng}`
	);
	assert.equal(url.searchParams.get('travelmode'), 'driving');
	assert.equal(url.searchParams.get('dir_action'), 'navigate');
	assert.equal(url.searchParams.has('origin'), false);
});
