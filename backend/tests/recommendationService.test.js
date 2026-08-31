import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ServiceController } from '../src/controllers/serviceController.js';
import { DEFAULT_DATA } from '../src/data/defaultData.js';
import { ServiceModel } from '../src/models/serviceModel.js';
import { nearestStop, recommendTrip } from '../src/services/recommendationService.js';
import { findAirportDepartureOptions } from '../src/services/airportDepartureService.js';
import { getAirportDepartureOptions } from '../../shared/airportDepartures.mjs';

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

test('evaluates both active routes at a shared boarding place', () => {
  const nearest = nearestStop(DEFAULT_DATA, { lat: 17.68605, lng: 83.20421 });
  assert.deepEqual(nearest.routeCodes, ['ASR-1', 'ASR-2']);
  assert.equal(nearest.candidates.length, 2);

  const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
  tomorrow.setHours(23, 59, 0, 0);
  const result = recommendTrip(DEFAULT_DATA, {
    coordinates: { lat: 17.68605, lng: 83.20421 },
    flightTime: tomorrow.toISOString(),
    flightType: 'domestic',
  });
  assert.equal(result.best.routeCode, 'ASR-1');
  assert.deepEqual(result.nearestStop.routeCodes, ['ASR-1', 'ASR-2']);
});

test('normalizes irregular directional timetables and rejects invalid times', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aeroexpress-model-'));
  const dataFile = path.join(directory, 'service-data.json');
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const model = new ServiceModel(dataFile);
  const draft = structuredClone(DEFAULT_DATA);
  draft.routes[0].timetables.toAirport = ['18:00', '04:15', '18:00'];
  const saved = model.replace(draft);
  assert.deepEqual(saved.routes[0].timetables.toAirport, ['04:15', '18:00', '18:00']);
  assert.deepEqual(saved.routes[0].times, saved.routes[0].timetables.toAirport);

  const invalid = structuredClone(saved);
  invalid.routes[0].timetables.fromAirport = ['24:10'];
  assert.throws(() => model.replace(invalid), /invalid time/i);
});

test('migrates legacy saved data while preserving public status settings', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aeroexpress-migration-'));
  const dataFile = path.join(directory, 'service-data.json');
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(dataFile, JSON.stringify({
    status: { ...DEFAULT_DATA.status, announcementVisible: false, announcement: 'Saved status' },
    routes: [],
  }));
  const model = new ServiceModel(dataFile);
  assert.equal(model.getAll().schemaVersion, 2);
  assert.equal(model.getAll().status.announcementVisible, false);
  assert.equal(model.getAll().status.announcement, 'Saved status');
  assert.equal(model.getAll().routes[0].timetables.toAirport[0], '04:15');
});

test('serves the requested timetable direction through the API controller', () => {
  const controller = new ServiceController({ getAll: () => DEFAULT_DATA });
  const responses = [];
  const response = { json: (body) => responses.push(body) };
  controller.getTimetable({ query: {
    routeId: 'asr-1',
    stopId: 'gajuwaka-stop',
    direction: 'from-airport',
  } }, response);
  assert.equal(responses[0].direction, 'from-airport');
  const indiaTime = (value) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
  assert.equal(indiaTime(responses[0].services[0].departure), '08:15');
  assert.equal(indiaTime(responses[0].services.at(-1).departure), '23:35');
});

test('keeps backend and shared airport departure results identical', () => {
  const input = {
    destinationPlaceId: 'old-gajuwaka',
    readyAt: '2026-09-01T19:30:00+05:30',
  };
  const options = { now: new Date('2026-09-01T12:00:00+05:30') };
  assert.deepEqual(
    findAirportDepartureOptions(DEFAULT_DATA, input, options),
    getAirportDepartureOptions(DEFAULT_DATA, input, options),
  );
});

test('serves airport departure options through the API controller', () => {
  const controller = new ServiceController({ getAll: () => DEFAULT_DATA });
  const responses = [];
  const response = {
    json: (body) => responses.push(body),
    status: () => response,
  };
  controller.createAirportDepartures({ body: {
    destinationPlaceId: 'nad-junction',
    readyAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } }, response);
  assert.equal(responses[0].direction, 'from-airport');
  assert.equal(responses[0].destination.placeId, 'nad-junction');
  assert.ok(responses[0].options.length > 0);
  assert.ok(responses[0].options.every((option) => option.routeCode === 'ASR-1'));
});
