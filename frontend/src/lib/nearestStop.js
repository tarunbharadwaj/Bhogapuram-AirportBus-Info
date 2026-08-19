const EARTH_RADIUS_KM = 6371;

const haversineKm = (from, to) => {
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

export const findNearestBoardingPoint = (service, point) => {
	const nearest = service.routes
		.filter((route) => route.enabled)
		.flatMap((route) =>
			route.stops.map((stop) => ({
				route,
				routeCode: route.code,
				stop,
				distanceKm: haversineKm(point, stop)
			}))
		)
		.sort((left, right) => left.distanceKm - right.distanceKm)[0];

	if (!nearest) throw new Error('No active AeroExpress route is available.');
	return { ...nearest, distanceKm: Number(nearest.distanceKm.toFixed(1)) };
};
