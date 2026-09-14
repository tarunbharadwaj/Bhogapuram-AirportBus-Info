import { haversineKm } from './serviceRouting.mjs';

export const TRACKING_REFRESH_MS = 30_000;
export const GPS_RECENT_MS = 120_000;
export const GPS_EXPIRES_MS = 30 * 60_000;
export const APSRTC_TRACKING_URL = 'https://apsrtclivetrack.com/';

// APSRTC waypoint document IDs observed on the public AeroExpress feed. Route
// identity and progress are derived only from these waypoints, never a duty or
// vehicle-number prefix.
export const APSRTC_WAYPOINT_PLACES = Object.freeze({
  '10821': 'old-gajuwaka',
  '9851': 'nad-junction',
  '243843': 'gurudwara',
  '223318': 'zoo-park',
  '1641462090785': 'scindia',
  '240931': 'kancharapalem',
  '1436352534894': 'siripuram',
  '1782984302304': 'iskcon-temple',
  '1782984212336': 'it-hills',
  '1457005959824': 'marikavalasa',
  '226027': 'anandapuram',
  '1375188927965': 'tagarapuvalasa',
  '1782812721498': 'airport-junction',
  '1782812590671': 'vizag-airport'
});

// APSRTC currently omits these website stops. The surrounding confirmed
// waypoints let us say only "definitely before", "within this segment", or
// "definitely passed"—never a fabricated arrival or ETA.
export const UNMAPPED_STOP_SEGMENTS = Object.freeze({
  'railway-station': { routeCode: 'ASR-2', before: 'kancharapalem', after: 'siripuram' },
  'rtc-complex': { routeCode: 'ASR-2', before: 'kancharapalem', after: 'siripuram' },
  'vuda-park': { routeCode: 'ASR-2', before: 'siripuram', after: 'iskcon-temple' }
});

// Generous local bounds reject zeroes and clearly unrelated/broken GPS readings.
export const validBusPosition = (lat, lng) =>
  typeof lat === 'number' && Number.isFinite(lat) && lat >= 17 && lat <= 18.8 &&
  typeof lng === 'number' && Number.isFinite(lng) && lng >= 82.5 && lng <= 84.5;

export function gpsQuality(position, now = Date.now()) {
  if (!position || !validBusPosition(position.lat, position.lng)) return 'unavailable';
  const updated = Date.parse(position.updatedAt);
  const age = now - updated;
  if (!Number.isFinite(updated) || age < -60_000 || age > GPS_EXPIRES_MS) return 'unavailable';
  return age <= GPS_RECENT_MS ? 'recent' : 'stale';
}

export function trackingDates(now = Date.now()) {
  const india = new Date(now + 330 * 60_000);
  const format = (date) => {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
    return `${day}-${month}-${date.getUTCFullYear()}`;
  };
  // Retain late services across midnight, not an entire historical fleet.
  return india.getUTCHours() < 4
    ? [format(india), format(new Date(india.getTime() - 86_400_000))]
    : [format(india)];
}

export function inferTrackingRoute(waypointIds) {
  const codes = new Set(waypointIds.map((id) => id.split('_').at(-1)));
  const first = ['NADX', 'ZOOPK', 'GDWAR'].some((code) => codes.has(code));
  const second = ['ITH', 'ISCT', 'SIA', 'KCHPM'].some((code) => codes.has(code));
  // Never infer from vehicle registration or AM/AW duty prefixes alone.
  return first === second ? null : first ? 'ASR-1' : 'ASR-2';
}

export const canonicalPlaceForWaypoint = (waypointId) => {
  const providerId = String(waypointId || '').split('_')[0];
  return APSRTC_WAYPOINT_PLACES[providerId] || null;
};

const indiaParts = (value) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

export const indiaDateAndTime = (value) => {
  const parts = indiaParts(value);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};

