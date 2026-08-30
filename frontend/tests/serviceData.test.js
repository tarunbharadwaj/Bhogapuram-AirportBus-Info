import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SERVICE_DATA } from '../../shared/serviceData.mjs';
import { getDirectionalTimes } from '../../shared/serviceRouting.mjs';
import { FALLBACK_SERVICE } from '../src/data/fallbackService.js';
import { findNearestBoardingPoint } from '../src/lib/nearestStop.js';

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
			['Siripuram', 350], ['ISKCON Temple', 300], ['IT Hills', 250],
			['Marikavalasa', 200], ['Anandapuram', 150],
			['Tagarapuvalasa', 100], ['Airport Junction', 50]
		]
	);
	assert.equal(route('ASR-1').stops.some((stop) => stop.name === 'Madhurawada'), false);
	assert.equal(route('ASR-2').stops.some((stop) => stop.name === 'Railway Station'), false);
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
	assert.equal(route('ASR-1').stops.find((stop) => stop.id === 'zoo-park-stop').coordinateQuality, 'approximate-best-match');
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
