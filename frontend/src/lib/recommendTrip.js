import { findNearestBoardingPoint } from './nearestStop.js';

const dateAtMinutes = (reference, minutes, dayOffset = 0) => {
	const result = new Date(reference);
	result.setHours(0, 0, 0, 0);
	result.setDate(result.getDate() + dayOffset);
	result.setMinutes(minutes);
	return result;
};

const parseTime = (time) => {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
};

const serializeService = (route, stop, originDate) => {
	const departure = new Date(originDate.getTime() + stop.offset * 60_000);
	const arrival = new Date(departure.getTime() + stop.journeyMinutes * 60_000);
	return {
		routeId: route.id,
		routeCode: route.code,
		routeName: route.name,
		stopId: stop.id,
		stopName: stop.name,
		landmark: stop.landmark,
		fare: stop.fare,
		departureTime: departure.toISOString(),
		airportArrivalTime: arrival.toISOString()
	};
};

export const recommendTrip = (service, input) => {
	const flightTime = new Date(input.flightTime);
	if (Number.isNaN(flightTime.getTime())) throw new Error('Please enter a valid flight time.');
	if (flightTime.getTime() < Date.now() - 60_000)
		throw new Error('Flight time must be in the future.');

	const nearest = findNearestBoardingPoint(service, input.coordinates);
	const terminalBuffer = input.flightType === 'international' ? 180 : 120;
	const airportBy = new Date(flightTime.getTime() - terminalBuffer * 60_000);
	const walkMinutes = Math.max(
		8,
		Math.round((nearest.distanceKm / 22) * 60 + 5)
	);
	const services = [-1, 0]
		.flatMap((dayOffset) =>
			nearest.route.times.map((time) => {
				const origin = dateAtMinutes(flightTime, parseTime(time), dayOffset);
				return serializeService(nearest.route, nearest.stop, origin);
			})
		)
		.sort(
			(left, right) =>
				new Date(left.departureTime) - new Date(right.departureTime)
		);
	const safeServices = services.filter(
		(serviceOption) => new Date(serviceOption.airportArrivalTime) <= airportBy
	);
	const best = safeServices.at(-1) || null;
	const earlier = safeServices.at(-2) || null;
	const next = best
		? services.find(
				(serviceOption) =>
					new Date(serviceOption.departureTime) > new Date(best.departureTime)
			)
		: services.find(
				(serviceOption) => new Date(serviceOption.departureTime) > new Date()
			);

	return {
		best,
		earlier,
		next: next || null,
		isNextSafe: next ? new Date(next.airportArrivalTime) <= airportBy : false,
		airportBy: airportBy.toISOString(),
		flightTime: flightTime.toISOString(),
		flightType: input.flightType === 'international' ? 'international' : 'domestic',
		terminalBuffer,
		extraBuffer: 0,
		nearestStop: {
			id: nearest.stop.id,
			name: nearest.stop.name,
			landmark: nearest.stop.landmark,
			routeCode: nearest.route.code,
			distanceKm: nearest.distanceKm,
			walkMinutes,
			lat: nearest.stop.lat,
			lng: nearest.stop.lng
		},
		warning: best
			? null
			: 'No scheduled bus can reach the airport within your selected safety window.'
	};
};
