import {
  findNearestBoardingPlace,
  getDirectionalTimes,
  haversineKm,
} from '../../../shared/serviceRouting.mjs';

export { haversineKm };

export function nearestStop(data, point) {
  return findNearestBoardingPlace(data, point);
}

function dateAtMinutes(reference, minutes, dayOffset = 0) {
  const result = new Date(reference);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + dayOffset);
  result.setMinutes(minutes);
  return result;
}

function parseTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function serializeService(route, stop, originDate) {
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
    airportArrivalTime: arrival.toISOString(),
  };
}

export function recommendTrip(data, input) {
  const flightTime = new Date(input.flightTime);
  if (Number.isNaN(flightTime.getTime())) throw new Error('Please enter a valid flight time.');
  if (flightTime.getTime() < Date.now() - 60_000) throw new Error('Flight time must be in the future.');

  const point = input.coordinates || data.locations.find((location) => location.id === input.locationId);
  if (!point) throw new Error('Please choose a starting area or use your current location.');

  const nearest = nearestStop(data, point);
  if (!nearest) throw new Error('No active AeroExpress route is available.');
  if (nearest.outsideServiceArea && input.allowOutsideServiceArea !== true) {
    throw new Error('Confirm that you can reach the nearest supported stop before planning this trip.');
  }

  const terminalBuffer = input.flightType === 'international' ? 180 : 120;
  const extraBuffer = Math.max(0, Math.min(120, Number(input.extraBuffer) || 0));
  const airportBy = new Date(flightTime.getTime() - (terminalBuffer + extraBuffer) * 60_000);
  const walkMinutes = nearest.outsideServiceArea
    ? null
    : Math.max(8, Math.round((nearest.distanceKm / 22) * 60 + 5));

  const services = [-1, 0].flatMap((dayOffset) =>
    nearest.candidates.flatMap(({ route, stop }) =>
      getDirectionalTimes(route, 'to-airport').map((time) => {
        const origin = dateAtMinutes(flightTime, parseTime(time), dayOffset);
        return serializeService(route, stop, origin);
      }),
    ),
  ).sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

  const safeServices = services.filter((service) => new Date(service.airportArrivalTime) <= airportBy);
  const best = safeServices.at(-1) || null;
  const earlier = safeServices.at(-2) || null;
  const next = best ? services.find((service) => new Date(service.departureTime) > new Date(best.departureTime)) : services.find((service) => new Date(service.departureTime) > new Date());
  const leaveHomeTime = best && walkMinutes !== null
    ? new Date(new Date(best.departureTime).getTime() - (walkMinutes + 10) * 60_000)
    : null;

  return {
    best,
    earlier,
    next: next || null,
    isNextSafe: next ? new Date(next.airportArrivalTime) <= airportBy : false,
    airportBy: airportBy.toISOString(),
    flightTime: flightTime.toISOString(),
    flightType: input.flightType === 'international' ? 'international' : 'domestic',
    terminalBuffer,
    extraBuffer,
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
      lng: nearest.stop.lng,
    },
    leaveHomeTime: leaveHomeTime?.toISOString() || null,
    warning: best ? null : 'No scheduled bus can reach the airport within your selected safety window.',
  };
}
