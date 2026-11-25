import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIRPORT_CORRIDOR } from '../src/data/reclaimAeroExpress.js';
import { parseReclaimPositions, ReclaimTrackingService } from '../src/services/reclaimTrackingService.js';

const time = Date.parse('2026-11-21T14:25:00+05:30');
const seconds = (timestamp) => String(timestamp / 1000);
const feed = (...entity) => ({ header: { timestamp: seconds(time) }, entity });
const bus = (tripId, plate, overrides = {}) => ({ vehicle: {
	trip: { tripId, startDate: '20261121', routeId: AIRPORT_CORRIDOR },
	position: { latitude: 17.84, longitude: 83.35 }, timestamp: seconds(time),
	vehicle: { id: `21112026_${tripId}`, label: plate }, ...overrides
} });
const tripUpdate = ({ vehicle }, stops, overrides = {}) => ({ tripUpdate: {
	trip: vehicle.trip, vehicle: vehicle.vehicle, timestamp: vehicle.timestamp,
	stopTimeUpdate: stops.map(([stopSequence, stopId, scheduleRelationship]) => ({ stopSequence, stopId, scheduleRelationship })),
	...overrides
} });

test('identifies routes and directions from verified airport trip IDs', () => {
	const { buses } = parseReclaimPositions(feed(
		bus('AM02_3_GAJUWAKA2', 'AP39AA1234'), bus('AM05_2_GAJUWAKA2', 'AP39AA1235'),
		bus('AW02_3_GAJUWAKA2', 'AP39AA1236'), bus('AW06_2_GAJUWAKA2', 'AP39AA1237')
	), time);
	assert.deepEqual(buses.map(({ routeCode, direction, scheduledOriginAt }) => [routeCode, direction, scheduledOriginAt]), [
		['ASR-1', 'to-airport', '2026-11-21T08:00:00.000Z'],
		['ASR-2', 'from-airport', '2026-11-21T08:45:00.000Z'],
		['ASR-2', 'to-airport', '2026-11-21T09:00:00.000Z'],
		['ASR-1', 'from-airport', '2026-11-21T08:50:00.000Z']
	]);
});

test('drops unknown trips, other corridors, old and future fixes, and implausible reports', () => {
	const { buses } = parseReclaimPositions(feed(
		bus('AM13_3_GAJUWAKA2', 'AP39AA1234'),
		bus('AW02_3_GAJUWAKA2', 'AP39AA1236', { timestamp: seconds(time - 900_000) }),
		bus('AW02_3_GAJUWAKA2', 'AP39AA1237', { timestamp: seconds(time + 60_000) }),
		bus('AW02_3_GAJUWAKA2', 'AP39AA1238', { position: { latitude: 0, longitude: 0 } }),
		bus('AW02_3_GAJUWAKA2', 'AP39AA1239', { trip: { tripId: 'AW02_3_GAJUWAKA2', routeId: AIRPORT_CORRIDOR, startDate: 20261121 } }),
		bus('AW02_3_GAJUWAKA2', 'AP39AA1240', { trip: { tripId: 'AW02_3_GAJUWAKA2', routeId: 'somewhere-else', startDate: '20261121' } })
	), time);
	assert.deepEqual(buses, []);
});

test('includes published stop times and reported speed for the selected trip', () => {
	const { buses } = parseReclaimPositions(feed(bus('AM04_4_GAJUWAKA2', 'AP39WU3584', {
		position: { latitude: 17.84, longitude: 83.35, speed: 21.111, bearing: 0 }
	})), time);
	assert.equal(buses[0].speedKph, 76);
	assert.equal(buses[0].bearingDegrees, 0);
	assert.equal(buses[0].scheduledStops.length, 11);
	assert.deepEqual(buses[0].scheduledStops.slice(0, 3), [
		{ placeId: 'bhogapuram-airport', scheduledAt: '2026-11-21T15:10:00.000Z' },
		{ placeId: 'airport-junction', scheduledAt: '2026-11-21T15:20:00.000Z' },
		{ placeId: 'tagarapuvalasa', scheduledAt: '2026-11-21T15:35:00.000Z' }
	]);
});

test('drops stale vehicle assignments when a newer or ambiguous assignment is reported', () => {
	const { buses } = parseReclaimPositions(feed(
		bus('AM02_3_GAJUWAKA2', 'AP39AA1234', { timestamp: seconds(time - 60_000) }),
		bus('UNRELATED', 'AP39AA1234'),
		bus('AW02_3_GAJUWAKA2', 'AP39AA1235'),
		bus('UNRELATED', 'AP39AA1235'),
		bus('AW06_2_GAJUWAKA2', 'AP39AA1236'),
		bus('UNRELATED', 'AP39AA1236', { timestamp: seconds(time - 60_000) })
	), time);
	assert.deepEqual(buses.map((item) => item.vehicleNumber), ['AP39AA1236']);
});

