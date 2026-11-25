import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultServiceData } from '../../shared/serviceData.mjs';
import { haversineKm } from '../../shared/serviceRouting.mjs';
import { getMapRouteShape, isGpsAwayFromRoute } from '../src/lib/liveRouteMap.js';
import { formatTrackingDistance, getLiveFeedState, getTrackingRoutes, getTrackingStops, getTrackingView, isLiveBusesSnapshot } from '../src/lib/liveTracking.js';

const departure = '2026-11-21T07:30:00.000Z';
const now = Date.parse('2026-11-21T07:40:00.000Z');
const selection = {
	routes: [{ routeCode: 'ASR-2', direction: 'to-airport' }, { routeCode: 'ASR-1', direction: 'to-airport' }],
	plannedRouteCode: 'ASR-2', scheduledOriginAt: departure
};
const bus = (id, busDetails = {}) => ({
	id, routeCode: 'ASR-2', direction: 'to-airport', scheduledOriginAt: departure,
	position: { lat: 17.8, lng: 83.3, updatedAt: new Date(now - 10_000).toISOString() },
	...busDetails
});
const snapshot = (...buses) => ({ status: 'available', buses });

test('only a valid and recent response can establish an empty live bus feed', () => {
	const empty = { ...snapshot(), feedUpdatedAt: new Date(now).toISOString(), positionCoverage: 'complete' };
	assert.equal(isLiveBusesSnapshot(empty), true);
	assert.equal(isLiveBusesSnapshot({ ...empty, feedUpdatedAt: null }), false);
	assert.equal(isLiveBusesSnapshot({ ...empty, status: 'unknown' }), false);
	assert.equal(isLiveBusesSnapshot({ ...empty, buses: [{}] }), false);
	assert.equal(getLiveFeedState(empty, 'ready', now), 'ready');
	assert.equal(getLiveFeedState(empty, 'ready', now + 120_000), 'feed-delayed');
	assert.equal(getLiveFeedState(empty, 'unavailable', now), 'tracking-error');
	assert.equal(getLiveFeedState(empty, 'offline', now), 'offline');
	assert.equal(getLiveFeedState({ status: 'unavailable', buses: [] }, 'ready', now), 'feed-unavailable');
});

test('ASR-2 map path reaches the configured city stops in direction order', () => {
	const places = getTrackingStops(createDefaultServiceData());
	const cityStops = ['railway-station', 'rtc-complex', 'siripuram', 'vuda-park'];
	for (const direction of ['to-airport', 'from-airport']) {
		const { paths, stops } = getMapRouteShape('ASR-2', direction, places);
		assert.equal(paths.length, 1);
		let previousIndex = -1;
		for (const placeId of direction === 'to-airport' ? cityStops : cityStops.toReversed()) {
			const place = places.find((stop) => stop.placeId === placeId);
			assert.deepEqual(stops.filter((stop) => stop.placeId === placeId), [{ placeId, point: [place.lat, place.lng] }]);
			const index = paths[0].findIndex(([lat, lng], index) => index > previousIndex && haversineKm(place, { lat, lng }) < 0.025);
			assert.ok(index > previousIndex, `${direction} path must reach ${placeId} in order`);
			previousIndex = index;
		}
	}
});

test('ASR-2 map omits the affected path segment when a configured city stop moves', () => {
	const places = getTrackingStops(createDefaultServiceData());
	const siripuram = places.find((stop) => stop.placeId === 'siripuram');
	siripuram.lat += 0.004;
	const { paths, stops } = getMapRouteShape('ASR-2', 'to-airport', places);
	assert.equal(paths.length, 2);
	assert.deepEqual(stops.find((stop) => stop.placeId === 'siripuram').point, [siripuram.lat, siripuram.lng]);
});

