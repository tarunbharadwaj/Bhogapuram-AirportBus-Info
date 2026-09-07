import {
	SERVICE_AREA_RADIUS_KM,
	isOutsideServiceArea
} from './serviceArea.mjs';

const EARTH_RADIUS_KM = 6371;

export const timeToMinutes = (time) => {
	const [hours, minutes] = String(time).split(':').map(Number);
	return hours * 60 + minutes;
};

export const isValidTime = (time) => {
	if (!/^\d{2}:\d{2}$/.test(String(time))) return false;
	const [hours, minutes] = String(time).split(':').map(Number);
	return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

export const haversineKm = (from, to) => {
	const radians = (value) => (value * Math.PI) / 180;
	const latitudeDelta = radians(to.lat - from.lat);
	const longitudeDelta = radians(to.lng - from.lng);
	const fromLatitude = radians(from.lat);
	const toLatitude = radians(to.lat);
	const haversine =
		Math.sin(latitudeDelta / 2) ** 2 +
		Math.cos(fromLatitude) *
			Math.cos(toLatitude) *
			Math.sin(longitudeDelta / 2) ** 2;
	return (
		EARTH_RADIUS_KM *
		2 *
		Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
	);
};

export const getDirectionalTimes = (route, direction = 'to-airport') => {
	const key = direction === 'from-airport' ? 'fromAirport' : 'toAirport';
	return route.timetables?.[key] || route.times || [];
};

const activeBoardingEntries = (service) =>
	service.routes
		.filter((route) => route.enabled)
		.flatMap((route) =>
			route.stops.map((stop) => ({
				route,
				routeCode: route.code,
				stop,
				placeId: stop.placeId || stop.id
			}))
		);

export const getActiveBoardingPlaces = (service) => {
	const places = new Map();
	for (const entry of activeBoardingEntries(service)) {
		const current = places.get(entry.placeId);
		if (current) {
			if (!current.routeCodes.includes(entry.route.code))
				current.routeCodes.push(entry.route.code);
			continue;
		}
		places.set(entry.placeId, {
			placeId: entry.placeId,
			name: entry.stop.name,
			landmark: entry.stop.landmark,
			lat: entry.stop.lat,
			lng: entry.stop.lng,
			routeCodes: [entry.route.code]
		});
	}
	return [...places.values()].sort((left, right) =>
		left.name.localeCompare(right.name)
	);
};

export const findBoardingPlaceById = (service, requestedPlaceId) => {
	const placeId = String(requestedPlaceId || '').trim();
	if (!placeId) return undefined;
	const candidates = activeBoardingEntries(service).filter(
		(entry) => entry.placeId === placeId
	);
	const selected = candidates[0];
	if (!selected) return undefined;
	return {
		...selected,
		candidates,
		routeCodes: [...new Set(candidates.map((entry) => entry.route.code))],
		distanceKm: 0,
		outsideServiceArea: false,
		serviceAreaRadiusKm: SERVICE_AREA_RADIUS_KM
	};
};

export const findNearestBoardingPlace = (service, point) => {
	const entries = activeBoardingEntries(service)
		.map((entry) => ({
			...entry,
			distanceKm: haversineKm(point, entry.stop)
		}))
		.sort((left, right) => left.distanceKm - right.distanceKm);

	const nearest = entries[0];
	if (!nearest) return undefined;
	const placeId = nearest.placeId;
	const candidates = entries.filter(
		(entry) => entry.placeId === placeId
	);
	const routeCodes = [...new Set(candidates.map((entry) => entry.route.code))];

	return {
		...nearest,
		placeId,
		candidates,
		routeCodes,
		outsideServiceArea: isOutsideServiceArea(nearest.distanceKm),
		serviceAreaRadiusKm: SERVICE_AREA_RADIUS_KM
	};
};
