import assert from 'node:assert/strict';
import test from 'node:test';
import { TrackingModel, TrackingUpstreamError } from '../src/models/trackingModel.js';
import { TrackingService } from '../src/services/trackingService.js';
import { TrackingController } from '../src/controllers/trackingController.js';
import { createApp } from '../src/app.js';
import { buildStopTrackingOptions, classifyStopProgress, gpsQuality, inferTrackingRoute,
  providerScheduleIso, trackingDates, reconcileGps, GPS_EXPIRES_MS } from '../../shared/liveTracking.mjs';

const NOW = Date.parse('2026-09-12T15:00:00+05:30');
const trip = (extra = {}) => ({ id: '12092026_AW05_2_GAJUWAKA2', vehicleNumber: 'AP39WU3983', date: '12-Sep-2026',
  tripNumber: 2, tripStatus: '1', trackingEnabled: true, direction: 'from-airport', ...extra });
const position = (extra = {}) => ({ lat: 17.84, lng: 83.35, updatedAt: new Date(NOW - 30_000).toISOString(), ...extra });
const fakeModel = (extra = {}) => ({ discover: async () => ({ trips: [trip()], limited: false }),
  position: async () => position(), route: async () => 'ASR-1', ...extra });
const stringFields = (values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: value }]));
const document = (extra = {}) => ({ name: 'projects/p/databases/(default)/documents/serviceDetails/12092026_AW05_2_GAJUWAKA2',
  fields: stringFields({ serviceType: 'AERO EXPRESS', serviceDocId: '12092026_AW05_2_GAJUWAKA2', vehicleNumber: 'AP39WU3983',
    journeyDate: '12-Sep-2026', tripNumber: '2', tripStatus: '1', enableTracking: '1',
    sourceName: 'VISAKHAPATNAM ASR INTERNATIONAL AIRPORT', destinationName: 'OLD GAJUWAKA', ...extra }) });
const signal = () => new AbortController().signal;

test('tracking date boundary uses IST on a UTC server and retains yesterday before 04:00', () => {
  assert.deepEqual(trackingDates(Date.parse('2026-09-12T18:29:59Z')), ['12-Sep-2026']);
  assert.deepEqual(trackingDates(Date.parse('2026-09-12T18:30:00Z')), ['13-Sep-2026', '12-Sep-2026']);
  assert.deepEqual(trackingDates(Date.parse('2026-09-12T22:30:00Z')), ['13-Sep-2026']);
  assert.deepEqual(trackingDates(Date.parse('2025-12-31T19:00:00Z')), ['01-Jan-2026', '31-Dec-2025']);
});

test('GPS freshness boundaries are independent of trip status', () => {
  for (const [age, expected] of [[0, 'recent'], [120_000, 'recent'], [120_001, 'stale'], [GPS_EXPIRES_MS, 'stale'], [GPS_EXPIRES_MS + 1, 'unavailable'], [-60_001, 'unavailable']]) {
    assert.equal(gpsQuality(position({ updatedAt: new Date(NOW - age).toISOString() }), NOW), expected);
  }
  for (const invalid of [null, {}, position({ lat: 0 }), position({ lat: NaN }), position({ lng: Infinity }),
    position({ lat: '17.84' }), position({ lat: 25 }), position({ updatedAt: 'invalid' })]) {
    assert.equal(gpsQuality(invalid, NOW), 'unavailable');
  }
});

test('route identification requires distinctive waypoint evidence, not common stops or duty prefixes', () => {
  assert.equal(inferTrackingRoute(['9851_NADX', '223318_ZOOPK']), 'ASR-1');
  assert.equal(inferTrackingRoute(['1782984212336_ITH', '1641462090785_SIA']), 'ASR-2');
  assert.equal(inferTrackingRoute(['10821_OGWK', '1457005959824_MRKVLS']), null);
  assert.equal(inferTrackingRoute(['1_NADX', '2_ITH']), null);
  assert.equal(inferTrackingRoute([]), null);
});