test('map warns only for a GPS fix clearly away from a complete route line', () => {
	const path = [[17.72, 83.29], [17.72, 83.32]];
	const route = { paths: [path] };
	assert.equal(isGpsAwayFromRoute({ lat: 17.72, lng: 83.305 }, route), false);
	assert.equal(isGpsAwayFromRoute({ lat: 17.7205, lng: 83.305 }, route), false);
	assert.equal(isGpsAwayFromRoute({ lat: 17.722, lng: 83.305 }, route), true);
	assert.equal(isGpsAwayFromRoute({ lat: 17.72, lng: 83.322 }, route), true);
	assert.equal(isGpsAwayFromRoute(null, route), false);
	assert.equal(isGpsAwayFromRoute({ lat: 17.722, lng: 83.305 }, { paths: [] }), false);
	assert.equal(isGpsAwayFromRoute({ lat: 17.722, lng: 83.305 }, { paths: [path, [[17.73, 83.32], [17.74, 83.32]]] }), false);
});

test('highlights only the exact route, direction and full departure instant', () => {
	const view = getTrackingView(snapshot(
		bus('matching'), bus('other-route', { routeCode: 'ASR-1' }),
		bus('other-direction', { direction: 'from-airport' }),
		bus('other-date', { scheduledOriginAt: '2026-11-20T07:30:00.000Z' })
	), selection, now, true);
	assert.equal(view.matchedId, 'matching');
	assert.deepEqual(view.buses.map(({ id }) => id), ['matching', 'other-route', 'other-date']);
});

test('does not choose one trip if more than one matches the departure', () => {
	assert.equal(getTrackingView(snapshot(bus('one'), bus('two')), selection, now, true).matchedId, null);
});

test('stop pairs select direct routes and infer direction from the stop order', () => {
	const service = createDefaultServiceData();
	const routes = (boardingPlaceId, destinationPlaceId) => getTrackingRoutes(service, { boardingPlaceId, destinationPlaceId });
	assert.deepEqual(routes('nad-junction', 'marikavalasa'), [{ routeCode: 'ASR-1', direction: 'to-airport' }]);
	assert.deepEqual(routes('marikavalasa', 'nad-junction'), [{ routeCode: 'ASR-1', direction: 'from-airport' }]);
	assert.deepEqual(routes('scindia', 'marikavalasa'), [{ routeCode: 'ASR-2', direction: 'to-airport' }]);
	assert.deepEqual(routes('old-gajuwaka', 'marikavalasa').map(({ routeCode }) => routeCode), ['ASR-1', 'ASR-2']);
	assert.deepEqual(routes(service.airport.id, 'airport-junction').map(({ direction }) => direction), ['from-airport', 'from-airport']);
	assert.deepEqual(routes('airport-junction', service.airport.id).map(({ direction }) => direction), ['to-airport', 'to-airport']);
	assert.deepEqual(routes(service.airport.id, '').map(({ direction }) => direction), ['from-airport', 'from-airport']);
	assert.deepEqual(routes('nad-junction', 'scindia'), []);
	assert.deepEqual(routes('marikavalasa', 'marikavalasa'), []);
	assert.deepEqual(routes('unknown', 'scindia'), []);
	assert.deepEqual(routes('scindia', ''), []);
	service.routes[0].enabled = false;
	assert.deepEqual(routes('nad-junction', 'marikavalasa'), []);
	assert.deepEqual(routes(service.airport.id, ''), [{ routeCode: 'ASR-2', direction: 'from-airport' }]);
	assert.deepEqual(getTrackingRoutes(service, { showAll: true }).map(({ routeCode }) => routeCode), ['ASR-2', 'ASR-2']);
});

test('the stop list deduplicates shared stops, includes the terminal, and excludes disabled-route stops', () => {
	const service = createDefaultServiceData();
	const places = getTrackingStops(service);
	assert.equal(places.filter(({ placeId }) => placeId === 'marikavalasa').length, 1);
	assert.equal(places.filter(({ placeId }) => placeId === service.airport.id).length, 1);
	service.routes[0].enabled = false;
	assert.ok(!getTrackingStops(service).some(({ placeId }) => placeId === 'nad-junction'));
});

