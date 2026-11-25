import { addDaysToDateValue, indiaDateTime, indiaDateValue } from '../../../shared/airportDepartures.mjs';
import { GPS_EXPIRY_MS, GPS_RECENT_MS, LIVE_REFRESH_MS, RECLAIM_PLACE_IDS, gpsAgeMs } from '../../../shared/liveTracking.mjs';
import { AIRPORT_CORRIDOR, RECLAIM_TRIPS } from '../data/reclaimAeroExpress.js';
import { estimateAirportStopProgress } from './airportGpsProgress.js';

const FEED_URL = 'https://maps.reclaim.city/apsrtc/rt/vehicle_positions.json';
const TRIP_UPDATES_URL = 'https://maps.reclaim.city/apsrtc/rt/trip_updates.json';
const MANUAL_REFRESH_INTERVAL_MS = 15_000;
const FUTURE_TOLERANCE_MS = 30_000;
const FEED_STALE_MS = 5 * 60_000;
const PROGRESS_RETENTION_MS = 6 * 60 * 60_000;

function parseTimestamp(value, now) {
	if (!/^\d{10}$/.test(String(value))) return null;
	const time = Number(value) * 1000;
	return time <= now + FUTURE_TOLERANCE_MS ? time : null;
}

function registration(report) {
	for (const value of [report.vehicle?.licensePlate, report.vehicle?.label]) {
		const plate = typeof value === 'string' ? value.replace(/[ -]/g, '').toUpperCase() : '';
		if (/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{3,4}$/.test(plate)) return plate;
	}
	return null;
}

function canTrackStops(bus, now) {
	const minutesAfterDeparture = (Date.parse(bus.position.updatedAt) - Date.parse(bus.scheduledOriginAt)) / 60_000;
	return gpsAgeMs(bus.position, now) < GPS_RECENT_MS && minutesAfterDeparture >= -15 && minutesAfterDeparture <= 300;
}

function getStopPredictions(stops, bus, updatedAt) {
	if (stops.some((stop, index) => index > 0 && stop.stopSequence === stops[index - 1].stopSequence)) return [];
	const latestArrival = Date.parse(bus.scheduledOriginAt) + 8 * 60 * 60_000;
	return stops.flatMap(({ stopSequence, arrival }) => {
		const { placeId, scheduledAt } = bus.scheduledStops[stopSequence - 1];
		const arrivalTime = /^\d{10}$/.test(String(arrival?.time)) ? Number(arrival.time) * 1000 : null;
		const estimatedAt = arrivalTime !== null && arrivalTime >= updatedAt - 60_000 && arrivalTime <= latestArrival
			? new Date(arrivalTime).toISOString() : null;
		const delay = arrival?.delay;
		const delaySeconds = Number.isInteger(delay) && Math.abs(delay) <= 6 * 60 * 60 ? delay : null;
		return estimatedAt !== null || delaySeconds !== null ? [{ placeId, scheduledAt, estimatedAt, delaySeconds }] : [];
	});
}

export function parseReclaimPositions(feed, now = Date.now()) {
	const feedTime = parseTimestamp(feed?.header?.timestamp, now);
	if (feedTime === null || !Array.isArray(feed?.entity)) throw new Error('Invalid Reclaim GPS feed');
	const today = indiaDateValue(now);
	const yesterday = addDaysToDateValue(today, -1);
	const latestByVehicle = new Map();
	let positionCoverage = 'complete';
	for (const entity of feed.entity) {
		if (entity?.isDeleted) continue;
		const report = entity?.vehicle;
		if (!report || typeof report !== 'object' || Array.isArray(report)) {
			positionCoverage = 'partial';
			continue;
		}
		const trip = report.trip;
		const airportReport = trip?.routeId === AIRPORT_CORRIDOR || RECLAIM_TRIPS.has(trip?.tripId);
		const gpsTime = parseTimestamp(report.timestamp, now);
		if (gpsTime === null) {
			if (airportReport) positionCoverage = 'partial';
			continue;
		}
		if (now - gpsTime >= GPS_EXPIRY_MS) continue;
		const vehicleNumber = registration(report);
		const tripKey = `${trip?.startDate}:${trip?.tripId}`;
		if (!vehicleNumber && !RECLAIM_TRIPS.has(trip?.tripId)) {
			if (airportReport && now - gpsTime < GPS_RECENT_MS) positionCoverage = 'partial';
			continue;
		}
		const key = vehicleNumber || tripKey;
		const previous = latestByVehicle.get(key);
		if (!previous || gpsTime > previous.gpsTime) {
			latestByVehicle.set(key, { report, gpsTime, vehicleNumber, tripKey, airportReport });
		} else if (gpsTime === previous.gpsTime && previous.tripKey !== tripKey) {
			previous.ambiguous = true;
			previous.airportReport ||= airportReport;
		}
	}

	const buses = new Map();
	for (const { report, gpsTime, vehicleNumber, ambiguous, airportReport } of latestByVehicle.values()) {
		if (!airportReport) continue;
		const { tripId, startDate, routeId } = report.trip ?? {};
		const schedule = RECLAIM_TRIPS.get(tripId);
		const date = typeof startDate === 'string' && /^\d{8}$/.test(startDate)
			? `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6)}` : null;
		const { latitude: lat, longitude: lng, speed, bearing } = report.position || {};
		if (ambiguous || routeId !== AIRPORT_CORRIDOR || !schedule || (date !== today && date !== yesterday) ||
			!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 17.60 || lat > 18.10 || lng < 83.09 || lng > 83.56) {
			if (now - gpsTime < GPS_RECENT_MS) positionCoverage = 'partial';
			continue;
		}
		const origin = indiaDateTime(date, schedule.time);
		const id = `${startDate}:${tripId}`;
		const bus = {
			id, vehicleNumber, serviceNumber: tripId.split('_').slice(0, 2).join('/'),
			providerVehicleId: report.vehicle?.id,
			bearingDegrees: Number.isFinite(bearing) && bearing >= 0 && bearing < 360 ? bearing : null,
			routeCode: schedule.routeCode, direction: schedule.direction,
			scheduledOriginAt: origin.toISOString(),
			scheduledStops: schedule.stopIds.map((stopId, index) => ({
				placeId: RECLAIM_PLACE_IDS.get(stopId),
				scheduledAt: new Date(origin.getTime() + schedule.arrivalOffsets[index] * 60_000).toISOString()
			})),
			position: { lat, lng, updatedAt: new Date(gpsTime).toISOString() },
			speedKph: Number.isFinite(speed) && speed >= 0 ? Math.round(speed * 3.6) : null
		};
		const previous = buses.get(id);
		if (!previous || bus.position.updatedAt > previous.position.updatedAt) buses.set(id, bus);
	}
	return { feedTime, positionCoverage, buses: [...buses.values()] };
}