test('out-of-order and implausible GPS jumps retain an explicitly stale last known position', () => {
  const previous = position();
  const backwards = position({ updatedAt: new Date(NOW - 60_000).toISOString() });
  assert.equal(reconcileGps(previous, backwards, NOW).rejected, true);
  const jump = position({ lat: 18.6, updatedAt: new Date(NOW).toISOString() });
  assert.deepEqual(reconcileGps(previous, jump, NOW), { position: previous, rejected: true });
  const normal = position({ lat: 17.841, updatedAt: new Date(NOW).toISOString() });
  assert.deepEqual(reconcileGps(previous, normal, NOW), { position: normal, rejected: false });
  assert.equal(reconcileGps(null, jump, NOW).rejected, false);
});

test('discovery sends a bounded projected AeroExpress/date query and discards unrelated fields', async () => {
  let request;
  const model = new TrackingModel({ fetchImpl: async (url, options) => {
    request = { url, ...options };
    return { ok: true, json: async () => [{ document: document({ driverMobileNo: 'PRIVATE', driverName: 'PRIVATE' }) }] };
  } });
  const result = await model.discover('12-Sep-2026', signal());
  const body = JSON.parse(request.body);
  assert.equal(body.structuredQuery.limit, 100);
  assert.equal(request.redirect, 'error');
  assert.ok(request.url.endsWith('/documents:runQuery'));
  assert.equal(body.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.stringValue, 'AERO EXPRESS');
  assert.ok(!request.body.includes('driver'));
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.equal(result.trips[0].direction, 'from-airport');
});

test('discovery rejects invalid dates, registrations, non-airport routes and unrelated services', async () => {
  const model = new TrackingModel({ fetchImpl: async () => ({ ok: true, json: async () => [
    { document: document({ journeyDate: '11-Sep-2026' }) }, { document: document({ serviceType: 'EXPRESS' }) },
    { document: document({ vehicleNumber: '<script>' }) }, { document: document({ tripNumber: 'NaN' }) },
    { document: document({ sourceName: 'OTHER', destinationName: 'OTHER' }) },
    { document: { ...document(), name: 'documents/serviceDetails/../../secret' } },
  ] }) });
  assert.deepEqual((await model.discover('12-Sep-2026', signal())).trips, []);
});

test('invalid provider response is a failure, not a fake empty fleet; denied access is surfaced', async () => {
  for (const payload of [{ error: 'bad' }, [{ error: 'bad' }], [{}], null]) {
    const model = new TrackingModel({ fetchImpl: async () => ({ ok: true, json: async () => payload }) });
    await assert.rejects(model.discover('12-Sep-2026', signal()));
  }
  const empty = new TrackingModel({ fetchImpl: async () => ({ ok: true, json: async () => [{ readTime: new Date(NOW).toISOString() }] }) });
  assert.equal((await empty.discover('12-Sep-2026', signal())).trips.length, 0);
  const denied = new TrackingModel({ fetchImpl: async () => ({ ok: false, status: 403 }) });
  await assert.rejects(denied.discover('12-Sep-2026', signal()), (error) => error.status === 403);
});

test('GPS requires matching registration and valid timestamp; no private fields are requested', async () => {
  let fields = { latitude: { doubleValue: 17.84 }, longitude: { doubleValue: 83.35 },
    refreshedAt: { integerValue: String(NOW) }, vehicleNumber: { stringValue: 'AP39WU3983' } };
  const model = new TrackingModel({ fetchImpl: async (url) => {
    assert.ok(!url.includes('driver'));
    assert.ok(url.includes('mask.fieldPaths=latitude'));
    return { ok: true, json: async () => ({ fields }) };
  } });
  assert.equal((await model.position(trip(), signal())).updatedAt, new Date(NOW).toISOString());
  fields = { ...fields, vehicleNumber: { stringValue: 'AP39WU3580' } };
  assert.equal(await model.position(trip(), signal()), null);
  fields = { ...fields, vehicleNumber: { stringValue: 'AP39WU3983' }, refreshedAt: { integerValue: '999999999999999999' } };
  assert.equal(await model.position(trip(), signal()), null);
  await assert.rejects(model.position(trip({ id: '../../secret' }), signal()));
});