test('accepts an in-progress trip from the previous India service date after midnight', () => {
	const afterMidnight = Date.parse('2026-11-22T00:30:00+05:30');
	const response = feed(bus('AM07_4_GAJUWAKA2', 'AP39AA1234', { timestamp: seconds(afterMidnight) }));
	response.header.timestamp = seconds(afterMidnight);
	const { buses } = parseReclaimPositions(response, afterMidnight);
	assert.equal(buses[0].scheduledOriginAt, '2026-11-21T18:15:00.000Z');
	assert.deepEqual(buses[0].scheduledStops.at(-1), {
		placeId: 'old-gajuwaka', scheduledAt: '2026-11-21T20:15:00.000Z'
	});
	assert.equal(buses[0].speedKph, null);
});

test('shares one refresh, backs off on 429, and expires cached positions', async () => {
	let calls = 0;
	let now = time;
	const service = new ReclaimTrackingService({ enabled: true, now: () => now, fetchFeed: async (url) => {
		if (url.endsWith('trip_updates.json')) return Response.json(feed());
		calls += 1;
		return calls === 1
			? Response.json(feed(bus('AW02_3_GAJUWAKA2', 'AP39AA1234')))
			: new Response(null, { status: 429 });
	} });
	const snapshots = await Promise.all([service.getSnapshot(), service.getSnapshot()]);
	assert.equal(calls, 1);
	assert.deepEqual(snapshots[0], snapshots[1]);
	assert.equal(snapshots[0].buses.length, 1);
	now += 30_000;
	assert.equal((await service.getSnapshot()).status, 'stale');
	now += 30_000;
	assert.equal((await service.getSnapshot({ refresh: true })).buses.length, 1);
	assert.equal(calls, 2);
	now += 900_000;
	assert.equal((await service.getSnapshot()).buses.length, 0);
});

test('manual refresh may check earlier while sharing requests and limiting upstream frequency', async () => {
	let now = time;
	let requests = 0;
	const service = new ReclaimTrackingService({ enabled: true, now: () => now, fetchFeed: async () => {
		requests += 1;
		return Response.json(feed());
	} });
	await service.getSnapshot();
	now += 14_000;
	await service.getSnapshot({ refresh: true });
	assert.equal(requests, 1);
	now += 1000;
	await service.getSnapshot();
	assert.equal(requests, 1);
	await Promise.all([service.getSnapshot({ refresh: true }), service.getSnapshot({ refresh: true })]);
	assert.equal(requests, 2);
});

test('distinguishes a verified empty GPS feed from a partial or unavailable feed', async () => {
	const getSnapshot = async (payload) => new ReclaimTrackingService({
		enabled: true, now: () => time, fetchFeed: async () => Response.json(payload)
	}).getSnapshot();
	const empty = await getSnapshot(feed());
	assert.equal(empty.status, 'available');
	assert.equal(empty.positionCoverage, 'complete');
	assert.deepEqual(empty.buses, []);

	const unmapped = await getSnapshot(feed(bus('UNKNOWN_AIRPORT_TRIP', 'AP39AA1234')));
	assert.equal(unmapped.status, 'available');
	assert.equal(unmapped.positionCoverage, 'partial');
	assert.deepEqual(unmapped.buses, []);
	assert.equal((await getSnapshot(feed({ unexpected: true }))).positionCoverage, 'partial');
	assert.equal((await getSnapshot({ entity: [] })).status, 'unavailable');
});

test('keeps valid GPS available when the live stop feed fails or supplies an out-of-range sequence', async () => {
	const position = bus('AM02_3_GAJUWAKA2', 'AP39AA1234');
	const getSnapshot = async (stopReply) => new ReclaimTrackingService({
		enabled: true, now: () => time, fetchFeed: async (url) =>
			url.endsWith('trip_updates.json') ? stopReply : Response.json(feed(position))
	}).getSnapshot();
	const unavailable = await getSnapshot(new Response(null, { status: 503 }));
	assert.equal(unavailable.status, 'available');
	assert.equal(unavailable.stopUpdatesStatus, 'unavailable');
	assert.equal(unavailable.buses.length, 1);

	const invalidSequence = await getSnapshot(Response.json(feed(tripUpdate(position, [[999, undefined]]))));
	assert.equal(invalidSequence.status, 'available');
	assert.equal(invalidSequence.buses[0].upcomingStopIds, undefined);
});