function parseUpcomingStops(feed, buses, now) {
	const feedTime = parseTimestamp(feed?.header?.timestamp, now);
	if (feedTime === null || !Array.isArray(feed?.entity)) throw new Error('Invalid live stop feed');
	if (now - feedTime >= FEED_STALE_MS) return { updates: new Map(), stopUpdatesStatus: 'delayed' };
	const byTrip = new Map(buses.map((bus) => [bus.id, bus]));
	const upcomingByTrip = new Map();
	for (const entity of feed.entity) {
		const update = entity?.tripUpdate;
		const trip = update?.trip;
		const id = `${trip?.startDate}:${trip?.tripId}`;
		const bus = byTrip.get(id);
		if (!bus || entity.isDeleted || trip.routeId !== AIRPORT_CORRIDOR) continue;
		if (!bus.providerVehicleId || bus.providerVehicleId !== update.vehicle?.id) continue;
		const vehicleNumber = registration(update);
		if (bus.vehicleNumber && vehicleNumber && bus.vehicleNumber !== vehicleNumber) continue;
		const updatedAt = parseTimestamp(update.timestamp, now);
		if (updatedAt !== Date.parse(bus.position.updatedAt) || now - updatedAt >= GPS_RECENT_MS) continue;
		if (upcomingByTrip.has(id) || ['CANCELED', 'DELETED'].includes(trip.scheduleRelationship)) {
			upcomingByTrip.set(id, null);
			continue;
		}
		if (!Array.isArray(update.stopTimeUpdate)) continue;
		const tripStopIds = RECLAIM_TRIPS.get(trip.tripId).stopIds;
		const stops = update.stopTimeUpdate
			.filter((stop) => Number.isInteger(stop?.stopSequence) && stop.stopSequence > 0 &&
				stop.stopSequence <= tripStopIds.length && typeof stop.stopId === 'string')
			.sort((left, right) => left.stopSequence - right.stopSequence);
		if (stops.length) upcomingByTrip.set(id, { updatedAt, stops, tripStopIds });
	}
	return { updates: upcomingByTrip, stopUpdatesStatus: 'available' };
}

export class ReclaimTrackingService {
	constructor({ fetchFeed = fetch, now = Date.now, enabled = process.env.LIVE_TRACKING_ENABLED !== 'false' } = {}) {
		this.fetchFeed = fetchFeed;
		this.now = now;
		this.enabled = enabled;
	}

	#cached;
	#lastRefreshStartedAt = -Infinity;
	#blockedUntil = 0;
	#progressRetryAt = 0;
	#furthestStopByTrip = new Map();
	#inFlight;

	async #getUpcomingStops(buses, signal) {
		const now = this.now();
		// Waiting and parked buses can report GPS outside their trip window.
		// Keep their positions for the fleet view without treating that as trip progress.
		const eligible = buses.filter((bus) => canTrackStops(bus, now));
		if (eligible.length === 0) return { updates: new Map(), stopUpdatesStatus: 'not-needed' };
		if (now < this.#progressRetryAt) return { updates: new Map(), stopUpdatesStatus: 'unavailable' };
		try {
			const response = await this.fetchFeed(TRIP_UPDATES_URL, { signal, redirect: 'error' });
			if (response.status === 429 || response.status === 403) this.#progressRetryAt = this.now() + FEED_STALE_MS;
			if (response.ok) return parseUpcomingStops(await response.json(), eligible, this.now());
		} catch {
			// GPS stays available in the snapshot when stop progress is unavailable.
		}
		return { updates: new Map(), stopUpdatesStatus: 'unavailable' };
	}