test('waypoint reads request only operational fields and map provider IDs to website stops', async () => {
  let requestedUrl;
  const model = new TrackingModel({ fetchImpl: async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ documents: [
      { name: 'projects/p/databases/(default)/documents/serviceDetails/x/wayPoints/10821_OGWK', fields: stringFields({
        seqNo: '1', wayPointName: 'OLD GAJUWAKA', scheduleArrTime: '10:15 AM', latitude: '17.68605', longitude: '83.20421' }) },
      { name: 'projects/p/databases/(default)/documents/serviceDetails/x/wayPoints/9851_NADX', fields: stringFields({
        seqNo: '2', wayPointName: 'NAD JUNCTION', scheduleArrTime: '10:35 AM', vtsArrivalTime: String(NOW) }) }
    ] }) };
  } });
  const result = await model.waypoints(trip({ direction: 'to-airport', date: '13-Sep-2026' }), signal());
  assert.equal(result.routeCode, 'ASR-1');
  assert.deepEqual(result.waypoints.map((point) => point.placeId), ['old-gajuwaka', 'nad-junction']);
  assert.equal(result.waypoints[0].scheduledAt, '2026-09-13T04:45:00.000Z');
  assert.ok(requestedUrl.includes('mask.fieldPaths=vtsDepartureTime'));
  assert.ok(!requestedUrl.toLowerCase().includes('driver'));
});

test('single-flight cache coalesces visitors; discovery and route reads are cached separately', async () => {
  let time = NOW;
  let reads = 0, routes = 0, discoveries = 0;
  const service = new TrackingService({ now: () => time, model: fakeModel({
    position: async () => { reads++; return position(); },
    route: async () => { routes++; return 'ASR-1'; },
    discover: async () => { discoveries++; return { trips: [trip()], limited: false }; },
  }) });
  await Promise.all(Array.from({ length: 50 }, () => service.getSnapshot()));
  assert.deepEqual([reads, routes, discoveries], [1, 1, 1]);
  time += 31_000;
  await service.getSnapshot();
  assert.deepEqual([reads, routes, discoveries], [2, 1, 1]);
  time += 120_000;
  await service.getSnapshot();
  assert.deepEqual([reads, routes, discoveries], [3, 2, 2]);
});

test('provider schedules are interpreted in India and invalid values are rejected', () => {
  assert.equal(providerScheduleIso('13-Sep-2026', '10:15 AM'), '2026-09-13T04:45:00.000Z');
  assert.equal(providerScheduleIso('13-Sep-2026', '12:05 PM'), '2026-09-13T06:35:00.000Z');
  assert.equal(providerScheduleIso('bad', '10:15 AM'), null);
  assert.equal(providerScheduleIso('13-Sep-2026', '25:00 PM'), null);
});

const mappedWaypoints = [
  { placeId: 'old-gajuwaka', name: 'Old Gajuwaka', seqNo: 1, scheduledAt: '2026-09-13T04:45:00.000Z' },
  { placeId: 'nad-junction', name: 'NAD Junction', seqNo: 2, scheduledAt: '2026-09-13T05:05:00.000Z' },
  { placeId: 'gurudwara', name: 'Gurudwara', seqNo: 3, scheduledAt: '2026-09-13T05:20:00.000Z' }
];
const stop = { placeId: 'nad-junction', name: 'NAD Junction', lat: 17.744512, lng: 83.236829,
  routeCodes: ['ASR-1'] };
