import { RECLAIM_PLACE_IDS } from '../../../shared/liveTracking.mjs';
import airportShapes from '../../../shared/reclaimAirportShapes.json' with { type: 'json' };
import { haversineKm } from '../../../shared/serviceRouting.mjs';
import asr2CityPaths from './asr2CityRoutePaths.json' with { type: 'json' };

const GPS_ROUTE_NOTICE_METERS = 120;
const METERS_PER_DEGREE = 111_320;

export function isGpsAwayFromRoute(position, routeShape) {
	const { lat, lng } = position ?? {};
	const paths = routeShape?.paths;
	// A partial route can have a gap where the bus is actually travelling.
	if (!Number.isFinite(lat) || !Number.isFinite(lng) || paths?.length !== 1 || paths[0].length < 2) return false;
	const longitudeScale = METERS_PER_DEGREE * Math.cos(lat * Math.PI / 180);
	const path = paths[0];
	for (let index = 1; index < path.length; index += 1) {
		const [startLat, startLng] = path[index - 1];
		const [endLat, endLng] = path[index];
		const x = (startLng - lng) * longitudeScale;
		const y = (startLat - lat) * METERS_PER_DEGREE;
		const dx = (endLng - startLng) * longitudeScale;
		const dy = (endLat - startLat) * METERS_PER_DEGREE;
		const lengthSquared = dx * dx + dy * dy;
		const fraction = lengthSquared ? Math.max(0, Math.min(1, -(x * dx + y * dy) / lengthSquared)) : 0;
		if (Math.hypot(x + fraction * dx, y + fraction * dy) <= GPS_ROUTE_NOTICE_METERS) return false;
	}
	return true;
}

export function getMapRouteShape(routeCode, direction, places) {
	const shape = airportShapes[`${routeCode}:${direction}`];
	if (!shape) return null;

	const corridor = routeCode === 'ASR-2' ? asr2CityPaths[direction] : null;
	const stops = shape.stopIds.map((id, index) => ({
		placeId: RECLAIM_PLACE_IDS.get(id),
		point: shape.stops[index]
	})).filter(({ placeId }) => placeId && (!corridor || !Object.hasOwn(corridor.stops, placeId)));
	if (!corridor) return { paths: [shape.points], stops };

	const corridorStops = Object.entries(corridor.stops).map(([placeId, [lat, lng]]) => ({
		place: places.find((place) => place.placeId === placeId),
		roadPoint: { lat, lng }
	}));
	for (const { place } of corridorStops) {
		if (place) stops.push({ placeId: place.placeId, point: [place.lat, place.lng] });
	}

	const start = shape.points.findIndex(([lat, lng]) => lat === corridor.start[0] && lng === corridor.start[1]);
	const end = shape.points.findIndex(([lat, lng]) => lat === corridor.end[0] && lng === corridor.end[1]);
	if (start < 0 || end <= start) return { paths: [], stops };

	const before = shape.points.slice(0, start + 1);
	const after = shape.points.slice(end);
	// Keep the published portions visible if the configured city stops have moved away from these roads.
	const fitsStops = corridorStops.every(({ place, roadPoint }) => place && haversineKm(place, roadPoint) <= 0.05);
	return {
		paths: fitsStops ? [[...before, ...corridor.points, ...after]] : [before, after],
		stops
	};
}
