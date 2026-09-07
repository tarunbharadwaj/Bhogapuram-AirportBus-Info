import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SERVICE_DATA } from '../../shared/serviceData.mjs';
import {
	findBoardingPlaceById,
	getActiveBoardingPlaces,
	getDirectionalTimes
} from '../../shared/serviceRouting.mjs';
import {
	addDaysToDateValue,
	indiaDateTime,
	indiaDateValue
} from '../../shared/airportDepartures.mjs';
import { FALLBACK_SERVICE } from '../src/data/fallbackService.js';
import { directionsLink } from '../src/lib/format.js';
import { findNearestBoardingPoint } from '../src/lib/nearestStop.js';
import { recommendTrip } from '../src/lib/recommendTrip.js';
import {
	buildTimetable,
	getVisibleTimetableServices
} from '../src/lib/timetable.js';

const route = (code) =>
	DEFAULT_SERVICE_DATA.routes.find((item) => item.code === code);

test('contains the corrected published directional timetables', () => {
	assert.deepEqual(route('ASR-1').timetables.toAirport, [
		'04:15', '04:50', '05:45', '06:35', '08:45', '09:05', '10:15', '11:00',
		'11:45', '12:30', '13:00', '13:30', '15:00', '15:30', '16:45', '17:30',
		'18:00', '18:45', '19:10', '19:45'
	]);
	assert.deepEqual(route('ASR-1').timetables.fromAirport, [
		'08:15', '08:45', '09:00', '09:30', '10:30', '10:45', '13:00', '14:15',
		'14:20', '15:00', '15:40', '16:30', '17:00', '18:30', '19:15', '20:00',
		'21:15', '21:30', '22:40', '23:35'
	]);
	assert.deepEqual(route('ASR-2').timetables.toAirport, [
		'04:20', '05:00', '05:20', '07:00', '07:35', '09:00', '09:30', '10:45',
		'11:15', '12:00', '13:00', '14:00', '14:30', '15:40', '16:20', '17:00',
		'17:40', '18:30', '18:40', '19:15'
	]);
	assert.deepEqual(route('ASR-2').timetables.fromAirport, [
		'08:30', '08:45', '09:15', '09:45', '10:20', '11:00', '12:50', '14:15',
		'15:00', '15:20', '16:15', '16:45', '17:20', '18:15', '19:00', '19:20',
		'20:40', '22:30', '23:00', '23:45'
	]);
	assert.equal(route('ASR-1').timetables.fromAirport.filter((time) => time === '21:30').length, 1);
});

test('contains the revised stops and fares', () => {
	assert.deepEqual(
		route('ASR-1').stops.map(({ name, fare }) => [name, fare]),
		[
			['Old Gajuwaka', 400], ['NAD Junction', 350], ['Gurudwara', 300],
			['Zoo Park', 250], ['Marikavalasa', 150], ['Tagarapuvalasa', 100],
			['Airport Junction', 50]
		]
	);
	assert.deepEqual(
		route('ASR-2').stops.map(({ name, fare }) => [name, fare]),
		[
			['Old Gajuwaka', 400], ['Scindia', 400], ['Kancharapalem', 400],
			['Railway Station', 300], ['RTC Complex', 350], ['Siripuram', 350],
			['Opposite VUDA Park', 300], ['ISKCON Temple', 300], ['IT Hills', 250],
			['Marikavalasa', 200], ['Anandapuram', 150],
			['Tagarapuvalasa', 100], ['Airport Junction', 50]
		]
	);
	assert.equal(route('ASR-1').stops.some((stop) => stop.name === 'Madhurawada'), false);
});