const trackedBus = (extra = {}) => ({ ...trip({ direction: 'to-airport' }), tripId: trip().id,
  routeCode: 'ASR-1', currentSeqNo: 1, previousStopName: 'Old Gajuwaka', waypoints: mappedWaypoints,
  routeOriginScheduledAt: mappedWaypoints[0].scheduledAt,
  position: { lat: 17.70, lng: 83.21, updatedAt: new Date(NOW - 20_000).toISOString() }, ...extra });

test('mapped waypoint progress distinguishes approaching, at-stop and passed buses', () => {
  const approaching = classifyStopProgress({ bus: trackedBus(), stop, now: NOW });
  assert.equal(approaching.stopProgress, 'approaching');
  assert.equal(approaching.stopsAway, 1);

  const atWaypoints = mappedWaypoints.map((item) => item.placeId === 'nad-junction'
    ? { ...item, vtsArrivalTime: NOW - 10_000 } : item);
  const atStop = classifyStopProgress({ bus: trackedBus({ currentSeqNo: 2, waypoints: atWaypoints,
    position: { lat: stop.lat, lng: stop.lng, updatedAt: new Date(NOW - 10_000).toISOString() } }), stop, now: NOW });
  assert.equal(atStop.stopProgress, 'at-stop');

  const departed = classifyStopProgress({ bus: trackedBus({ currentSeqNo: 2,
    waypoints: atWaypoints.map((item) => item.placeId === 'nad-junction' ? { ...item, vtsDepartureTime: NOW - 5_000 } : item) }), stop, now: NOW });
  assert.equal(departed.passed, true);
  assert.equal(classifyStopProgress({ bus: trackedBus({ currentSeqNo: 3 }), stop, now: NOW }).passed, true);
});

test('unmapped ASR-2 stops use surrounding waypoints without fabricating precise progress', () => {
  const waypoints = [
    { placeId: 'kancharapalem', name: 'Kancharapalem', seqNo: 3 },
    { placeId: 'siripuram', name: 'Siripuram', seqNo: 4 }
  ];
  const railway = { placeId: 'railway-station', name: 'Railway Station', lat: 17.722783, lng: 83.290794,
    routeCodes: ['ASR-2'] };
  const bus = trackedBus({ routeCode: 'ASR-2', waypoints, currentSeqNo: 2 });
  assert.equal(classifyStopProgress({ bus, stop: railway, now: NOW }).stopProgress, 'approaching');
  const within = { ...bus, currentSeqNo: 3, waypoints: [{ ...waypoints[0], vtsDepartureTime: NOW - 1_000 }, waypoints[1]] };
  assert.equal(classifyStopProgress({ bus: within, stop: railway, now: NOW }).stopProgress, 'uncertain');
  assert.equal(classifyStopProgress({ bus: { ...bus, currentSeqNo: 4 }, stop: railway, now: NOW }).passed, true);
});

test('stop options cap at three, exclude passed buses and never promote stale GPS as most likely', () => {
  const buses = [
    trackedBus({ tripId: '13092026_AW01_1_GAJUWAKA2', vehicleNumber: 'AP39WU0001', currentSeqNo: 3 }),
    trackedBus({ tripId: '13092026_AW02_1_GAJUWAKA2', vehicleNumber: 'AP39WU0002',
      position: { lat: 17.70, lng: 83.21, updatedAt: new Date(NOW - 300_000).toISOString() } }),
    trackedBus({ tripId: '13092026_AW03_1_GAJUWAKA2', vehicleNumber: 'AP39WU0003' }),
    trackedBus({ tripId: '13092026_AW04_1_GAJUWAKA2', vehicleNumber: 'AP39WU0004' }),
    trackedBus({ tripId: '13092026_AW05_1_GAJUWAKA2', vehicleNumber: 'AP39WU0005' })
  ];
  const result = buildStopTrackingOptions({ buses }, stop, { now: NOW });
  assert.equal(result.options.length, 3);
  assert.ok(result.options.every((item) => !item.passed));
  assert.equal(result.options[0].stopProgress, 'approaching');
  assert.notEqual(result.options[0].vehicleNumber, 'AP39WU0002');
});