test('GPS positions are filtered by the compatible route and direction together', () => {
	const report = snapshot(
		bus('inbound'),
		bus('outbound-1', { routeCode: 'ASR-1', direction: 'from-airport' }),
		bus('outbound-2', { direction: 'from-airport' })
	);
	const visibleIds = (routes) => getTrackingView(report, { routes }, now, true).buses.map(({ id }) => id);
	assert.deepEqual(visibleIds([{ routeCode: 'ASR-2', direction: 'from-airport' }]), ['outbound-2']);
	assert.deepEqual(visibleIds([
		{ routeCode: 'ASR-1', direction: 'from-airport' }, { routeCode: 'ASR-2', direction: 'to-airport' }
	]), ['inbound', 'outbound-1']);
	assert.deepEqual(visibleIds([]), []);
});

test('marks old or disconnected positions as last known and hides expired points', () => {
	assert.equal(getTrackingView(snapshot(bus('recent')), selection, now, false).buses[0].recent, false);
	const results = getTrackingView(snapshot(
		bus('stale', { position: { updatedAt: new Date(now - 120_000).toISOString() } }),
		bus('expired', { position: { updatedAt: new Date(now - 900_000).toISOString() } })
	), selection, now, true);
	assert.deepEqual(results.buses.map(({ id, recent }) => ({ id, recent })), [{ id: 'stale', recent: false }]);
});

test('all-bus tracking includes parked buses with recent GPS even without stop progress', () => {
	const fleet = { routes: selection.routes, freshOnly: true };
	const report = snapshot(
		bus('moving', { upcomingStopIds: ['nad-junction', 'bhogapuram-airport'] }),
		bus('parked'),
		bus('stale', { position: { updatedAt: new Date(now - 120_000).toISOString() } })
	);
	assert.deepEqual(getTrackingView(report, fleet, now, true).buses.map(({ id }) => id), ['moving', 'parked']);
	assert.deepEqual(getTrackingView(report, fleet, now, false).buses, []);
	assert.deepEqual(getTrackingView({ ...report, status: 'stale' }, fleet, now, true).buses, []);
});

test('airport boarding shows recent terminal GPS from eligible outbound buses without requiring stop updates', () => {
	const service = createDefaultServiceData();
	const airport = getTrackingStops(service).find((stop) => stop.placeId === service.airport.id);
	const destination = 'siripuram';
	const routes = getTrackingRoutes(service, { boardingPlaceId: airport.placeId, destinationPlaceId: destination });
	const terminal = { lat: 17.97983, lng: 83.50681, updatedAt: new Date(now - 10_000).toISOString() };
	const reportAtAirport = (id, details = {}) => bus(id, { direction: 'from-airport', position: terminal, ...details });
	const report = snapshot(
		reportAtAirport('waiting-without-stop-updates'),
		reportAtAirport('boarding-now', { position: { ...terminal, lat: airport.lat, lng: airport.lng }, upcomingStopIds: [airport.placeId, destination] }),
		reportAtAirport('different-route', { routeCode: 'ASR-1' }),
		reportAtAirport('arriving', { direction: 'to-airport' }),
		reportAtAirport('left-terminal', { position: { ...terminal, lat: 17.98558 } }),
		reportAtAirport('already-departed', { originBoardingUnavailable: true }),
		reportAtAirport('airport-passed', { passedStopIds: [airport.placeId] }),
		reportAtAirport('origin-behind', { upcomingStopIds: [destination] }),
		reportAtAirport('destination-skipped', { skippedStopIds: [destination] }),
		reportAtAirport('stale', { position: { ...terminal, updatedAt: new Date(now - 120_000).toISOString() } })
	);
	const airportBoarding = { boardingAtAirport: true, boardingStop: airport, destinationPlaceId: destination, routes };
	assert.deepEqual(getTrackingView(report, airportBoarding, now, true).buses.map(({ id }) => id), ['waiting-without-stop-updates', 'boarding-now']);
	assert.deepEqual(getTrackingView(report, airportBoarding, now, false).buses, []);
	assert.deepEqual(getTrackingView({ ...report, status: 'stale' }, airportBoarding, now, true).buses, []);
	const airportRoutes = getTrackingRoutes(service, { boardingPlaceId: airport.placeId, destinationPlaceId: '' });
	assert.ok(getTrackingView(report, { ...airportBoarding, routes: airportRoutes, destinationPlaceId: '' }, now, true).buses.some(({ id }) => id === 'different-route'));
});

