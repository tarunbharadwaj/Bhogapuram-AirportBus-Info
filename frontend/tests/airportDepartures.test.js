import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getAirportDepartureOptions,
	getAirportDestinations,
	indiaDateTime
} from '../../shared/airportDepartures.mjs';
import { createDefaultServiceData } from '../../shared/serviceData.mjs';

const now = new Date('2026-08-31T00:00:00+05:30');
const request = (readyAt, destinationPlaceId = 'old-gajuwaka') => ({
	destinationPlaceId,
	readyAt
});

test('groups shared destinations across active routes', () => {
	const destinations = getAirportDestinations(createDefaultServiceData());
	const gajuwaka = destinations.find(
		(destination) => destination.placeId === 'old-gajuwaka'
	);
	assert.deepEqual(gajuwaka.routeCodes, ['ASR-1', 'ASR-2']);
	assert.equal(
		destinations.filter((destination) => destination.placeId === 'old-gajuwaka')
			.length,
		1
	);
});

test('returns the next three airport departures before the first bus', () => {
	const result = getAirportDepartureOptions(
		createDefaultServiceData(),
		request('2026-08-31T08:00:00+05:30'),
		{ now }
	);
	assert.deepEqual(
		result.options.map(({ routeCode, airportDepartureTime }) => [
			routeCode,
			airportDepartureTime
		]),
		[
			['ASR-1', '2026-08-31T02:45:00.000Z'],
			['ASR-2', '2026-08-31T03:00:00.000Z'],
			['ASR-1', '2026-08-31T03:15:00.000Z']
		]
	);
});

test('includes an exact departure and filters earlier buses', () => {
	const result = getAirportDepartureOptions(
		createDefaultServiceData(),
		request('2026-08-31T09:15:00+05:30'),
		{ now }
	);
	assert.equal(result.options[0].routeCode, 'ASR-2');
	assert.equal(result.options[0].airportDepartureTime, '2026-08-31T03:45:00.000Z');
});

test('rolls over to tomorrow after the final published service', () => {
	const result = getAirportDepartureOptions(
		createDefaultServiceData(),
		request('2026-08-31T23:50:00+05:30'),
		{ now }
	);
	assert.equal(result.options.length, 3);
	assert.equal(result.options[0].routeCode, 'ASR-1');
	assert.equal(result.options[0].airportDepartureTime, '2026-09-01T02:45:00.000Z');
});

test('uses only active routes that serve the selected destination', () => {
	const service = createDefaultServiceData();
	service.routes[0].enabled = false;
	const sharedStop = getAirportDepartureOptions(
		service,
		request('2026-08-31T08:00:00+05:30'),
		{ now }
	);
	assert.ok(sharedStop.options.every((option) => option.routeCode === 'ASR-2'));

	const defaultService = createDefaultServiceData();
	const routeSpecificStop = getAirportDepartureOptions(
		defaultService,
		request('2026-08-31T08:00:00+05:30', 'nad-junction'),
		{ now }
	);
	assert.ok(routeSpecificStop.options.every((option) => option.routeCode === 'ASR-1'));
});

test('returns the destination fare, landmark and reverse journey estimate', () => {
	const service = createDefaultServiceData();
	const stop = service.routes[0].stops.find(
		(candidate) => candidate.placeId === 'nad-junction'
	);
	const result = getAirportDepartureOptions(
		service,
		request('2026-08-31T08:00:00+05:30', 'nad-junction'),
		{ now }
	);
	assert.equal(result.options[0].fare, 350);
	assert.equal(result.options[0].landmark, stop.landmark);
	assert.equal(
		new Date(result.options[0].destinationArrivalTime) -
			new Date(result.options[0].airportDepartureTime),
		stop.journeyMinutes * 60_000
	);
});

test('rejects past times and invalid destinations', () => {
	const service = createDefaultServiceData();
	assert.throws(
		() =>
			getAirportDepartureOptions(
				service,
				request('2026-08-30T20:00:00+05:30'),
				{ now }
			),
		/past|current time|later/i
	);
	assert.throws(
		() =>
			getAirportDepartureOptions(
				service,
				request('2026-08-31T08:00:00+05:30', 'not-a-stop'),
				{ now }
			),
		/choose a destination/i
	);
});

test('constructs published times in India regardless of host timezone', () => {
	assert.equal(
		indiaDateTime('2026-08-31', '08:15').toISOString(),
		'2026-08-31T02:45:00.000Z'
	);
});

test('treats a ready time without an offset as India Standard Time', () => {
	const result = getAirportDepartureOptions(
		createDefaultServiceData(),
		request('2026-08-31T08:15:00'),
		{ now: new Date('2026-08-31T02:00:00.000Z') }
	);
	assert.equal(result.options[0].airportDepartureTime, '2026-08-31T02:45:00.000Z');
});
