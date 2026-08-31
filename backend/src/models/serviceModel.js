import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	DEFAULT_DATA,
	SERVICE_DATA_SCHEMA_VERSION,
	createDefaultServiceData
} from '../data/defaultData.js';
import { isValidTime, timeToMinutes } from '../../../shared/serviceRouting.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.join(__dirname, '..', '..', 'data', 'service-data.json');
const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizedTimes = (times, label) => {
	if (!Array.isArray(times) || !times.length)
		throw new Error(`${label} must include at least one departure.`);
	if (!times.every(isValidTime)) throw new Error(`${label} contains an invalid time.`);
	return [...times].sort((left, right) => timeToMinutes(left) - timeToMinutes(right));
};

export class ServiceModel {
	constructor(dataFile = defaultDataFile) {
		this.dataFile = dataFile;
		this.data = this.#load();
	}

	#load() {
		try {
			const stored = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
			if (stored.schemaVersion !== SERVICE_DATA_SCHEMA_VERSION) {
				const migrated = createDefaultServiceData();
				migrated.status = { ...migrated.status, ...(stored.status || {}) };
				return this.#normalize(migrated);
			}
			return this.#normalize(stored);
		} catch {
			return clone(DEFAULT_DATA);
		}
	}

	getAll() {
		return this.data;
	}

	replace(payload) {
		const next = this.#normalize(payload);
		fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
		fs.writeFileSync(this.dataFile, `${JSON.stringify(next, null, 2)}\n`);
		this.data = next;
		return this.data;
	}

	#normalize(payload) {
		const next = clone(payload);
		if (!next.status || !Array.isArray(next.routes) || !next.routes.length)
			throw new Error('Invalid service data.');
		if (next.airport?.id === DEFAULT_DATA.airport.id)
			next.airport.name = DEFAULT_DATA.airport.name;
		if (typeof next.status.announcementVisible !== 'boolean')
			next.status.announcementVisible = true;
		next.schemaVersion = SERVICE_DATA_SCHEMA_VERSION;

		for (const route of next.routes) {
			if (!route.timetables)
				throw new Error(`${route.code || 'Route'} is missing directional timetables.`);
			route.timetables.toAirport = normalizedTimes(
				route.timetables.toAirport,
				`${route.code} city-to-airport timetable`
			);
			route.timetables.fromAirport = normalizedTimes(
				route.timetables.fromAirport,
				`${route.code} airport-to-city timetable`
			);
			route.times = [...route.timetables.toAirport];
			route.schedule = {
				start: route.times[0],
				end: route.times.at(-1),
				frequency: null,
				irregular: true
			};

			const duration = Number(route.estimatedJourneyMinutes);
			if (!Number.isFinite(duration) || duration < 1)
				throw new Error(`${route.code} must have a valid estimated journey time.`);
			route.estimatedJourneyMinutes = duration;
			if (!Array.isArray(route.stops) || !route.stops.length)
				throw new Error(`${route.code} must include at least one stop.`);

			route.stops.forEach((stop) => {
				stop.placeId ||= stop.id;
				if (typeof stop.landmark === 'string')
					stop.landmark = stop.landmark.replace(/Bhogapuram/gi, 'Vizag');
				stop.fare = Math.max(0, Number(stop.fare));
				stop.offset = Math.max(0, Number(stop.offset));
				stop.journeyMinutes = Math.max(1, Number(stop.journeyMinutes));
				stop.lat = Number(stop.lat);
				stop.lng = Number(stop.lng);
				if (
					![stop.fare, stop.offset, stop.journeyMinutes, stop.lat, stop.lng].every(
						Number.isFinite
					)
				)
					throw new Error(`${route.code} contains invalid stop data.`);
			});
		}

		return next;
	}
}