test('airport boarding explains nearby reports that do not qualify for the chosen stop', () => {
	const service = createDefaultServiceData();
	const boardingStop = getTrackingStops(service).find((stop) => stop.placeId === service.airport.id);
	const destinationPlaceId = 'siripuram';
	const routes = getTrackingRoutes(service, { boardingPlaceId: boardingStop.placeId, destinationPlaceId });
	const airportView = { routes, boardingAtAirport: true, boardingStop, destinationPlaceId, activeRouteCodes: ['ASR-1', 'ASR-2'] };
	const terminal = { lat: 17.97983, lng: 83.50681, updatedAt: new Date(now - 10_000).toISOString() };
	const outbound = (id, details = {}) => bus(id, { direction: 'from-airport', position: terminal, ...details });
	const report = snapshot(
		outbound('inbound', { routeCode: 'ASR-1', direction: 'to-airport' }),
		outbound('wrong-route', { routeCode: 'ASR-1' }),
		outbound('skips-stop', { skippedStopIds: [destinationPlaceId] }),
		outbound('already-passed', { passedStopIds: [boardingStop.placeId] }),
		outbound('unconfirmed', { originBoardingUnavailable: true }),
		outbound('nearby', { position: { ...terminal, lat: 17.983 } }),
		outbound('too-far', { position: { ...terminal, lat: 17.989 } }),
		outbound('stale', { position: { ...terminal, updatedAt: new Date(now - 120_000).toISOString() } }),
		outbound('inactive-route', { routeCode: 'ASR-3', direction: 'to-airport' })
	);
	const view = getTrackingView(report, airportView, now, true);
	assert.deepEqual(view.buses, []);
	assert.deepEqual(view.nearbyBuses.map(({ id, reason, atTerminal }) => [id, reason, atTerminal]), [
		['inbound', 'arriving', true],
		['wrong-route', 'different-route', true],
		['skips-stop', 'skips-destination', true],
		['already-passed', 'passed-terminal', true],
		['unconfirmed', 'unconfirmed', true],
		['nearby', 'outside-terminal', false]
	]);
	assert.deepEqual(getTrackingView(report, airportView, now, false).nearbyBuses, []);
});