test('keeps published origin times exact and marks intermediate pins and times', () => {
	for (const item of DEFAULT_SERVICE_DATA.routes) {
		assert.deepEqual(item.times, item.timetables.toAirport);
		assert.equal(item.stops[0].offset, 0);
		assert.equal(item.stops[0].journeyMinutes, item.estimatedJourneyMinutes);
		assert.equal(item.stops.at(-1).offset + item.stops.at(-1).journeyMinutes, item.estimatedJourneyMinutes);
		assert.deepEqual(getDirectionalTimes(item, 'from-airport'), item.timetables.fromAirport);
	}
	assert.equal(route('ASR-1').estimatedJourneyMinutes, 120);
	assert.equal(route('ASR-2').estimatedJourneyMinutes, 150);
	assert.deepEqual(
		(({ lat, lng }) => ({ lat, lng }))(
			route('ASR-1').stops.find((stop) => stop.id === 'zoo-park-stop')
		),
		{ lat: 17.7689933, lng: 83.3439567 }
	);
	assert.equal(
		route('ASR-1').stops.find((stop) => stop.id === 'airport-junction-stop').coordinateQuality,
		'approximate-best-match'
	);
	for (const routeCode of ['ASR-1', 'ASR-2']) {
		const marikavalasa = route(routeCode).stops.find(
			(stop) => stop.id === 'marikavalasa-stop'
		);
		const tagarapuvalasa = route(routeCode).stops.find(
			(stop) => stop.id === 'tagarapuvalasa-stop'
		);
		assert.deepEqual(
			{ lat: marikavalasa.lat, lng: marikavalasa.lng },
			{ lat: 17.8371327, lng: 83.358547 }
		);
		assert.deepEqual(
			{ lat: tagarapuvalasa.lat, lng: tagarapuvalasa.lng },
			{ lat: 17.9287702, lng: 83.4236959 }
		);
	}
	const asr2Coordinates = Object.fromEntries(
		route('ASR-2').stops.map((stop) => [stop.id, [stop.lat, stop.lng]])
	);
	assert.deepEqual(asr2Coordinates['kancharapalem-stop'], [17.7322554, 83.2778582]);
	assert.deepEqual(asr2Coordinates['railway-stop'], [17.722783, 83.290794]);
	assert.deepEqual(asr2Coordinates['rtc-complex-stop'], [17.723881, 83.305552]);
	assert.deepEqual(asr2Coordinates['siripuram-stop'], [17.7209182, 83.3218202]);
	assert.deepEqual(asr2Coordinates['vuda-park-stop'], [17.723734, 83.337496]);
	assert.deepEqual(asr2Coordinates['iskcon-temple-stop'], [17.7677556, 83.3666993]);
	assert.deepEqual(asr2Coordinates['it-hills-stop'], [17.8103056, 83.3893056]);
});

test('groups both routes at a shared physical stop', () => {
	const nearest = findNearestBoardingPoint(DEFAULT_SERVICE_DATA, {
		lat: 17.68605,
		lng: 83.20421
	});
	assert.equal(nearest.placeId, 'old-gajuwaka');
	assert.deepEqual(nearest.routeCodes, ['ASR-1', 'ASR-2']);
	assert.equal(nearest.candidates.length, 2);
});

test('uses the same canonical data for the frontend fallback', () => {
	assert.deepEqual(FALLBACK_SERVICE, DEFAULT_SERVICE_DATA);
});

test('groups active manual boarding places and excludes disabled routes', () => {
	const places = getActiveBoardingPlaces(DEFAULT_SERVICE_DATA);
	const railwayStation = places.find(
		(place) => place.placeId === 'railway-station'
	);
	assert.deepEqual(railwayStation.routeCodes, ['ASR-2']);
	assert.deepEqual(
		{ lat: railwayStation.lat, lng: railwayStation.lng },
		{ lat: 17.722783, lng: 83.290794 }
	);
	assert.equal(places.filter((place) => place.placeId === 'marikavalasa').length, 1);
	assert.deepEqual(
		places.find((place) => place.placeId === 'marikavalasa').routeCodes,
		['ASR-1', 'ASR-2']
	);
	const draft = structuredClone(DEFAULT_SERVICE_DATA);
	draft.routes.find((item) => item.code === 'ASR-2').enabled = false;
	assert.deepEqual(
		findBoardingPlaceById(draft, 'marikavalasa').routeCodes,
		['ASR-1']
	);
	assert.equal(findBoardingPlaceById(draft, 'it-hills'), undefined);
});

test('selects Railway Station as an active ASR-2 boarding point', () => {
	const nearest = findNearestBoardingPoint(DEFAULT_SERVICE_DATA, {
		lat: 17.722783,
		lng: 83.290794
	});
	assert.equal(nearest.placeId, 'railway-station');
	assert.equal(nearest.stop.id, 'railway-stop');
	assert.deepEqual(nearest.routeCodes, ['ASR-2']);
	assert.equal(nearest.stop.fare, 300);
});

