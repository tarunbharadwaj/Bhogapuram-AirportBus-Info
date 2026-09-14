import { gpsQuality } from '../../../shared/liveTracking.mjs';

export function validateTrackingSnapshot(value) {
  if (!value || !['available', 'unavailable', 'disabled'].includes(value.status) ||
      !Number.isFinite(Date.parse(value.serverTime)) || !Array.isArray(value.buses) || value.buses.length > 40) {
    throw new Error('Invalid tracking response');
  }
  const ids = new Set();
  for (const bus of value.buses) {
    if (!bus || typeof bus.tripId !== 'string' || !/^\d{8}_[A-Z0-9-]{1,20}_\d{1,3}_GAJUWAKA2$/.test(bus.tripId) ||
        !/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(bus.vehicleNumber || '') || ids.has(bus.vehicleNumber) ||
        !['to-airport', 'from-airport'].includes(bus.direction) || ![null, 'ASR-1', 'ASR-2'].includes(bus.routeCode)) {
      throw new Error('Invalid bus data');
    }
    ids.add(bus.vehicleNumber);
  }
  return value;
}

export function validateStopTrackingSnapshot(value) {
  const statuses = ['available', 'unavailable', 'disabled', 'not-yet-available'];
  const matches = ['exact', 'ambiguous', 'passed', 'route-only', 'future', 'not-requested'];
  const progress = ['at-stop', 'approaching', 'uncertain', 'last-known', 'gps-unavailable'];
  if (!value || !statuses.includes(value.status) || !Number.isFinite(Date.parse(value.serverTime)) ||
      !value.selection || !/^[a-z0-9-]{2,60}$/.test(value.selection.placeId || '') ||
      typeof value.selection.stopName !== 'string' || !matches.includes(value.plannedTripMatch) ||
      !Array.isArray(value.options) || value.options.length > 3 || !Array.isArray(value.nextPublishedServices) ||
      value.nextPublishedServices.length > 3) throw new Error('Invalid stop tracking response');
  const ids = new Set();
  for (const bus of value.options) {
    if (!bus || typeof bus.tripId !== 'string' || !/^\d{8}_[A-Z0-9-]{1,20}_\d{1,3}_GAJUWAKA2$/.test(bus.tripId) ||
        !/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(bus.vehicleNumber || '') || ids.has(bus.tripId) ||
        !['ASR-1', 'ASR-2'].includes(bus.routeCode) || bus.direction !== 'to-airport' ||
        !progress.includes(bus.stopProgress) || !['provider-waypoint', 'surrounding-waypoints'].includes(bus.progressQuality) ||
        !['recent', 'stale', 'unavailable'].includes(bus.quality)) throw new Error('Invalid stop tracking bus');
    ids.add(bus.tripId);
  }
  return value;
}

export function visibleTrackingBuses(snapshot, now, { route = 'all', direction = 'all', search = '', paused = false, failed = false } = {}) {
  if (!snapshot || snapshot.status === 'disabled' || !Number.isFinite(Date.parse(snapshot.checkedAt)) ||
      now - Date.parse(snapshot.checkedAt) > 300_000) return [];
  const needle = search.replace(/\s/g, '').toUpperCase();
  return snapshot.buses.filter((bus) =>
    (route === 'all' || bus.routeCode === route) && (direction === 'all' || bus.direction === direction) &&
    bus.vehicleNumber.includes(needle)).map((bus) => {
    let quality = gpsQuality(bus.position, now);
    if (quality === 'recent' && (paused || failed || bus.positionUnavailable || snapshot.status !== 'available')) quality = 'stale';
    return { ...bus, quality, position: quality === 'unavailable' ? null : bus.position };
  });
}

export function gpsAgeLabel(position, now) {
  if (!position || !Number.isFinite(Date.parse(position.updatedAt))) return 'GPS unavailable';
  const seconds = Math.max(0, Math.floor((now - Date.parse(position.updatedAt)) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)} min ago`;
}