test('shows one nearest eligible recent bus and recalculates distance when the GPS fix moves', () => {
	const pair = { ...selection, boardingStop: { lat: 17.8, lng: 83.3, placeId: 'nad-junction' }, destinationPlaceId: 'bhogapuram-airport' };
	const bothStops = ['nad-junction', 'bhogapuram-airport'];
	const position = (latitudeOffset, age = 10_000) => ({
		lat: pair.boardingStop.lat + latitudeOffset,
		lng: pair.boardingStop.lng,
		updatedAt: new Date(now - age).toISOString()
	});
	const reports = (offset) => snapshot(
		bus('planned-but-farther', { position: position(0.01), upcomingStopIds: bothStops }),
		bus('nearest-recent', { routeCode: 'ASR-1', position: position(offset), upcomingStopIds: bothStops }),
		bus('stale-but-closer', { position: position(0.0001, 180_000), scheduledOriginAt: '2026-11-21T07:00:00.000Z', upcomingStopIds: bothStops }),
		bus('wrong-direction', { direction: 'from-airport', position: position(0), upcomingStopIds: bothStops }),
		bus('passed-boarding-stop', { position: position(0.0002), routeCode: 'ASR-1', upcomingStopIds: ['bhogapuram-airport'] })
	);
	const first = getTrackingView(reports(0.004), pair, now, true);
	assert.equal(first.matchedId, 'planned-but-farther');
	assert.deepEqual(first.buses.map(({ id }) => id), ['nearest-recent']);
	assert.equal(formatTrackingDistance(first.buses[0].distanceFromBoardingKm), '445 m');
	const moved = getTrackingView(reports(0.002), pair, now, true);
	assert.equal(formatTrackingDistance(moved.buses[0].distanceFromBoardingKm), '222 m');
	assert.deepEqual(getTrackingView(reports(0.002), pair, now, false).buses, []);
});

test('shows no approaching bus when progress is missing, passed, skipped, stale or in the wrong order', () => {
	const pair = { ...selection, boardingStop: { ...bus('at-stop').position, placeId: 'airport-junction' }, destinationPlaceId: 'bhogapuram-airport' };
	const report = snapshot(
		bus('unrecognized-progress', { gpsStopProgress: { nextStopId: 'airport-junction', passedStopIds: [] } }),
		bus('passed', { upcomingStopIds: ['bhogapuram-airport'] }),
		bus('missing-destination', { upcomingStopIds: ['airport-junction'] }),
		bus('wrong-stop-order', { upcomingStopIds: ['bhogapuram-airport', 'airport-junction'] }),
		bus('stale', { upcomingStopIds: ['airport-junction', 'bhogapuram-airport'], position: { ...pair.boardingStop, updatedAt: new Date(now - 180_000).toISOString() } })
	);
	assert.deepEqual(getTrackingView(report, pair, now, true).buses, []);
	assert.equal(getTrackingView(report, selection, now, true).buses.length, 5);
});

test('keeps the same stop-tracking bus through re-ranking and missing updates', () => {
	const boardingStop = { lat: 17.8, lng: 83.3, placeId: 'nad-junction' };
	const destinationPlaceId = 'bhogapuram-airport';
	const upcomingStopIds = [boardingStop.placeId, destinationPlaceId];
	const first = bus('first', { vehicleNumber: 'AP39AA1234', upcomingStopIds });
	const alternate = bus('alternate', { vehicleNumber: 'AP39AA1235', upcomingStopIds });
	const pair = { ...selection, boardingStop, destinationPlaceId, trackedStop: { bus: first } };
	const update = (report, checkedAt = now) => getTrackingView(report, pair, checkedAt, true);
	const moved = { ...first, position: { ...first.position, lat: 17.82 } };

	assert.deepEqual(update(snapshot(alternate, moved)).buses.map(({ id }) => id), ['first']);
	assert.equal(update(snapshot({ ...first, vehicleNumber: null })).buses[0].vehicleNumber, first.vehicleNumber);
	const gpsLost = update(snapshot(alternate));
	assert.equal(gpsLost.stopTrackingStatus, 'gps-missing');
	assert.equal(gpsLost.buses[0].id, first.id);
	assert.equal(gpsLost.buses[0].recent, false);
	assert.equal(gpsLost.buses[0].distanceFromBoardingKm, undefined);
	assert.equal(gpsLost.nextBus.id, alternate.id);
	assert.deepEqual(update(snapshot(alternate), now + 240_000).buses, []);
	assert.equal(update(snapshot(first), now + 120_000).stopTrackingStatus, 'gps-old');
	assert.equal(update(snapshot(alternate, { ...first, upcomingStopIds: undefined })).stopTrackingStatus, 'stop-unconfirmed');
	assert.equal(update(snapshot(alternate, first)).stopTrackingStatus, 'live');
	assert.deepEqual(update({ status: 'disabled', buses: [] }).buses, []);
});