test('planned trips match by India date, route and published origin time', () => {
  const fallback = buildStopTrackingOptions({ buses: [trackedBus()] }, stop, {
    routeCode: 'ASR-1', scheduledOriginAt: '2026-09-13T10:20:00+05:30', now: Date.parse('2026-09-13T09:00:00+05:30')
  });
  // Different origin time safely falls back to route-only candidates.
  assert.equal(fallback.plannedTripMatch, 'route-only');
  const matched = buildStopTrackingOptions({ buses: [trackedBus()] }, stop, {
    routeCode: 'ASR-1', scheduledOriginAt: '2026-09-13T10:15:00+05:30', now: Date.parse('2026-09-13T09:00:00+05:30')
  });
  assert.equal(matched.plannedTripMatch, 'exact');
  assert.equal(matched.options.length, 1);
  const future = buildStopTrackingOptions({ buses: [trackedBus()] }, stop, {
    routeCode: 'ASR-1', scheduledOriginAt: '2026-09-14T10:15:00+05:30', now: Date.parse('2026-09-13T09:00:00+05:30')
  });
  assert.equal(future.plannedTripMatch, 'future');
  assert.deepEqual(future.options, []);
});

test('latest completed trip suppresses old running trip; latest running trip deduplicates vehicle', async () => {
  const make = (status) => new TrackingService({ now: () => NOW, model: fakeModel({ discover: async () => ({ trips: [
    trip({ id: '12092026_AW05_1_GAJUWAKA2', tripNumber: 1 }), trip({ tripStatus: status }),
  ], limited: false }) }) });
  assert.equal((await make('2').getSnapshot()).buses.length, 0);
  assert.equal((await make('3').getSnapshot()).buses.length, 0);
  const result = await make('1').getSnapshot();
  assert.equal(result.buses.length, 1);
  assert.equal(result.buses[0].tripId, trip().id);
});

test('today supersedes yesterday after midnight regardless of trip number', async () => {
  const time = Date.parse('2026-09-12T19:00:00Z');
  const service = new TrackingService({ now: () => time, model: fakeModel({ discover: async (date) => ({ trips: [
    trip({ date, id: date === '13-Sep-2026' ? '13092026_AW05_1_GAJUWAKA2' : trip().id,
      tripNumber: date === '13-Sep-2026' ? 1 : 9, tripStatus: date === '13-Sep-2026' ? '2' : '1' }),
  ], limited: false }) }) });
  assert.equal((await service.getSnapshot()).buses.length, 0);
});

test('missing GPS and unknown route retain usable list entries without invented coordinates', async () => {
  const service = new TrackingService({ now: () => NOW, model: fakeModel({ position: async () => { throw new TrackingUpstreamError(404); }, route: async () => null }) });
  const result = await service.getSnapshot();
  assert.equal(result.partial, true);
  assert.equal(result.buses[0].position, null);
  assert.equal(result.buses[0].routeCode, null);
});

test('disabled tracking makes no upstream requests', async () => {
  const service = new TrackingService({ enabled: () => false, model: fakeModel({ discover: () => { throw new Error('must not call'); } }) });
  assert.equal((await service.getSnapshot()).status, 'disabled');
});

test('transient failures use short-lived cached snapshot and enforce retry cooldown', async () => {
  let time = NOW, fail = false, calls = 0;
  const service = new TrackingService({ now: () => time, model: fakeModel({ discover: async () => {
    calls++; if (fail) throw new Error('offline'); return { trips: [trip()], limited: false };
  } }) });
  await service.getSnapshot();
  fail = true; time += 121_000;
  const cached = await service.getSnapshot();
  assert.equal(cached.status, 'unavailable');
  assert.equal(cached.buses.length, 1);
  await service.getSnapshot();
  assert.equal(calls, 2);
  time += 301_000;
  assert.equal((await service.getSnapshot()).buses.length, 0);
});

