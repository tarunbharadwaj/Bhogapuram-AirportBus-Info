import { findNearestBoardingPoint } from './nearestStop.js';
import {
	findBoardingPlaceById,
	getDirectionalTimes
} from '../../../shared/serviceRouting.mjs';
import { indiaDateTime, indiaDateValue } from '../../../shared/airportDepartures.mjs';

const serializeService = (route, stop, originDate) => {
	const departure = new Date(originDate.getTime() + stop.offset * 60_000);
	const arrival = new Date(departure.getTime() + stop.journeyMinutes * 60_000);
	return {
		routeId: route.id,
		routeCode: route.code,
		routeName: route.name,
		routeOriginName: route.stops[0].name,
		stopId: stop.id,
		stopName: stop.name,
		landmark: stop.landmark,
		fare: stop.fare,
		routeOriginDepartureTime: originDate.toISOString(),
		departureTime: departure.toISOString(),
		stopTimeQuality: stop.offset === 0 ? 'published' : 'estimated',
		arriveAtStopBy: new Date(departure.getTime() - 10 * 60_000).toISOString(),
		airportArrivalTime: arrival.toISOString()
	};
};

const resolveBoardingSelection = (service, input) => {
	const hasCoordinates = input.coordinates != null;
	const hasBoardingPlace = Boolean(String(input.boardingPlaceId || '').trim());
	const hasLegacyLocation = Boolean(String(input.locationId || '').trim());
	if ([hasCoordinates, hasBoardingPlace, hasLegacyLocation].filter(Boolean).length !== 1)
		throw new Error('Choose either your current location or one boarding stop.');

	if (hasBoardingPlace) {
		const selected = findBoardingPlaceById(service, input.boardingPlaceId);
		if (!selected) throw new Error('Choose an active AeroExpress boarding stop.');
		return { match: selected, mode: 'manual-stop' };
	}

	const point = hasLegacyLocation
		? service.locations.find((location) => location.id === input.locationId)
		: input.coordinates;
	if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng)))
		throw new Error('A valid current location is required.');
	return { match: findNearestBoardingPoint(service, point), mode: 'location' };
};

export const recommendTrip = (service, input) => {
	const flightTime = new Date(input.flightTime);
	if (Number.isNaN(flightTime.getTime())) throw new Error('Please enter a valid flight time.');
	if (flightTime.getTime() < Date.now() - 60_000)
		throw new Error('Flight time must be in the future.');

	const { match: nearest, mode: selectionMode } = resolveBoardingSelection(
		service,
		input
	);
	if (!nearest) throw new Error('No active AeroExpress route is available.');
	if (nearest.outsideServiceArea && input.allowOutsideServiceArea !== true)
		throw new Error(
			'Confirm that you can reach the nearest supported stop before planning this trip.'
		);
	const terminalBuffer = input.flightType === 'international' ? 180 : 120;
	const airportBy = new Date(flightTime.getTime() - terminalBuffer * 60_000);
	const walkMinutes = selectionMode === 'manual-stop'
		? 0
		: nearest.outsideServiceArea
		? null
		: Math.max(8, Math.round((nearest.distanceKm / 22) * 60 + 5));
	const services = [-1, 0]
		.flatMap((dayOffset) =>
			nearest.candidates.flatMap(({ route, stop }) =>
				getDirectionalTimes(route, 'to-airport').map((time) => {
					const origin = indiaDateTime(
						indiaDateValue(flightTime),
						time,
						dayOffset
					);
					return serializeService(route, stop, origin);
				})
			)
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
	const leaveHomeTime =
		best && walkMinutes !== null
			? new Date(
					new Date(best.departureTime).getTime() -
						(walkMinutes + 10) * 60_000
				)
			: null;

	return {
		boardingSelection: {
			mode: selectionMode,
			placeId: nearest.placeId
		},
		best,
		earlier,
		next: next || null,
		isNextSafe: next ? new Date(next.airportArrivalTime) <= airportBy : false,
		airportBy: airportBy.toISOString(),
		flightTime: flightTime.toISOString(),
		flightType: input.flightType === 'international' ? 'international' : 'domestic',
		terminalBuffer,
		extraBuffer: 0,
		outsideServiceArea: nearest.outsideServiceArea,
		serviceAreaRadiusKm: nearest.serviceAreaRadiusKm,
		nearestStop: {
			id: nearest.stop.id,
			name: nearest.stop.name,
			landmark: nearest.stop.landmark,
			routeCode: nearest.route.code,
			routeCodes: nearest.routeCodes,
			placeId: nearest.placeId,
			distanceKm: Number(nearest.distanceKm.toFixed(1)),
			walkMinutes,
			lat: nearest.stop.lat,
			lng: nearest.stop.lng
		},
		leaveHomeTime: leaveHomeTime?.toISOString() || null,
		warning: best
			? null
			: 'No scheduled bus can reach the airport within your selected safety window.'
	};
};
