import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DATA, buildSchedule } from '../data/defaultData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.join(__dirname, '..', '..', 'data', 'service-data.json');
const clone = (value) => JSON.parse(JSON.stringify(value));

export class ServiceModel {
  constructor(dataFile = defaultDataFile) {
    this.dataFile = dataFile;
    this.data = this.#load();
  }

  #load() {
    try {
      return JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
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
    if (!next.status || !Array.isArray(next.routes)) throw new Error('Invalid service data.');

    for (const route of next.routes) {
      const { start, end, frequency } = route.schedule || {};
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) throw new Error('Invalid schedule time.');
      const safeFrequency = Number(frequency);
      if (safeFrequency < 10 || safeFrequency > 180) throw new Error('Frequency must be between 10 and 180 minutes.');
      route.schedule.frequency = safeFrequency;
      route.times = buildSchedule(start, end, safeFrequency);
      route.stops.forEach((stop) => {
        stop.fare = Math.max(0, Number(stop.fare));
        stop.journeyMinutes = Math.max(1, Number(stop.journeyMinutes));
      });
    }

    return next;
  }
}
