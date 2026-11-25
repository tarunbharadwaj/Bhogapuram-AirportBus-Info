import { GPS_EXPIRY_MS, GPS_RECENT_MS, gpsAgeMs } from '../../../shared/liveTracking.mjs';
import { getActiveBoardingPlaces, haversineKm } from '../../../shared/serviceRouting.mjs';
import { AIRPORT_NAVIGATION_DESTINATION } from './format.js';

// Covers both the terminal boarding pin and the airport trip origin in the static feed.
const AIRPORT_TERMINAL_AREA = { lat: 17.9775, lng: 83.507 };
const AIRPORT_TERMINAL_RADIUS_KM = 0.45;
const AIRPORT_NEARBY_RADIUS_KM = 1;
const STOP_LAST_KNOWN_MS = 2 * GPS_RECENT_MS;
const snapshotStatuses = new Set(['available', 'stale', 'unavailable', 'disabled']);

export function isLiveBusesSnapshot(snapshot) {
	if (!snapshotStatuses.has(snapshot?.status) || !Array.isArray(snapshot.buses)) return false;
	if (['available', 'stale'].includes(snapshot.status) && !Number.isFinite(Date.parse(snapshot.feedUpdatedAt))) return false;
	if (snapshot.positionCoverage !== undefined && !['complete', 'partial'].includes(snapshot.positionCoverage)) return false;
	if (snapshot.stopUpdatesStatus !== undefined && !['available', 'delayed', 'unavailable', 'not-needed'].includes(snapshot.stopUpdatesStatus)) return false;
	return snapshot.buses.every((bus) =>
		typeof bus?.id === 'string' && typeof bus.routeCode === 'string' &&
		['to-airport', 'from-airport'].includes(bus.direction) &&
		Number.isFinite(bus.position?.lat) && Number.isFinite(bus.position?.lng) &&
		Number.isFinite(Date.parse(bus.position.updatedAt))
	);
}

export function getLiveFeedState(snapshot, networkStatus, now) {
	if (networkStatus === 'offline') return 'offline';
	if (networkStatus === 'unavailable') return 'tracking-error';
	if (!snapshot) return 'checking';
	if (snapshot.status === 'disabled') return 'disabled';
	if (snapshot.status === 'unavailable') return 'feed-unavailable';
	if (snapshot.status === 'stale' || now - Date.parse(snapshot.feedUpdatedAt) >= GPS_RECENT_MS) return 'feed-delayed';
	return 'ready';
}

export const directions = {
	'to-airport': 'City → Airport',
	'from-airport': 'Airport → City'
};

export function formatReportedDelay(seconds) {
	if (!Number.isFinite(seconds)) return 'Delay unavailable';
	if (seconds === 0) return '0 min reported delay';
	const duration = Math.abs(seconds) < 60 ? '<1 min' : `${Math.round(Math.abs(seconds) / 60)} min`;
	return `${duration} ${seconds > 0 ? 'behind schedule' : 'ahead of schedule'}`;
}

export function getTrackingStops(service) {
	const places = getActiveBoardingPlaces(service);
	if (!places.length || places.some((stop) => stop.placeId === service.airport.id)) return places;
	return [...places, {
		placeId: service.airport.id,
		name: service.airport.name,
		...AIRPORT_NAVIGATION_DESTINATION
	}];
}

export function getTrackingRoutes(service, { showAll, boardingPlaceId, destinationPlaceId }) {
	const activeRoutes = service.routes.filter((route) => route.enabled);
	if (showAll) return activeRoutes.flatMap(({ code: routeCode }) => [
		{ routeCode, direction: 'to-airport' }, { routeCode, direction: 'from-airport' }
	]);
	if (boardingPlaceId === service.airport.id && !destinationPlaceId) {
		return activeRoutes.map(({ code: routeCode }) => ({ routeCode, direction: 'from-airport' }));
	}
	if (!boardingPlaceId || !destinationPlaceId || boardingPlaceId === destinationPlaceId) return [];

	return activeRoutes.flatMap((route) => {
		// Public stop lists are in city-to-airport order with the airport as the terminus.
		const stops = route.stops.map((stop) => stop.placeId || stop.id);
		if (!stops.includes(service.airport.id)) stops.push(service.airport.id);
		const boardingIndex = stops.indexOf(boardingPlaceId);
		const destinationIndex = stops.indexOf(destinationPlaceId);
		if (boardingIndex < 0 || destinationIndex < 0) return [];
		return [{ routeCode: route.code, direction: boardingIndex < destinationIndex ? 'to-airport' : 'from-airport' }];
	});
}

