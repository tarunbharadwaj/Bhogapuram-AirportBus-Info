import { nearestStop, recommendTrip } from '../services/recommendationService.js';

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
    res.json({ routeId: nearest.route.id, routeCode: nearest.route.code, stop: nearest.stop, distanceKm: Number(nearest.distanceKm.toFixed(1)) });
  };

  createRecommendation = (req, res) => {
    try {
      res.json(recommendTrip(this.serviceModel.getAll(), req.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  getTimetable = (req, res) => {
    const data = this.serviceModel.getAll();
    const route = data.routes.find((item) => item.id === req.query.routeId) || data.routes[0];
    const stop = route.stops.find((item) => item.id === req.query.stopId) || route.stops[0];
    const direction = req.query.direction === 'from-airport' ? 'from-airport' : 'to-airport';
    const now = new Date();
    const services = route.times.map((time) => {
      const [hours, minutes] = time.split(':').map(Number);
      const departure = new Date(now);
      departure.setHours(hours, minutes, 0, 0);
      if (direction === 'to-airport') departure.setMinutes(departure.getMinutes() + stop.offset);
      const arrival = new Date(departure.getTime() + stop.journeyMinutes * 60_000);
      return { departure: departure.toISOString(), arrival: arrival.toISOString() };
    });
    res.json({ route, stop, direction, services, verifiedDate: data.status.verifiedDate });
  };
}