	#attachUpcomingStops(buses, updates) {
		const now = this.now();
		for (const [id, progress] of this.#furthestStopByTrip) {
			if (now - progress.updatedAt > PROGRESS_RETENTION_MS) this.#furthestStopByTrip.delete(id);
		}
		return buses.map(({ providerVehicleId, ...bus }) => {
			const update = updates.get(bus.id);
			const previous = this.#furthestStopByTrip.get(bus.id);
			if (bus.direction === 'from-airport' && (update === null || previous?.passedOrigin)) {
				bus.originBoardingUnavailable = true;
			}
			if (update === undefined && canTrackStops(bus, now)) {
				const schedule = RECLAIM_TRIPS.get(bus.id.split(':')[1]);
				const gpsStopProgress = estimateAirportStopProgress(bus, bus.bearingDegrees, schedule);
				if (gpsStopProgress && gpsStopProgress.nextSequence >= (previous?.nextSequence ?? 0)) return { ...bus, gpsStopProgress };
			}
			if (!update || (previous && update.updatedAt < previous.updatedAt)) return bus;
			// A positional estimate can jump back. Keep stops already reported as passed out of the results.
			const nextSequence = Math.max(update.stops[0].stopSequence, previous?.nextSequence || 0);
			const matchesPublishedOrder = update.stops.every(({ stopId, stopSequence }) => update.tripStopIds[stopSequence - 1] === stopId);
			const passedOrigin = previous?.passedOrigin || (matchesPublishedOrder && update.stops[0].stopSequence > 1);
			this.#furthestStopByTrip.set(bus.id, { nextSequence, updatedAt: update.updatedAt, passedOrigin });
			const remainingStops = update.stops.filter((stop) => stop.stopSequence >= nextSequence);
			const upcomingStops = remainingStops.filter((stop) => !['SKIPPED', 'NO_DATA'].includes(stop.scheduleRelationship));
			const upcomingStopIds = upcomingStops
				.map((stop) => RECLAIM_PLACE_IDS.get(stop.stopId))
				.filter(Boolean);
			const skippedStopIds = remainingStops
				.filter((stop) => stop.scheduleRelationship === 'SKIPPED')
				.map((stop) => RECLAIM_PLACE_IDS.get(stop.stopId))
				.filter(Boolean);
			const passedStopIds = matchesPublishedOrder && nextSequence <= update.tripStopIds.length
				? update.tripStopIds.slice(0, nextSequence - 1).map((stopId) => RECLAIM_PLACE_IDS.get(stopId))
				: undefined;
			const stopPredictions = matchesPublishedOrder ? getStopPredictions(upcomingStops, bus, update.updatedAt) : [];
			return { ...bus, upcomingStopIds, passedStopIds, skippedStopIds, stopPredictions };
		});
	}

	async #refresh() {
		try {
			const signal = AbortSignal.timeout(8000);
			const response = await this.fetchFeed(FEED_URL, { signal, redirect: 'error' });
			if (response.status === 429 || response.status === 403) this.#blockedUntil = this.now() + FEED_STALE_MS;
			if (!response.ok) throw new Error(`Reclaim GPS returned ${response.status}`);
			const parsed = parseReclaimPositions(await response.json(), this.now());
			if (this.#cached && parsed.feedTime < this.#cached.feedTime) throw new Error('Reclaim feed moved backwards');
			const { updates, stopUpdatesStatus } = await this.#getUpcomingStops(parsed.buses, signal);
			this.#cached = { ...parsed, stopUpdatesStatus, buses: this.#attachUpcomingStops(parsed.buses, updates) };
			return true;
		} catch {
			return false;
		}
	}

	async getSnapshot({ refresh = false } = {}) {
		if (!this.enabled) return { status: 'disabled', feedUpdatedAt: null, buses: [] };
		const startedAt = this.now();
		const interval = refresh ? MANUAL_REFRESH_INTERVAL_MS : LIVE_REFRESH_MS;
		if (!this.#inFlight && startedAt >= this.#blockedUntil && startedAt - this.#lastRefreshStartedAt >= interval) {
			this.#lastRefreshStartedAt = startedAt;
			this.#inFlight = this.#refresh().then((success) => {
				this.lastRefreshSucceeded = success;
				this.#inFlight = undefined;
			});
		}
		await this.#inFlight;
		if (!this.#cached) return { status: 'unavailable', feedUpdatedAt: null, buses: [] };
		const now = this.now();
		const { feedTime, buses, positionCoverage, stopUpdatesStatus } = this.#cached;
		return {
			status: this.lastRefreshSucceeded && now - feedTime < FEED_STALE_MS ? 'available' : 'stale',
			feedUpdatedAt: new Date(feedTime).toISOString(),
			positionCoverage,
			stopUpdatesStatus,
			buses: buses.filter((bus) => gpsAgeMs(bus.position, now) < GPS_EXPIRY_MS)
		};
	}
}
