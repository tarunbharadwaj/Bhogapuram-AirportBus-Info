const EARTH_RADIUS_KM = 6371;

export function haversineKm(a, b) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearestStop(data, point) {
  return data.routes
    .filter((route) => route.enabled)
    .flatMap((route) => route.stops.map((stop) => ({ route, stop, distanceKm: haversineKm(point, stop) })))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
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

  const terminalBuffer = input.flightType === 'international' ? 180 : 120;
  const extraBuffer = Math.max(0, Math.min(120, Number(input.extraBuffer) || 0));
  const airportBy = new Date(flightTime.getTime() - (terminalBuffer + extraBuffer) * 60_000);
  const walkMinutes = Math.max(8, Math.round((nearest.distanceKm / 22) * 60 + 5));

  const services = [-1, 0].flatMap((dayOffset) => nearest.route.times.map((time) => {
    const origin = dateAtMinutes(flightTime, parseTime(time), dayOffset);
    return serializeService(nearest.route, nearest.stop, origin);
  })).sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

  const safeServices = services.filter((service) => new Date(service.airportArrivalTime) <= airportBy);
  const best = safeServices.at(-1) || null;
  const earlier = safeServices.at(-2) || null;
  const next = best ? services.find((service) => new Date(service.departureTime) > new Date(best.departureTime)) : services.find((service) => new Date(service.departureTime) > new Date());
  const leaveHomeTime = best ? new Date(new Date(best.departureTime).getTime() - (walkMinutes + 10) * 60_000) : null;

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
    nearestStop: {
      id: nearest.stop.id,
      name: nearest.stop.name,
      landmark: nearest.stop.landmark,
      routeCode: nearest.route.code,
      distanceKm: Number(nearest.distanceKm.toFixed(1)),
      walkMinutes,
      lat: nearest.stop.lat,
      lng: nearest.stop.lng,
    },
    leaveHomeTime: leaveHomeTime?.toISOString() || null,
    warning: best ? null : 'No scheduled bus can reach the airport within your selected safety window.',
  };
}
