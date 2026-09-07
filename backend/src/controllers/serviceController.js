import { nearestStop, recommendTrip } from '../services/recommendationService.js';
import { findAirportDepartureOptions } from '../services/airportDepartureService.js';
import { getDirectionalTimes } from '../../../shared/serviceRouting.mjs';
import { indiaDateTime, indiaDateValue } from '../../../shared/airportDepartures.mjs';

export class ServiceController {
  constructor(serviceModel) {
    this.serviceModel = serviceModel;
  }

  health = (_req, res) => res.json({ ok: true });

  getService = (_req, res) => res.json(this.serviceModel.getAll());

  getNearest = (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Valid coordinates are required.' });
    const nearest = nearestStop(this.serviceModel.getAll(), { lat, lng });
    if (!nearest) return res.status(404).json({ error: 'No active route is available.' });
    res.json({
      routeId: nearest.route.id,
      routeCode: nearest.route.code,
      routeCodes: nearest.routeCodes,
      stop: nearest.stop,
      distanceKm: Number(nearest.distanceKm.toFixed(1)),
      outsideServiceArea: nearest.outsideServiceArea,
      serviceAreaRadiusKm: nearest.serviceAreaRadiusKm,
    });
  };

  createRecommendation = (req, res) => {
    try {
      res.json(recommendTrip(this.serviceModel.getAll(), req.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  createAirportDepartures = (req, res) => {
    try {
      res.json(findAirportDepartureOptions(this.serviceModel.getAll(), req.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  getTimetable = (req, res) => {
    const data = this.serviceModel.getAll();
    const activeRoutes = data.routes.filter((item) => item.enabled);
    const route = activeRoutes.find((item) => item.id === req.query.routeId) || activeRoutes[0];
    if (!route) return res.status(404).json({ error: 'No active AeroExpress route is available.' });
    const stop = route.stops.find((item) => item.id === req.query.stopId) || route.stops[0];
    const direction = req.query.direction === 'from-airport' ? 'from-airport' : 'to-airport';
    const now = new Date();
    const serviceDate = indiaDateValue(now);
    const services = getDirectionalTimes(route, direction).map((time) => {
      const routeOriginDeparture = indiaDateTime(serviceDate, time);
      const departure = new Date(routeOriginDeparture);
      if (direction === 'to-airport') departure.setMinutes(departure.getMinutes() + stop.offset);
      const arrival = new Date(departure.getTime() + stop.journeyMinutes * 60_000);
      return {
        routeOriginDeparture: routeOriginDeparture.toISOString(),
        departure: departure.toISOString(),
        arrival: arrival.toISOString(),
        timeQuality: direction === 'to-airport' && stop.offset > 0 ? 'estimated' : 'published',
      };
    });
    res.json({ route, stop, direction, services, verifiedDate: data.status.verifiedDate });
  };
}