test('a passed or reassigned bus is removed and the next bus stays a separate choice', () => {
	const boardingStop = { lat: 17.8, lng: 83.3, placeId: 'nad-junction' };
	const destinationPlaceId = 'bhogapuram-airport';
	const upcomingStopIds = [boardingStop.placeId, destinationPlaceId];
	const first = bus('first', { vehicleNumber: 'AP39AA1234', upcomingStopIds });
	const alternate = bus('alternate', { upcomingStopIds });
	const pair = { ...selection, boardingStop, destinationPlaceId, trackedStop: { bus: first } };
	const passed = getTrackingView(snapshot({ ...first, passedStopIds: [boardingStop.placeId] }, alternate), pair, now, true);
	assert.equal(passed.stopTrackingEndReason, 'passed');
	assert.deepEqual(passed.buses, []);
	assert.equal(passed.nextBus.id, alternate.id);
	const afterGap = getTrackingView(snapshot(first, alternate), { ...pair, trackedStop: { bus: first, endReason: 'passed' } }, now, true);
	assert.equal(afterGap.stopTrackingStatus, 'passed');
	assert.deepEqual(afterGap.buses, []);
	const replacement = { ...first, vehicleNumber: 'AP39AA9999' };
	const reassigned = getTrackingView(snapshot(replacement), pair, now, true);
	assert.equal(reassigned.stopTrackingEndReason, 'vehicle-changed');
	assert.equal(reassigned.nextBus.vehicleNumber, replacement.vehicleNumber);
});

test('the fleet shortcut follows the vehicle number across trips and never selects a replacement bus', () => {
	const original = bus('original-trip', { vehicleNumber: 'AP39AA1234', distanceFromBoardingKm: 2.1 });
	const replacement = bus(original.id, { vehicleNumber: 'AP39AA9999' });
	const outbound = bus('outbound-trip', { vehicleNumber: original.vehicleNumber, direction: 'from-airport' });
	const fleet = {
		routes: getTrackingRoutes(createDefaultServiceData(), { showAll: true }),
		freshOnly: true,
		fleetVehicle: original
	};
	const unavailable = getTrackingView(snapshot(replacement), fleet, now, true).buses;
	assert.deepEqual(unavailable.map(({ id, recent }) => [id, recent]), [[original.id, false]]);
	assert.equal(unavailable[0].distanceFromBoardingKm, undefined);
	assert.deepEqual(getTrackingView(snapshot(replacement, outbound), fleet, now, true).buses.map(({ id, recent }) => [id, recent]), [[outbound.id, true]]);
	assert.deepEqual(getTrackingView(snapshot(replacement), fleet, now + 240_000, true).buses, []);
	assert.deepEqual(getTrackingView({ status: 'disabled', buses: [] }, fleet, now, true).buses, []);
});

test('supports a bus exactly at the stop when both stops are still ahead', () => {
	const atStop = bus('at-stop', { upcomingStopIds: ['airport-junction', 'bhogapuram-airport'] });
	const report = snapshot(atStop, bus('also-visible', { routeCode: 'ASR-1' }));
	const nearest = getTrackingView(report, { ...selection, boardingStop: { ...atStop.position, placeId: 'airport-junction' }, destinationPlaceId: 'bhogapuram-airport' }, now, true);
	assert.equal(nearest.buses.length, 1);
	assert.equal(formatTrackingDistance(nearest.buses[0].distanceFromBoardingKm), '0 m');
	assert.equal(formatTrackingDistance(1.24), '1.2 km');
	const all = getTrackingView(report, selection, now, true);
	assert.equal(all.buses.length, 2);
	assert.ok(all.buses.every(({ distanceFromBoardingKm }) => distanceFromBoardingKm === undefined));
});
