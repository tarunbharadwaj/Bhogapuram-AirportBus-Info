export const LIVE_REFRESH_MS = 30_000;
export const GPS_RECENT_MS = 2 * 60_000;
export const GPS_EXPIRY_MS = 15 * 60_000;

// APSRTC stop IDs from Reclaim's published GTFS stops.txt (ODbL 1.0).
export const RECLAIM_PLACE_IDS = new Map(Object.entries({
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
	'1782812590671': 'bhogapuram-airport'
}));

const placesWithStopUpdates = new Set(RECLAIM_PLACE_IDS.values());
export const supportsLiveStopUpdates = (placeId) => placesWithStopUpdates.has(placeId);

export function gpsAgeMs(position, now = Date.now()) {
	return Math.max(0, now - Date.parse(position.updatedAt));
}
