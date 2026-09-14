import { buildStopTrackingOptions, gpsQuality, TRACKING_REFRESH_MS } from '../../../shared/liveTracking.mjs';
import { indiaDateTime, indiaDateValue } from '../../../shared/airportDepartures.mjs';
import { findBoardingPlaceById, getDirectionalTimes } from '../../../shared/serviceRouting.mjs';

const publicBus = (bus, result, now = Date.now()) => {
  let quality = gpsQuality(bus.position, now);
  if (quality === 'recent' && (result.status !== 'available' || bus.positionUnavailable)) quality = 'stale';
  return { tripId: bus.tripId, vehicleNumber: bus.vehicleNumber, direction: bus.direction,
    routeCode: bus.routeCode, quality, position: quality === 'unavailable' ? null : bus.position,
    positionUnavailable: Boolean(bus.positionUnavailable) };
};

const publishedSchedule = (service, place, now, routeCode, scheduledOriginAt) => {
  const date = indiaDateValue(scheduledOriginAt || now);
  const requestedOrigin = scheduledOriginAt ? Date.parse(scheduledOriginAt) : null;
  return [0, 1].flatMap((dayOffset) => place.candidates.filter(({ route }) => !routeCode || route.code === routeCode).flatMap(({ route, stop }) =>
    getDirectionalTimes(route, 'to-airport').map((time) => {
      const origin = indiaDateTime(date, time, dayOffset);
      const stopTime = new Date(origin.getTime() + stop.offset * 60_000);
      return { routeCode: route.code, routeName: route.name, routeOriginDepartureAt: origin.toISOString(),
        stopArrivalAt: stopTime.toISOString(), timeQuality: stop.offset ? 'estimated' : 'published' };
    }))).filter((item) => requestedOrigin === null ? Date.parse(item.stopArrivalAt) >= now : Date.parse(item.routeOriginDepartureAt) >= requestedOrigin)
    .sort((left, right) => Date.parse(left.stopArrivalAt) - Date.parse(right.stopArrivalAt))
    .slice(0, 3);
};

export class TrackingController {
  constructor(tracking, serviceModel) { this.tracking = tracking; this.serviceModel = serviceModel; }

  getLiveBuses = async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await this.tracking.getSnapshot();
    const enabled = new Set(this.serviceModel.getAll().routes.filter((route) => route.enabled).map((route) => route.code));
    const buses = result.buses.filter((bus) => bus.routeCode ? enabled.has(bus.routeCode) : enabled.has('ASR-1') && enabled.has('ASR-2'));
    res.json({ status: result.status, checkedAt: result.checkedAt, partial: result.partial,
      buses: buses.map((bus) => publicBus(bus, result)),
      serverTime: new Date().toISOString(), refreshAfterMs: TRACKING_REFRESH_MS });
  };

  getStopTracking = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const allowed = new Set(['placeId', 'routeCode', 'scheduledOriginAt']);
    if (Object.keys(req.query).some((key) => !allowed.has(key))) {
      return res.status(400).json({ error: 'Unsupported tracking filter.' });
    }
    const placeId = typeof req.query.placeId === 'string' ? req.query.placeId.trim() : '';
    const routeCode = typeof req.query.routeCode === 'string' ? req.query.routeCode.trim() : undefined;
    const scheduledOriginAt = typeof req.query.scheduledOriginAt === 'string' ? req.query.scheduledOriginAt.trim() : undefined;
    if (!/^[a-z0-9-]{2,60}$/.test(placeId)) return res.status(400).json({ error: 'Choose a valid boarding stop.' });
    if (routeCode && !/^ASR-[12]$/.test(routeCode)) return res.status(400).json({ error: 'Choose a valid active route.' });
    if (scheduledOriginAt && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledOriginAt) || !Number.isFinite(Date.parse(scheduledOriginAt)))) {
      return res.status(400).json({ error: 'Choose a valid scheduled departure.' });
    }

    const service = this.serviceModel.getAll();
    const place = findBoardingPlaceById(service, placeId);
    if (!place) return res.status(400).json({ error: 'This boarding stop is unavailable.' });
    if (routeCode && !place.routeCodes.includes(routeCode)) return res.status(400).json({ error: 'That route does not serve this stop.' });

    const result = await this.tracking.getSnapshot();
    const now = Date.now();
    const enabledCodes = new Set(service.routes.filter((route) => route.enabled).map((route) => route.code));
    const filtered = { ...result, buses: result.buses.filter((bus) => bus.direction === 'to-airport' &&
      bus.routeCode && enabledCodes.has(bus.routeCode) && place.routeCodes.includes(bus.routeCode)) };
    const tracking = buildStopTrackingOptions(filtered, { ...place.stop, placeId, routeCodes: place.routeCodes },
      { routeCode, scheduledOriginAt, now });
    const options = tracking.options.map((bus) => ({
      ...publicBus(bus, result, now),
      stopProgress: bus.stopProgress,
      progressQuality: bus.progressQuality,
      currentStopName: bus.currentStopName,
      stopsAway: bus.stopsAway,
      distanceKm: bus.distanceKm,
      selectedStopScheduledAt: bus.selectedStopScheduledAt
    }));
    const reliable = options.some((bus) => bus.quality === 'recent' &&
      bus.progressQuality === 'provider-waypoint' && ['at-stop', 'approaching'].includes(bus.stopProgress));
    return res.json({
      status: tracking.plannedTripMatch === 'future' ? 'not-yet-available' : result.status,
      partial: result.partial,
      checkedAt: result.checkedAt,
      serverTime: new Date(now).toISOString(),
      refreshAfterMs: TRACKING_REFRESH_MS,
      selection: { placeId, stopName: place.name },
      plannedTripMatch: tracking.plannedTripMatch,
      matchedBusPassed: tracking.matchedPassed,
      reliableLiveResult: reliable,
      options,
      nextPublishedServices: publishedSchedule(service, place, now, routeCode, scheduledOriginAt)
    });
  };
}