test('selects RTC Complex as an active ASR-2 boarding point', () => {
	const nearest = findNearestBoardingPoint(DEFAULT_SERVICE_DATA, {
		lat: 17.723881,
		lng: 83.305552
	});
	assert.equal(nearest.placeId, 'rtc-complex');
	assert.equal(nearest.stop.id, 'rtc-complex-stop');
	assert.deepEqual(nearest.routeCodes, ['ASR-2']);
	assert.equal(nearest.stop.fare, 350);
});

test('selects Opposite VUDA Park as an active ASR-2 boarding point', () => {
	const nearest = findNearestBoardingPoint(DEFAULT_SERVICE_DATA, {
		lat: 17.723734,
		lng: 83.337496
	});
	assert.equal(nearest.placeId, 'vuda-park');
	assert.equal(nearest.stop.id, 'vuda-park-stop');
	assert.deepEqual(nearest.routeCodes, ['ASR-2']);
	assert.equal(nearest.stop.fare, 300);
});

test('plans directly from a manually selected stop without location coverage checks', () => {
	const tomorrow = addDaysToDateValue(indiaDateValue(), 1);
	const result = recommendTrip(DEFAULT_SERVICE_DATA, {
		boardingPlaceId: 'it-hills',
		flightTime: indiaDateTime(tomorrow, '23:59').toISOString(),
		flightType: 'domestic'
	});
	assert.equal(result.boardingSelection.mode, 'manual-stop');
	assert.equal(result.boardingSelection.placeId, 'it-hills');
	assert.equal(result.nearestStop.distanceKm, 0);
	assert.equal(result.outsideServiceArea, false);
	assert.equal(result.best.stopId, 'it-hills-stop');
	assert.equal(result.best.stopTimeQuality, 'estimated');
	assert.ok(
		new Date(result.best.arriveAtStopBy) < new Date(result.best.departureTime)
	);
});

test('requires exactly one valid boarding source', () => {
	const tomorrow = addDaysToDateValue(indiaDateValue(), 1);
	const input = {
		flightTime: indiaDateTime(tomorrow, '23:59').toISOString(),
		flightType: 'domestic'
	};
	assert.throws(() => recommendTrip(DEFAULT_SERVICE_DATA, input), /either your current location/i);
	assert.throws(
		() => recommendTrip(DEFAULT_SERVICE_DATA, {
			...input,
			boardingPlaceId: 'not-an-active-stop'
		}),
		/active AeroExpress boarding stop/i
	);
	assert.throws(
		() => recommendTrip(DEFAULT_SERVICE_DATA, {
			...input,
			boardingPlaceId: 'it-hills',
			coordinates: { lat: 17.8, lng: 83.3 }
		}),
		/either your current location/i
	);
});

test('supports upcoming and complete daily timetable views', () => {
	const now = new Date('2026-09-07T16:00:00+05:30');
	const data = buildTimetable(
		DEFAULT_SERVICE_DATA,
		'asr-1',
		'gajuwaka-stop',
		'to-airport',
		now
	);
	const upcoming = getVisibleTimetableServices(data, 'upcoming', now);
	const fullDay = getVisibleTimetableServices(data, 'full-day', now);
	assert.equal(upcoming.length, 5);
	assert.equal(fullDay.length, route('ASR-1').timetables.toAirport.length);
	assert.equal(fullDay[0].timeQuality, 'published');
	assert.equal(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Asia/Kolkata',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		}).format(new Date(fullDay[0].departure)),
		'04:15'
	);

	const intermediate = buildTimetable(
		DEFAULT_SERVICE_DATA,
		'asr-1',
		'nad-stop',
		'to-airport',
		now
	);
	assert.equal(intermediate.services[0].timeQuality, 'estimated');
	assert.notEqual(
		intermediate.services[0].departure,
		intermediate.services[0].routeOriginDeparture
	);
});

test('builds directions with a captured origin only when one is provided', () => {
	const destination = { lat: 17.81, lng: 83.38 };
	const manualUrl = new URL(directionsLink({ destination }));
	assert.equal(manualUrl.searchParams.get('destination'), '17.81,83.38');
	assert.equal(manualUrl.searchParams.has('origin'), false);
	const locationUrl = new URL(
		directionsLink({ destination, origin: { lat: 17.7, lng: 83.3 } })
	);
	assert.equal(locationUrl.searchParams.get('origin'), '17.7,83.3');
});