const MONTHS = Object.freeze({ Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' });

export function providerScheduleIso(journeyDate, time) {
  const dateMatch = /^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/.exec(String(journeyDate || ''));
  const timeMatch = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(String(time || '').trim());
  if (!dateMatch || !timeMatch || !MONTHS[dateMatch[2]]) return null;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  hour = hour % 12 + (timeMatch[3].toUpperCase() === 'PM' ? 12 : 0);
  const iso = `${dateMatch[3]}-${MONTHS[dateMatch[2]]}-${dateMatch[1]}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`;
  return Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString() : null;
}

const validSeq = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;
const waypointForPlace = (waypoints, placeId) => waypoints.find((point) => point.placeId === placeId);
const hasMarker = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

export function classifyStopProgress({ bus, stop, now = Date.now() }) {
  const waypoints = Array.isArray(bus.waypoints) ? bus.waypoints : [];
  const currentSeq = validSeq(bus.currentSeqNo) ? Number(bus.currentSeqNo) : null;
  const gps = bus.positionUnavailable ? 'stale' : gpsQuality(bus.position, now);
  const mapped = waypointForPlace(waypoints, stop.placeId);
  const currentWaypoint = currentSeq === null ? null : waypoints.find((point) => Number(point.seqNo) === currentSeq);
  const currentStopName = currentWaypoint?.name || bus.previousStopName || null;
  const distanceKm = bus.position ? Math.round(haversineKm(bus.position, stop) * 10) / 10 : null;

  if (mapped) {
    const selectedSeq = Number(mapped.seqNo);
    const departed = hasMarker(mapped.vtsDepartureTime) || (currentSeq !== null && currentSeq > selectedSeq);
    if (departed) return { passed: true, stopProgress: 'passed', progressQuality: 'provider-waypoint',
      currentStopName, stopsAway: 0, distanceKm, selectedStopScheduledAt: mapped.scheduledAt || null };
    const arrived = hasMarker(mapped.vtsArrivalTime);
    if (arrived && !hasMarker(mapped.vtsDepartureTime) && gps === 'recent' && distanceKm !== null && distanceKm <= .5) {
      return { passed: false, stopProgress: 'at-stop', progressQuality: 'provider-waypoint',
        currentStopName: mapped.name || currentStopName, stopsAway: 0, distanceKm,
        selectedStopScheduledAt: mapped.scheduledAt || null };
    }
    if (currentSeq !== null && currentSeq < selectedSeq && gps === 'recent') {
      return { passed: false, stopProgress: 'approaching', progressQuality: 'provider-waypoint',
        currentStopName, stopsAway: selectedSeq - currentSeq, distanceKm,
        selectedStopScheduledAt: mapped.scheduledAt || null };
    }
    return { passed: false, stopProgress: gps === 'stale' ? 'last-known' : gps === 'unavailable' ? 'gps-unavailable' : 'uncertain',
      progressQuality: 'provider-waypoint', currentStopName, stopsAway: null, distanceKm,
      selectedStopScheduledAt: mapped.scheduledAt || null };
  }

  const segment = UNMAPPED_STOP_SEGMENTS[stop.placeId];
  if (!segment || segment.routeCode !== bus.routeCode) return { passed: true, stopProgress: 'unsupported',
    progressQuality: 'unavailable', currentStopName, stopsAway: null, distanceKm, selectedStopScheduledAt: null };
  const before = waypointForPlace(waypoints, segment.before);
  const after = waypointForPlace(waypoints, segment.after);
  if (!before || !after || currentSeq === null) return { passed: false,
    stopProgress: gps === 'stale' ? 'last-known' : gps === 'unavailable' ? 'gps-unavailable' : 'uncertain',
    progressQuality: 'surrounding-waypoints', currentStopName, stopsAway: null, distanceKm, selectedStopScheduledAt: null };
  const beforeSeq = Number(before.seqNo);
  const afterSeq = Number(after.seqNo);
  if (currentSeq >= afterSeq || hasMarker(after.vtsArrivalTime) || hasMarker(after.vtsDepartureTime)) {
    return { passed: true, stopProgress: 'passed', progressQuality: 'surrounding-waypoints',
      currentStopName, stopsAway: null, distanceKm, selectedStopScheduledAt: null };
  }
  if ((currentSeq < beforeSeq || (currentSeq === beforeSeq && !hasMarker(before.vtsDepartureTime))) && gps === 'recent') return { passed: false, stopProgress: 'approaching',
    progressQuality: 'surrounding-waypoints', currentStopName, stopsAway: null, distanceKm, selectedStopScheduledAt: null };
  return { passed: false, stopProgress: gps === 'stale' ? 'last-known' : gps === 'unavailable' ? 'gps-unavailable' : 'uncertain',
    progressQuality: 'surrounding-waypoints', currentStopName, stopsAway: null, distanceKm, selectedStopScheduledAt: null };
}

export function buildStopTrackingOptions(snapshot, stop, { routeCode, scheduledOriginAt, now = Date.now() } = {}) {
  const requested = scheduledOriginAt ? indiaDateAndTime(scheduledOriginAt) : null;
  const today = indiaDateAndTime(now).date;
  if (requested && requested.date > today) return { plannedTripMatch: 'future', options: [], matchedPassed: false };
  const eligible = snapshot.buses.filter((bus) => bus.direction === 'to-airport' &&
    (!routeCode || bus.routeCode === routeCode) && (!bus.routeCode || stop.routeCodes.includes(bus.routeCode)));
  const evaluated = eligible.map((bus) => ({ ...bus, ...classifyStopProgress({ bus, stop, now }) }));
  const exact = requested ? evaluated.filter((bus) => {
    if (!bus.routeOriginScheduledAt) return false;
    const origin = indiaDateAndTime(bus.routeOriginScheduledAt);
    return origin.date === requested.date && origin.time === requested.time;
  }) : [];
  let plannedTripMatch = scheduledOriginAt ? exact.length === 1 ? exact[0].passed ? 'passed' : 'exact' : exact.length > 1 ? 'ambiguous' : 'route-only' : 'not-requested';
  const rank = { 'at-stop': 0, approaching: 1, uncertain: 2, 'last-known': 3, 'gps-unavailable': 4 };
  const options = evaluated.filter((bus) => !bus.passed && bus.stopProgress !== 'unsupported').sort((left, right) => {
    const exactDifference = Number(!exact.includes(left)) - Number(!exact.includes(right));
    if (exactDifference) return exactDifference;
    const statusDifference = (rank[left.stopProgress] ?? 9) - (rank[right.stopProgress] ?? 9);
    if (statusDifference) return statusDifference;
    const stopDifference = (left.stopsAway ?? 999) - (right.stopsAway ?? 999);
    if (stopDifference) return stopDifference;
    return Date.parse(left.selectedStopScheduledAt || '9999-12-31') - Date.parse(right.selectedStopScheduledAt || '9999-12-31');
  }).slice(0, 3);
  return { plannedTripMatch, options, matchedPassed: exact.some((bus) => bus.passed) };
}

export const officialTripUrl = (id) =>
  `${APSRTC_TRACKING_URL}#/trip_details?serviceDocId=${encodeURIComponent(id)}`;

export function reconcileGps(previous, next, now = Date.now()) {
  if (gpsQuality(next, now) === 'unavailable') return { position: null, rejected: false };
  if (gpsQuality(previous, now) !== 'unavailable') {
    const elapsed = Date.parse(next.updatedAt) - Date.parse(previous.updatedAt);
    const distance = haversineKm(previous, next);
    // A broad 200 km/h ceiling plus 500 m GPS tolerance; never interpolate a correction.
    if (elapsed < 0 || (elapsed <= 600_000 && distance > .5 + Math.max(0, elapsed) / 3_600_000 * 200)) {
      return { position: previous, rejected: true };
    }
  }
  return { position: next, rejected: false };
}