function airportBoardingReason(bus, matchesRoute, atTerminal, airportId, destinationPlaceId) {
	if (bus.direction === 'to-airport') return 'arriving';
	if (!matchesRoute(bus)) return 'different-route';
	if (bus.skippedStopIds?.includes(destinationPlaceId)) return 'skips-destination';
	if (bus.passedStopIds?.includes(airportId) || bus.gpsStopProgress?.passedStopIds?.includes(airportId)) return 'passed-terminal';
	if (bus.originBoardingUnavailable || bus.skippedStopIds?.includes(airportId) ||
		(bus.upcomingStopIds?.length && !bus.upcomingStopIds.includes(airportId))) return 'unconfirmed';
	return atTerminal ? null : 'outside-terminal';
}

export function getTrackingView(snapshot, { routes, plannedRouteCode, scheduledOriginAt, boardingStop, destinationPlaceId, boardingAtAirport = false, activeRouteCodes = [], freshOnly = false, trackedStop, fleetVehicle }, now, connected) {
	const matchesRoute = (bus) => routes.some((route) => bus.routeCode === route.routeCode && bus.direction === route.direction);
	const gpsBuses = (snapshot?.buses || [])
		.filter((bus) => gpsAgeMs(bus.position, now) < GPS_EXPIRY_MS)
		.map((bus) => ({
			...bus,
			recent: connected && snapshot.status === 'available' && gpsAgeMs(bus.position, now) < GPS_RECENT_MS
		}));
	const buses = gpsBuses.filter((bus) => matchesRoute(bus) && (!freshOnly || bus.recent));
	if (fleetVehicle) {
		if (snapshot?.status === 'disabled') return { buses: [], matchedId: null };
		const report = gpsBuses.find((bus) => matchesRoute(bus) && bus.vehicleNumber === fleetVehicle.vehicleNumber);
		if (report?.recent) return { buses: [report], matchedId: null };
		const lastKnown = report && Date.parse(report.position.updatedAt) > Date.parse(fleetVehicle.position.updatedAt) ? report : fleetVehicle;
		const showLastKnown = matchesRoute(lastKnown) && gpsAgeMs(lastKnown.position, now) < STOP_LAST_KNOWN_MS;
		return {
			buses: showLastKnown ? [{ ...lastKnown, recent: false, distanceFromBoardingKm: undefined }] : [],
			matchedId: null
		};
	}
	const exact = scheduledOriginAt && plannedRouteCode
		? buses.filter((bus) => bus.routeCode === plannedRouteCode && Date.parse(bus.scheduledOriginAt) === Date.parse(scheduledOriginAt))
		: [];
	const matchedId = exact.length === 1 ? exact[0].id : null;
	if (boardingAtAirport && boardingStop) {
		const atAirport = [];
		const nearbyBuses = [];
		for (const bus of gpsBuses) {
			if (!bus.recent || (!activeRouteCodes.includes(bus.routeCode) && !matchesRoute(bus))) continue;
			const distance = haversineKm(AIRPORT_TERMINAL_AREA, bus.position);
			if (!Number.isFinite(distance) || distance > AIRPORT_NEARBY_RADIUS_KM) continue;
			const atTerminal = distance <= AIRPORT_TERMINAL_RADIUS_KM;
			const reason = airportBoardingReason(bus, matchesRoute, atTerminal, boardingStop.placeId, destinationPlaceId);
			if (reason) nearbyBuses.push({ ...bus, atTerminal, reason });
			else atAirport.push(bus);
		}
		atAirport.sort((left, right) =>
			Number(right.id === matchedId) - Number(left.id === matchedId) ||
			Date.parse(right.position.updatedAt) - Date.parse(left.position.updatedAt)
		);
		nearbyBuses.sort((left, right) => Number(right.atTerminal) - Number(left.atTerminal) ||
			Date.parse(right.position.updatedAt) - Date.parse(left.position.updatedAt));
		return { buses: atAirport, nearbyBuses, matchedId };
	}
	if (boardingStop) {
		const ranked = buses
			.filter((bus) => {
				if (!bus.recent || !Array.isArray(bus.upcomingStopIds)) return false;
				if (bus.passedStopIds?.includes(boardingStop.placeId) ||
					bus.skippedStopIds?.some((id) => id === boardingStop.placeId || id === destinationPlaceId)) return false;
				const boardingIndex = bus.upcomingStopIds.indexOf(boardingStop.placeId);
				return boardingIndex !== -1 && bus.upcomingStopIds.indexOf(destinationPlaceId) > boardingIndex;
			})
			.map((bus) => ({ ...bus, distanceFromBoardingKm: haversineKm(boardingStop, bus.position) }))
			.filter((bus) => Number.isFinite(bus.distanceFromBoardingKm))
			.sort((left, right) =>
				left.distanceFromBoardingKm - right.distanceFromBoardingKm ||
				Date.parse(right.position.updatedAt) - Date.parse(left.position.updatedAt) ||
				left.id.localeCompare(right.id)
			);
		if (!trackedStop) return { buses: ranked.slice(0, 1), matchedId, stopTrackingStatus: ranked.length ? 'live' : null };
		if (snapshot?.status === 'disabled') return { buses: [], matchedId };

		const previous = trackedStop.bus;
		const isTrackedBus = (bus) => bus.id === previous.id &&
			(!bus.vehicleNumber || !previous.vehicleNumber || bus.vehicleNumber === previous.vehicleNumber);
		const current = ranked.find(isTrackedBus);
		if (current && !trackedStop.endReason) {
			return {
				buses: [{ ...current, vehicleNumber: current.vehicleNumber || previous.vehicleNumber }],
				matchedId,
				stopTrackingStatus: 'live'
			};
		}

		const reported = buses.find(isTrackedBus);
		const replaced = buses.some((bus) => bus.recent && bus.id === previous.id && !isTrackedBus(bus));
		let endReason = trackedStop.endReason;
		if (!endReason && reported?.recent && reported.passedStopIds?.includes(boardingStop.placeId)) endReason = 'passed';
		if (!endReason && reported?.recent && reported.skippedStopIds?.some((id) => id === boardingStop.placeId || id === destinationPlaceId)) endReason = 'skipped';
		if (!endReason && replaced) endReason = 'vehicle-changed';

		const canShowLastPosition = !endReason && gpsAgeMs(previous.position, now) < STOP_LAST_KNOWN_MS;
		return {
			buses: canShowLastPosition ? [{ ...previous, recent: false, distanceFromBoardingKm: undefined }] : [],
			matchedId,
			stopTrackingStatus: endReason || (reported?.recent ? 'stop-unconfirmed' : reported ? 'gps-old' : 'gps-missing'),
			stopTrackingEndReason: endReason,
			nextBus: ranked.find((bus) => !isTrackedBus(bus))
		};
	}
	buses.sort((left, right) =>
		Number(right.id === matchedId) - Number(left.id === matchedId) ||
		Number(right.recent) - Number(left.recent) ||
		Date.parse(right.position.updatedAt) - Date.parse(left.position.updatedAt)
	);
	return { buses, matchedId };
}

export function formatTrackingDistance(kilometers) {
	const meters = Math.round(kilometers * 1000);
	return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function gpsAgeLabel(position, now) {
	const minutes = Math.floor(gpsAgeMs(position, now) / 60_000);
	return minutes < 1 ? 'Less than a minute ago' : `${minutes} min ago`;
}
