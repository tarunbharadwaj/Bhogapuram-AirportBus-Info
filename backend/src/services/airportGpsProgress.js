import { RECLAIM_PLACE_IDS } from '../../../shared/liveTracking.mjs';
import shapes from '../../../shared/reclaimAirportShapes.json' with { type: 'json' };

const ROUTE_TOLERANCE_METERS = 125;
const STOP_CLEARANCE_METERS = 90;
const MIN_MOVING_SPEED_KPH = 8;
const HEADING_ALIGNMENT = Math.cos(55 * Math.PI / 180);

// Convert the airport corridor to local east/north metres for segment projection.
function metres([lat, lng]) {
	return [(lng - 83) * 111_320 * Math.cos(18 * Math.PI / 180), (lat - 18) * 111_320];
}

function project([x, y], segment) {
	const { start, dx, dy, length, offset } = segment;
	const fraction = ((x - start[0]) * dx + (y - start[1]) * dy) / (length * length);
	const clamped = Math.max(0, Math.min(1, fraction));
	return {
		along: offset + clamped * length,
		away: Math.hypot(x - start[0] - clamped * dx, y - start[1] - clamped * dy)
	};
}

function prepareShape({ points, stopIds, stops }) {
	const vertices = points.map(metres);
	const segments = [];
	let length = 0;
	for (let index = 1; index < vertices.length; index += 1) {
		const start = vertices[index - 1];
		const dx = vertices[index][0] - start[0];
		const dy = vertices[index][1] - start[1];
		const distance = Math.hypot(dx, dy);
		if (!distance) continue;
		segments.push({ start, dx, dy, length: distance, offset: length });
		length += distance;
	}
	const stopOffsets = stops.map((stop) => {
		const point = metres(stop);
		return segments.map((segment) => project(point, segment)).sort((left, right) => left.away - right.away)[0];
	});
	if (stopOffsets.some(({ away, along }, index) => away > 300 || (index > 0 && along <= stopOffsets[index - 1].along))) return null;
	return { segments, stopOffsets, stopIds, length };
}

const routeShapes = new Map(Object.entries(shapes).map(([key, shape]) => [key, prepareShape(shape)]));

export function estimateAirportStopProgress(bus, bearing, schedule) {
	if (!(bus.speedKph >= MIN_MOVING_SPEED_KPH) || !Number.isFinite(bearing) || bearing < 0 || bearing >= 360) return null;
	const shape = routeShapes.get(`${bus.routeCode}:${bus.direction}`);
	if (!shape || shape.stopIds.length !== schedule.stopIds.length || shape.stopIds.some((id, index) => id !== schedule.stopIds[index])) return null;
	const fixTime = Date.parse(bus.position.updatedAt);
	const latestPlausible = Date.parse(bus.scheduledStops.at(-1).scheduledAt) + 90 * 60_000;
	if (fixTime < Date.parse(bus.scheduledOriginAt) || fixTime > latestPlausible) return null;

	const point = metres([bus.position.lat, bus.position.lng]);
	const heading = bearing * Math.PI / 180;
	const east = Math.sin(heading);
	const north = Math.cos(heading);
	const candidates = shape.segments
		.filter(({ dx, dy, length }) => (dx * east + dy * north) / length >= HEADING_ALIGNMENT)
		.map((segment) => project(point, segment))
		.filter(({ away }) => away <= ROUTE_TOLERANCE_METERS)
		.sort((left, right) => left.away - right.away);
	const nearest = candidates[0];
	if (!nearest || nearest.along < 40 || nearest.along > shape.length - 40) return null;
	// A loop or parallel street may fit the same GPS fix at very different points in the trip.
	if (candidates.some(({ away, along }) => away <= nearest.away + 25 && Math.abs(along - nearest.along) > 300)) return null;
	const nextIndex = shape.stopOffsets.findIndex(({ along }) => along >= nearest.along - STOP_CLEARANCE_METERS);
	if (nextIndex < 0) return null;
	return {
		nextStopId: RECLAIM_PLACE_IDS.get(shape.stopIds[nextIndex]),
		passedStopIds: shape.stopIds.slice(0, nextIndex).map((id) => RECLAIM_PLACE_IDS.get(id)),
		nextSequence: nextIndex + 1
	};
}
