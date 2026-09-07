import { indiaDateTime, indiaDateValue } from '../../../shared/airportDepartures.mjs';
import { getDirectionalTimes } from '../../../shared/serviceRouting.mjs';

export const buildTimetable = (
	service,
	routeId,
	stopId,
	direction,
	now = new Date()
) => {
	const activeRoutes = service.routes.filter((item) => item.enabled);
	const route = activeRoutes.find((item) => item.id === routeId) || activeRoutes[0];
	if (!route) throw new Error('No active AeroExpress route is available.');
	const stop = route.stops.find((item) => item.id === stopId) || route.stops[0];
	const serviceDate = indiaDateValue(now);
	const services = [0, 1].flatMap((dayOffset) =>
		getDirectionalTimes(route, direction).map((time) => {
			const routeOriginDeparture = indiaDateTime(serviceDate, time, dayOffset);
			const departure = new Date(routeOriginDeparture);
			if (direction === 'to-airport')
				departure.setMinutes(departure.getMinutes() + stop.offset);
			const arrival = new Date(
				departure.getTime() + stop.journeyMinutes * 60_000
			);
			return {
				serviceDate: indiaDateValue(routeOriginDeparture),
				routeOriginDeparture: routeOriginDeparture.toISOString(),
				departure: departure.toISOString(),
				arrival: arrival.toISOString(),
				timeQuality:
					direction === 'to-airport' && stop.offset > 0 ? 'estimated' : 'published'
			};
		})
	);
	return {
		route,
		stop,
		direction,
		services,
		verifiedDate: service.status.verifiedDate
	};
};

export const getVisibleTimetableServices = (
	data,
	viewMode,
	now = new Date()
) => {
	if (viewMode === 'full-day') {
		const today = indiaDateValue(now);
		return data.services.filter((item) => item.serviceDate === today);
	}
	return data.services
		.filter((item) => new Date(item.departure).getTime() >= now.getTime())
		.slice(0, 5);
};
