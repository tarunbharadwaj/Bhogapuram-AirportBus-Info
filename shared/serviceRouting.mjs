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

export const findNearestBoardingPlace = (service, point) => {
	const entries = service.routes
		.filter((route) => route.enabled)
		.flatMap((route) =>
			route.stops.map((stop) => ({
				route,
				routeCode: route.code,
				stop,
				distanceKm: haversineKm(point, stop)
			}))
		)
		.sort((left, right) => left.distanceKm - right.distanceKm);

	const nearest = entries[0];
	if (!nearest) return undefined;
	const placeId = nearest.stop.placeId || nearest.stop.id;
	const candidates = entries.filter(
		(entry) => (entry.stop.placeId || entry.stop.id) === placeId
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