test('keeps confirmed upcoming stops in trip order and never reopens a passed stop after a GPS regression', async () => {
	let now = time;
	let stops = [[2, '9851'], [3, '243843'], [9, '1782812590671']];
	const service = new ReclaimTrackingService({ enabled: true, now: () => now, fetchFeed: async (url) => {
		const position = bus('AM02_3_GAJUWAKA2', 'AP39AA1234', { timestamp: seconds(now) });
		const response = url.endsWith('trip_updates.json') ? tripUpdate(position, stops) : position;
		return Response.json({ header: { timestamp: seconds(now) }, entity: [response] });
	} });
	const progress = async () => {
		const { passedStopIds, upcomingStopIds } = (await service.getSnapshot()).buses[0];
		return [passedStopIds, upcomingStopIds];
	};
	assert.deepEqual(await progress(), [['old-gajuwaka'], ['nad-junction', 'gurudwara', 'bhogapuram-airport']]);
	now += 30_000;
	stops = [[3, '243843', 'SKIPPED'], [9, '1782812590671']];
	assert.deepEqual(await progress(), [['old-gajuwaka', 'nad-junction'], ['bhogapuram-airport']]);
	assert.deepEqual((await service.getSnapshot()).buses[0].skippedStopIds, ['gurudwara']);
	now += 30_000;
	stops = [[2, '9851'], [9, '1782812590671']];
	assert.deepEqual(await progress(), [['old-gajuwaka', 'nad-junction'], ['bhogapuram-airport']]);
});

test('derives reverse-direction passed stops only when the update matches the published sequence', async () => {
	const position = bus('AW06_2_GAJUWAKA2', 'AP39AA1234');
	const timeline = async (stops) => {
		const service = new ReclaimTrackingService({ enabled: true, now: () => time, fetchFeed: async (url) =>
			Response.json(feed(url.endsWith('trip_updates.json') ? tripUpdate(position, stops) : position))
		});
		const { passedStopIds, upcomingStopIds } = (await service.getSnapshot()).buses[0];
		return [passedStopIds, upcomingStopIds];
	};
	assert.deepEqual(await timeline([[1, '1782812590671']]), [[], ['bhogapuram-airport']]);
	assert.deepEqual(await timeline([[3, '1375188927965'], [4, '226027']]), [
		['bhogapuram-airport', 'airport-junction'], ['tagarapuvalasa', 'anandapuram']
	]);
	assert.deepEqual(await timeline([[3, '226027']]), [undefined, ['anandapuram']]);
});

test('remembers a confirmed airport departure when the next feed only has GPS', async () => {
	let now = time;
	let stops = [[2, '1782812721498'], [3, '1375188927965']];
	const service = new ReclaimTrackingService({ enabled: true, now: () => now, fetchFeed: async (url) => {
		const position = bus('AW06_2_GAJUWAKA2', 'AP39AA1234', { timestamp: seconds(now) });
		const entities = url.endsWith('trip_updates.json') ? (stops ? [tripUpdate(position, stops)] : []) : [position];
		return Response.json({ header: { timestamp: seconds(now) }, entity: entities });
	} });
	assert.ok((await service.getSnapshot()).buses[0].passedStopIds.includes('bhogapuram-airport'));
	stops = null;
	now += 30_000;
	const report = (await service.getSnapshot()).buses[0];
	assert.equal(report.upcomingStopIds, undefined);
	assert.equal(report.originBoardingUnavailable, true);
});

test('publishes only matched upcoming Reclaim arrival estimates and reported delays', async () => {
	const position = bus('AM02_3_GAJUWAKA2', 'AP39AA1234');
	const getBus = async (stopTimeUpdate) => {
		const service = new ReclaimTrackingService({ enabled: true, now: () => time, fetchFeed: async (url) => Response.json(feed(
			url.endsWith('trip_updates.json') ? tripUpdate(position, [], { stopTimeUpdate }) : position
		)) });
		return (await service.getSnapshot()).buses[0];
	};
	const nad = { stopSequence: 2, stopId: '9851', arrival: { time: seconds(time + 120_000), delay: 2520 } };
	const updates = [
		{ ...nad, stopSequence: 1, stopId: '10821', arrival: { time: seconds(time - 120_000) } },
		nad,
		{ ...nad, stopSequence: 3, stopId: '243843', scheduleRelationship: 'SKIPPED' },
		{ ...nad, stopSequence: 4, stopId: '223318', arrival: { time: 'invalid', delay: 999999 } },
		{ ...nad, stopSequence: 5, stopId: '1457005959824', arrival: { delay: -30 } },
		{ ...nad, stopSequence: 9, stopId: '1782812590671', arrival: { time: seconds(time + 50 * 60_000), delay: 0 } }
	];
	assert.deepEqual((await getBus(updates)).stopPredictions, [
		{ placeId: 'nad-junction', scheduledAt: '2026-11-21T08:15:00.000Z', estimatedAt: '2026-11-21T08:57:00.000Z', delaySeconds: 2520 },
		{ placeId: 'marikavalasa', scheduledAt: '2026-11-21T09:00:00.000Z', estimatedAt: null, delaySeconds: -30 },
		{ placeId: 'bhogapuram-airport', scheduledAt: '2026-11-21T09:45:00.000Z', estimatedAt: '2026-11-21T09:45:00.000Z', delaySeconds: 0 }
	]);
	assert.deepEqual((await getBus([{ ...nad, stopSequence: 6 }])).stopPredictions, []);
	assert.deepEqual((await getBus([nad, nad])).stopPredictions, []);
});

