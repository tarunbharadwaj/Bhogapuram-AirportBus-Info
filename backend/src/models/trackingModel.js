import { canonicalPlaceForWaypoint, inferTrackingRoute, providerScheduleIso } from '../../../shared/liveTracking.mjs';

const BASE = 'https://firestore.googleapis.com/v1/projects/apsrtc-uts-prod/databases/(default)/documents';
const FIELDS = ['serviceDocId', 'serviceType', 'vehicleNumber', 'routeName', 'sourceName',
  'destinationName', 'journeyDate', 'tripNumber', 'tripStatus', 'enableTracking',
  'currentSeqNo', 'prevBoardingPoint'];
const WAYPOINT_FIELDS = ['seqNo', 'wayPointName', 'placeName', 'latitude', 'longitude',
  'scheduleArrTime', 'vtsArrivalTime', 'vtsDepartureTime'];
const AIRPORT = 'VISAKHAPATNAM ASR INTERNATIONAL AIRPORT';
const ID = /^\d{8}_[A-Z0-9-]{1,20}_\d{1,3}_GAJUWAKA2$/;
export const fieldValue = (field) => field?.stringValue ?? field?.doubleValue ?? field?.integerValue ?? null;

export class TrackingUpstreamError extends Error {
  constructor(status = 502) { super('Tracking provider unavailable'); this.status = status; }
}

export class TrackingModel {
  constructor({ fetchImpl = globalThis.fetch } = {}) { this.fetch = fetchImpl; }

  async request(path, signal, body) {
    const response = await this.fetch(`${BASE}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
      redirect: 'error',
    });
    if (!response.ok) throw new TrackingUpstreamError(response.status);
    return response.json();
  }

  async discover(date, signal) {
    const equal = (fieldPath, stringValue) => ({ fieldFilter: {
      field: { fieldPath }, op: 'EQUAL', value: { stringValue },
    } });
    const response = await this.request(':runQuery', signal, { structuredQuery: {
      select: { fields: FIELDS.map((fieldPath) => ({ fieldPath })) },
      from: [{ collectionId: 'serviceDetails' }],
      where: { compositeFilter: { op: 'AND', filters: [equal('serviceType', 'AERO EXPRESS'), equal('journeyDate', date)] } },
      limit: 100,
    } });
    if (!Array.isArray(response) || response.some((row) => row.error || (!row.document && !row.readTime))) {
      throw new TrackingUpstreamError();
    }
    const documents = response.filter((row) => row.document).map((row) => row.document);
    const trips = documents.flatMap((doc) => {
      const values = Object.fromEntries(FIELDS.map((key) => [key, fieldValue(doc.fields?.[key])]));
      const id = doc.name?.split('/').at(-1);
      if (!ID.test(id || '') || values.serviceType !== 'AERO EXPRESS' || values.journeyDate !== date ||
          !/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(values.vehicleNumber || '') ||
          !/^\d{1,3}$/.test(values.tripNumber || '')) return [];
      const direction = values.sourceName === AIRPORT ? 'from-airport' : values.destinationName === AIRPORT ? 'to-airport' : null;
      if (!direction) return [];
      return [{ id, vehicleNumber: values.vehicleNumber, tripNumber: Number(values.tripNumber),
        direction, tripStatus: values.tripStatus, trackingEnabled: values.enableTracking === '1', date,
        currentSeqNo: Number.isInteger(Number(values.currentSeqNo)) ? Number(values.currentSeqNo) : null,
        previousStopName: typeof values.prevBoardingPoint === 'string' ? values.prevBoardingPoint.slice(0, 100) : null }];
    });
    return { trips, limited: documents.length >= 100 };
  }

  async position(trip, signal) {
    if (!ID.test(trip.id)) throw new TrackingUpstreamError();
    const mask = ['latitude', 'longitude', 'refreshedAt', 'vehicleNumber']
      .map((key) => `mask.fieldPaths=${key}`).join('&');
    const doc = await this.request(`/trackingDetailsV2/${trip.id}?${mask}`, signal);
    if (!doc?.fields) throw new TrackingUpstreamError();
    if (fieldValue(doc.fields.vehicleNumber) !== trip.vehicleNumber) return null;
    const raw = ['latitude', 'longitude', 'refreshedAt'].map((key) => fieldValue(doc.fields[key]));
    if (raw.some((value) => value === null || value === '' || typeof value === 'boolean')) return null;
    const [lat, lng, time] = raw.map(Number);
    if (!Number.isFinite(time) || time < 1e12 || time > 8.64e15) return null;
    return { lat, lng, updatedAt: new Date(time).toISOString() };
  }

  async waypoints(trip, signal) {
    if (!ID.test(trip.id)) throw new TrackingUpstreamError();
    const mask = WAYPOINT_FIELDS.map((key) => `mask.fieldPaths=${key}`).join('&');
    const result = await this.request(`/serviceDetails/${trip.id}/wayPoints?pageSize=50&${mask}`, signal);
    if (!result || result.nextPageToken || (result.documents && !Array.isArray(result.documents))) throw new TrackingUpstreamError();
    const documents = result.documents || [];
    const routeCode = inferTrackingRoute(documents.map((doc) => doc.name?.split('/').at(-1) || ''));
    const waypoints = documents.flatMap((doc) => {
      const waypointId = doc.name?.split('/').at(-1) || '';
      const seqNo = Number(fieldValue(doc.fields?.seqNo));
      const placeId = canonicalPlaceForWaypoint(waypointId);
      if (!placeId || !Number.isInteger(seqNo) || seqNo < 0) return [];
      const rawLat = Number(fieldValue(doc.fields?.latitude));
      const rawLng = Number(fieldValue(doc.fields?.longitude));
      const schedule = fieldValue(doc.fields?.scheduleArrTime);
      return [{
        placeId,
        seqNo,
        name: String(fieldValue(doc.fields?.wayPointName) || fieldValue(doc.fields?.placeName) || '').slice(0, 100),
        lat: Number.isFinite(rawLat) ? rawLat : null,
        lng: Number.isFinite(rawLng) ? rawLng : null,
        scheduledAt: providerScheduleIso(trip.date, schedule),
        vtsArrivalTime: fieldValue(doc.fields?.vtsArrivalTime),
        vtsDepartureTime: fieldValue(doc.fields?.vtsDepartureTime)
      }];
    }).sort((left, right) => left.seqNo - right.seqNo);
    return { routeCode, waypoints };
  }
}
