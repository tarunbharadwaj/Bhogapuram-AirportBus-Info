import { TrackingModel } from '../models/trackingModel.js';
import { gpsQuality, reconcileGps, trackingDates, TRACKING_REFRESH_MS } from '../../../shared/liveTracking.mjs';

// One cache and one in-flight refresh per server instance, never per visitor.
export class TrackingService {
  constructor({ model = new TrackingModel(), now = Date.now, enabled = () => process.env.LIVE_TRACKING_ENABLED !== 'false' } = {}) {
    Object.assign(this, { model, now, enabled });
    this.snapshot = null;
    this.pending = null;
    this.nextRefresh = 0;
    this.discovery = null;
    this.routes = new Map();
  }

  async getSnapshot() {
    if (!this.enabled()) return { status: 'disabled', checkedAt: null, buses: [], partial: false };
    if (!this.pending && this.now() >= this.nextRefresh) {
      this.pending = this.refresh().finally(() => { this.pending = null; });
    }
    if (this.pending) await this.pending;
    const age = this.now() - Date.parse(this.snapshot?.checkedAt);
    if (!this.snapshot || age > 5 * 60_000) {
      return { status: 'unavailable', checkedAt: this.snapshot?.checkedAt || null, buses: [], partial: true };
    }
    return { ...this.snapshot, status: this.failed ? 'unavailable' : this.snapshot.status };
  }

  async refresh() {
    const signal = AbortSignal.timeout(22_000);
    const now = this.now();
    const dates = trackingDates(now);
    try {
      if (!this.discovery || this.discovery.key !== dates.join('|') || now - this.discovery.at >= 120_000) {
        const results = await Promise.all(dates.map((date) => this.model.discover(date, signal)));
        this.discovery = { key: dates.join('|'), at: now, trips: results.flatMap((result) => result.trips),
          limited: results.some((result) => result.limited) };
      }
      // Latest trip wins even when completed; don't resurrect an older 'running' trip.
      const latest = new Map();
      for (const trip of this.discovery.trips) {
        const prior = latest.get(trip.vehicleNumber);
        if (!prior || dates.indexOf(trip.date) < dates.indexOf(prior.date) ||
            (trip.date === prior.date && trip.tripNumber > prior.tripNumber)) latest.set(trip.vehicleNumber, trip);
      }
      const candidates = [...latest.values()].filter((trip) => trip.tripStatus === '1');
      const buses = [];
      let partial = this.discovery.limited || candidates.length > 40;
      let blockedStatus = null;
      let index = 0;
      const queue = candidates.slice(0, 40);
      // Bounded workers: no large upstream fan-out, stop issuing requests after access denial.
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (index < queue.length) {
          const trip = queue[index++];
          let position = null;
          let positionUnavailable = false;
          const previousPosition = this.snapshot?.buses.find((bus) => bus.tripId === trip.id && bus.vehicleNumber === trip.vehicleNumber)?.position || null;
          let routeCode = this.routes.get(trip.id)?.code ?? null;
          let waypoints = this.routes.get(trip.id)?.waypoints || [];
          try {
            if (blockedStatus || signal.aborted) throw new Error('Refresh stopped');
            if (trip.trackingEnabled) position = await this.model.position(trip, signal);
          } catch (error) {
            partial = true;
            positionUnavailable = true;
            if ([401, 403, 429].includes(error.status)) blockedStatus = error.status;
            position = previousPosition;
          }
          const cachedRoute = this.routes.get(trip.id);
          if ((!cachedRoute || now - cachedRoute.at >= 120_000) && !blockedStatus && !signal.aborted) {
            try {
              if (typeof this.model.waypoints === 'function') {
                const progress = await this.model.waypoints(trip, signal);
                routeCode = progress.routeCode;
                waypoints = progress.waypoints;
              } else {
                routeCode = await this.model.route(trip, signal);
              }
              this.routes.set(trip.id, { code: routeCode, waypoints, at: now });
            } catch (error) {
              partial = true;
              if ([401, 403, 429].includes(error.status)) blockedStatus = error.status;
            }
          }
          if (gpsQuality(position, this.now()) === 'unavailable') position = null;
          const reconciled = reconcileGps(previousPosition, position, this.now());
          position = reconciled.position;
          if (reconciled.rejected) { positionUnavailable = true; partial = true; }
          const routeOriginScheduledAt = waypoints[0]?.scheduledAt || null;
          buses.push({ tripId: trip.id, vehicleNumber: trip.vehicleNumber, direction: trip.direction,
            routeCode, position, positionUnavailable, currentSeqNo: trip.currentSeqNo,
            previousStopName: trip.previousStopName, routeOriginScheduledAt, waypoints });
        }
      }));
      for (const [id, value] of this.routes) {
        if (now - value.at > 6 * 60 * 60_000 || this.routes.size > 400) this.routes.delete(id);
      }
      this.snapshot = { status: blockedStatus ? 'unavailable' : 'available', checkedAt: new Date(this.now()).toISOString(),
        partial, buses: buses.sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber)) };
      this.failed = false;
      this.nextRefresh = this.now() + (blockedStatus ? 300_000 : TRACKING_REFRESH_MS);
    } catch (error) {
      this.failed = true;
      this.nextRefresh = this.now() + ([401, 403, 429].includes(error.status) ? 300_000 : 60_000);
    }
  }
}