test('keeps fleet positions when trip updates are outdated, mismatched, or unavailable', async () => {
	const position = bus('AM02_3_GAJUWAKA2', 'AP39AA1234');
	const stops = [[2, '9851'], [9, '1782812590671']];
	const replies = [
		Response.json(feed(tripUpdate(position, stops, { timestamp: seconds(time - 30_000) }))),
		Response.json(feed(tripUpdate(position, stops, { vehicle: { id: 'another-bus' } }))),
		new Response(null, { status: 429 })
	];
	for (const reply of replies) {
		const service = new ReclaimTrackingService({ enabled: true, now: () => time, fetchFeed: async (url) =>
			url.endsWith('trip_updates.json') ? reply : Response.json(feed(position))
		});
		const snapshot = await service.getSnapshot();
		assert.equal(snapshot.status, 'available');
		assert.equal(snapshot.buses.length, 1);
		assert.equal(snapshot.buses[0].upcomingStopIds, undefined);
	}
});

test('estimates the selected bus’s stops from a recent GPS fix when the stop feed is empty', async () => {
	const now = Date.parse('2026-11-21T21:31:00+05:30');
	const base = { latitude: 17.94656, longitude: 83.41854, speed: 12.083333, bearing: 161.6 };
	const snapshot = async ({ coordinates = {}, age = 39_000, stops = [], canceled = false } = {}) => {
		const position = bus('AW04_4_GAJUWAKA2', 'AP39AA1234', { position: { ...base, ...coordinates }, timestamp: seconds(now - age) });
		const update = tripUpdate(position, stops, canceled ? { trip: { ...position.vehicle.trip, scheduleRelationship: 'CANCELED' } } : {});
		const service = new ReclaimTrackingService({ enabled: true, now: () => now, fetchFeed: async (url) => Response.json({
			header: { timestamp: seconds(now) }, entity: url.endsWith('trip_updates.json') ? [update] : [position]
		}) });
		return (await service.getSnapshot()).buses[0];
	};
	const estimated = await snapshot();
	assert.equal(estimated.gpsStopProgress.nextStopId, 'tagarapuvalasa');
	assert.deepEqual(estimated.gpsStopProgress.passedStopIds, ['bhogapuram-airport', 'airport-junction']);
	assert.equal(estimated.upcomingStopIds, undefined);
	const reported = await snapshot({ stops: [[3, '1375188927965'], [4, '226027']] });
	assert.deepEqual(reported.upcomingStopIds, ['tagarapuvalasa', 'anandapuram']);
	assert.equal(reported.gpsStopProgress, undefined);
	for (const options of [
		{ age: 120_000 }, { coordinates: { speed: 0 } }, { coordinates: { bearing: 341.6 } },
		{ coordinates: { longitude: 83.52 } }, { canceled: true }
	]) {
		assert.equal((await snapshot(options)).gpsStopProgress, undefined, JSON.stringify(options));
	}
});

test('keeps parked buses before departure and after service in the fleet without reporting trip progress', async () => {
	const waiting = bus('AM01_4_GAJUWAKA2', 'AP39AA1234', { position: { latitude: 17.97983, longitude: 83.50681, speed: 0 } });
	const finished = bus('AM01_1_GAJUWAKA2', 'AP39AA1235', { position: { latitude: 17.97983, longitude: 83.50681, speed: 0 } });
	const active = bus('AM02_3_GAJUWAKA2', 'AP39AA1236');
	const service = new ReclaimTrackingService({ enabled: true, now: () => time, fetchFeed: async (url) => Response.json(
		url.endsWith('trip_updates.json') ? feed(
			tripUpdate(waiting, [[1, '1782812590671']]),
			tripUpdate(finished, [[9, '1782812590671']]),
			tripUpdate(active, [[2, '9851'], [9, '1782812590671']])
		) : feed(waiting, finished, active)
	) });
	const result = await service.getSnapshot();
	assert.deepEqual(result.buses.map(({ vehicleNumber, upcomingStopIds }) => [vehicleNumber, upcomingStopIds]), [
		['AP39AA1234', undefined], ['AP39AA1235', undefined], ['AP39AA1236', ['nad-junction', 'bhogapuram-airport']]
	]);
});

test('does not call the provider when tracking is disabled', async () => {
	const service = new ReclaimTrackingService({ enabled: false, fetchFeed: assert.fail });
	assert.deepEqual(await service.getSnapshot(), { status: 'disabled', feedUpdatedAt: null, buses: [] });
});
