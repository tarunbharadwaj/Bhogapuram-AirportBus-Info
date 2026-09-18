import { haversineKm } from '../../../shared/serviceRouting.mjs';

export const JOURNEY_SESSION_KEY = 'vizag-airport-journey-v1';
export const MAX_TRACKING_ACCURACY_METERS = 250;
export const MAX_READING_AGE_MS = 60_000;
export const AIRPORT_NAVIGATION_DESTINATION = Object.freeze({
	lat: 17.9751901,
	lng: 83.5070719
});

const isFiniteCoordinate = (value) =>
	typeof value === 'number' && Number.isFinite(value);

const isRegionalPosition = ({ lat, lng }) =>
	isFiniteCoordinate(lat) &&
	isFiniteCoordinate(lng) &&
	lat >= 17 &&
	lat <= 18.8 &&
	lng >= 82.5 &&
	lng <= 84.5;

const pointToSegmentKm = (point, start, end) => {
	const latitudeScale = 111.32;
	const longitudeScale =
		111.32 * Math.cos((((start.lat + end.lat) / 2) * Math.PI) / 180);
	const px = (point.lng - start.lng) * longitudeScale;
	const py = (point.lat - start.lat) * latitudeScale;
	const ex = (end.lng - start.lng) * longitudeScale;
	const ey = (end.lat - start.lat) * latitudeScale;
	const lengthSquared = ex * ex + ey * ey;
	const projection = lengthSquared
		? Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared))
		: 0;
	return Math.hypot(px - projection * ex, py - projection * ey);
};

export const createJourney = (service, routeCode, boardingStopId) => {
	const route = service.routes.find(
		(item) => item.enabled && item.code === routeCode
	);
	if (!route) throw new Error('Choose an active AeroExpress route.');
	const boardingIndex = route.stops.findIndex(
		(stop) => stop.id === boardingStopId
	);
	if (boardingIndex < 0)
		throw new Error('Choose a boarding stop served by this route.');

	return {
		routeCode: route.code,
		routeName: route.name,
		boardingStopId,
		boardingStop: route.stops[boardingIndex],
		estimatedJourneyMinutes: route.stops[boardingIndex].journeyMinutes,
		points: [
			...route.stops.slice(boardingIndex),
			{
				...service.airport,
				id: service.airport.id,
				placeId: service.airport.id,
				landmark: service.airport.fullName,
				isAirport: true
			}
		]
	};
};

export const createJourneySession = (journey, confirmedIndex = 0) => ({
	version: 1,
	routeCode: journey.routeCode,
	boardingStopId: journey.boardingStopId,
	confirmedIndex: Math.max(
		0,
		Math.min(Number(confirmedIndex) || 0, journey.points.length - 1)
	)
});

export const restoreJourneySession = (service, value) => {
	if (!value || value.version !== 1) return null;
	try {
		const journey = createJourney(
			service,
			String(value.routeCode || ''),
			String(value.boardingStopId || '')
		);
		return {
			journey,
			session: createJourneySession(journey, value.confirmedIndex)
		};
	} catch {
		return null;
	}
};

export const journeyNavigationLink = (
	airport = AIRPORT_NAVIGATION_DESTINATION
) => {
	const params = new URLSearchParams({
		api: '1',
		destination: `${airport.lat},${airport.lng}`,
		travelmode: 'driving',
		dir_action: 'navigate'
	});
	return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const initialJourneyProgress = (confirmedIndex = 0) => ({
	confirmedIndex: Math.max(0, Number(confirmedIndex) || 0),
	pendingIndex: null,
	pendingCount: 0,
	status: 'waiting',
	distanceToNextKm: null
});

const readingStatus = (reading, now) => {
	if (!reading || !isRegionalPosition(reading)) return 'unavailable';
	if (
		!Number.isFinite(reading.accuracy) ||
		reading.accuracy < 0 ||
		reading.accuracy > MAX_TRACKING_ACCURACY_METERS
	)
		return 'weak';
	const age = now - Number(reading.timestamp);
	if (!Number.isFinite(age) || age > MAX_READING_AGE_MS || age < -10_000)
		return 'stale';
	return 'valid';
};

export const updateJourneyProgress = (
	journey,
	previous,
	reading,
	now = Date.now()
) => {
	const lastIndex = journey.points.length - 1;
	const confirmedIndex = Math.max(
		0,
		Math.min(previous?.confirmedIndex || 0, lastIndex)
	);
	if (confirmedIndex >= lastIndex)
		return {
			...initialJourneyProgress(lastIndex),
			status: 'arrived',
			distanceToNextKm: 0
		};

	const quality = readingStatus(reading, now);
	if (quality !== 'valid')
		return {
			...previous,
			confirmedIndex,
			status: quality,
			distanceToNextKm: null
		};

	const remainingPoints = journey.points.slice(confirmedIndex + 1);
	const distances = remainingPoints.map((point) => haversineKm(reading, point));
	const nextDistance = distances[0];
	const segments = journey.points
		.slice(confirmedIndex)
		.slice(0, -1)
		.map((start, index) =>
			pointToSegmentKm(reading, start, journey.points[confirmedIndex + index + 1])
		);
	const routeDistance = Math.min(...segments);
	if (routeDistance > 4)
		return {
			...previous,
			confirmedIndex,
			status: 'off-route',
			distanceToNextKm: Math.round(nextDistance * 10) / 10
		};

	const geofenceKm = Math.min(
		0.75,
		Math.max(0.35, (reading.accuracy / 1000) * 1.5)
	);
	let detectedIndex = null;
	distances.forEach((distance, index) => {
		if (distance <= geofenceKm) detectedIndex = confirmedIndex + index + 1;
	});

	let pendingIndex = previous?.pendingIndex ?? null;
	let pendingCount = previous?.pendingCount || 0;
	let nextConfirmedIndex = confirmedIndex;
	if (detectedIndex !== null) {
		if (pendingIndex === detectedIndex) pendingCount += 1;
		else {
			pendingIndex = detectedIndex;
			pendingCount = 1;
		}
		if (pendingCount >= 2) {
			nextConfirmedIndex = Math.max(confirmedIndex, detectedIndex);
			pendingIndex = null;
			pendingCount = 0;
		}
	} else {
		pendingIndex = null;
		pendingCount = 0;
	}

	if (nextConfirmedIndex >= lastIndex)
		return {
			confirmedIndex: lastIndex,
			pendingIndex: null,
			pendingCount: 0,
			status: 'arrived',
			distanceToNextKm: 0
		};

	const updatedNextDistance = haversineKm(
		reading,
		journey.points[nextConfirmedIndex + 1]
	);
	return {
		confirmedIndex: nextConfirmedIndex,
		pendingIndex,
		pendingCount,
		status: updatedNextDistance <= 2 ? 'approaching' : 'tracking',
		distanceToNextKm: Math.round(updatedNextDistance * 10) / 10
	};
};

export const accuracyLabel = (accuracy) => {
	if (!Number.isFinite(accuracy)) return 'Unavailable';
	if (accuracy <= 50) return 'Precise';
	if (accuracy <= 150) return 'Good';
	if (accuracy <= MAX_TRACKING_ACCURACY_METERS) return 'Approximate';
	return 'Weak';
};