test('access denied and rate limits stop hot-loop retries for five minutes', async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0, time = NOW;
    const service = new TrackingService({ now: () => time, model: fakeModel({ discover: async () => { calls++; throw new TrackingUpstreamError(status); } }) });
    assert.equal((await service.getSnapshot()).status, 'unavailable');
    time += 299_000;
    await service.getSnapshot();
    assert.equal(calls, 1);
  }
});

test('partial GPS failures retain original timestamp and never promote old coordinates to fresh', async () => {
  let time = NOW, fail = false;
  const service = new TrackingService({ now: () => time, model: fakeModel({ position: async () => {
    if (fail) throw new Error('timeout'); return position();
  } }) });
  await service.getSnapshot();
  time += 31_000; fail = true;
  const result = await service.getSnapshot();
  assert.equal(result.buses[0].position.updatedAt, position().updatedAt);
  assert.equal(result.buses[0].positionUnavailable, true);
  assert.equal(result.partial, true);
});

test('GPS concurrency is bounded and result cap is explicitly marked partial', async () => {
  let pending = 0, maximum = 0;
  const trips = Array.from({ length: 45 }, (_, index) => trip({ id: `12092026_AW${index}_2_GAJUWAKA2`, vehicleNumber: `AP39WU${String(index).padStart(4, '0')}` }));
  const service = new TrackingService({ now: () => NOW, model: fakeModel({ discover: async () => ({ trips, limited: true }), position: async () => {
    pending++; maximum = Math.max(maximum, pending); await new Promise((resolve) => setTimeout(resolve, 2)); pending--; return position();
  } }) });
  const result = await service.getSnapshot();
  assert.equal(result.buses.length, 40);
  assert.equal(result.partial, true);
  assert.ok(maximum <= 4);
});

test('controller excludes disabled routes and unconfirmed routes when either is disabled', async () => {
  const tracking = { getSnapshot: async () => ({ status: 'available', buses: [
    { routeCode: 'ASR-1' }, { routeCode: 'ASR-2' }, { routeCode: null },
  ] }) };
  let payload;
  const controller = new TrackingController(tracking, { getAll: () => ({ routes: [{ code: 'ASR-1', enabled: true }, { code: 'ASR-2', enabled: false }] }) });
  await controller.getLiveBuses({}, { set: (key, value) => assert.equal(value, 'no-store'), json: (value) => { payload = value; } });
  assert.equal(payload.buses.length, 1);
  assert.equal(payload.buses[0].routeCode, 'ASR-1');
  assert.ok(Number.isFinite(Date.parse(payload.serverTime)));
});

test('public live-buses HTTP route works and never forwards arbitrary query inputs', async (context) => {
  let argumentCount;
  const app = createApp({ tracking: { getSnapshot: async (...args) => {
    argumentCount = args.length;
    return { status: 'disabled', buses: [], checkedAt: null, partial: false };
  } } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/live-buses?url=https://example.com/private&date=1900`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).status, 'disabled');
  assert.equal(argumentCount, 0);
});

test('stop-tracking validates every filter and serves only canonical active stops', async (context) => {
  const app = createApp({ tracking: { getSnapshot: async () => ({ status: 'available', buses: [],
    checkedAt: new Date(NOW).toISOString(), partial: false }) } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/stop-tracking`;
  for (const query of [
    '?placeId=../../secret',
    '?placeId=unknown-stop',
    '?placeId=nad-junction&direction=from-airport',
    '?placeId=nad-junction&routeCode=ASR-9',
    '?placeId=railway-station&routeCode=ASR-1',
    '?placeId=nad-junction&scheduledOriginAt=tomorrow'
  ]) assert.equal((await fetch(`${base}${query}`)).status, 400);

  const response = await fetch(`${base}?placeId=nad-junction&routeCode=ASR-1`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.selection.placeId, 'nad-junction');
  assert.equal(payload.options.length, 0);
  assert.ok(payload.nextPublishedServices.length <= 3);
});
