import { getDirectionalTimes } from './serviceRouting.mjs';

export const SERVICE_TIME_ZONE = 'Asia/Kolkata';
export const SERVICE_UTC_OFFSET = '+05:30';

const indiaDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
	timeZone: SERVICE_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

const pad = (value) => String(value).padStart(2, '0');

const parseReadyAt = (value) => {
	const readyAtValue = String(value || '');
	const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(readyAtValue);
	return new Date(
		hasTimeZone ? readyAtValue : `${readyAtValue}${SERVICE_UTC_OFFSET}`
	);
};

export const indiaDateTimeParts = (value = new Date()) => {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error('Please enter a valid date and time.');
	const parts = Object.fromEntries(
		indiaDateTimeFormatter
			.formatToParts(date)
			.filter(({ type }) => type !== 'literal')
			.map(({ type, value: partValue }) => [type, partValue])
	);
	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		hour: Number(parts.hour),
		minute: Number(parts.minute)
	};
};

export const indiaDateValue = (value = new Date()) =>
	indiaDateTimeParts(value).date;

export const addDaysToDateValue = (dateValue, days) => {
	const date = new Date(`${dateValue}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) throw new Error('Please enter a valid travel date.');
	date.setUTCDate(date.getUTCDate() + days);
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export const indiaDateTime = (dateValue, time, dayOffset = 0) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue)))
		throw new Error('Please enter a valid travel date.');
	if (!/^\d{2}:\d{2}$/.test(String(time)))
		throw new Error('Please enter a valid travel time.');
	const [hours, minutes] = time.split(':').map(Number);
	if (hours > 23 || minutes > 59)
		throw new Error('Please enter a valid travel time.');
	const serviceDate = addDaysToDateValue(dateValue, dayOffset);
	const result = new Date(`${serviceDate}T${time}:00${SERVICE_UTC_OFFSET}`);
	if (Number.isNaN(result.getTime())) throw new Error('Please enter a valid date and time.');
	return result;
};

export const indiaIsoFromParts = ({ date, hour, minute, period }) => {
	const numericHour = Number(hour);
	const numericMinute = Number(minute);
	if (
		!Number.isInteger(numericHour) ||
		numericHour < 1 ||
		numericHour > 12 ||
		!Number.isInteger(numericMinute) ||
		numericMinute < 0 ||
		numericMinute > 59 ||
		!['AM', 'PM'].includes(period)
	)
		throw new Error('Please enter a valid travel time.');
	const hour24 = (numericHour % 12) + (period === 'PM' ? 12 : 0);
	return `${date}T${pad(hour24)}:${pad(numericMinute)}:00${SERVICE_UTC_OFFSET}`;
};

export const getAirportDestinations = (service) => {
	const destinations = new Map();
	for (const route of service.routes.filter((item) => item.enabled)) {
		for (const stop of route.stops) {
			const placeId = stop.placeId || stop.id;
			const existing = destinations.get(placeId);
			if (existing) {
				if (!existing.routeCodes.includes(route.code))
					existing.routeCodes.push(route.code);
				continue;
			}
			destinations.set(placeId, {
				placeId,
				name: stop.name,
				lat: stop.lat,
				lng: stop.lng,
				routeCodes: [route.code]
			});
		}
	}
	return [...destinations.values()].sort((left, right) =>
		left.name.localeCompare(right.name, 'en-IN')
	);
};

export const getAirportDepartureOptions = (
	service,
	input,
	{ now = new Date() } = {}
) => {
	const readyAt = parseReadyAt(input?.readyAt);
	if (Number.isNaN(readyAt.getTime()))
		throw new Error('Please enter a valid ready time.');
	const currentTime = now instanceof Date ? now : new Date(now);
	if (Number.isNaN(currentTime.getTime())) throw new Error('Current time is invalid.');
	if (readyAt.getTime() < currentTime.getTime() - 60_000)
		throw new Error('Ready time must be the current time or later.');

	const destinationPlaceId = String(input?.destinationPlaceId || '');
	const candidates = service.routes
		.filter((route) => route.enabled)
		.flatMap((route) =>
			route.stops
				.filter((stop) => (stop.placeId || stop.id) === destinationPlaceId)
				.map((stop) => ({ route, stop }))
		);
	if (!candidates.length)
		throw new Error('Choose a destination served by an active AeroExpress route.');

	const readyDate = indiaDateValue(readyAt);
	const options = [0, 1, 2]
		.flatMap((dayOffset) =>
			candidates.flatMap(({ route, stop }) =>
				getDirectionalTimes(route, 'from-airport').map((time) => {
					const departure = indiaDateTime(readyDate, time, dayOffset);
					const arrival = new Date(
						departure.getTime() + stop.journeyMinutes * 60_000
					);
					return {
						routeId: route.id,
						routeCode: route.code,
						routeName: route.name,
						stopId: stop.id,
						stopName: stop.name,
						landmark: stop.landmark,
						fare: stop.fare,
						airportDepartureTime: departure.toISOString(),
						destinationArrivalTime: arrival.toISOString()
					};
				})
			)
		)
		.filter(
			(option) => new Date(option.airportDepartureTime).getTime() >= readyAt.getTime()
		)
		.sort((left, right) => {
			const timeDifference =
				new Date(left.airportDepartureTime) -
				new Date(right.airportDepartureTime);
			return timeDifference || left.routeCode.localeCompare(right.routeCode);
		})
		.slice(0, 3);

	const firstStop = candidates[0].stop;
	return {
		direction: 'from-airport',
		readyAt: readyAt.toISOString(),
		destination: {
			placeId: destinationPlaceId,
			name: firstStop.name,
			lat: firstStop.lat,
			lng: firstStop.lng
		},
		options,
		warning: options.length
			? null
			: 'No published airport departure is available after your selected time.'
	};
};
